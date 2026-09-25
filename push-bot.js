// By ZyP — push bot, run by GitHub Actions every ~5 minutes.
// Sends: motivation at 08:30 / 14:30 / 21:30 (local time) and a warning before every red (High) news.
import webpush from 'web-push';
import fs from 'fs';

const PUBLIC = process.env.VAPID_PUBLIC || 'BEbAlapGPODbyKuDao4BL5sEJyF3m3ax0rr2BTNTqD2pzMEivOj-3BqgZL2Y2FjYd0uha2TgsUW1EIteOKnH9ns';
const PRIVATE = process.env.VAPID_PRIVATE;
const SUB = process.env.PUSH_SUB;
const TZ = process.env.APP_TZ || 'Atlantic/Canary';
const TEST = process.env.TEST_PUSH === 'true';
if (!PRIVATE || !SUB) { console.log('Secrets missing (VAPID_PRIVATE / PUSH_SUB) — nothing to do.'); process.exit(0); }
webpush.setVapidDetails('mailto:byzyp@users.noreply.github.com', PUBLIC, PRIVATE);
const subs = (() => { const j = JSON.parse(SUB); return Array.isArray(j) ? j : [j]; })();

const STATE = 'sent.json';
let sent = {}; try { sent = JSON.parse(fs.readFileSync(STATE, 'utf8')); } catch (e) {}
let changed = false;

function local(d) {
  const p = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', weekday:'short', hour12:false })
    .formatToParts(d).reduce((o, x) => (o[x.type] = x.value, o), {});
  return { date: `${p.year}-${p.month}-${p.day}`, hm: +p.hour * 60 + +p.minute, wd: p.weekday, hhmm: `${p.hour}:${p.minute}` };
}
const status = Array.isArray(sent._status) ? sent._status : [];
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
  Sat: ['🏃 Azi e alergarea lungă. Fiecare minut e dovada că te-ai schimbat.', '🫁 Cu fiecare săptămână fără fum respiri mai ușor la efort.', '💤 Somn devreme, ZyP. Mușchii și voința se refac noaptea.'],
  Sun: ['🌿 Duminică liniștită. Odihnă, nu scuze. Fără țigări și azi.', '🔥 Nu da tot înapoi pentru o singură țigară. Ai ajuns prea departe.', '🗓️ Pregătește săptămâna: antrenamente, mâncare, obiective.']
};
const SLOTS = [8 * 60 + 30, 14 * 60 + 30, 21 * 60 + 30];
for (let i = 0; i < SLOTS.length; i++) {
  const key = `m-${L.date}-${i}`;
  if (L.hm >= SLOTS[i] && L.hm < SLOTS[i] + 40 && !sent[key]) {
    if (await send('By ZyP', MOT[L.wd][i], 'motivatie')) { sent[key] = Date.now(); changed = true; }
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
const soon = news.filter(e => e.impact === 'High' || (e.impact === 'Medium' && e.country === 'USD')).map(e => ({ ...e, t: new Date(e.date) }))
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
const evs = (gold.events || []).filter(e => e && e.id && !sent['e-' + e.id] && (Date.now() - new Date(e.t).getTime()) < 3 * 3600000);
const MAXN = 5;
for (const e of evs.slice(0, MAXN)) {
  if (await send(e.title, e.body, 'strat-' + e.sid)) { sent['e-' + e.id] = Date.now(); changed = true; }
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
