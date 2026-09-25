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


def load_spot():
    """Live XAU/USD spot (keyless public APIs). Returns float or None."""
    try:
        j = json.loads(get('https://xaus.com/api/v1/spot?compact=1'))
        st = (j.get('data_state') or {}).get('status')
        v = j.get('spot_usd_oz') or (j.get('xau') or {}).get('price')
        if v and st != 'unavailable': return float(v)
    except Exception as e:
        print('xaus spot failed:', e, file=sys.stderr)
    try:
        j = json.loads(get('https://api.gold-api.com/price/XAU'))
        if j.get('price'): return float(j['price'])
    except Exception as e:
        print('gold-api spot failed:', e, file=sys.stderr)
    return None

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

def load_h1():
    """Gold futures hourly (Yahoo) — used only for direction on H1/H4, not for levels."""
    j = json.loads(get('https://query1.finance.yahoo.com/v8/finance/chart/GC%3DF?interval=60m&range=1mo'))
    res = j['chart']['result'][0]; q = res['indicators']['quote'][0]
    out = []
    for i, t in enumerate(res['timestamp']):
        o, h, l, c = q['open'][i], q['high'][i], q['low'][i], q['close'][i]
        if None in (o, h, l, c): continue
        out.append({'t': t, 'o': o, 'h': h, 'l': l, 'c': c})
    if len(out) < 120: raise ValueError('h1: too few bars')
    return out

def to_h4(h1):
    out = []
    for i in range(0, len(h1) - len(h1) % 4, 4):
        g = h1[i:i + 4]
        out.append({'o': g[0]['o'], 'h': max(b['h'] for b in g), 'l': min(b['l'] for b in g), 'c': g[-1]['c']})
    return out

def trend_of(bars):
    c = [b['c'] for b in bars]
    e20, e50 = ema(c, 20)[-1], ema(c, 50)[-1]
    r = rsi(c)
    up = (c[-1] > e20) + (e20 > e50) + (r > 50)
    return {'dir': 'UP' if up >= 2 else 'DOWN', 'rsi': round(r, 1), 'strength': up if up >= 2 else 3 - up}

def macd(vals):
    e12, e26 = ema(vals, 12), ema(vals, 26)
    line = [a - b if a is not None and b is not None else None for a, b in zip(e12, e26)]
    valid = [x for x in line if x is not None]
    sig = ema(valid, 9)
    return valid, sig

def sma(vals, n): return sum(vals[-n:]) / n

def stdev(vals, n):
    m = sma(vals, n); return math.sqrt(sum((v - m) ** 2 for v in vals[-n:]) / n)

def session_now():
    h = dt.datetime.utcnow().hour
    s = []
    if 0 <= h < 8: s.append('Asia')
    if 7 <= h < 16: s.append('Londra')
    if 12 <= h < 21: s.append('New York')
    note = 'Suprapunere Londra–New York: cea mai mare volatilitate pe aur.' if ('Londra' in s and 'New York' in s) else \
           'Sesiunea asiatică: de obicei mișcări mai mici pe aur.' if s == ['Asia'] else \
           'Piață mai liniștită; spread-ul poate fi mai mare.' if not s else 'Volatilitate normală spre ridicată.'
    return {'active': s or ['Închidere / tranziție'], 'note': note}


def main():
    try: bars, src = load_stooq()
    except Exception as e:
        print('stooq failed:', e, file=sys.stderr); bars, src = load_yahoo()
    spot = load_spot()
    spot_used = False
    if spot and abs(spot - bars[-1]['c']) / bars[-1]['c'] < 0.08:      # sanity check vs daily data
        today_u = dt.datetime.utcnow().strftime('%Y-%m-%d')
        if bars[-1]['d'] == today_u:
            bars[-1]['c'] = spot; bars[-1]['h'] = max(bars[-1]['h'], spot); bars[-1]['l'] = min(bars[-1]['l'], spot)
        elif dt.datetime.utcnow().weekday() < 5 or dt.datetime.utcnow().weekday() == 6 and dt.datetime.utcnow().hour >= 22:
            pc = bars[-1]['c']; bars.append({'d': today_u, 'o': pc, 'h': max(pc, spot), 'l': min(pc, spot), 'c': spot})
        else:
            bars[-1]['c'] = spot
        spot_used = True
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

    # ---------- multi-timeframe ----------
    h1 = None
    mtf = {'D1': {'dir': 'UP' if (price > e20 and e20 > e50) else 'DOWN' if (price < e20 and e20 < e50) else 'MIX', 'rsi': round(R, 1)}}
    try:
        h1 = load_h1()
        mtf['H4'] = trend_of(to_h4(h1)) if len(h1) >= 220 else None
        mtf['H1'] = trend_of(h1)
    except Exception as e:
        print('h1 unavailable:', e, file=sys.stderr)

    strategies = []
    SID = [('Trend following', 'trend'), ('Suport', 'sr'), ('Breakout', 'breakout'), ('RSI', 'rsi'), ('MACD', 'macd'), ('Bollinger', 'bb'),
           ('Fibonacci', 'fib'), ('Pivot', 'pivot'), ('Smart Money', 'fvg'), ('Aliniere', 'mtf'), ('Ichimoku', 'ichi'), ('Stochastic', 'stoch'),
           ('Price action', 'pa'), ('ADX', 'adx'), ('Supertrend', 'st'), ('London', 'london'), ('Niveluri psihologice', 'round'), ('EMA 9/21', 'ema921')]
    def S(name, verdict, strength, why, entry=None, sl=None, tp1=None, tp2=None, info=''):
        sid = next((v for k, v in SID if name.startswith(k)), 'x')
        d = {'id': sid, 'name': name, 'verdict': verdict, 'strength': strength, 'why': why, 'info': info}
        if entry is not None:
            d.update({'entry': r2(entry), 'sl': r2(sl), 'tp1': r2(tp1), 'tp2': r2(tp2),
                      'rr': round(abs(tp1 - entry) / max(1e-9, abs(entry - sl)), 2)})
        strategies.append(d)

    # 1. Trend following (EMA stack)
    if price > e20 > e50 > e200:
        S('Trend following (EMA 20/50/200)', 'BUY', 3, 'Toate mediile aliniate în sus: trend clar ascendent. Se caută cumpărări la retrageri spre EMA20.',
          e20, e20 - 1.0 * A, e20 + 1.5 * A, e20 + 3.0 * A, 'Intrare la retragere spre EMA20, SL 1×ATR sub.')
    elif price < e20 < e50 < e200:
        S('Trend following (EMA 20/50/200)', 'SELL', 3, 'Toate mediile aliniate în jos: trend clar descendent. Se caută vânzări la reveniri spre EMA20.',
          e20, e20 + 1.0 * A, e20 - 1.5 * A, e20 - 3.0 * A, 'Intrare la revenire spre EMA20, SL 1×ATR peste.')
    else:
        S('Trend following (EMA 20/50/200)', 'NEUTRU', 1, 'Mediile nu sunt aliniate: trendul nu e clar, strategia stă deoparte.')

    # 2. Support / resistance bounce (the scenarios above)
    sb, ss = scen('BUY'), scen('SELL')
    near_s = (price - S1) <= 0.6 * A; near_r = (R1 - price) <= 0.6 * A
    if near_s and not near_r:
        S('Suport / rezistență', 'BUY', 2, f'Prețul e aproape de suportul {r2(S1)}. Cumpărare la confirmare (respingere).', sb['entry'], sb['sl'], sb['tp1'], sb['tp2'])
    elif near_r and not near_s:
        S('Suport / rezistență', 'SELL', 2, f'Prețul e aproape de rezistența {r2(R1)}. Vânzare la confirmare (respingere).', ss['entry'], ss['sl'], ss['tp1'], ss['tp2'])
    else:
        S('Suport / rezistență', 'AȘTEAPTĂ', 1, f'Prețul e între suport ({r2(S1)}) și rezistență ({r2(R1)}). Se așteaptă atingerea unui nivel.')

    # 3. Breakout (Donchian 20)
    hh = max(b['h'] for b in bars[-21:-1]); ll = min(b['l'] for b in bars[-21:-1])
    if price > hh:
        S('Breakout (maxim 20 zile)', 'BUY', 3, f'Prețul a spart maximul ultimelor 20 de zile ({r2(hh)}). Momentum puternic.', price, hh - 0.5 * A, price + 1.5 * A, price + 3 * A, 'Nivelul spart devine suport.')
    elif price < ll:
        S('Breakout (minim 20 zile)', 'SELL', 3, f'Prețul a spart minimul ultimelor 20 de zile ({r2(ll)}). Momentum puternic în jos.', price, ll + 0.5 * A, price - 1.5 * A, price - 3 * A, 'Nivelul spart devine rezistență.')
    else:
        dist_h, dist_l = hh - price, price - ll
        S('Breakout (Donchian 20)', 'AȘTEAPTĂ', 1, f'Canal 20 zile: {r2(ll)} – {r2(hh)}. ' + ('Mai aproape de maxim: atenție la o spargere în sus.' if dist_h < dist_l else 'Mai aproape de minim: atenție la o spargere în jos.'))

    # 4. RSI mean reversion
    if R < 30:
        S('RSI extrem (revenire)', 'BUY', 2 if near_s else 1, f'RSI {round(R,1)} (supravândut). Probabilitate mai mare de revenire, mai ales la suport.', price, price - 1.0 * A, price + 1.0 * A, e20, 'Contra-trend: risc mai mare, lot mai mic.')
    elif R > 70:
        S('RSI extrem (revenire)', 'SELL', 2 if near_r else 1, f'RSI {round(R,1)} (supracumpărat). Probabilitate mai mare de corecție, mai ales la rezistență.', price, price + 1.0 * A, price - 1.0 * A, e20, 'Contra-trend: risc mai mare, lot mai mic.')
    else:
        S('RSI extrem (revenire)', 'NEUTRU', 1, f'RSI {round(R,1)}: nici supracumpărat, nici supravândut.')

    # 5. MACD momentum
    ml, sg = macd(closes)
    hist_now, hist_prev = ml[-1] - sg[-1], ml[-2] - sg[-2]
    crossed_up = any(ml[-k] - sg[-k] > 0 and ml[-k - 1] - sg[-k - 1] <= 0 for k in range(1, 4))
    crossed_dn = any(ml[-k] - sg[-k] < 0 and ml[-k - 1] - sg[-k - 1] >= 0 for k in range(1, 4))
    if crossed_up: S('MACD (momentum)', 'BUY', 2, 'MACD a trecut peste linia de semnal în ultimele 3 zile: momentum nou pe creștere.')
    elif crossed_dn: S('MACD (momentum)', 'SELL', 2, 'MACD a trecut sub linia de semnal în ultimele 3 zile: momentum nou pe scădere.')
    else: S('MACD (momentum)', 'BUY' if hist_now > 0 else 'SELL', 1, ('Histograma pozitivă' if hist_now > 0 else 'Histograma negativă') + (', în creștere.' if abs(hist_now) > abs(hist_prev) else ', în slăbire.'))

    # 6. Bollinger Bands
    mid = sma(closes, 20); sd = stdev(closes, 20); up_b, lo_b = mid + 2 * sd, mid - 2 * sd
    widths = []
    for k in range(120, 0, -1):
        seg = closes[-k - 20:-k] if k else closes[-20:]
        if len(seg) == 20:
            m = sum(seg) / 20; widths.append(4 * math.sqrt(sum((v - m) ** 2 for v in seg) / 20) / m)
    bw = 4 * sd / mid; squeeze = widths and bw <= sorted(widths)[max(0, int(len(widths) * 0.2) - 1)]
    if price >= up_b: S('Bollinger Bands', 'SELL', 1, f'Prețul atinge banda de sus ({r2(up_b)}): întins pe termen scurt. Într-un trend puternic poate continua.', info=f'Banda de mijloc {r2(mid)} e ținta unei corecții.')
    elif price <= lo_b: S('Bollinger Bands', 'BUY', 1, f'Prețul atinge banda de jos ({r2(lo_b)}): întins în jos pe termen scurt.', info=f'Banda de mijloc {r2(mid)} e ținta unei reveniri.')
    elif squeeze: S('Bollinger Bands', 'AȘTEAPTĂ', 2, 'Benzile sunt foarte strânse (squeeze): de obicei urmează o mișcare mare. Direcția o dă spargerea.', info=f'Benzi: {r2(lo_b)} – {r2(up_b)}')
    else: S('Bollinger Bands', 'NEUTRU', 1, f'Prețul e în interiorul benzilor ({r2(lo_b)} – {r2(up_b)}).')

    # 7. Fibonacci retracement (last 60 days swing)
    seg = bars[-60:]
    i_hi = max(range(len(seg)), key=lambda i: seg[i]['h']); i_lo = min(range(len(seg)), key=lambda i: seg[i]['l'])
    H, Lw = seg[i_hi]['h'], seg[i_lo]['l']; rng = H - Lw
    if i_lo < i_hi:  # impulse up -> buy the retracement
        f382, f50, f618, f786 = H - 0.382 * rng, H - 0.5 * rng, H - 0.618 * rng, H - 0.786 * rng
        inzone = f618 <= price <= f382
        S('Fibonacci (retragere)', 'BUY' if inzone else 'AȘTEAPTĂ', 2 if inzone else 1,
          (f'Impuls în sus {r2(Lw)} → {r2(H)}. Prețul e în zona de aur 38.2–61.8% ({r2(f618)} – {r2(f382)}).' if inzone else
           f'Impuls în sus {r2(Lw)} → {r2(H)}. Zona de cumpărare: 50–61.8% ({r2(f618)} – {r2(f50)}).'),
          f50, f786 - 0.2 * A, H, H + 0.272 * rng, 'SL sub 78.6%, TP la maxim și extensia 127.2%.')
    else:  # impulse down -> sell the retracement
        f382, f50, f618, f786 = Lw + 0.382 * rng, Lw + 0.5 * rng, Lw + 0.618 * rng, Lw + 0.786 * rng
        inzone = f382 <= price <= f618
        S('Fibonacci (retragere)', 'SELL' if inzone else 'AȘTEAPTĂ', 2 if inzone else 1,
          (f'Impuls în jos {r2(H)} → {r2(Lw)}. Prețul e în zona de aur 38.2–61.8% ({r2(f382)} – {r2(f618)}).' if inzone else
           f'Impuls în jos {r2(H)} → {r2(Lw)}. Zona de vânzare: 50–61.8% ({r2(f50)} – {r2(f618)}).'),
          f50, f786 + 0.2 * A, Lw, Lw - 0.272 * rng, 'SL peste 78.6%, TP la minim și extensia 127.2%.')

    # 8. Daily pivot points (intraday)
    Pp = piv['P']
    if price > Pp: S('Pivot points (intraday)', 'BUY', 1, f'Prețul e peste pivotul zilei ({r2(Pp)}): bias intraday pozitiv. Ținte R1 {r2(piv["R1"])}, R2 {r2(piv["R2"])}.')
    else: S('Pivot points (intraday)', 'SELL', 1, f'Prețul e sub pivotul zilei ({r2(Pp)}): bias intraday negativ. Ținte S1 {r2(piv["S1"])}, S2 {r2(piv["S2"])}.')

    # 9. Fair Value Gaps (Smart Money)
    fvg_bull = fvg_bear = None
    b30 = bars[-40:]
    for i in range(2, len(b30)):
        a, c = b30[i - 2], b30[i]
        later = b30[i + 1:]
        if c['l'] > a['h'] and all(x['l'] > a['h'] for x in later): fvg_bull = (a['h'], c['l'])
        if c['h'] < a['l'] and all(x['h'] < a['l'] for x in later): fvg_bear = (c['h'], a['l'])
    parts = []
    if fvg_bull and fvg_bull[1] < price: parts.append(f'FVG bullish neumplut {r2(fvg_bull[0])} – {r2(fvg_bull[1])} (zonă unde prețul poate reveni și cumpărătorii pot intra)')
    if fvg_bear and fvg_bear[0] > price: parts.append(f'FVG bearish neumplut {r2(fvg_bear[0])} – {r2(fvg_bear[1])} (zonă unde vânzătorii pot intra)')
    if parts:
        v = 'BUY' if (fvg_bull and not fvg_bear) else 'SELL' if (fvg_bear and not fvg_bull) else 'AȘTEAPTĂ'
        S('Smart Money (Fair Value Gap)', v, 1, '; '.join(parts) + '.')
    else:
        S('Smart Money (Fair Value Gap)', 'NEUTRU', 1, 'Niciun gol de preț (FVG) neumplut aproape de preț pe zilnic.')

    # 10. Multi-timeframe alignment
    dirs = [mtf.get(k, {}) and mtf[k].get('dir') for k in ('D1', 'H4', 'H1') if mtf.get(k)]
    if dirs and all(d == 'UP' for d in dirs): S('Aliniere timeframe-uri', 'BUY', 3, 'D1, H4 și H1 arată toate în sus. Cele mai bune intrări sunt în direcția asta.')
    elif dirs and all(d == 'DOWN' for d in dirs): S('Aliniere timeframe-uri', 'SELL', 3, 'D1, H4 și H1 arată toate în jos. Cele mai bune intrări sunt în direcția asta.')
    else: S('Aliniere timeframe-uri', 'AȘTEAPTĂ', 1, 'Timeframe-urile nu sunt de acord (' + ', '.join(f'{k} {mtf[k]["dir"]}' for k in ('D1','H4','H1') if mtf.get(k)) + '). Piață mai greu de tranzacționat.')


    # 11. Ichimoku (9/26/52)
    def mid_hl(seq): return (max(b['h'] for b in seq) + min(b['l'] for b in seq)) / 2
    tenkan, kijun = mid_hl(bars[-9:]), mid_hl(bars[-26:])
    spanA = (mid_hl(bars[-35:-26]) + mid_hl(bars[-52:-26])) / 2   # cloud plotted 26 bars ago -> today
    spanB = mid_hl(bars[-78:-26])
    ctop, cbot = max(spanA, spanB), min(spanA, spanB)
    if price > ctop and tenkan > kijun:
        S('Ichimoku Cloud', 'BUY', 3 if spanA > spanB else 2, f'Prețul e deasupra norului ({r2(cbot)} – {r2(ctop)}) și Tenkan ({r2(tenkan)}) e peste Kijun ({r2(kijun)}): trend ascendent confirmat.',
          kijun, kijun - 1.0 * A, kijun + 1.5 * A, kijun + 3 * A, 'Intrare la retragere spre Kijun, SL 1×ATR sub Kijun.')
    elif price < cbot and tenkan < kijun:
        S('Ichimoku Cloud', 'SELL', 3 if spanA < spanB else 2, f'Prețul e sub nor ({r2(cbot)} – {r2(ctop)}) și Tenkan ({r2(tenkan)}) e sub Kijun ({r2(kijun)}): trend descendent confirmat.',
          kijun, kijun + 1.0 * A, kijun - 1.5 * A, kijun - 3 * A, 'Intrare la revenire spre Kijun, SL 1×ATR peste Kijun.')
    else:
        S('Ichimoku Cloud', 'AȘTEAPTĂ', 1, f'Prețul e în nor sau semnalele se contrazic (nor {r2(cbot)} – {r2(ctop)}, Kijun {r2(kijun)}). Zonă de indecizie.')

    # 12. Stochastic (14,3,3)
    ks = []
    for i in range(len(bars) - 20, len(bars)):
        seg14 = bars[i - 13:i + 1]; hh14 = max(b['h'] for b in seg14); ll14 = min(b['l'] for b in seg14)
        ks.append(100 * (bars[i]['c'] - ll14) / max(1e-9, hh14 - ll14))
    kS = [sum(ks[i - 2:i + 1]) / 3 for i in range(2, len(ks))]      # slow %K
    dS = [sum(kS[i - 2:i + 1]) / 3 for i in range(2, len(kS))]      # %D
    k0, k1, d0, d1 = kS[-1], kS[-2], dS[-1], dS[-2]
    if k1 <= d1 and k0 > d0 and k0 < 30:
        S('Stochastic (14,3,3)', 'BUY', 2, f'%K ({round(k0)}) a trecut peste %D ({round(d0)}) în zona de supravânzare: semnal de revenire.', price, price - 1.0 * A, price + 1.2 * A, price + 2.2 * A)
    elif k1 >= d1 and k0 < d0 and k0 > 70:
        S('Stochastic (14,3,3)', 'SELL', 2, f'%K ({round(k0)}) a trecut sub %D ({round(d0)}) în zona de supracumpărare: semnal de corecție.', price, price + 1.0 * A, price - 1.2 * A, price - 2.2 * A)
    elif k0 > 80: S('Stochastic (14,3,3)', 'AȘTEAPTĂ', 1, f'Stochastic {round(k0)}: supracumpărat. Se așteaptă încrucișarea în jos pentru vânzare.')
    elif k0 < 20: S('Stochastic (14,3,3)', 'AȘTEAPTĂ', 1, f'Stochastic {round(k0)}: supravândut. Se așteaptă încrucișarea în sus pentru cumpărare.')
    else: S('Stochastic (14,3,3)', 'BUY' if k0 > d0 else 'SELL', 1, f'Stochastic {round(k0)} ' + ('peste' if k0 > d0 else 'sub') + f' linia de semnal ({round(d0)}), zonă neutră.')

    # 13. Price action on yesterday's completed candle
    y0, y1 = bars[-2], bars[-3]
    body = abs(y0['c'] - y0['o']); rngc = max(1e-9, y0['h'] - y0['l'])
    lw = min(y0['o'], y0['c']) - y0['l']; uw = y0['h'] - max(y0['o'], y0['c'])
    if y1['c'] < y1['o'] and y0['c'] > y0['o'] and y0['c'] >= y1['o'] and y0['o'] <= y1['c']:
        S('Price action (lumânări)', 'BUY', 2, 'Ieri s-a format un Bullish Engulfing: o lumânare verde a „înghițit” lumânarea roșie de dinainte. Cumpărătorii au preluat controlul.',
          y0['c'] - 0.3 * A, y0['l'] - 0.2 * A, y0['c'] + 1.2 * A, y0['c'] + 2.4 * A, 'SL sub minimul lumânării.')
    elif y1['c'] > y1['o'] and y0['c'] < y0['o'] and y0['o'] >= y1['c'] and y0['c'] <= y1['o']:
        S('Price action (lumânări)', 'SELL', 2, 'Ieri s-a format un Bearish Engulfing: o lumânare roșie a „înghițit” lumânarea verde de dinainte. Vânzătorii au preluat controlul.',
          y0['c'] + 0.3 * A, y0['h'] + 0.2 * A, y0['c'] - 1.2 * A, y0['c'] - 2.4 * A, 'SL peste maximul lumânării.')
    elif lw >= 2 * body and lw >= 0.55 * rngc:
        S('Price action (lumânări)', 'BUY', 2 if near_s else 1, 'Ieri s-a format un Pin Bar (ciocan): fitil lung în jos, piața a respins prețurile mici.',
          y0['c'], y0['l'] - 0.2 * A, y0['c'] + 1.2 * A, y0['c'] + 2.4 * A, 'Mai puternic dacă apare la un suport.')
    elif uw >= 2 * body and uw >= 0.55 * rngc:
        S('Price action (lumânări)', 'SELL', 2 if near_r else 1, 'Ieri s-a format un Shooting Star: fitil lung în sus, piața a respins prețurile mari.',
          y0['c'], y0['h'] + 0.2 * A, y0['c'] - 1.2 * A, y0['c'] - 2.4 * A, 'Mai puternic dacă apare la o rezistență.')
    elif y0['h'] <= y1['h'] and y0['l'] >= y1['l']:
        S('Price action (lumânări)', 'AȘTEAPTĂ', 1, f'Ieri a fost un Inside Bar (în interiorul zilei precedente). Cumpărare la spargerea lui {r2(y1["h"])}, vânzare la spargerea lui {r2(y1["l"])}.')
    else:
        S('Price action (lumânări)', 'NEUTRU', 1, 'Nicio formație clară de lumânări pe ziua de ieri.')

    # 14. ADX (14) + DI
    trs, pdm, ndm = [], [], []
    for p0, b in zip(bars[-60:], bars[-59:]):
        up_m, dn_m = b['h'] - p0['h'], p0['l'] - b['l']
        pdm.append(up_m if up_m > dn_m and up_m > 0 else 0); ndm.append(dn_m if dn_m > up_m and dn_m > 0 else 0)
        trs.append(max(b['h'] - b['l'], abs(b['h'] - p0['c']), abs(b['l'] - p0['c'])))
    def wild(v, n=14):
        a = sum(v[:n]); out = [a]
        for x in v[n:]: a = a - a / n + x; out.append(a)
        return out
    TRn, Pn, Nn = wild(trs), wild(pdm), wild(ndm)
    pdi = [100 * p_ / t for p_, t in zip(Pn, TRn)]; ndi = [100 * n_ / t for n_, t in zip(Nn, TRn)]
    dxs = [100 * abs(a - b) / max(1e-9, a + b) for a, b in zip(pdi, ndi)]
    adx_v = sum(dxs[:14]) / 14
    for x in dxs[14:]: adx_v = (adx_v * 13 + x) / 14
    if adx_v >= 25:
        v = 'BUY' if pdi[-1] > ndi[-1] else 'SELL'
        S('ADX (puterea trendului)', v, 3 if adx_v >= 35 else 2, f'ADX {round(adx_v)}: trend puternic. +DI {round(pdi[-1])} vs −DI {round(ndi[-1])} → direcția e ' + ('în sus.' if v == 'BUY' else 'în jos.'))
    elif adx_v < 20:
        S('ADX (puterea trendului)', 'AȘTEAPTĂ', 1, f'ADX {round(adx_v)}: nu există trend, piața merge lateral. Strategiile de trend dau semnale false; mai bune sunt cele de suport/rezistență.')
    else:
        S('ADX (puterea trendului)', 'NEUTRU', 1, f'ADX {round(adx_v)}: trend slab, în formare. +DI {round(pdi[-1])}, −DI {round(ndi[-1])}.')

    # 15. Supertrend (10, 3)
    atr10 = []; trl = []
    for p0, b in zip(bars[:-1], bars[1:]): trl.append(max(b['h'] - b['l'], abs(b['h'] - p0['c']), abs(b['l'] - p0['c'])))
    a10 = sum(trl[:10]) / 10; atr10 = [None] * 10 + [a10]
    for t in trl[10:]: a10 = (a10 * 9 + t) / 10; atr10.append(a10)
    fu = fl = None; dirn = 1; st_line = None; flips = []
    for i in range(11, len(bars)):
        b = bars[i]; hl2 = (b['h'] + b['l']) / 2; au = hl2 + 3 * atr10[i]; al = hl2 - 3 * atr10[i]
        pc = bars[i - 1]['c']
        fu = au if fu is None or au < fu or pc > fu else fu
        fl = al if fl is None or al > fl or pc < fl else fl
        nd = 1 if b['c'] > fu else -1 if b['c'] < fl else dirn
        if nd != dirn: flips.append(i)
        dirn = nd; st_line = fl if dirn == 1 else fu
    recent_flip = flips and flips[-1] >= len(bars) - 3
    if dirn == 1:
        S('Supertrend (10,3)', 'BUY', 3 if recent_flip else 2, ('Supertrend tocmai a întors în sus: semnal nou de cumpărare. ' if recent_flip else 'Supertrend e verde (sub preț): trendul e în sus. ') + f'Linia de urmărire: {r2(st_line)}.',
          price, st_line, price + 1.5 * (price - st_line), price + 3 * (price - st_line), 'SL pe linia Supertrend, care se mută în sus zi de zi (trailing stop).')
    else:
        S('Supertrend (10,3)', 'SELL', 3 if recent_flip else 2, ('Supertrend tocmai a întors în jos: semnal nou de vânzare. ' if recent_flip else 'Supertrend e roșu (peste preț): trendul e în jos. ') + f'Linia de urmărire: {r2(st_line)}.',
          price, st_line, price - 1.5 * (st_line - price), price - 3 * (st_line - price), 'SL pe linia Supertrend, care coboară zi de zi (trailing stop).')

    # 16. London breakout (Asian range, from hourly data converted to spot)
    try:
        if not h1: raise ValueError('no h1')
        off = price - h1[-1]['c']
        now_u = dt.datetime.utcnow(); d0 = now_u.date()
        asia = [b for b in h1 if dt.datetime.utcfromtimestamp(b['t']).date() == d0 and dt.datetime.utcfromtimestamp(b['t']).hour < 7]
        if len(asia) < 4: raise ValueError('asia range not formed')
        ah, al_ = max(b['h'] for b in asia) + off, min(b['l'] for b in asia) + off
        rng_a = ah - al_; last = h1[-1]['c'] + off
        if now_u.hour < 7:
            S('London breakout (range asiatic)', 'AȘTEAPTĂ', 1, f'Range-ul asiatic se formează încă ({r2(al_)} – {r2(ah)}). La deschiderea Londrei (ora 07:00 UTC) se urmărește spargerea.')
        elif last > ah:
            S('London breakout (range asiatic)', 'BUY', 2, f'Prețul a spart în sus range-ul asiatic ({r2(al_)} – {r2(ah)}).', ah, ah - rng_a * 0.5, ah + rng_a, ah + 2 * rng_a, 'SL la mijlocul range-ului, TP = 1× și 2× mărimea range-ului.')
        elif last < al_:
            S('London breakout (range asiatic)', 'SELL', 2, f'Prețul a spart în jos range-ul asiatic ({r2(al_)} – {r2(ah)}).', al_, al_ + rng_a * 0.5, al_ - rng_a, al_ - 2 * rng_a, 'SL la mijlocul range-ului, TP = 1× și 2× mărimea range-ului.')
        else:
            S('London breakout (range asiatic)', 'AȘTEAPTĂ', 1, f'Prețul e încă în range-ul asiatic ({r2(al_)} – {r2(ah)}). Cumpărare peste {r2(ah)}, vânzare sub {r2(al_)}.')
    except Exception as e:
        S('London breakout (range asiatic)', 'NEUTRU', 1, 'Date intraday indisponibile acum pentru range-ul asiatic.')

    # 17. Psychological round numbers ($50 / $100)
    step = 50.0
    rn_up, rn_dn = math.ceil(price / step) * step, math.floor(price / step) * step
    near_rn = min(rn_up - price, price - rn_dn)
    big = lambda v: ' (nivel de 100, mai puternic)' if v % 100 == 0 else ''
    if near_rn <= 0.2 * A:
        rn = rn_up if rn_up - price < price - rn_dn else rn_dn
        S('Niveluri psihologice', 'AȘTEAPTĂ', 2, f'Prețul e chiar lângă nivelul rotund {int(rn)}{big(rn)}. Aici apar des respingeri sau accelerări; se așteaptă reacția.')
    else:
        S('Niveluri psihologice', 'NEUTRU', 1, f'Cele mai apropiate niveluri rotunde: {int(rn_dn)}{big(rn_dn)} dedesubt și {int(rn_up)}{big(rn_up)} deasupra. Sunt folosite des ca ținte și pentru stop-uri.')

    # 18. EMA 9/21 crossover (short-term)
    e9s, e21s = ema(closes, 9), ema(closes, 21)
    cu = any(e9s[-k] > e21s[-k] and e9s[-k - 1] <= e21s[-k - 1] for k in range(1, 4))
    cd = any(e9s[-k] < e21s[-k] and e9s[-k - 1] >= e21s[-k - 1] for k in range(1, 4))
    if cu: S('EMA 9/21 (încrucișare)', 'BUY', 2, f'EMA9 a trecut peste EMA21 în ultimele 3 zile: impuls nou în sus. EMA21 = {r2(e21s[-1])}.', e21s[-1], e21s[-1] - 0.8 * A, e21s[-1] + 1.5 * A, e21s[-1] + 3 * A)
    elif cd: S('EMA 9/21 (încrucișare)', 'SELL', 2, f'EMA9 a trecut sub EMA21 în ultimele 3 zile: impuls nou în jos. EMA21 = {r2(e21s[-1])}.', e21s[-1], e21s[-1] + 0.8 * A, e21s[-1] - 1.5 * A, e21s[-1] - 3 * A)
    else: S('EMA 9/21 (încrucișare)', 'BUY' if e9s[-1] > e21s[-1] else 'SELL', 1, 'EMA9 e ' + ('peste' if e9s[-1] > e21s[-1] else 'sub') + f' EMA21 ({r2(e9s[-1])} vs {r2(e21s[-1])}), fără încrucișare recentă.')

    buy_w = sum(x['strength'] for x in strategies if x['verdict'] == 'BUY')
    sell_w = sum(x['strength'] for x in strategies if x['verdict'] == 'SELL')
    total_w = sum(x['strength'] for x in strategies)
    need = max(6, round(total_w * 0.3))
    if buy_w >= sell_w * 1.6 and buy_w >= need: conf = 'BUY'
    elif sell_w >= buy_w * 1.6 and sell_w >= need: conf = 'SELL'
    else: conf = 'AȘTEAPTĂ'
    confluence = {'verdict': conf, 'buy': buy_w, 'sell': sell_w, 'total': total_w,
                  'buyN': sum(1 for x in strategies if x['verdict'] == 'BUY'), 'sellN': sum(1 for x in strategies if x['verdict'] == 'SELL'),
                  'waitN': sum(1 for x in strategies if x['verdict'] in ('NEUTRU', 'AȘTEAPTĂ'))}

    # ---------- plain-language story + step-by-step plan ----------
    def pct(a, b): return (a - b) / b * 100
    wk = closes[-6] if len(closes) > 6 else closes[0]; mo = closes[-22] if len(closes) > 22 else closes[0]
    hi20 = max(b['h'] for b in bars[-20:]); lo20 = min(b['l'] for b in bars[-20:])
    atr_avg = sum(max(b['h'] - b['l'], 0) for b in bars[-60:]) / 60
    story = []
    story.append(f"Ieri aurul a închis la {r2(prev)}. Azi e la {r2(price)}, adică {'+' if price >= prev else ''}{r2(price - prev)} $ ({'+' if price >= prev else ''}{round(pct(price, prev), 2)}%).")
    story.append(f"În ultima săptămână: {'+' if price >= wk else ''}{round(pct(price, wk), 2)}%. În ultima lună: {'+' if price >= mo else ''}{round(pct(price, mo), 2)}%.")
    story.append(f"Pe ultimele 20 de zile a mers între {r2(lo20)} și {r2(hi20)}. Azi a făcut un maxim de {r2(bars[-1]['h'])} și un minim de {r2(bars[-1]['l'])}.")
    rng_today = bars[-1]['h'] - bars[-1]['l']
    story.append(f"Aurul se mișcă în medie cam {r2(A)} $ pe zi (ATR). " + ('Azi e mai agitat decât de obicei.' if rng_today > 1.2 * atr_avg else 'Azi e mai liniștit decât de obicei.' if rng_today < 0.6 * atr_avg else 'Azi volatilitatea e normală.'))

    where = []
    where.append(('Prețul e PESTE' if price > e20 else 'Prețul e SUB') + f" media de 20 de zile ({r2(e20)}), " + ('PESTE' if price > e50 else 'SUB') + f" cea de 50 ({r2(e50)}) și " + ('PESTE' if price > e200 else 'SUB') + f" cea de 200 ({r2(e200)}).")
    where.append(f"Cea mai apropiată rezistență (plafon) e la {r2(R1)}, la {r2(R1 - price)} $ deasupra. Cel mai apropiat suport (podea) e la {r2(S1)}, la {r2(price - S1)} $ dedesubt.")
    where.append(f"RSI e {round(R, 1)}: " + ('zonă de supracumpărare, cumpărătorii sunt obosiți.' if R > 70 else 'zonă de supravânzare, vânzătorii sunt obosiți.' if R < 30 else 'cumpărătorii au un ușor avantaj.' if R > 50 else 'vânzătorii au un ușor avantaj.'))
    trend_word = {'BULLISH': 'în sus (bullish)', 'BEARISH': 'în jos (bearish)', 'NEUTRU': 'fără o direcție clară (neutru)'}[bias]
    where.append(f"Pe ansamblu, trendul zilnic e {trend_word}.")

    conf = confluence['verdict']
    plan = []
    if conf in ('BUY', 'SELL'):
        sc0 = scen(conf); verb = 'cumpărare' if conf == 'BUY' else 'vânzare'
        toward = 'coboare' if conf == 'BUY' else 'urce'
        plan.append(f"Direcția de lucru azi: {verb.upper()} ({confluence['buyN' if conf=='BUY' else 'sellN']} din {len(strategies)} strategii sunt de acord).")
        plan.append(f"1. Nu intra la prețul actual. Așteaptă să {toward} în zona {sc0['zone'][0]} – {sc0['zone'][1]}.")
        plan.append("2. Când ajunge acolo, deschide graficul H1 (în tab-ul Live) și așteaptă o lumânare de confirmare: " + ('fitil lung în jos și închidere în sus.' if conf == 'BUY' else 'fitil lung în sus și închidere în jos.'))
        plan.append(f"3. Intră {verb} în jur de {sc0['entry']}, cu Stop Loss la {sc0['sl']} (risc {sc0['slDist']} $ pe uncie). Folosește calculatorul de risc pentru lot.")
        plan.append(f"4. La TP1 {sc0['tp1']} închide jumătate din poziție și mută SL-ul la prețul de intrare (tranzacție fără risc).")
        plan.append(f"5. Lasă restul să meargă spre TP2 {sc0['tp2']}.")
        plan.append(f"6. Dacă prețul nu ajunge în zonă azi, nu intri. {sc0['inval']} Atunci planul se anulează.")
    else:
        plan.append("Azi strategiile nu sunt de acord: cel mai bun lucru e să AȘTEPȚI. A nu tranzacționa e tot o decizie bună.")
        plan.append(f"1. Dacă o lumânare H4 se închide PESTE {r2(R1)}, se poate lua în calcul o cumpărare la revenirea spre acel nivel, cu SL sub {r2(R1 - 0.8 * A)}.")
        plan.append(f"2. Dacă o lumânare H4 se închide SUB {r2(S1)}, se poate lua în calcul o vânzare la revenirea spre acel nivel, cu SL peste {r2(S1 + 0.8 * A)}.")
        plan.append(f"3. Între {r2(S1)} și {r2(R1)} piața e „la mijloc”: intrările au raport risc/profit slab.")
        plan.append("4. Uită-te din nou după următoarea actualizare (din oră în oră).")

    avoid = ["Nu deschide poziții cu 30 de minute înainte și după o știre roșie pe USD.",
             "Nu muta Stop Loss-ul mai departe când prețul merge împotriva ta.",
             "Nu risca mai mult de 1–2% din cont pe o tranzacție. Dacă și 0.01 lot e prea mult, exersează pe demo.",
             "Nu intra de frică să nu pierzi mișcarea: dacă prețul a plecat fără tine, așteaptă următorul setup.",
             "Vinerea seara și duminica noaptea spread-ul pe aur poate fi mare."]

    # ---------- history: how did previous plans do? ----------
    history = []
    ptrades = []
    try:
        with open('xauusd.json') as f: old = json.load(f)
        history = old.get('history', [])
        ptrades = old.get('ptrades', [])
    except Exception:
        pass
    today_d = bars[-1]['d']
    idx = {b['d']: i for i, b in enumerate(bars)}
    OPEN = ('așteaptă intrarea', 'în desfășurare', 'TP1 atins')
    for h in history:
        if h.get('side') not in ('BUY', 'SELL') or h.get('status') not in OPEN: continue
        start = idx.get(h['date'])
        if start is None: continue
        later = bars[start + 1:]          # only bars after the plan was published
        state = 'wait'; status = 'așteaptă intrarea'
        buy = h['side'] == 'BUY'
        for b in later:
            if state == 'wait':
                touched = (b['l'] <= h['zone'][1]) if buy else (b['h'] >= h['zone'][0])
                if not touched: continue
                state = 'in'; status = 'în desfășurare'
            hit_sl = (b['l'] <= h['sl']) if buy else (b['h'] >= h['sl'])
            hit_tp1 = (b['h'] >= h['tp1']) if buy else (b['l'] <= h['tp1'])
            hit_tp2 = (b['h'] >= h['tp2']) if buy else (b['l'] <= h['tp2'])
            back_be = (b['l'] <= h['entry']) if buy else (b['h'] >= h['entry'])
            if state == 'in':
                if hit_sl: status = 'SL atins'; break
                if hit_tp2: status = 'TP2 atins'; break
                if hit_tp1: state = 'tp1'; status = 'TP1 atins'; continue
            elif state == 'tp1':
                if hit_tp2: status = 'TP2 atins'; break
                if back_be: status = 'TP1 + breakeven'; break
        if state == 'wait' and len(later) >= 3: status = 'intrarea nu s-a atins'
        h['status'] = status
    if history and history[-1]['date'] == today_d and history[-1]['status'] in ('așteaptă intrarea', 'fără tranzacție'):
        history.pop()   # plan for today not triggered yet -> refresh it with the latest hourly analysis
    if not history or history[-1]['date'] != today_d:
        if conf in ('BUY', 'SELL'):
            sc0 = scen(conf)
            history.append({'date': today_d, 'side': conf, 'entry': sc0['entry'], 'zone': sc0['zone'], 'sl': sc0['sl'], 'tp1': sc0['tp1'], 'tp2': sc0['tp2'], 'status': 'așteaptă intrarea'})
        else:
            history.append({'date': today_d, 'side': 'AȘTEAPTĂ', 'status': 'fără tranzacție'})
    history = history[-20:]
    done = [h for h in history if h['status'] in ('TP1 atins', 'TP2 atins', 'TP1 + breakeven', 'SL atins')]
    wins = sum(1 for h in done if h['status'] != 'SL atins')
    track = {'closed': len(done), 'wins': wins, 'rate': round(wins / len(done) * 100) if done else None}


    # ---------- paper trading: every strategy "enters" its own trades, tracked separately ----------
    now_iso = dt.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ')
    def sim(t):
        """Re-evaluate a paper trade from scratch on the daily bars after it was created (deterministic, hourly-safe)."""
        start = idx.get(t['date'])
        if start is None: return t
        later = bars[start + 1:]
        buy = t['side'] == 'BUY'; risk = abs(t['entry'] - t['sl'])
        state = 'open' if t['type'] == 'market' else 'pending'; status = 'deschisă' if state == 'open' else 'în așteptare'
        res_r = None; exit_p = None; n_open = 0
        for bi, b in enumerate(later):
            if state == 'pending':
                if (b['l'] <= t['entry'] <= b['h']) or (buy and b['l'] <= t['entry']) or ((not buy) and b['h'] >= t['entry']):
                    state = 'open'; status = 'deschisă'
                elif bi >= 4:
                    state = 'done'; status = 'expirată (nu s-a atins intrarea)'; break
                else: continue
            n_open += 1
            hit_sl = (b['l'] <= t['sl']) if buy else (b['h'] >= t['sl'])
            hit_tp1 = (b['h'] >= t['tp1']) if buy else (b['l'] <= t['tp1'])
            hit_tp2 = (b['h'] >= t['tp2']) if buy else (b['l'] <= t['tp2'])
            back_be = (b['l'] <= t['entry']) if buy else (b['h'] >= t['entry'])
            r1 = abs(t['tp1'] - t['entry']) / risk; r2_ = abs(t['tp2'] - t['entry']) / risk
            if state == 'open':
                if hit_sl: state = 'done'; status = 'pierdere (SL)'; res_r = -1.0; exit_p = t['sl']; break   # conservative: SL first on same bar
                if hit_tp2: state = 'done'; status = 'câștig (TP2)'; res_r = 0.5 * r1 + 0.5 * r2_; exit_p = t['tp2']; break
                if hit_tp1: state = 'tp1'; status = 'TP1 atins, restul fără risc'; continue
            elif state == 'tp1':
                if hit_tp2: state = 'done'; status = 'câștig (TP2)'; res_r = 0.5 * r1 + 0.5 * r2_; exit_p = t['tp2']; break
                if back_be: state = 'done'; status = 'câștig (TP1 + breakeven)'; res_r = 0.5 * r1; exit_p = t['entry']; break
            if n_open >= 20:
                cur = b['c']; mv = (cur - t['entry']) if buy else (t['entry'] - cur)
                base = 0.5 * r1 if state == 'tp1' else 0
                res_r = base + (0.5 if state == 'tp1' else 1) * mv / risk; exit_p = cur; state = 'done'
                status = 'închisă după 20 de zile'; break
        t['status'] = status; t['closed'] = state == 'done'
        t['resultR'] = round(res_r, 2) if res_r is not None else None
        t['pnlOz'] = round(res_r * risk, 2) if res_r is not None else None      # $ per 1 oz = 0.01 lot
        if state in ('open', 'tp1'):
            mv = (price - t['entry']) if buy else (t['entry'] - price)
            t['floatR'] = round(((0.5 * abs(t['tp1'] - t['entry']) / risk) + 0.5 * max(0, mv) / risk) if state == 'tp1' else mv / risk, 2)
            t['floatOz'] = round(t['floatR'] * risk, 2)
        else:
            t.pop('floatR', None); t.pop('floatOz', None)
        t['exit'] = r2(exit_p) if exit_p is not None else None
        return t

    old_status = {t['id']: t.get('status') for t in ptrades}
    events = []
    try:
        events = old.get('events', [])
    except Exception:
        events = []
    ptrades = [sim(t) for t in ptrades]
    open_ids = {t['sid'] for t in ptrades if not t['closed']}
    for x in strategies:
        if x['verdict'] not in ('BUY', 'SELL') or x.get('entry') is None or x['id'] in open_ids: continue
        if abs(x['entry'] - x['sl']) < 0.15 * A: continue          # ignore unrealistically tight stops
        market = abs(x['entry'] - price) <= 0.25 * A
        e = price if market else x['entry']
        shift = e - x['entry']
        t = {'id': f"{x['id']}-{today_d}-{len(ptrades)}", 'sid': x['id'], 'strat': x['name'], 'side': x['verdict'],
             'type': 'market' if market else 'limit', 'date': today_d, 'opened': now_iso,
             'entry': r2(e), 'sl': r2(x['sl'] + shift if market else x['sl']), 'tp1': r2(x['tp1'] + shift if market else x['tp1']),
             'tp2': r2(x['tp2'] + shift if market else x['tp2']), 'strength': x['strength']}
        # sanity: SL must be on the losing side
        if (t['side'] == 'BUY' and not (t['sl'] < t['entry'] < t['tp1'])) or (t['side'] == 'SELL' and not (t['sl'] > t['entry'] > t['tp1'])): continue
        ptrades.append(sim(t)); open_ids.add(x['id'])
    ptrades = ptrades[-600:]

    # ---------- events for push notifications (new trade / fill / TP / SL / expiry) ----------
    ICON = {'BUY': '🟢', 'SELL': '🔴'}
    for t in ptrades:
        pst = old_status.get(t['id']); cur = t['status']
        if pst == cur: continue
        lv = f"Intrare {t['entry']} · SL {t['sl']} · TP1 {t['tp1']} · TP2 {t['tp2']}"
        if pst is None:
            if t['type'] == 'market' and cur == 'deschisă':
                title = f"{ICON[t['side']]} {t['side']} deschis · {t['strat']}"; body = f"Strategia a intrat acum pe XAUUSD. {lv}"
            elif cur == 'în așteptare':
                title = f"🕒 Ordin {t['side']} pus · {t['strat']}"; body = f"Așteaptă prețul la {t['entry']}. SL {t['sl']} · TP1 {t['tp1']}"
            else:
                title = f"{ICON[t['side']]} {t['side']} · {t['strat']}"; body = f"{cur}. {lv}"
        elif cur == 'deschisă':
            title = f"{ICON[t['side']]} {t['side']} intrat · {t['strat']}"; body = f"Ordinul s-a executat la {t['entry']}. SL {t['sl']} · TP1 {t['tp1']}"
        elif cur.startswith('TP1 atins'):
            title = f"✅ TP1 atins · {t['strat']}"; body = f"{t['side']} de la {t['entry']}: jumătate închisă la {t['tp1']}, SL mutat la intrare."
        elif t['closed'] and t.get('resultR') is not None:
            won = t['resultR'] > 0
            title = f"{'🏆' if won else '❌'} {'Câștig' if won else 'Pierdere'} {('+' if won else '')}{t['resultR']}R · {t['strat']}"
            body = f"{t['side']} {t['entry']} → {t.get('exit')}: {cur}. {('+' if t['pnlOz'] >= 0 else '')}{t['pnlOz']}$ la 0.01 lot."
        elif t['closed']:
            title = f"⏸ Ordin expirat · {t['strat']}"; body = f"{t['side']} la {t['entry']} nu s-a executat în 5 zile."
        else:
            continue
        events.append({'id': f"{t['id']}|{cur}", 'sid': t['sid'], 't': now_iso, 'title': title, 'body': body})
    events = events[-80:]

    pstats = {}
    for t in ptrades:
        st_ = pstats.setdefault(t['sid'], {'sid': t['sid'], 'name': t['strat'], 'n': 0, 'wins': 0, 'losses': 0, 'r': 0.0, 'oz': 0.0, 'open': 0, 'pending': 0, 'expired': 0})
        st_['name'] = t['strat']
        if t['closed'] and t['resultR'] is not None:
            st_['n'] += 1; st_['r'] += t['resultR']; st_['oz'] += t['pnlOz']
            if t['resultR'] > 0: st_['wins'] += 1
            else: st_['losses'] += 1
        elif t['closed']: st_['expired'] += 1
        elif t['status'] == 'în așteptare': st_['pending'] += 1
        else: st_['open'] += 1
    for v in pstats.values():
        v['rate'] = round(v['wins'] / v['n'] * 100) if v['n'] else None
        v['r'] = round(v['r'], 2); v['oz'] = round(v['oz'], 2); v['avgR'] = round(v['r'] / v['n'], 2) if v['n'] else None
    tot = {'n': sum(v['n'] for v in pstats.values()), 'wins': sum(v['wins'] for v in pstats.values()),
           'r': round(sum(v['r'] for v in pstats.values()), 2), 'oz': round(sum(v['oz'] for v in pstats.values()), 2),
           'open': sum(v['open'] for v in pstats.values()), 'pending': sum(v['pending'] for v in pstats.values())}
    tot['rate'] = round(tot['wins'] / tot['n'] * 100) if tot['n'] else None

    out = {
        'symbol': 'XAUUSD', 'source': src + (' + preț live' if spot_used else ''), 'spotUsed': spot_used, 'barDate': bars[-1]['d'],
        'updated': dt.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ'),
        'price': r2(price), 'change': r2(price - prev), 'changePct': round((price - prev) / prev * 100, 2),
        'dayHigh': r2(bars[-1]['h']), 'dayLow': r2(bars[-1]['l']),
        'ema20': r2(e20), 'ema50': r2(e50), 'ema200': r2(e200), 'rsi': round(R, 1), 'atr': r2(A),
        'bias': bias, 'score': score, 'notes': notes,
        'levels': {'R2': r2(R2), 'R1': r2(R1), 'S1': r2(S1), 'S2': r2(S2)},
        'pivots': {k: r2(v) for k, v in piv.items()},
        'scenarios': [scen('BUY'), scen('SELL')],
        'strategies': strategies, 'confluence': confluence, 'mtf': mtf, 'session': session_now(),
        'fib': {'high': r2(H), 'low': r2(Lw)},
        'ptrades': ptrades, 'pstats': pstats, 'ptotal': tot, 'events': events,
        'story': story, 'where': where, 'plan': plan, 'avoid': avoid, 'history': history, 'track': track,
        'candles': [[b['d'], r2(b['o']), r2(b['h']), r2(b['l']), r2(b['c'])] for b in bars[-90:]],
        'ema20s': [r2(x) for x in ema(closes, 20)[-90:]],
        'ema50s': [r2(x) for x in ema(closes, 50)[-90:]],
    }
    with open('xauusd.json', 'w') as f: json.dump(out, f, ensure_ascii=False)
    print('ok', src, out['price'], bias, score)

if __name__ == '__main__':
    main()
