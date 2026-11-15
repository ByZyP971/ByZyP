// By ZyP — MT5 bot (run every ~5 min by the Notificari workflow).
// Reads the MetaTrader 5 account through MetaApi (investor / read-only password),
// stores it PRIVATELY in Supabase (never in this public repo) and sends push notifications
// when a position opens, closes (TP / SL / manual), moves SL to breakeven, or a pending order is placed.
import webpush from 'web-push';

const TOKEN = process.env.METAAPI_TOKEN, ACC = process.env.METAAPI_ACCOUNT;
const REGION = (process.env.METAAPI_REGION || 'new-york').trim();
const KEY = process.env.BYZYP_KEY;
const SUPA = 'https://bskujbfaynbeqjonqydb.supabase.co';
const SUPA_KEY = 'sb_publishable_iFv52BsojpLXTxuBzqGU1Q_cCFVZUAX';
if (!TOKEN || !ACC || !KEY) { console.log('MT5: secrets missing (METAAPI_TOKEN / METAAPI_ACCOUNT / BYZYP_KEY) — skipped.'); process.exit(0); }

const API = `https://mt-client-api-v1.${REGION}.agiliumtrade.ai/users/current/accounts/${ACC}`;
async function mt(path) {
  const r = await fetch(API + path, { headers: { 'auth-token': TOKEN, Accept: 'application/json' } });
  if (!r.ok) throw new Error(`${path} → HTTP ${r.status} ${(await r.text()).slice(0, 160)}`);
  return r.json();
}
const r2 = (x) => x == null ? null : Math.round(x * 100) / 100;
const side = (t) => /BUY/.test(t || '') ? 'BUY' : 'SELL';

let info, positions, orders, deals;
try {
  const now = new Date(), from = new Date(now.getTime() - 35 * 86400000);
  [info, positions, orders, deals] = await Promise.all([
    mt('/account-information'), mt('/positions'), mt('/orders'),
    mt(`/history-deals/time/${from.toISOString()}/${now.toISOString()}`)
  ]);
} catch (e) { console.log('MT5: MetaApi unavailable —', e.message); process.exit(0); }

// closed trades = OUT deals, joined with their IN deal
const byPos = {};
for (const d of deals || []) { (byPos[d.positionId] = byPos[d.positionId] || []).push(d); }
const closed = [];
for (const pid of Object.keys(byPos)) {
  const ds = byPos[pid], out = ds.filter((d) => /OUT/.test(d.entryType || '')), inn = ds.find((d) => d.entryType === 'DEAL_ENTRY_IN');
  if (!out.length) continue;
  const last = out[out.length - 1];
  const pl = ds.reduce((a, d) => a + (d.profit || 0) + (d.commission || 0) + (d.swap || 0), 0);
  closed.push({ id: pid, symbol: last.symbol, side: inn ? side(inn.type) : (side(last.type) === 'BUY' ? 'SELL' : 'BUY'),
    volume: inn ? inn.volume : last.volume, open: inn ? inn.price : null, openTime: inn ? inn.time : null,
    close: last.price, closeTime: last.time, profit: r2(pl),
    reason: /SL/.test(last.reason || '') ? 'SL' : /TP/.test(last.reason || '') ? 'TP' : /SO/.test(last.reason || '') ? 'stop out' : 'manual' });
}
closed.sort((a, b) => String(b.closeTime).localeCompare(String(a.closeTime)));

const state = {
  ok: true,
  info: { balance: r2(info.balance), equity: r2(info.equity), margin: r2(info.margin), freeMargin: r2(info.freeMargin),
    marginLevel: info.marginLevel != null ? Math.round(info.marginLevel) : null, currency: info.currency, leverage: info.leverage,
    broker: info.broker, server: info.server, name: info.name, login: info.login ? String(info.login).replace(/.(?=.{3})/g, '•') : null },
  positions: (positions || []).map((p) => ({ id: String(p.id), symbol: p.symbol, side: side(p.type), volume: p.volume,
    open: p.openPrice, price: p.currentPrice, sl: p.stopLoss || null, tp: p.takeProfit || null,
    profit: r2((p.profit || 0) + (p.swap || 0) + (p.commission || 0)), time: p.time })),
  orders: (orders || []).map((o) => ({ id: String(o.id), symbol: o.symbol, type: o.type, side: side(o.type), volume: o.currentVolume || o.volume,
    price: o.openPrice, sl: o.stopLoss || null, tp: o.takeProfit || null, time: o.time })),
  closed: closed.slice(0, 60)
};

// save privately in Supabase; the function returns the previous state (for change detection)
let prev = {};
try {
  const r = await fetch(`${SUPA}/rest/v1/rpc/push_mt5`, { method: 'POST',
    headers: { apikey: SUPA_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ p_secret: KEY, p_data: state }) });
  if (!r.ok) throw new Error(`HTTP ${r.status} ${(await r.text()).slice(0, 160)}`);
  prev = await r.json() || {};
} catch (e) { console.log('MT5: could not save to Supabase —', e.message); process.exit(0); }
console.log(`MT5 ok: balance ${state.info.balance} ${state.info.currency}, ${state.positions.length} positions, ${state.orders.length} orders`);

// ---------- notifications ----------
const PRIVATE = process.env.VAPID_PRIVATE, SUB = process.env.PUSH_SUB;
if (!PRIVATE || !SUB || !Array.isArray(prev.positions)) { console.log('MT5: first run or no push secrets — no notifications.'); process.exit(0); }
webpush.setVapidDetails('mailto:byzyp@users.noreply.github.com', process.env.VAPID_PUBLIC || 'BEbAlapGPODbyKuDao4BL5sEJyF3m3ax0rr2BTNTqD2pzMEivOj-3BqgZL2Y2FjYd0uha2TgsUW1EIteOKnH9ns', PRIVATE);
let subs = (() => { try { const j = JSON.parse(SUB); return (Array.isArray(j) ? j : [j]).filter((x) => x && x.endpoint); } catch (e) { return []; } })();
// Trading notifications go only to phones whose account has the module „Bani și Ethereum” switched on (Profil → Personalizează aplicația).
// Same rule as push-bot.js: mods saved -> mods.money decides; saved without choices -> on; phone not found in the account -> the owner's account choice, otherwise OFF.
{
  let all = [], own = [];
  const rpc = async (fn) => { const r = await fetch(`${SUPA}/rest/v1/rpc/${fn}`, { method: 'POST', signal: AbortSignal.timeout(15000), headers: { apikey: SUPA_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ p_secret: KEY.trim() }) }); if (!r.ok) throw new Error('HTTP ' + r.status); const j = await r.json(); return Array.isArray(j) ? j : []; };
  try { all = await rpc('get_all_push'); own = await rpc('get_push_subs'); } catch (e) { console.log('MT5: could not read the modules —', e.message); }
  const has = (u) => u && u.sub && typeof u.sub === 'object';
  const ownEp = new Set(own.filter((x) => x && x.endpoint).map((x) => x.endpoint));
  const ownerRec = all.find((u) => has(u) && ownEp.has(u.sub.endpoint));
  subs = subs.filter((s) => {
    const rec = all.find((u) => has(u) && u.sub.endpoint === s.endpoint) || ownerRec;
    if (!rec) return false;
    const m = rec.mods;
    if (m === undefined || m === null) return true;
    return typeof m === 'object' && !Array.isArray(m) && !!m.money && +m.money !== 0;
  });
  if (!subs.length) { console.log('MT5: money module is off (or unknown) — no notifications.'); process.exit(0); }
}
async function send(title, body) {
  for (const s of subs) {
    try { await webpush.sendNotification(s, JSON.stringify({ title, body, tag: 'mt5-' + Date.now(), url: './#trading' }), { TTL: 1800, urgency: 'high' }); console.log('sent:', title); }
    catch (e) { console.log('push error', e.statusCode, e.body || e.message); }
  }
}
const cur = state.info.currency === 'USD' ? '$' : (state.info.currency || '') + ' ';
const money = (v) => (v >= 0 ? '+' : '−') + cur + Math.abs(v).toFixed(2);
const pPrev = Object.fromEntries(prev.positions.map((p) => [p.id, p]));
const pNow = Object.fromEntries(state.positions.map((p) => [p.id, p]));
const msgs = [];
for (const p of state.positions) {
  const o = pPrev[p.id];
  if (!o) msgs.push([`${p.side === 'BUY' ? '🟢' : '🔴'} Ai intrat ${p.side} ${p.symbol} ${p.volume}`, `La ${p.open}${p.sl ? ' · SL ' + p.sl : ' · fără SL!'}${p.tp ? ' · TP ' + p.tp : ''}. Contul: ${cur}${state.info.equity}.`]);
  else {
    const be = p.sl && Math.abs(p.sl - p.open) <= Math.max(0.3, p.open * 0.0002);
    if (be && !(o.sl && Math.abs(o.sl - o.open) <= Math.max(0.3, o.open * 0.0002))) msgs.push([`🛡️ SL mutat la BE · ${p.symbol}`, `${p.side} de la ${p.open}: acum e fără risc. Profit curent ${money(p.profit)}.`]);
    else if (p.sl !== o.sl || p.tp !== o.tp) msgs.push([`✏️ SL/TP modificat · ${p.symbol}`, `SL ${p.sl || '—'} · TP ${p.tp || '—'} · profit curent ${money(p.profit)}.`]);
  }
}
for (const o of prev.positions) {
  if (pNow[o.id]) continue;
  const c = state.closed.find((x) => x.id === o.id);
  const pl = c ? c.profit : o.profit;
  const why = c ? (c.reason === 'TP' ? 'a atins TP' : c.reason === 'SL' ? 'a atins SL' : c.reason === 'stop out' ? 'STOP OUT' : 'închis de tine') : 'închis';
  msgs.push([`${pl >= 0 ? '🏆' : '❌'} ${o.symbol} ${o.side} ${why}: ${money(pl)}`, `De la ${o.open} la ${c ? c.close : o.price}. Balanța acum: ${cur}${state.info.balance}.`]);
}
const oPrev = new Set((prev.orders || []).map((o) => o.id));
for (const o of state.orders) if (!oPrev.has(o.id)) msgs.push([`🕒 Ordin pus: ${o.side} ${o.symbol} ${o.volume}`, `La ${o.price}${o.sl ? ' · SL ' + o.sl : ''}${o.tp ? ' · TP ' + o.tp : ''}. Te anunț când intră.`]);
if (state.info.marginLevel != null && state.info.marginLevel < 150 && !(prev.info && prev.info.marginLevel < 150) && state.positions.length)
  msgs.push(['⚠️ Marjă scăzută în contul MT5', `Nivelul marjei e ${state.info.marginLevel}%. Verifică pozițiile ca să eviți stop out-ul.`]);

for (const [t, b] of msgs.slice(0, 6)) await send(t, b);
if (msgs.length > 6) await send(`📊 MT5: încă ${msgs.length - 6} schimbări`, 'Deschide aplicația la Bani → Trading.');
