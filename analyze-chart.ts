// By ZyP — Supabase Edge Function "analyze-chart"
// Primește o captură de grafic (JPEG/PNG/WebP, base64) de la aplicație, o trimite la Claude (vision)
// și întoarce analiza ca JSON. Cheia Anthropic stă DOAR aici, ca secret (ANTHROPIC_API_KEY), nu în aplicație.
// Doar utilizatorul logat în aplicația ta poate apela funcția.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const SYSTEM = `Ești un analist de grafice care ajută un trader începător din România (broker XTB, mai ales aur XAUUSD).
Primești O captură de ecran cu un grafic de preț (TradingView, MT5, XTB sau altă aplicație).
Răspunzi EXCLUSIV cu un obiect JSON valid, fără markdown, fără text în afara lui.

REGULI
- Citește doar ce se vede. Dacă un preț nu se poate citi clar, pune null. Nu inventa numere.
- Prețurile sunt numere simple (fără simbol, fără separator de mii). Coordonatele x și y sunt fracții între 0 și 1: x de la stânga la dreapta, y de sus (0) în jos (1), relativ la ÎNTREAGA imagine.
- Tot textul în limba română, scurt și simplu, fără jargon inutil.
- Nu promite profit. Ești educațional. Dacă nu e un grafic de preț, pune "ok": false și explică în "reason".
- Dacă pe poză sunt desenate de utilizator o intrare, un stop loss sau un take profit (unealta Long/Short din TradingView, linii orizontale, linii de poziție MT5 cu SL/TP, săgeți de intrare), le raportezi la "user_trade". Altfel "user_trade": {"found": false}.

FORMAT (toate câmpurile; folosește null unde nu se aplică)
{
 "ok": true,
 "reason": "",
 "symbol": "XAUUSD",
 "timeframe": "M15",
 "price_now": 4300.5,
 "axis": [ {"y": 0.15, "price": 4320}, {"y": 0.85, "price": 4260} ],
 "trend": "up" | "down" | "range",
 "trend_text": "o propoziție despre trend",
 "levels": [ {"price": 4290, "y": 0.52, "type": "support" | "resistance", "strength": 1, "note": "de ce contează"} ],
 "trendlines": [ {"type": "support" | "resistance", "a": {"x": 0.1, "y": 0.8}, "b": {"x": 0.9, "y": 0.4}, "note": ""} ],
 "patterns": ["ex. dublu minim, flag, triunghi, respingere la suport"],
 "user_trade": {"found": true, "side": "BUY" | "SELL", "entry": 4300, "sl": 4285, "tp": 4330, "entry_y": 0.5, "sl_y": 0.6, "tp_y": 0.3,
                "verdict": "bun" | "mediu" | "riscant", "comment": "ce a făcut și de ce e bine sau nu", "good": ["..."], "problems": ["..."]},
 "scenario": {"side": "BUY" | "SELL" | "WAIT", "entry": 4300, "sl": 4285, "tp1": 4325, "tp2": 4345, "why": "motivul", "invalid_if": "când nu mai e valabil"},
 "summary": "2-3 propoziții: ce se întâmplă pe grafic acum",
 "risks": ["ce poate merge prost"]
}

CUM ANALIZEZI
- "axis": 2-4 etichete de pe axa de preț pe care le citești cu siguranță, cu poziția lor y. Aplicația le folosește ca să deseneze corect nivelurile.
- "levels": maximum 6, doar niveluri vizibile (minime/maxime repetate, zone unde prețul s-a întors).
- "trendlines": maximum 2 linii de trend (prin minime pentru suport, prin maxime pentru rezistență), doar dacă sunt clare.
- "user_trade": spune dacă SL-ul e după un nivel real sau în aer, dacă raportul risc:câștig e rezonabil, dacă intrarea e în mijlocul mișcării sau lângă un nivel, dacă TP e înaintea unui obstacol. Fii sincer, dar blând.
- "scenario": un plan realist (BUY, SELL sau WAIT dacă nu e un setup clar). SL se pune dincolo de un nivel real. Fără să forțezi o intrare.`;

function extractJson(text) {
  const t = String(text || '').replace(/```json|```/g, '').trim();
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a < 0 || b <= a) throw new Error('Răspunsul nu conține JSON');
  return JSON.parse(t.slice(a, b + 1));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Doar POST', code: 'method' }, 405);
  try {
    // 1) doar utilizatorul logat
    const auth = req.headers.get('Authorization') || '';
    const u = await fetch(`${Deno.env.get('SUPABASE_URL')}/auth/v1/user`, {
      headers: { Authorization: auth, apikey: req.headers.get('apikey') || '' },
    });
    if (!u.ok) return json({ error: 'Nu ești autentificat. Intră în cont în aplicație.', code: 'auth' }, 401);

    // 2) cheia Anthropic
    const key = Deno.env.get('ANTHROPIC_API_KEY');
    if (!key) return json({ error: 'Lipsește secretul ANTHROPIC_API_KEY în Supabase.', code: 'nokey' }, 500);

    // 3) imaginea
    const body = await req.json();
    const mime = ['image/jpeg', 'image/png', 'image/webp'].includes(body.mime) ? body.mime : 'image/jpeg';
    const image = String(body.image || '');
    if (image.length < 2000) return json({ error: 'Imaginea lipsește sau e prea mică.', code: 'img' }, 400);
    if (image.length > 7_000_000) return json({ error: 'Imaginea e prea mare.', code: 'img' }, 413);
    const ctx = String(body.context || '').slice(0, 2500);

    const model = Deno.env.get('ANTHROPIC_MODEL') || 'claude-sonnet-5-5';
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model,
        max_tokens: 2200,
        temperature: 0.2,
        system: SYSTEM,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mime, data: image } },
            { type: 'text', text: 'Analizează captura și răspunde doar cu JSON-ul cerut.' + (ctx ? '\n\nCONTEXT DE LA UTILIZATOR ȘI DIN APLICAȚIE:\n' + ctx : '') },
          ],
        }],
      }),
    });
    const raw = await r.text();
    if (!r.ok) {
      let msg = raw.slice(0, 300);
      try { msg = JSON.parse(raw).error.message; } catch (_) { /* ignore */ }
      const credit = /credit|billing|balance/i.test(msg);
      return json({ error: credit ? 'Nu mai ai credit în contul Anthropic. Adaugă credit și încearcă din nou.' : 'Eroare Anthropic: ' + msg, code: credit ? 'credit' : 'anthropic' }, 502);
    }
    const data = JSON.parse(raw);
    const text = (data.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('\n');
    let result;
    try { result = extractJson(text); } catch (e) { return json({ error: 'Nu am putut citi analiza. Încearcă din nou.', code: 'parse' }, 502); }
    return json({ result, model, usage: data.usage || null });
  } catch (e) {
    return json({ error: 'Eroare: ' + (e && e.message ? e.message : e), code: 'server' }, 500);
  }
});
