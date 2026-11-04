// By ZyP — push bot, run by GitHub Actions every ~5 minutes.
// Sends: motivation at 08:30 / 14:30 / 21:30, supplements at 09:00 / 20:00 / 22:00, Ethereum summary 10:00 / 18:00 + news (local time) and a warning before every red (High) news.
import webpush from 'web-push';
import fs from 'fs';

const PUBLIC = process.env.VAPID_PUBLIC || 'BEbAlapGPODbyKuDao4BL5sEJyF3m3ax0rr2BTNTqD2pzMEivOj-3BqgZL2Y2FjYd0uha2TgsUW1EIteOKnH9ns';
const PRIVATE = process.env.VAPID_PRIVATE;
const SUB = process.env.PUSH_SUB;
const TZ = process.env.APP_TZ || 'Atlantic/Canary';
const TEST = process.env.TEST_PUSH === 'true';
const STATE = 'sent.json';
let sent = {}; try { sent = JSON.parse(fs.readFileSync(STATE, 'utf8')); } catch (e) {}
const GOLD_PUSH = false; // alertele și știrile pe aur sunt oprite pentru moment (pune true ca să revină)
const status = Array.isArray(sent._status) ? sent._status : [];
let changed = false;
// a wrong secret must NOT crash the run (red X + e-mails every 5 min): log it, show it in the app (Profil → Notificări) and stop quietly
function bail(msg) {
  console.log('CONFIG ERROR:', msg);
  const last = status[status.length - 1];
  if (!(last && last.code === 'config' && last.err === msg)) { status.push({ t: new Date().toISOString(), title: 'Configurare notificări', ok: false, code: 'config', err: msg }); sent._status = status.slice(-15); fs.writeFileSync(STATE, JSON.stringify(sent)); }
  process.exit(0);
}
if (!PRIVATE || (!SUB && !process.env.BYZYP_KEY)) { console.log('Secrets missing (VAPID_PRIVATE and PUSH_SUB or BYZYP_KEY) — nothing to do.'); process.exit(0); }
try { webpush.setVapidDetails('mailto:byzyp@users.noreply.github.com', PUBLIC, PRIVATE.trim()); }
catch (e) { bail('VAPID_PRIVATE nu e valid sau nu se potrivește cu cheia publică din aplicație.'); }
// subscriptions: (1) the phone saves its own code in the account (Supabase) — read here with the private key BYZYP_KEY; (2) fallback: the PUSH_SUB secret
let subs = [];
const okSub = (x) => x && x.endpoint && x.keys;
const KEY = process.env.BYZYP_KEY;
if (KEY) {
  try {
    const r = await fetch('https://bskujbfaynbeqjonqydb.supabase.co/rest/v1/rpc/get_push_subs', { method: 'POST',
      headers: { apikey: 'sb_publishable_iFv52BsojpLXTxuBzqGU1Q_cCFVZUAX', 'Content-Type': 'application/json' }, body: JSON.stringify({ p_secret: KEY.trim() }) });
    if (r.ok) { const j = await r.json(); subs = (Array.isArray(j) ? j : []).filter(okSub); console.log('subscriptions from account:', subs.length); }
    else console.log('account lookup failed: HTTP', r.status);
  } catch (e) { console.log('account lookup failed:', e.message); }
}
if (SUB && SUB.trim()) {
  try { const j = JSON.parse(SUB.trim()); for (const x of (Array.isArray(j) ? j : [j])) if (okSub(x) && !subs.some(y => y.endpoint === x.endpoint)) subs.push(x); }
  catch (e) { if (!subs.length) bail('PUSH_SUB nu e un cod valid. Copiază din nou codul întreg din aplicație și lipește-l în secret.'); }
}
if (!subs.length) bail('Nu am niciun cod de telefon. În aplicație: Profil → Notificări → Activează (codul se salvează singur în cont).');

function local(d) {
  const p = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', weekday:'short', hour12:false })
    .formatToParts(d).reduce((o, x) => (o[x.type] = x.value, o), {});
  return { date: `${p.year}-${p.month}-${p.day}`, hm: +p.hour * 60 + +p.minute, wd: p.weekday, hhmm: `${p.hour}:${p.minute}` };
}
async function send(title, body, tag, url) {
  let ok = false;
  for (const s of subs) {
    try { const r = await webpush.sendNotification(s, JSON.stringify({ title, body, tag, url: url || './' }), { TTL: 1800, urgency: 'high' });
      ok = true; console.log('sent:', title, r && r.statusCode); status.push({ t: new Date().toISOString(), title, ok: true, code: r && r.statusCode }); }
    catch (e) { console.log('push error', e.statusCode, e.body || e.message); status.push({ t: new Date().toISOString(), title, ok: false, code: e.statusCode || 0, err: String(e.body || e.message).slice(0, 120) }); }
  }
  changed = true;
  return ok;
}

const now = new Date();
const L = local(now);

if (TEST) { await send('By ZyP ✅', 'Notificările funcționează! Ne auzim la cafea. ☕', 'test'); }

// ---------- motivation ----------
const MOT = {
  Mon: ['☕ ZyP, cafeaua merge și fără țigară. Săptămână nouă, pornește curat.', '🚭 Poftă după masă? Trece în 3–5 minute. Un pahar de apă și gata.', '✅ Ai bifat azi toate 5? Deschide aplicația și închide ziua cum trebuie.'],
  Tue: ['🌅 Bună dimineața, ZyP. Fiecare dimineață fără fum e o victorie.', '🧠 Pofta e doar un obicei vechi care bate la ușă. Nu-i deschide.', '🌙 Încă o zi fără țigări, ZyP. Mândru de tine. Mâine la fel.'],
  Wed: ['💪 Azi e zi de sală. Omul care ai hotărât să devii nu sare peste.', '💶 Banii pe care nu-i mai dai pe țigări construiesc libertatea ta financiară.', '⚖️ Notează greutatea și bifează ziua. Ce se măsoară, se îmbunătățește.'],
  Thu: ['☕ Cafea, apă, fără zahăr. Ești mai puternic decât pofta.', '🍎 Fără dulce, ZyP. Un fruct, nuci sau apă — corpul îți mulțumește.', '📚 10 minute de citit despre bani înainte de somn. Investește în tine.'],
  Fri: ['🚀 Vineri, ZyP. Încă o săptămână de viață nouă aproape bifată.', '📈 Disciplina de azi e profitul de mâine. Exact ca în trading.', '🏆 Fiecare zi bifată te apropie de o medalie nouă în Profil.'],
  Sat: ['💪 Sâmbătă. Antrenament sau odihnă planificată — oricare ar fi, rămâi pe drum.', '🫁 Cu fiecare săptămână fără fum respiri mai ușor la efort.', '💤 Somn devreme, ZyP. Mușchii și voința se refac noaptea.'],
  Sun: ['🌿 Duminică liniștită. Odihnă, nu scuze. Fără țigări și azi.', '🔥 Nu da tot înapoi pentru o singură țigară. Ai ajuns prea departe.', '🗓️ Pregătește săptămâna: antrenamente, mâncare, obiective.']
};
const SLOTS = [8 * 60 + 30, 14 * 60 + 30, 21 * 60 + 30];
for (let i = 0; i < SLOTS.length; i++) {
  const key = `m-${L.date}-${i}`;
  if (L.hm >= SLOTS[i] && L.hm < SLOTS[i] + 40 && !sent[key]) {
    const GYM = { Mon: 'Push (piept, umeri, triceps)', Tue: 'Pull (spate, biceps)', Wed: 'Picioare', Thu: 'Upper (partea de sus)', Fri: 'Lower (picioare)' };
    const gym = i === 0 && GYM[L.wd];
    const title = gym ? '🏋️ La sală, ZyP!' : 'By ZyP';
    const body = gym ? `E 8:30. Pleacă la sală acum și termină antrenamentul (${GYM[L.wd]}), că ai de plecat la muncă. Nu mai sta pe telefon!` : MOT[L.wd][i];
    if (await send(title, body, gym ? 'sala' : 'motivatie')) { sent[key] = Date.now(); changed = true; }
  }
}


// ---------- supplements: 09:00 / 20:00 / 22:00 (local time) ----------
const SUPP = [
  { h: 9 * 60, k: 'am', title: '🤦 Băi prostule, vitaminele!', body: 'Se apropie 9:00. Ia-ți D3 + K2, Omega 3 și creatina 5 g cu micul dejun (au nevoie de grăsime) și un pahar de apă.' },
  { h: 20 * 60 + 30, k: 'zn', title: '🤦 Băi prostule, zincul!', body: 'Se apropie cina. Ia zincul cu mâncarea, nu pe stomacul gol, ca să nu te supere.' },
  { h: 22 * 60, k: 'mg', title: '🤦 Băi prostule, magneziul!', body: 'Se apropie somnul. Ia magneziul acum, te ajută să dormi și să te refaci.' }
];
for (const s of SUPP) {
  const key = `s-${L.date}-${s.k}`;
  if (L.hm >= s.h - 15 && L.hm < s.h + 50 && !sent[key]) {
    if (await send(s.title, s.body, 'supl-' + s.k)) { sent[key] = Date.now(); changed = true; }
  }
}


// ---------- Ethereum: price + your gain, news (needs no keys; position comes inside the phone code) ----------
const ETHPOS = subs.map(x => x.eth).find(e => e && +e.invested > 0 && +e.qty > 0);
const eur = (n, d = 2) => n.toLocaleString('ro-RO', { minimumFractionDigits: d, maximumFractionDigits: d }) + ' €';
const sgnE = (n, d = 2) => (n >= 0 ? '+' : '−') + Math.abs(n).toLocaleString('ro-RO', { minimumFractionDigits: d, maximumFractionDigits: d });
async function getJson(url) { const r = await fetch(url, { signal: AbortSignal.timeout(9000), headers: { 'User-Agent': 'ByZyP-bot' } }); if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }
async function ethPrice() {
  try { const j = await getJson('https://api.exchange.coinbase.com/products/ETH-EUR/stats'); const last = +j.last, open = +j.open; if (last > 0) return { p: last, ch: open > 0 ? (last / open - 1) * 100 : null }; } catch (e) { console.log('eth coinbase:', e.message); }
  try { const j = await getJson('https://api.kraken.com/0/public/Ticker?pair=ETHEUR'); const t = Object.values(j.result || {})[0]; const last = +t.c[0], open = +t.o; if (last > 0) return { p: last, ch: open > 0 ? (last / open - 1) * 100 : null }; } catch (e) { console.log('eth kraken:', e.message); }
  return null;
}
async function ethNews() {
  try {
    const r = await fetch('https://cointelegraph.com/rss/tag/ethereum', { signal: AbortSignal.timeout(9000), headers: { 'User-Agent': 'Mozilla/5.0 ByZyP-bot' } });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const x = await r.text(), out = [];
    for (const it of (x.match(/<item>[\s\S]*?<\/item>/g) || []).slice(0, 8)) {
      const g = (t) => { const m = it.match(new RegExp('<' + t + '[^>]*>([\\s\\S]*?)</' + t + '>')); return m ? m[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim() : ''; };
      const t = new Date(g('pubDate')).getTime();
      if (g('title') && g('link') && t) out.push({ title: g('title'), link: g('link'), t });
    }
    return out;
  } catch (e) { console.log('eth news:', e.message); return []; }
}
{
  const inDay = L.hm >= 8 * 60 && L.hm <= 22 * 60 + 30;
  const px = (inDay || TEST) ? await ethPrice() : null;
  const news = inDay ? await ethNews() : [];
  let sentNow = false;
  if (px) {
    let pos = '';
    if (ETHPOS) { const val = ETHPOS.qty * px.p, pl = val - ETHPOS.invested, pc = pl / ETHPOS.invested * 100;
      const day = px.ch != null ? val - val / (1 + px.ch / 100) : null;
      const dayTxt = day != null ? `Azi (24h): ${day >= 0 ? '▲' : '▼'} ${sgnE(day)} € pe banii tăi.\n` : '';
      pos = `${dayTxt}În total: ${sgnE(pl)} € (${sgnE(pc)}%) din ${eur(+ETHPOS.invested, 0)} investiți · valoare acum ${eur(val)}.`; }
    const chTxt = px.ch != null ? ` · ${px.ch >= 0 ? '▲' : '▼'} ${sgnE(px.ch)}% în 24h` : '';
    // two summaries a day: 10:00 and 18:00
    for (const [h, k] of [[10 * 60, 'am'], [18 * 60, 'pm']]) {
      const key = `eth-${L.date}-${k}`;
      if (L.hm >= h && L.hm < h + 50 && !sent[key]) {
        const top = news[0] ? `\n📰 ${news[0].title}` : '';
        if (await send(`Ξ Ethereum ${eur(px.p, 0)}${chTxt}`, (pos || 'Pune suma investită în aplicație (Bani) ca să-ți arăt și câștigul.') + top, 'eth', './#eth')) { sent[key] = Date.now(); changed = true; sentNow = true; }
      }
    }
    // big move: 24h change of 4% or more (once a day per direction)
    if (inDay && px.ch != null && Math.abs(px.ch) >= 4) {
      const key = `eth-mv-${L.date}-${px.ch > 0 ? 'up' : 'dn'}`;
      if (!sent[key]) {
        if (await send(`${px.ch > 0 ? '🚀' : '⚠️'} Ethereum ${px.ch > 0 ? 'a crescut' : 'a scăzut'} ${sgnE(px.ch, 1)}% în 24h`, `Acum ${eur(px.p, 0)}. ` + pos, 'eth-mv', './#eth')) { sent[key] = Date.now(); changed = true; }
      }
    }
  }
  // fresh news (max 2 a day, only articles from the last 2 hours)
  const slots = [1, 2].map(i => `enw-${L.date}-${i}`), used = slots.filter(k => sent[k]).length;
  if (news.length && used < 2 && !sentNow) {
    const nw = news.find(n => now.getTime() - n.t < 2 * 3600000 && now.getTime() - n.t > -600000 && !sent['en-' + n.link]);
    if (nw && await send('📰 Știre Ethereum', nw.title, 'eth-news', nw.link)) { sent['en-' + nw.link] = Date.now(); sent[slots[used]] = Date.now(); changed = true; }
  }
}

// ---------- weekly report: Sunday 20:00 ----------
{
  const key = `w-${L.date}`, slot = 20 * 60;
  if (L.wd === 'Sun' && L.hm >= slot && L.hm < slot + 60 && !sent[key]) {
    if (await send('📊 Raportul săptămânii e gata', 'Vezi cum a mers săptămâna: obiceiuri, greutate, bani, trading și strategiile pe aur. Plus obiectivul pentru săptămâna viitoare.', 'raport', './#raport')) { sent[key] = Date.now(); changed = true; }
  }
}

// ---------- red news, ~10 min before ----------
let news = []; try { news = JSON.parse(fs.readFileSync('news.json', 'utf8')); } catch (e) {}
const soon = !GOLD_PUSH ? [] : news.filter(e => e.impact === 'High' || (e.impact === 'Medium' && e.country === 'USD')).map(e => ({ ...e, t: new Date(e.date) }))
  .filter(e => { const m = (e.t - now) / 60000; return m >= -1 && m <= 13; });
const groups = {};
soon.forEach(e => { const k = e.date; (groups[k] = groups[k] || []).push(e); });
for (const k of Object.keys(groups)) {
  const key = `n-${k}`;
  if (sent[key]) continue;
  const g = groups[k], mins = Math.max(0, Math.round((g[0].t - now) / 60000));
  const red = g.some(e => e.impact === 'High'), ic = red ? '🔴' : '🟠', kind = red ? 'roșie' : 'portocalie (USD)';
  const title = mins > 0 ? `${ic} Știre ${kind} în ${mins} min · ${local(g[0].t).hhmm}` : `${ic} Știre ${kind} ACUM`;
  const body = g.map(e => `${e.impact === 'High' ? '🔴' : '🟠'} ${e.country} — ${e.title}` + (e.forecast ? ` (prognoză ${e.forecast})` : '')).join('\n') + '\nAurul se poate mișca brusc. Atenție la tranzacții.';
  if (await send(title, body, 'stire-' + k)) { sent[key] = Date.now(); changed = true; }
}

// ---------- strategy paper-trade events (written by analyze.py) ----------
let gold = {}; try { gold = JSON.parse(fs.readFileSync('xauusd.json', 'utf8')); } catch (e) {}
const evs = !GOLD_PUSH ? [] : (gold.events || []).filter(e => e && e.id && !sent['e-' + e.id] && (Date.now() - new Date(e.t).getTime()) < 3 * 3600000);
const MAXN = 5;
// every alert says WHEN the price was read and from where (the analysis time), and how late it reaches you if the queue was slow
const stamp = (iso) => new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(new Date(iso));
function withStamp(e) {
  const t = new Date(e.t); if (isNaN(t)) return e.body || '';
  const late = Math.round((Date.now() - t.getTime()) / 60000), src = e.ps ? (/paxg/i.test(e.ps) ? ' (≈ PAXG)' : ` (${e.ps})`) : '';
  return (e.body || '') + `\n🕒 ${stamp(e.t)}` + (e.px ? ` · preț ${Number(e.px).toFixed(2)}${src}` : '') + (late >= 3 ? ` · acum ${late} min` : '');
}
evs.sort((a, b) => (b.id.startsWith('lvl|') ? 1 : 0) - (a.id.startsWith('lvl|') ? 1 : 0));   // support/resistance alerts first: they are the most time-sensitive
for (const e of evs.slice(0, MAXN)) {
  if (await send(e.title, withStamp(e), 'strat-' + e.sid)) { sent['e-' + e.id] = Date.now(); changed = true; }
}
if (evs.length > MAXN) {
  if (await send('🧪 Strategii XAUUSD', `Încă ${evs.length - MAXN} actualizări la tranzacțiile de test. Deschide fila Aur → Istoric.`, 'strat-more')) {
    for (const e of evs.slice(MAXN)) sent['e-' + e.id] = Date.now(); changed = true;
  }
}

// keep state small (last 4 days)
for (const k of Object.keys(sent)) if (!k.startsWith('_') && Date.now() - sent[k] > 4 * 86400000) { delete sent[k]; changed = true; }
sent._status = status.slice(-15);
if (changed) fs.writeFileSync(STATE, JSON.stringify(sent));
console.log('local time', L.date, L.hhmm, L.wd, '| changed:', changed);
