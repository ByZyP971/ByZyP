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
const DAYN = Math.floor(Date.parse(L.date + 'T00:00:00Z') / 86400000);
const pick = (arr, salt = 0) => arr[(DAYN + salt) % arr.length];
const FUN = [
  '😂 Mușchii nu cresc din scuze, ZyP. Deși scuzele fac exercițiu bun pentru limbă.',
  '🏋️ Gantera nu se ridică singură. Am încercat să-i vorbesc, nu m-a ascultat.',
  '🍗 Puiul și orezul te așteaptă. Pe aia o iubești mai mult decât pe mine, recunoaște.',
  '🥤 Whey-ul nu se bea singur. Dar se bea mai bine după sală, nu în loc de sală.',
  '🦵 Cine sare peste ziua de picioare ajunge cu spate de rege și picioare de pui. Fii rege întreg.',
  '😴 Somnul e suplimentul gratis. Nu necesită etichetă, doar să lași telefonul jos.',
  '🧠 Creierul zice „mâine". Mușchiul zice „azi". Pe cine asculți?',
  '💧 Ai băut apă azi sau doar cafea și vise? Un pahar acum, fără discuții.',
  '📱 Ai stat pe telefon mai mult decât sub bară. Hai că se rezolvă diseară.',
  '🐔 Cine mănâncă pui crește. Cine doar se uită la pui crește doar de curiozitate.',
  '🔥 Un antrenament făcut prost bate unul făcut perfect în capul tău.',
  '🧘 Întinderile durează 5 minute. Durerea de a doua zi durează 3 zile. Matematica e simplă.',
  '🍌 Banana e carbohidrat cu cojoc. Pune-o în traistă pentru sală.',
  '🎯 Greutatea nu minte, oglinda uneori minte. Notează greutatea și gata cu drama.',
  '🚶 7.000 de pași. Nu trebuie să fugi, trebuie doar să nu stai pe canapea ca o pernă.'
];
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
    const GYMV = [
      d => `E 8:30. Pleacă la sală acum și termină antrenamentul (${d}), că ai de plecat la muncă. Nu mai sta pe telefon!`,
      d => `Hei, Hercule! Azi e ${d}. Gantera te strigă. Tu ce faci, scrolezi? Pleacă!`,
      d => `Ora 8:30. Perna te cheamă, dar bara te așteaptă. Azi: ${d}. Nu o lăsa să aștepte!`,
      d => `Ai spus că vrei mușchi, nu? Mușchii s-au adunat la sală (${d}). Tu unde ești?`,
      d => `Alarma de sală sună ca un tren. Urcă-te! Azi: ${d}. Terminăm la timp, ajungem la muncă.`
    ];
    const title = gym ? pick(['🏋️ La sală, ZyP!', '💪 Hercule, trezirea!', '🦍 Maimuța de sală te cheamă', '🔥 Ora de fier a sosit'], 1) : (i === 1 ? pick(['😂 By ZyP', '🤣 Pauză de râs', '🧐 Gândul zilei', '🥴 Povestea zilei'], 2) : 'By ZyP');
    const body = gym ? pick(GYMV)(GYM[L.wd]) : (i === 1 ? pick(FUN) : MOT[L.wd][i]);
    if (await send(title, body, gym ? 'sala' : 'motivatie')) { sent[key] = Date.now(); changed = true; }
  }
}


// ---------- supplements: 09:00 / 20:00 / 22:00 (local time) ----------
const SUPP = [
  { h: 9 * 60, k: 'am', titles: ['🤦 Băi prostule, vitaminele!', '🧟 Zombie, bagă vitaminele!', '🦸 Eroul uită iar vitaminele?', '🐟 Peștele așteaptă, ia Omega 3!'], bodies: ['Se apropie 9:00. Ia-ți D3 + K2, Omega 3 și creatina 5 g cu micul dejun (au nevoie de grăsime) și un pahar de apă.', 'Ora 9 bate la ușă. D3+K2, Omega 3, creatină 5 g, toate cu mâncare. Nu le lăsa să plângă în sertar.', 'Nu mă face să vin eu la tine. Vitaminele, mâncare și apă. Acum, nu mâine.', 'Mușchii cresc din mâncare și suplimente, nu din gânduri frumoase. 9:00, la treabă!'] },
  { h: 20 * 60 + 30, k: 'zn', titles: ['🤦 Băi prostule, zincul!', '🛡️ Zincul nu se ia singur', '🧪 Ora zincului, domnule'], bodies: ['Se apropie cina. Ia zincul cu mâncarea, nu pe stomacul gol, ca să nu te supere.', 'Cina e gata? Atunci și zincul. Pe stomacul gol îți face greață, iar tu o arunci pe mine.', 'Un zinc la cină ține imunitatea în picioare. Nu-l lăsa să stea la rând.'] },
  { h: 22 * 60, k: 'mg', titles: ['🤦 Băi prostule, magneziul!', '🌙 Magneziul, apoi la nani', '😴 Somnul începe cu magneziul'], bodies: ['Se apropie somnul. Ia magneziul acum, te ajută să dormi și să te refaci.', 'Telefonul jos, magneziul sus. Doar un pahar de apă și mergi la somn ca un campion.', 'Mușchii cresc în somn. Magneziul îi ajută. Nu-i lăsa fără ajutor.'] }
];
for (const s of SUPP) {
  const key = `s-${L.date}-${s.k}`;
  if (L.hm >= s.h - 15 && L.hm < s.h + 50 && !sent[key]) {
    if (await send(pick(s.titles), pick(s.bodies, 1), 'supl-' + s.k)) { sent[key] = Date.now(); changed = true; }
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
        if (await send(`${px.ch > 0 ? pick(['🚀 Ethereum zboară', '🤑 Banii tăi dansează', '📈 Ethereum a luat-o razna'], 3) : pick(['⚠️ Ethereum a căzut', '😬 Ethereum a alunecat', '📉 Aer tare la Ethereum'], 3)} ${sgnE(px.ch, 1)}% în 24h`, `Acum ${eur(px.p, 0)}. ` + pos, 'eth-mv', './#eth')) { sent[key] = Date.now(); changed = true; }
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

// ---------- OTHER USERS: every account gets its own funny notifications, on its own time zone and only for the modules it chose ----------
const FUNU = [
  '😂 Mușchii nu cresc din scuze. Deși scuzele fac exercițiu bun pentru limbă.',
  '🏋️ Gantera nu se ridică singură. Am încercat să-i vorbesc, nu m-a ascultat.',
  '🍗 Puiul și orezul te așteaptă. Pe ele le iubești mai mult decât pe mine, recunoaște.',
  '🥤 Proteina nu se bea singură. Dar se bea mai bine după sală, nu în loc de sală.',
  '😴 Somnul e suplimentul gratis. Nu are etichetă, doar lași telefonul jos.',
  '🧠 Creierul zice „mâine". Mușchiul zice „azi". Pe cine asculți?',
  '💧 Ai băut apă azi sau doar cafea și vise? Un pahar acum, fără discuții.',
  '📱 Ai stat pe telefon mai mult decât sub bară. Hai că se rezolvă diseară.',
  '🔥 Un antrenament făcut prost bate unul făcut perfect în capul tău.',
  '🧘 Întinderile durează 5 minute. Durerea de a doua zi durează 3 zile. Matematica e simplă.',
  '🍌 Banana e carbohidrat cu cojoc. Pune-o în traistă pentru sală.',
  '🚶 7.000 de pași. Nu trebuie să fugi, trebuie doar să nu stai pe canapea ca o pernă.'
];
const UGYM = [
  ['🏋️ Hei, campionule!', 'Ora de sală se apropie. Gantera te strigă, tu ce faci, scrolezi? Deschide planul de azi.'],
  ['🦍 Maimuța de sală te cheamă', 'Azi e zi de antrenament. Perna te cheamă, dar bara te așteaptă. Nu o lăsa să aștepte!'],
  ['💪 Hercule, trezirea!', 'Ai spus că vrei mușchi, nu? Mușchii s-au adunat la sală. Tu unde ești?'],
  ['🔥 Ora de fier a sosit', 'Încălzire, serii simple, bifat. Fără scuze azi. Deschide antrenamentul.']
];
const UFOOD = [
  ['🍗 Ora de mâncare', 'Ai mâncat proteine azi? Stomacul zice că nu e momentul să fii zen. Deschide meniul.'],
  ['🥣 Stomacul trimite mesaj', 'Un prânz făcut acasă bate orice fast-food. Meniul de azi te așteaptă în aplicație.'],
  ['🍚 Orezul nu se face singur', 'Pune apa la fiert și deschide meniul. Mâncarea simplă face mușchi simpli.']
];
const USUPP = [
  { h: 9 * 60, k: 'am', t: ['🤦 Hei, vitaminele!', '🐟 Peștele așteaptă, ia Omega 3!', '🧟 Zombie, bagă vitaminele!'], b: ['Se apropie 9:00. Ia suplimentele de dimineață, cu micul dejun.', 'Dimineața e momentul vitaminelor. Deschide bifa din aplicație și ia-le acum.'] },
  { h: 20 * 60 + 30, k: 'ev', t: ['🛡️ Ora suplimentelor de seară', '🧪 Zincul nu se ia singur'], b: ['Se apropie cina. Ia suplimentele de seară cu mâncarea, ca să nu te supere stomacul.', 'Cina e gata? Atunci și suplimentele de seară. Bifează-le în aplicație.'] },
  { h: 22 * 60, k: 'ng', t: ['🌙 Magneziul, apoi la nani', '😴 Somnul începe cu magneziul'], b: ['Se apropie somnul. Ia ce ai de luat înainte de culcare și lasă telefonul jos.', 'Telefonul jos, magneziul sus. Somn bun, campionule.'] }
];
function localTz(d, tz) {
  try {
    const p = new Intl.DateTimeFormat('en-GB', { timeZone: tz, year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', weekday:'short', hour12:false })
      .formatToParts(d).reduce((o, x) => (o[x.type] = x.value, o), {});
    return { date: `${p.year}-${p.month}-${p.day}`, hm: (+p.hour % 24) * 60 + +p.minute, wd: p.weekday };
  } catch (e) { return local(d); }
}
if (KEY) {
  let all = [];
  try {
    const r = await fetch('https://bskujbfaynbeqjonqydb.supabase.co/rest/v1/rpc/get_all_push', { method: 'POST',
      headers: { apikey: 'sb_publishable_iFv52BsojpLXTxuBzqGU1Q_cCFVZUAX', 'Content-Type': 'application/json' }, body: JSON.stringify({ p_secret: KEY.trim() }) });
    if (r.ok) { const j = await r.json(); all = Array.isArray(j) ? j : []; } else console.log('all-users lookup failed: HTTP', r.status);
  } catch (e) { console.log('all-users lookup failed:', e.message); }
  const mine = new Set(subs.map(x => x.endpoint));
  const others = all.filter(u => u && okSub(u.sub) && !mine.has(u.sub.endpoint));
  console.log('other users:', others.length);
  for (const u of others) {
    const id = String(u.sub.endpoint).slice(-14).replace(/[^A-Za-z0-9]/g, '_');
    const M = u.mods && typeof u.mods === 'object' ? u.mods : {};
    const on = (m) => M[m] === undefined || +M[m] !== 0;
    const U = localTz(now, u.tz || TZ);
    const dn = Math.floor(Date.parse(U.date + 'T00:00:00Z') / 86400000), salt = id.length * 7 + id.charCodeAt(id.length - 1);
    const up = (arr, z = 0) => arr[(dn + salt + z) % arr.length];
    const todo = [];
    if (on('sport') && ['Mon','Tue','Wed','Thu','Fri'].includes(U.wd) && U.hm >= 17 * 60 + 30 && U.hm < 17 * 60 + 70) todo.push(['gym', up(UGYM)]);
    if (on('food') && U.hm >= 13 * 60 && U.hm < 13 * 60 + 40) todo.push(['food', up(UFOOD)]);
    if (U.hm >= 14 * 60 + 30 && U.hm < 14 * 60 + 70) todo.push(['joke', [up(['😂 By ZyP', '🤣 Pauză de râs', '🧐 Gândul zilei'], 1), up(FUNU)]]);
    const SC = u.supps && typeof u.supps === 'object' && Array.isArray(u.supps.g) ? u.supps : null;
    if (on('supp') && SC) {
      // the user's own schedule: only the supplements he chose, at the time he chose, a few minutes before
      if (SC.on !== false) {
        const lead = [5, 10, 15, 20, 30].includes(+SC.lead) ? +SC.lead : 15;
        const clean = (x) => String(x || '').replace(/[^\p{L}\p{N} +\-.,()]/gu, '').slice(0, 40);
        SC.g.slice(0, 6).forEach((g, gi) => {
          const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(g && g.t || '')); if (!m || !Array.isArray(g.n)) return;
          const names = g.n.slice(0, 12).map(clean).filter(Boolean); if (!names.length) return;
          const at = (+m[1]) * 60 + (+m[2]), fire = at - lead;
          if (fire >= 0 && U.hm >= fire && U.hm < fire + 25) {
            const list = names.length > 4 ? names.slice(0, 4).join(', ') + ' și încă ' + (names.length - 4) : names.join(', ');
            todo.push(['sp' + gi + '-' + m[1] + m[2], [up(['💊 Ora suplimentelor', '🤦 Hei, vitaminele!', '🧟 Zombie, bagă vitaminele!', '🐟 Nu uita de suplimente'], gi), 'La ' + m[1] + ':' + m[2] + ': ' + list + '. Doza e cea de pe ambalaj sau de la medic.']]);
          }
        });
      }
    } else if (on('supp')) for (const q of USUPP) if (U.hm >= q.h - 15 && U.hm < q.h + 50) todo.push(['s-' + q.k, [up(q.t), up(q.b, 1)]]);
    // ---- personalized by THIS account's own results (stats saved by the phone) ----
    const S = u.stats && typeof u.stats === 'object' ? u.stats : null;
    if (S && on('sport')) {
      const num = (x) => Math.max(0, Math.min(9999, +x || 0));
      const mon = new Date(Date.parse(U.date + 'T00:00:00Z') - ((['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].indexOf(U.wd)) * 86400000)).toISOString().slice(0, 10);
      const stale = !String(u.at || '').slice(0, 10) || String(u.at).slice(0, 10) < mon;   // phone not opened this week -> this week counts as 0
      const w = stale ? 0 : num(S.w), s2 = stale ? 0 : num(S.s), pw = stale ? num(S.w) : num(S.pw), ps = stale ? num(S.s) : num(S.ps);
      const rec = stale ? 0 : num(S.rec), st = num(S.st);
      const la = /^\d{4}-\d\d-\d\d$/.test(S.la || '') ? S.la : '';
      const gap = la ? Math.round((dn - Math.floor(Date.parse(la + 'T00:00:00Z') / 86400000))) : 99;
      if (U.wd === 'Sun' && U.hm >= 19 * 60 && U.hm < 19 * 60 + 40) {
        let t, b;
        if (w === 0 && pw === 0) { t = '📊 Raportul săptămânii'; b = 'Zero antrenamente săptămâna asta și zero și cea trecută. Luni începem cu stângul sau cu dreptul, dar începem!'; }
        else if (w === 0) { t = '📊 Raportul tău: săptămână liberă?'; b = `Săptămâna trecută ai făcut ${pw} antrenamente (${ps} serii). Asta... nimic. Gantera a întrebat de tine. Luni revenim!`; }
        else if (w > pw) { t = '📈 Raportul tău: ai crescut!'; b = `${w} antrenamente și ${s2} serii săptămâna asta, față de ${pw} și ${ps} cea trecută. Așa se face!` + (rec ? ` Plus ${rec} recorduri noi 🏆` : ''); }
        else if (w === pw) { t = '📊 Raportul tău: constant'; b = `${w} antrenamente și ${s2} serii, la fel de serios ca săptămâna trecută (${ps} serii).` + (s2 > ps ? ' Ba chiar cu mai multe serii!' : ' Săptămâna viitoare încearcă o serie în plus la fiecare exercițiu.') + (rec ? ` Recorduri noi: ${rec} 🏆` : ''); }
        else { t = '📊 Raportul tău: puțin sub ritm'; b = `${w} antrenamente săptămâna asta, față de ${pw} cea trecută. Nicio dramă, luni refacem ritmul.`; }
        todo.push(['wk', [t, b]]);
      }
      const gi = todo.findIndex(x => x[0] === 'gym');
      if (gi >= 0) {
        if (la === U.date) todo.splice(gi, 1);                                   // already trained today: no nagging
        else if (gap >= 7 && gap < 90) todo[gi] = ['gym', ['🦍 Unde ai dispărut?', `Au trecut ${gap} zile de la ultimul antrenament. Gantera s-a mutat în altă relație. Hai înapoi azi!`]];
        else if (gap >= 3 && gap < 7) todo[gi] = ['gym', ['🏋️ Nu te-am mai văzut', `Ultimul antrenament: acum ${gap} zile. Mușchii au început să uite cine ești. Deschide planul de azi.`]];
        else if (st >= 3) todo[gi] = ['gym', [`🔥 ${st} zile la rând!`, `Nu rupe seria acum. Planul de azi te așteaptă, durează cât o pauză de cafea.`]];
        else if (pw > 0 && w < pw) todo[gi] = ['gym', ['💪 Hai să egalezi săptămâna trecută', `Ai ${w} antrenamente săptămâna asta față de ${pw} cea trecută. Azi mai bifezi unul?`]];
      }
    }
    for (const [k, [title, body]] of todo) {
      const key = `u-${id}-${U.date}-${k}`;
      if (sent[key]) continue;
      try { await webpush.sendNotification(u.sub, JSON.stringify({ title, body, tag: 'u-' + k, url: './' }), { TTL: 1800, urgency: 'high' }); console.log('sent to user', id, k); }
      catch (e) { console.log('user push error', id, e.statusCode || e.message); }
      sent[key] = Date.now(); changed = true;
    }
  }
}

// keep state small (last 4 days)
for (const k of Object.keys(sent)) if (!k.startsWith('_') && Date.now() - sent[k] > 4 * 86400000) { delete sent[k]; changed = true; }
sent._status = status.slice(-15);
if (changed) fs.writeFileSync(STATE, JSON.stringify(sent));
console.log('local time', L.date, L.hhmm, L.wd, '| changed:', changed);
