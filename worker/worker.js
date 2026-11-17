// Pawn's AI endpoint on Cloudflare Workers (free plan), answering with Google Gemini (free tier).
// Paste this whole file into a Worker, add the secret GEMINI_API_KEY, deploy, and put the Worker's
// address in js/config.js. The site sends POST {question, lang, context}; this answers {reply}.

const ALLOWED_ORIGINS = ['https://mz6630.github.io'];
// Tried in order: if one is busy or unavailable on the free tier, the next one answers.
const MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite'];

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const cors = {
      'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Vary': 'Origin'
    };
    const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST') return json({ error: 'POST only' }, 405);
    if (!ALLOWED_ORIGINS.includes(origin)) return json({ error: 'Not allowed' }, 403);
    if (!env.GEMINI_API_KEY) return json({ error: 'GEMINI_API_KEY is not set' }, 500);

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

    for (const model of MODELS) {
      const generationConfig = { maxOutputTokens: 500, temperature: 0.6 };
      if (model.startsWith('gemini-2.5')) generationConfig.thinkingConfig = { thinkingBudget: 0 };
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig
        })
      });
      if (!r.ok) { console.log(model, r.status, (await r.text()).slice(0, 300)); continue; }
      const j = await r.json();
      const reply = ((j.candidates || [])[0]?.content?.parts || []).map(p => p.text || '').join('').trim();
      if (reply) return json({ reply });
    }
    return json({ error: 'AI unavailable' }, 502);
  }
};
