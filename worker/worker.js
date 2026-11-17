// Pawn's AI endpoint on Cloudflare Workers (free plan), answering with Google Gemini (free tier).
// Paste this whole file into a Worker, add the secret GEMINI_API_KEY, deploy, and put the Worker's
// address in js/config.js. The site sends POST {question, lang, context}; this answers {reply}.
// Open the Worker's address in a browser (GET) to see a status check: whether the key is set,
// whether Google accepts it, and which model Pawn will use.

const ALLOWED_ORIGINS = ['https://mz6630.github.io'];
// Tried first. The "-latest" aliases follow Google's current Flash models, so retirements don't break Pawn.
// If none of these work, the Worker asks Google which models this key can use and picks a Flash one.
const PREFERRED = ['gemini-flash-latest', 'gemini-flash-lite-latest'];
const API = 'https://generativelanguage.googleapis.com/v1beta';

let working = null; // the model that answered last, reused while the Worker stays warm
let geminiBlockedUntil = 0; // set when Google refuses this Cloudflare location; Workers AI answers meanwhile

// Backup: Cloudflare's own free models (Workers AI), which have no location limits.
// Turn on by adding a Workers AI binding named AI (Settings > Bindings > Add > Workers AI).
const CF_MODELS = ['@cf/google/gemma-4-26b-a4b-it', '@cf/meta/llama-3.3-70b-instruct-fp8-fast', '@cf/meta/llama-3.1-8b-instruct'];
async function cloudflareAI(env, system, prompt, tried) {
  if (!env.AI) { tried.push('Workers AI: no binding named AI'); return null; }
  for (const model of CF_MODELS) {
    try {
      const out = await env.AI.run(model, {
        messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }],
        max_tokens: 600, temperature: 0.6
      });
      let text = typeof out === 'string' ? out
        : out && (out.response ?? out.choices?.[0]?.message?.content ?? out.result?.response);
      if (typeof text !== 'string') text = '';
      text = text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
      if (text) { working = model; return text; }
      tried.push(`${model}: empty`);
    } catch (e) { tried.push(`${model}: ${String(e.message || e).slice(0, 80)}`); }
  }
  return null;
}

// Google's own error sentence, e.g. "API key not valid" or "User location is not supported".
function googleMessage(text) {
  try { const e = JSON.parse(text).error; return `${e.status || ''} ${e.message || ''}`.trim().slice(0, 200); }
  catch (_) { return text.slice(0, 200); }
}

async function listModels(key) {
  const r = await fetch(`${API}/models?pageSize=200`, { headers: { 'x-goog-api-key': key } });
  const text = await r.text();
  if (!r.ok) return { ok: false, status: r.status, detail: googleMessage(text), models: [] };
  const j = JSON.parse(text);
  const models = (j.models || [])
    .filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
    .map(m => m.name.replace(/^models\//, ''))
    .filter(n => /flash/.test(n) && !/image|tts|audio|live|embed|preview|exp/.test(n));
  // Newest first: sort by the version number in the name, lite after full.
  const ver = n => parseFloat((n.match(/(\d+(?:\.\d+)?)/) || [0, 0])[1]);
  models.sort((a, b) => (ver(b) - ver(a)) || (a.includes('lite') - b.includes('lite')));
  return { ok: true, status: r.status, models };
}

async function generate(model, key, system, prompt) {
  const body = thinking => {
    const generationConfig = { maxOutputTokens: 1024, temperature: 0.6 };
    if (thinking && /^gemini-2\.5/.test(model)) generationConfig.thinkingConfig = { thinkingBudget: 0 };
    return JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig
    });
  };
  const call = thinking => fetch(`${API}/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: body(thinking)
  });
  let r = await call(true);
  if (r.status === 400 && /^gemini-2\.5/.test(model)) r = await call(false); // model refused the thinking setting
  if (!r.ok) return { ok: false, status: r.status, detail: googleMessage(await r.text()) };
  const j = await r.json();
  const reply = ((j.candidates || [])[0]?.content?.parts || []).map(p => p.text || '').join('').trim();
  return reply ? { ok: true, reply } : { ok: false, status: 200, detail: 'empty answer' };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const cors = {
      'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Vary': 'Origin'
    };
    const json = (body, status = 200) => new Response(JSON.stringify(body, null, 2), { status, headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8' } });
    // Strip spaces, line breaks and quotes that often sneak in when the key is pasted.
    const key = (env.GEMINI_API_KEY || '').trim().replace(/^["'`]+|["'`]+$/g, '').trim();

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    // Status check: open the Worker's address in a browser. It lists models only (no answer is generated).
    if (request.method === 'GET') {
      if (!key) return json({ ok: false, problem: 'GEMINI_API_KEY is not set. Add it under Settings > Variables and Secrets as a Secret, then deploy.' });
      const list = await listModels(key);
      if (!list.ok) return json({ ok: false, problem: `Google refused the request (HTTP ${list.status}).`, google: list.detail, where: request.cf && request.cf.colo, keyLooksLike: key.slice(0, 4) + '…' + key.slice(-2) + ` (${key.length} chars)` });
      return json({ ok: true, message: 'The key works. Pawn will try these models in order.', try: [...PREFERRED, ...list.models.filter(m => !PREFERRED.includes(m))].slice(0, 8), backup: env.AI ? 'Workers AI is on' : 'Workers AI backup is off (add a Workers AI binding named AI)', where: request.cf && request.cf.colo });
    }

    if (request.method !== 'POST') return json({ error: 'POST only' }, 405);
    if (!ALLOWED_ORIGINS.includes(origin)) return json({ error: `Origin not allowed: ${origin || '(none)'}` }, 403);
    if (!key) return json({ error: 'GEMINI_API_KEY is not set' }, 500);

    let data;
    try { data = await request.json(); } catch (e) { return json({ error: 'Bad JSON' }, 400); }
    const { question, lang, context } = data || {};
    if (typeof question !== 'string' || !question.trim() || question.length > 400) return json({ error: 'Bad question' }, 400);

    const system = [
      'You are Pawn, a friendly chess tutor on the First Gambit website, a site for complete beginners.',
      `Answer in ${lang === 'ko' ? 'Korean' : 'English'}, warmly and plainly, in at most 120 words. Plain text only, no markdown.`,
      'Use the situation you are given: the section of the site the visitor is on, the board (each piece with its home square, current square and whether it has been knocked over) and the site\'s own analysis of their moves.',
      'The board starts from the Queen\'s Gambit position (1. d4 d5 2. c4). Explain why a move is good or bad, suggest one concrete next step, and use algebraic notation.',
      'If the question has nothing to do with chess or the site, say kindly that you can only help with chess.'
    ].join(' ');
    const prompt = `Situation: ${JSON.stringify(context || {}).slice(0, 6000)}\n\nQuestion: ${question}`;

    const tried = [];
    let locationBlocked = false;
    const attempt = async model => {
      const res = await generate(model, key, system, prompt);
      if (res.ok) { working = model; return res.reply; }
      tried.push(`${model}: ${res.status}`);
      console.log(model, res.status, res.detail);
      if (/location is not supported/i.test(res.detail)) locationBlocked = true;
      if (res.status === 429) tried.push('(free-tier limit reached; wait a minute)');
      return null;
    };

    let reply = null;
    if (Date.now() > geminiBlockedUntil) {
      const first = working && !working.startsWith('@cf/') ? [working] : [];
      for (const m of [...first, ...PREFERRED].filter((m, i, a) => a.indexOf(m) === i)) {
        if ((reply = await attempt(m)) || locationBlocked) break;
      }
      if (!reply && !locationBlocked) {
        const list = await listModels(key);
        if (!list.ok) tried.push(`Google: ${list.detail}`);
        for (const m of list.models.filter(m => !PREFERRED.includes(m)).slice(0, 4)) {
          if ((reply = await attempt(m)) || locationBlocked) break;
        }
      }
      // Google refuses some Cloudflare locations; skip it for 10 minutes and let Workers AI answer.
      if (locationBlocked) { geminiBlockedUntil = Date.now() + 10 * 60 * 1000; tried.push('Gemini: location not supported'); }
    }
    if (!reply) reply = await cloudflareAI(env, system, prompt, tried);
    return reply ? json({ reply, model: working }) : json({ error: 'AI unavailable', tried }, 502);
  }
};
