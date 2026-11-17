// Pawn's AI endpoint: a Firebase function that keeps the Anthropic API key secret.
// The site sends POST {question, lang, context}; this answers {reply}.
const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');

const ANTHROPIC_API_KEY = defineSecret('ANTHROPIC_API_KEY');
const MODEL = 'claude-haiku-5-5';                 // fast and inexpensive; 'claude-sonnet-5-5' answers more deeply
const ALLOWED_ORIGINS = ['https://mz6630.github.io'];

exports.tutor = onRequest(
  { secrets: [ANTHROPIC_API_KEY], cors: ALLOWED_ORIGINS, region: 'asia-northeast3', maxInstances: 3, timeoutSeconds: 30 },
  async (req, res) => {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
    const { question, lang, context } = req.body || {};
    if (typeof question !== 'string' || !question.trim() || question.length > 400) return res.status(400).json({ error: 'Bad question' });

    const system = [
      'You are Pawn, a friendly chess tutor on the First Gambit website, a site for complete beginners.',
      `Answer in ${lang === 'ko' ? 'Korean' : 'English'}, warmly and plainly, in at most 120 words. No markdown headings or tables.`,
      'Use the situation you are given: the section of the site the visitor is on, the board (each piece with its home square, current square and whether it has been knocked over) and the site\'s own analysis of their moves.',
      'The board starts from the Queen\'s Gambit position (1. d4 d5 2. c4). Explain why a move is good or bad, suggest one concrete next step, and use algebraic notation.',
      'If the question has nothing to do with chess or the site, say kindly that you can only help with chess.'
    ].join(' ');

    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': ANTHROPIC_API_KEY.value(), 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 400,
          system,
          messages: [{ role: 'user', content: `Situation: ${JSON.stringify(context || {}).slice(0, 6000)}\n\nQuestion: ${question}` }]
        })
      });
      if (!r.ok) { console.error('Anthropic API', r.status, await r.text()); return res.status(502).json({ error: 'AI unavailable' }); }
      const j = await r.json();
      const reply = (j.content || []).filter(c => c.type === 'text').map(c => c.text).join('\n').trim();
      return res.json({ reply });
    } catch (e) {
      console.error(e);
      return res.status(502).json({ error: 'AI unavailable' });
    }
  }
);
