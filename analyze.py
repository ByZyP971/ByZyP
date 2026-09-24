#!/usr/bin/env python3
"""By ZyP — XAUUSD technical snapshot (runs in GitHub Actions, stdlib only).
Writes xauusd.json: price, indicators, key levels and two rule-based scenarios.
Educational, rule-based output — not financial advice."""
import csv, io, json, math, sys, urllib.request, datetime as dt

UA = {'User-Agent': 'Mozilla/5.0'}

def get(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read().decode('utf-8', 'replace')

def load_stooq():
    txt = get('https://stooq.com/q/d/l/?s=xauusd&i=d')
    rows = list(csv.DictReader(io.StringIO(txt)))
    out = []
    for r in rows:
        try:
            out.append({'d': r['Date'], 'o': float(r['Open']), 'h': float(r['High']), 'l': float(r['Low']), 'c': float(r['Close'])})
        except Exception:
            pass
    if len(out) < 220: raise ValueError('stooq: too few rows (%d)' % len(out))
    return out[-400:], 'XAUUSD spot (Stooq)'

def load_yahoo():
    j = json.loads(get('https://query1.finance.yahoo.com/v8/finance/chart/GC%3DF?interval=1d&range=2y'))
    res = j['chart']['result'][0]; q = res['indicators']['quote'][0]
    out = []
    for i, t in enumerate(res['timestamp']):
        o, h, l, c = q['open'][i], q['high'][i], q['low'][i], q['close'][i]
        if None in (o, h, l, c): continue
        out.append({'d': dt.datetime.utcfromtimestamp(t).strftime('%Y-%m-%d'), 'o': o, 'h': h, 'l': l, 'c': c})
    if len(out) < 220: raise ValueError('yahoo: too few rows')
    return out[-400:], 'Aur futures GC=F (Yahoo, aproximativ)'

def ema(vals, n):
    k = 2 / (n + 1); e = sum(vals[:n]) / n; out = [None] * (n - 1) + [e]
    for v in vals[n:]:
        e = v * k + e * (1 - k); out.append(e)
    return out

def rsi(vals, n=14):
    g = l = 0.0
    for i in range(1, n + 1):
        d = vals[i] - vals[i - 1]; g += max(d, 0); l += max(-d, 0)
    g /= n; l /= n
    for i in range(n + 1, len(vals)):
        d = vals[i] - vals[i - 1]
        g = (g * (n - 1) + max(d, 0)) / n; l = (l * (n - 1) + max(-d, 0)) / n
    return 100.0 if l == 0 else 100 - 100 / (1 + g / l)

def atr(bars, n=14):
    trs = [max(b['h'] - b['l'], abs(b['h'] - p['c']), abs(b['l'] - p['c'])) for p, b in zip(bars, bars[1:])]
    a = sum(trs[:n]) / n
    for t in trs[n:]: a = (a * (n - 1) + t) / n
    return a

def swings(bars, k=2, look=150):
    b = bars[-look:]; hi, lo = [], []
    for i in range(k, len(b) - k):
        if all(b[i]['h'] >= b[j]['h'] for j in range(i - k, i + k + 1)): hi.append(b[i]['h'])
        if all(b[i]['l'] <= b[j]['l'] for j in range(i - k, i + k + 1)): lo.append(b[i]['l'])
    return hi, lo

def merge(levels, tol):
    levels = sorted(levels); out = []
    for v in levels:
        if out and abs(v - out[-1][0]) <= tol: out[-1] = ((out[-1][0] * out[-1][1] + v) / (out[-1][1] + 1), out[-1][1] + 1)
        else: out.append((v, 1))
    return out  # (level, touches)

def r2(x): return round(x, 2)

def main():
    try: bars, src = load_stooq()
    except Exception as e:
        print('stooq failed:', e, file=sys.stderr); bars, src = load_yahoo()
    closes = [b['c'] for b in bars]
    price = closes[-1]; prev = closes[-2]
    e20, e50, e200 = ema(closes, 20)[-1], ema(closes, 50)[-1], ema(closes, 200)[-1]
    e20_prev = ema(closes, 20)[-6]
    R = rsi(closes); A = atr(bars)
    y = bars[-2]; P = (y['h'] + y['l'] + y['c']) / 3
    piv = {'P': P, 'R1': 2 * P - y['l'], 'S1': 2 * P - y['h'], 'R2': P + (y['h'] - y['l']), 'S2': P - (y['h'] - y['l'])}
    hi, lo = swings(bars)
    lv = merge(hi + lo, 0.3 * A)
    res = sorted([l for l in lv if l[0] > price + 0.15 * A], key=lambda x: x[0])
    sup = sorted([l for l in lv if l[0] < price - 0.15 * A], key=lambda x: -x[0])
    R1 = res[0][0] if res else price + 1.0 * A; R2 = res[1][0] if len(res) > 1 else R1 + 1.0 * A
    S1 = sup[0][0] if sup else price - 1.0 * A; S2 = sup[1][0] if len(sup) > 1 else S1 - 1.0 * A

    score = 0; notes = []
    def add(cond, txt_up, txt_dn):
        nonlocal score
        score += 1 if cond else -1; notes.append(txt_up if cond else txt_dn)
    add(price > e20, 'Prețul e peste EMA20 (momentum pozitiv)', 'Prețul e sub EMA20 (momentum negativ)')
    add(e20 > e50, 'EMA20 peste EMA50 (trend pe termen mediu în sus)', 'EMA20 sub EMA50 (trend pe termen mediu în jos)')
    add(price > e200, 'Peste EMA200 (trend lung ascendent)', 'Sub EMA200 (trend lung descendent)')
    add(R > 50, 'RSI peste 50 (cumpărătorii domină)', 'RSI sub 50 (vânzătorii domină)')
    add(e20 > e20_prev, 'EMA20 urcă', 'EMA20 coboară')
    bias = 'BULLISH' if score >= 2 else 'BEARISH' if score <= -2 else 'NEUTRU'
    if R > 70: notes.append('⚠️ RSI peste 70: supracumpărat, risc de corecție')
    if R < 30: notes.append('⚠️ RSI sub 30: supravândut, risc de revenire')

    def scen(side):
        if side == 'BUY':
            entry = S1 if price - S1 <= 1.5 * A else price - 0.5 * A
            sl = (S1 - 0.4 * A) if entry - S1 <= 1.0 * A else (entry - 1.0 * A)
            risk = entry - sl
            tp1 = R1 if R1 - entry >= 1.0 * risk else entry + 1.5 * risk
            tp2 = R2 if R2 > tp1 + 0.3 * risk else tp1 + 1.5 * risk
            cond = f'Cumpărare doar dacă prețul coboară în zona {r2(entry - 0.15*A)}–{r2(entry + 0.15*A)} și arată respingere (lumânare cu fitil jos pe H1/H4).'
            inval = f'Invalid dacă se închide o lumânare H4 sub {r2(sl)}.'
        else:
            entry = R1 if R1 - price <= 1.5 * A else price + 0.5 * A
            sl = (R1 + 0.4 * A) if R1 - entry <= 1.0 * A else (entry + 1.0 * A)
            risk = sl - entry
            tp1 = S1 if entry - S1 >= 1.0 * risk else entry - 1.5 * risk
            tp2 = S2 if S2 < tp1 - 0.3 * risk else tp1 - 1.5 * risk
            cond = f'Vânzare doar dacă prețul urcă în zona {r2(entry - 0.15*A)}–{r2(entry + 0.15*A)} și arată respingere (lumânare cu fitil sus pe H1/H4).'
            inval = f'Invalid dacă se închide o lumânare H4 peste {r2(sl)}.'
        return {'side': side, 'entry': r2(entry), 'zone': [r2(entry - 0.15 * A), r2(entry + 0.15 * A)], 'sl': r2(sl),
                'tp1': r2(tp1), 'tp2': r2(tp2), 'slDist': r2(abs(entry - sl)),
                'rr1': round(abs(tp1 - entry) / abs(entry - sl), 2), 'rr2': round(abs(tp2 - entry) / abs(entry - sl), 2),
                'cond': cond, 'inval': inval,
                'main': (side == 'BUY' and bias == 'BULLISH') or (side == 'SELL' and bias == 'BEARISH')}

    out = {
        'symbol': 'XAUUSD', 'source': src, 'barDate': bars[-1]['d'],
        'updated': dt.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ'),
        'price': r2(price), 'change': r2(price - prev), 'changePct': round((price - prev) / prev * 100, 2),
        'dayHigh': r2(bars[-1]['h']), 'dayLow': r2(bars[-1]['l']),
        'ema20': r2(e20), 'ema50': r2(e50), 'ema200': r2(e200), 'rsi': round(R, 1), 'atr': r2(A),
        'bias': bias, 'score': score, 'notes': notes,
        'levels': {'R2': r2(R2), 'R1': r2(R1), 'S1': r2(S1), 'S2': r2(S2)},
        'pivots': {k: r2(v) for k, v in piv.items()},
        'scenarios': [scen('BUY'), scen('SELL')],
    }
    with open('xauusd.json', 'w') as f: json.dump(out, f, ensure_ascii=False)
    print('ok', src, out['price'], bias, score)

if __name__ == '__main__':
    main()
