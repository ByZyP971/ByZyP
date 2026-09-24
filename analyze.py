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
    mtf = {'D1': {'dir': 'UP' if (price > e20 and e20 > e50) else 'DOWN' if (price < e20 and e20 < e50) else 'MIX', 'rsi': round(R, 1)}}
    try:
        h1 = load_h1()
        mtf['H4'] = trend_of(to_h4(h1)) if len(h1) >= 220 else None
        mtf['H1'] = trend_of(h1)
    except Exception as e:
        print('h1 unavailable:', e, file=sys.stderr)

    strategies = []
    def S(name, verdict, strength, why, entry=None, sl=None, tp1=None, tp2=None, info=''):
        d = {'name': name, 'verdict': verdict, 'strength': strength, 'why': why, 'info': info}
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

    buy_w = sum(x['strength'] for x in strategies if x['verdict'] == 'BUY')
    sell_w = sum(x['strength'] for x in strategies if x['verdict'] == 'SELL')
    total_w = sum(x['strength'] for x in strategies)
    if buy_w >= sell_w * 1.6 and buy_w >= 6: conf = 'BUY'
    elif sell_w >= buy_w * 1.6 and sell_w >= 6: conf = 'SELL'
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
    try:
        with open('xauusd.json') as f: old = json.load(f)
        history = old.get('history', [])
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
        'strategies': strategies, 'confluence': confluence, 'mtf': mtf, 'session': session_now(),
        'fib': {'high': r2(H), 'low': r2(Lw)},
        'story': story, 'where': where, 'plan': plan, 'avoid': avoid, 'history': history, 'track': track,
        'candles': [[b['d'], r2(b['o']), r2(b['h']), r2(b['l']), r2(b['c'])] for b in bars[-90:]],
        'ema20s': [r2(x) for x in ema(closes, 20)[-90:]],
        'ema50s': [r2(x) for x in ema(closes, 50)[-90:]],
    }
    with open('xauusd.json', 'w') as f: json.dump(out, f, ensure_ascii=False)
    print('ok', src, out['price'], bias, score)

if __name__ == '__main__':
    main()
