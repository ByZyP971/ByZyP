/* By ZyP — Corp · Recuperare · Antrenor */
(function(){
  'use strict';
  var esc = window.zEsc || function(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]; }); };
  function $(id){ return document.getElementById(id); }
  function pad(n){ return (n < 10 ? '0' : '') + n; }
  function dk(d){ return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function parse(k){ var p = k.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function num(v){ v = parseFloat(String(v).replace(',', '.')); return isFinite(v) ? v : null; }
  function f1(v){ return (Math.round(v * 10) / 10).toLocaleString('ro-RO', { minimumFractionDigits: 1, maximumFractionDigits: 1 }); }
  function toast(m){ if(window.zToast) window.zToast(m); }

  /* ---------- stocare: local + sincronizare în cont ---------- */
  function Store(key, doc, init){
    var s = null, t = null, cb = null;
    try{ s = JSON.parse(localStorage.getItem(key) || 'null'); }catch(e){}
    if(!s || typeof s !== 'object') s = init();
    function persist(){ try{ localStorage.setItem(key, JSON.stringify(s)); }catch(e){} }
    function attach(){
      try{
        if(!window.__byzypDb) return false;
        window.__byzypDb.doc(doc).onSnapshot(function(snap){
          if(!snap || !snap.exists) return; var d = snap.data();
          if(d && typeof d === 'object' && (d.at || 0) > (s.at || 0)){ s = d; persist(); if(cb) cb(); }
        });
        return true;
      }catch(e){ return false; }
    }
    var n = 0, iv = setInterval(function(){ n++; if(attach() || n > 90) clearInterval(iv); }, 1000);
    return {
      get:function(){ return s; },
      save:function(){ s.at = Date.now(); persist(); clearTimeout(t); t = setTimeout(function(){ try{ if(window.__byzypDb) window.__byzypDb.doc(doc).set(s); }catch(e){} }, 800); },
      onRemote:function(f){ cb = f; }
    };
  }
  var body = Store('zyp_body_v1', 'settings/body', function(){ return { sex:'', neck:'', waist:'', hip:'', log:{} }; });
  var sleep = Store('zyp_sleep_v1', 'settings/sleep', function(){ return { goal:8, wake:'07:00', bed:'23:00', log:{} }; });

  /* ---------- grafice (SVG) ---------- */
  function lineChart(pts, unit, goal){
    if(!pts.length) return '<div class="ft-empty">Nu sunt date încă.</div>';
    var W = 300, H = 120, pl = 8, pr = 8, pt = 14, pb = 20, vs = pts.map(function(p){ return p.v; });
    if(goal != null) vs = vs.concat([goal]);
    var mn = Math.min.apply(null, vs), mx = Math.max.apply(null, vs); if(mx - mn < 0.6){ mn -= 0.3; mx += 0.3; }
    var padv = (mx - mn) * 0.12; mn -= padv; mx += padv;
    function X(i){ return pts.length === 1 ? W / 2 : pl + i * (W - pl - pr) / (pts.length - 1); }
    function Y(v){ return pt + (mx - v) / (mx - mn) * (H - pt - pb); }
    var line = pts.map(function(p, i){ return (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(p.v).toFixed(1); }).join(' ');
    var dots = pts.map(function(p, i){ return '<circle cx="' + X(i).toFixed(1) + '" cy="' + Y(p.v).toFixed(1) + '" r="2.6" class="ft-dot"/>'; }).join('');
    var g = goal != null ? '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + Y(goal).toFixed(1) + '" y2="' + Y(goal).toFixed(1) + '" class="ft-goal"/><text x="' + (W - pr) + '" y="' + (Y(goal) - 3).toFixed(1) + '" text-anchor="end" class="ft-lbl">țintă ' + f1(goal) + '</text>' : '';
    var last = pts[pts.length - 1];
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" class="ft-svg" role="img">' + g + '<path d="' + line + '" class="ft-line" fill="none"/>' + dots +
      '<text x="' + pl + '" y="' + (H - 5) + '" class="ft-lbl">' + esc(pts[0].l) + '</text><text x="' + (W - pr) + '" y="' + (H - 5) + '" text-anchor="end" class="ft-lbl">' + esc(last.l) + '</text>' +
      '<text x="' + X(pts.length - 1).toFixed(1) + '" y="' + (Y(last.v) - 6).toFixed(1) + '" text-anchor="' + (pts.length > 1 ? 'end' : 'middle') + '" class="ft-val">' + f1(last.v) + ' ' + unit + '</text></svg>';
  }
  function barChart(pts, goal, unit){
    var W = 300, H = 120, pl = 6, pb = 20, pt = 14, mx = Math.max(goal || 0, Math.max.apply(null, pts.map(function(p){ return p.v; })) || 1) * 1.15;
    var bw = (W - pl * 2) / pts.length;
    var bars = pts.map(function(p, i){ var h = p.v ? p.v / mx * (H - pt - pb) : 0, ok = goal && p.v >= goal - 0.25;
      return '<rect x="' + (pl + i * bw + bw * 0.18).toFixed(1) + '" y="' + (H - pb - h).toFixed(1) + '" width="' + (bw * 0.64).toFixed(1) + '" height="' + h.toFixed(1) + '" rx="4" class="' + (p.v ? (ok ? 'ft-bar ok' : 'ft-bar') : 'ft-bar none') + '"/>' +
        '<text x="' + (pl + i * bw + bw / 2).toFixed(1) + '" y="' + (H - 5) + '" text-anchor="middle" class="ft-lbl">' + esc(p.l) + '</text>' +
        (p.v ? '<text x="' + (pl + i * bw + bw / 2).toFixed(1) + '" y="' + (H - pb - h - 3).toFixed(1) + '" text-anchor="middle" class="ft-val sm">' + f1(p.v) + '</text>' : ''); }).join('');
    var gl = goal ? '<line x1="' + pl + '" x2="' + (W - pl) + '" y1="' + (H - pb - goal / mx * (H - pt - pb)).toFixed(1) + '" y2="' + (H - pb - goal / mx * (H - pt - pb)).toFixed(1) + '" class="ft-goal"/>' : '';
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" class="ft-svg" role="img">' + gl + bars + '</svg>';
  }
  var MN = ['ian', 'feb', 'mar', 'apr', 'mai', 'iun', 'iul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  function aggregate(series, mode){      // series: [{d:'YYYY-MM-DD', v}]
    var buckets = {}, order = [];
    series.forEach(function(p){
      var d = parse(p.d), key, label;
      if(mode === 'm'){ key = d.getFullYear() + '-' + pad(d.getMonth() + 1); label = MN[d.getMonth()]; }
      else if(mode === 'w'){ var mon = new Date(d); mon.setDate(d.getDate() - ((d.getDay() + 6) % 7)); key = dk(mon); label = mon.getDate() + ' ' + MN[mon.getMonth()]; }
      else { key = p.d; label = d.getDate() + ' ' + MN[d.getMonth()]; }
      if(!buckets[key]){ buckets[key] = { s:0, n:0, l:label }; order.push(key); }
      buckets[key].s += p.v; buckets[key].n++;
    });
    order.sort();
    var lim = mode === 'm' ? 12 : mode === 'w' ? 12 : 30;
    return order.slice(-lim).map(function(k){ return { l:buckets[k].l, v:buckets[k].s / buckets[k].n }; });
  }

  /* =====================================================================
     CORP
     ===================================================================== */
  var bodyMode = 'w', bodySeries = 'kg';
  function navyBF(sex, cm, neck, waist, hip){
    if(!cm || !neck || !waist) return null;
    var v;
    if(sex === 'f'){ if(!hip || waist + hip - neck <= 0) return null; v = 495 / (1.29579 - 0.35004 * Math.log10(waist + hip - neck) + 0.22100 * Math.log10(cm)) - 450; }
    else { if(waist - neck <= 0) return null; v = 495 / (1.0324 - 0.19077 * Math.log10(waist - neck) + 0.15456 * Math.log10(cm)) - 450; }
    return isFinite(v) && v > 2 && v < 65 ? v : null;
  }
  function bfCat(sex, bf){
    var t = sex === 'f' ? [[14, 'Esențial'], [21, 'Atletic'], [25, 'Fit'], [32, 'Mediu']] : [[6, 'Esențial'], [14, 'Atletic'], [18, 'Fit'], [25, 'Mediu']];
    for(var i = 0; i < t.length; i++) if(bf < t[i][0]) return t[i][1];
    return 'Ridicat';
  }
  function renderBody(){
    var root = $('bodyRoot'); if(!root) return;
    var z = window.__zData && window.__zData() || {}, b = body.get(), sex = b.sex || z.sex || 'm', cm = z.cm || 172, kg = z.kg;
    var keys = Object.keys(b.log || {}).sort(), lastK = keys[keys.length - 1], last = lastK ? b.log[lastK] : null;
    var out = '';
    if(last){
      var bf = last.bf, kgNow = kg || last.kg, fat = kgNow * bf / 100, lean = kgNow - fat, musc = lean * 0.54;
      out += '<div class="ft-grid"><div><b>' + f1(bf) + '%</b><span>Grăsime corporală</span></div><div><b>' + f1(lean) + ' kg</b><span>Masă slabă</span></div><div><b>≈ ' + f1(musc) + ' kg</b><span>Masă musculară (estimare)</span></div><div><b>' + f1(fat) + ' kg</b><span>Masă grasă</span></div></div>' +
        '<div class="ft-note">Categorie: <b>' + bfCat(sex, bf) + '</b> · măsurat ' + esc(lastK) + '. Estimările sunt orientative: metoda cu centimetrul are o eroare de câteva procente, iar masa musculară e calculată din masa slabă. Compară trendul, nu un singur număr.</div>';
    }
    var BMI = kg ? kg / Math.pow(cm / 100, 2) : null;
    out += '<div class="ft-sub">Măsurătoare nouă</div><div class="ft-pills" id="bdSex"><button data-s="m" class="' + (sex === 'm' ? 'on' : '') + '">Bărbat</button><button data-s="f" class="' + (sex === 'f' ? 'on' : '') + '">Femeie</button></div>' +
      '<div class="ft-row3"><label>Gât (cm)<input id="bdNeck" inputmode="decimal" value="' + esc(b.neck) + '" placeholder="38"></label><label>Talie (cm)<input id="bdWaist" inputmode="decimal" value="' + esc(b.waist) + '" placeholder="84"></label>' +
      (sex === 'f' ? '<label>Șold (cm)<input id="bdHip" inputmode="decimal" value="' + esc(b.hip) + '" placeholder="96"></label>' : '') + '</div>' +
      '<div class="ft-note">Înălțimea (' + cm + ' cm) și greutatea ' + (kg ? '(' + f1(kg) + ' kg)' : '(notează-ți greutatea în fila Azi)') + ' se iau automat. Gâtul se măsoară sub mărul lui Adam, talia la nivelul buricului, relaxat.' + (BMI ? ' IMC: ' + f1(BMI) + '.' : '') + '</div>' +
      '<button class="ghost-btn" id="bdSave" style="width:100%">💾 Calculează și salvează</button><div class="hint" id="bdMsg"></div>';
    // grafice
    var ser = [];
    if(bodySeries === 'kg') ser = (z.weights || []).map(function(w){ return { d:w.d, v:w.v }; });
    else ser = keys.map(function(k){ return { d:k, v:b.log[k].bf }; });
    var pts = aggregate(ser, bodyMode);
    out += '<div class="ft-sub">Grafice</div><div class="ft-pills" id="bdSer"><button data-v="kg" class="' + (bodySeries === 'kg' ? 'on' : '') + '">Greutate</button><button data-v="bf" class="' + (bodySeries === 'bf' ? 'on' : '') + '">Grăsime %</button></div>' +
      '<div class="ft-pills" id="bdMode"><button data-m="d" class="' + (bodyMode === 'd' ? 'on' : '') + '">Zilnic</button><button data-m="w" class="' + (bodyMode === 'w' ? 'on' : '') + '">Săptămânal</button><button data-m="m" class="' + (bodyMode === 'm' ? 'on' : '') + '">Lunar</button></div>' +
      lineChart(pts, bodySeries === 'kg' ? 'kg' : '%') +
      (bodySeries === 'bf' && keys.length < 2 ? '<div class="ft-note">Fă măsurătoarea o dată la 1–2 săptămâni, în aceleași condiții (dimineața), ca să vezi trendul.</div>' : '');
    root.innerHTML = out;
    var p = root.querySelectorAll('#bdSex button'); p.forEach(function(x){ x.addEventListener('click', function(){ b.sex = x.getAttribute('data-s'); body.save(); renderBody(); }); });
    root.querySelectorAll('#bdSer button').forEach(function(x){ x.addEventListener('click', function(){ bodySeries = x.getAttribute('data-v'); renderBody(); }); });
    root.querySelectorAll('#bdMode button').forEach(function(x){ x.addEventListener('click', function(){ bodyMode = x.getAttribute('data-m'); renderBody(); }); });
    var sv = $('bdSave'); if(sv) sv.addEventListener('click', function(){
      var n = num($('bdNeck').value), w = num($('bdWaist').value), h = $('bdHip') ? num($('bdHip').value) : null, msg = $('bdMsg');
      if(!n || !w || n < 20 || n > 70 || w < 40 || w > 220){ msg.textContent = 'Completează gâtul și talia în centimetri (valori realiste).'; return; }
      if(sex === 'f' && (!h || h < 50 || h > 200)){ msg.textContent = 'Completează și șoldul.'; return; }
      var v = navyBF(sex, cm, n, w, h); if(!v){ msg.textContent = 'Valorile nu se potrivesc (talia trebuie să fie mai mare decât gâtul). Verifică măsurătorile.'; return; }
      b.sex = sex; b.neck = n; b.waist = w; b.hip = h || ''; b.log = b.log || {}; b.log[dk(new Date())] = { bf:Math.round(v * 10) / 10, neck:n, waist:w, hip:h || null, kg:kg || null };
      body.save(); toast('Măsurătoare salvată ✅'); renderBody();
    });
  }
  body.onRemote(renderBody);

  /* =====================================================================
     RECUPERARE
     ===================================================================== */
  var WARM = {
    gen:{ t:'🔥 Încălzire generală (6 minute)', s:[['Mers rapid sau bicicletă ușoară', 180, 'Pulsul crește treptat, să poți vorbi.'], ['Rotiri de brațe, înainte și înapoi', 30, 'Cercuri mari, relaxat.'], ['Rotiri de șolduri', 30, 'Cercuri largi, pe ambele sensuri.'], ['Genuflexiuni cu greutatea corpului', 45, 'Lent, spatele drept.'], ['Pisica și vaca (pe patru labe)', 30, 'Mobilizezi coloana, respiri adânc.'], ['Fandări cu pas înainte', 45, 'Alternezi picioarele, genunchiul urmărește vârful.']] },
    up:{ t:'💪 Înainte de zi de sus (piept, spate, umeri)', s:[['Cercuri cu brațele', 30, 'De la mici la mari.'], ['Tracțiune ușoară cu bandă sau față de pe loc', 30, 'Activezi omoplații.'], ['Flotări ușoare, pe genunchi', 40, '8–10 repetări curate.'], ['Rotații externe ale umărului (fără greutate)', 30, 'Cotul lipit de corp.'], ['Prima serie cu 50% din greutate', 60, '8–10 repetări ușoare la primul exercițiu.']] },
    low:{ t:'🦵 Înainte de zi de jos (picioare, fesieri)', s:[['Pod pentru fesieri', 40, 'Strângi fesierii sus 1 secundă.'], ['Genuflexiuni cu pauză jos', 45, 'Ții 2 secunde jos, genunchii afară.'], ['Balansări de picior, față-spate', 30, 'Cu ținere de perete, câte 10 pe picior.'], ['Fandări laterale', 40, 'Deschide șoldurile, călcâiul pe podea.'], ['Prima serie cu 50% din greutate', 60, '8–10 repetări ușoare la primul exercițiu.']] }
  };
  var STRETCH = [['Piept', 'Mâna pe perete, brațul întins în lateral, rotește corpul în partea opusă.', 30], ['Spate (poziția copilului)', 'În genunchi, șezi pe călcâie, brațele întinse în față, fruntea pe podea.', 40], ['Umeri', 'Brațul peste piept, tras ușor cu cealaltă mână.', 30], ['Triceps', 'Cotul sus lângă cap, palma pe spate, tragi ușor de cot.', 30], ['Cvadriceps', 'În picioare, tragi călcâiul spre fese, genunchii aproape.', 30], ['Femural', 'Șezi, un picior întins, te apleci din șolduri spre vârf.', 40], ['Fesieri', 'Pe spate, gleznă pe genunchi, tragi coapsa spre piept.', 40], ['Flexorii șoldului', 'Fandare joasă, genunchiul din spate pe podea, împingi șoldul în față.', 40], ['Gambe', 'Mâinile pe perete, un picior în spate, călcâiul pe podea.', 30]];
  var TIPS = ['Încălzește-te mereu, 5–8 minute, apoi fă 1–2 serii ușoare înainte de greutatea de lucru.', 'Crește greutatea treptat, cu 2,5 kg sau o repetare în plus, nu din salturi mari.', 'Tehnica înaintea greutății: dacă nu poți controla coborârea, scade greutatea.', 'Doarme 7–9 ore. Majoritatea accidentărilor apar pe oboseală.', 'Ia o zi sau două de odihnă pe săptămână și o săptămână mai ușoară (deload) la fiecare 4–8 săptămâni.', 'Nu antrena același mușchi greu în zile consecutive.', 'Bea apă înainte, în timpul și după antrenament.', 'Fă mobilitate pentru umeri, șolduri și glezne, sunt cele mai solicitate articulații.', 'La dureri musculare normale (după 24–72 ore) poți antrena ușor sau poți merge la plimbare.', 'Folosește aparatul sau un partener la greutăți mari (bară la piept, genuflexiuni grele).'];
  var REDFLAGS = ['durere ascuțită, bruscă, într-o articulație', 'amorțeală sau furnicături care nu trec', 'umflătură sau vânătaie după o mișcare greșită', 'durere în piept, amețeală, leșin sau lipsă de aer neobișnuită'];

  function hoursBetween(bed, wake){
    var b = bed.split(':'), w = wake.split(':'), bm = (+b[0]) * 60 + (+b[1]), wm = (+w[0]) * 60 + (+w[1]);
    var d = wm - bm; if(d <= 0) d += 1440; return d / 60;
  }
  function sleepWeek(){
    var s = sleep.get(), out = [], now = new Date(), sum = 0, n = 0;
    for(var i = 6; i >= 0; i--){ var d = new Date(now); d.setDate(now.getDate() - i); var k = dk(d), e = s.log && s.log[k]; out.push({ l:['D', 'L', 'Ma', 'Mi', 'J', 'V', 'S'][d.getDay()], v:e ? e.h : 0, k:k }); if(e){ sum += e.h; n++; } }
    return { pts:out, avg:n ? sum / n : null, n:n };
  }
  function bedtimeFor(wake, goal){ var w = wake.split(':'), m = (+w[0]) * 60 + (+w[1]) - Math.round(goal * 60) - 15; m = ((m % 1440) + 1440) % 1440; return pad(Math.floor(m / 60)) + ':' + pad(m % 60); }
  function readiness(){
    var z = window.__zData && window.__zData(), sw = sleepWeek(), s = sleep.get(), tk = dk(new Date()), last = s.log && s.log[tk];
    var score = 60, why = [];
    if(last){ var d = last.h - s.goal; if(d >= -0.25){ score += 20; why.push('somn bun (' + f1(last.h) + ' h)'); } else if(d > -1.5){ score += 5; why.push('somn puțin sub țintă (' + f1(last.h) + ' h)'); } else { score -= 20; why.push('somn scurt (' + f1(last.h) + ' h)'); } }
    else why.push('nu ai notat somnul de azi-noapte');
    if(z){
      var streak = 0, c = new Date(); c.setDate(c.getDate() - 1);
      for(var i = 0; i < 7; i++){ var k = dk(c), any = false, st = z.sets || {}; Object.keys(st).forEach(function(x){ if(x.split('|')[0] === k) Object.keys(st[x] || {}).forEach(function(q){ if(st[x][q]) any = true; }); }); if(any){ streak++; c.setDate(c.getDate() - 1); } else break; }
      if(streak >= 4){ score -= 25; why.push(streak + ' zile de antrenament la rând'); } else if(streak >= 3){ score -= 10; why.push(streak + ' zile la rând'); } else if(streak === 0) { score += 10; why.push('ai avut pauză ieri'); }
    }
    if(sw.avg != null && sw.n >= 3 && sw.avg < s.goal - 1){ score -= 10; why.push('media somnului e mică'); }
    score = Math.max(0, Math.min(100, score));
    var lab, tip;
    if(score >= 75){ lab = '🟢 Ești gata de un antrenament greu'; tip = 'Mergi pe planul normal. Încearcă ținta de greutate propusă.'; }
    else if(score >= 50){ lab = '🟡 Antrenament moderat'; tip = 'Fă planul, dar oprește-te la 1–2 repetări înainte de eșec și nu forța recorduri.'; }
    else if(score >= 30){ lab = '🟠 Mai ușor azi'; tip = 'Scade greutatea cu 10–15% sau fă o serie mai puțin. Fă mobilitate și stretching.'; }
    else { lab = '🔴 Zi de recuperare'; tip = 'Plimbare, stretching, apă și somn devreme. Mâine revii mai puternic.'; }
    return { score:score, lab:lab, tip:tip, why:why };
  }
  var guideTimer = null;
  function guided(title, steps){
    var ov = document.createElement('div'); ov.className = 'z-place'; document.body.appendChild(ov);
    var i = 0, left = 0, run = true;
    function end(){ clearInterval(guideTimer); ov.remove(); }
    function beep(){ try{ if(navigator.vibrate) navigator.vibrate(120); }catch(e){} }
    function draw(){
      if(i >= steps.length){ ov.innerHTML = '<div class="zp-box"><div class="zp-n">' + esc(title) + '</div><h3>Gata! 🎉</h3><p class="zp-s">Ai terminat toate exercițiile.</p><button class="zp-opt zp-go" id="gdX">Închide</button></div>'; $('gdX').addEventListener('click', end); clearInterval(guideTimer); beep(); return; }
      var st = steps[i]; left = st[1] || 30;
      ov.innerHTML = '<div class="zp-box"><div class="zp-n">' + esc(title) + ' · ' + (i + 1) + '/' + steps.length + '</div><h3>' + esc(st[0]) + '</h3><p class="zp-s">' + esc(st[2] || '') + '</p><div class="ft-count" id="gdT">' + left + ' s</div><button class="zp-opt" id="gdP">⏸ Pauză</button><button class="zp-opt" id="gdN">Următorul ›</button><button class="zp-x" id="gdX">Închide</button></div>';
      $('gdX').addEventListener('click', end);
      $('gdN').addEventListener('click', function(){ i++; draw(); });
      $('gdP').addEventListener('click', function(){ run = !run; $('gdP').textContent = run ? '⏸ Pauză' : '▶ Continuă'; });
    }
    clearInterval(guideTimer);
    guideTimer = setInterval(function(){ if(!run || i >= steps.length) return; left--; var t = $('gdT'); if(t) t.textContent = Math.max(left, 0) + ' s'; if(left <= 0){ beep(); i++; draw(); } }, 1000);
    draw();
  }
  function renderRec(){
    var root = $('recRoot'); if(!root) return;
    var s = sleep.get(), sw = sleepWeek(), rd = readiness(), tk = dk(new Date()), todayLog = s.log && s.log[tk];
    var out = '<div class="card"><div class="card-title">🔋 Cât de odihnit ești azi</div><div class="ft-ready"><b>' + rd.lab + '</b><span>' + esc(rd.tip) + '</span></div><div class="ft-note">Pe baza: ' + esc(rd.why.join(', ')) + '. Scorul e o recomandare simplă, nu o măsurătoare medicală.</div></div>';
    out += '<div class="card"><div class="card-title">😴 Somn</div>' +
      '<div class="ft-row3"><label>Te-ai culcat<input type="time" id="slBed" value="' + esc(todayLog ? todayLog.bed : s.bed) + '"></label><label>Te-ai trezit<input type="time" id="slWake" value="' + esc(todayLog ? todayLog.wake : s.wake) + '"></label><label>Țintă (ore)<input type="number" id="slGoal" min="5" max="11" step="0.5" value="' + s.goal + '"></label></div>' +
      '<button class="ghost-btn" id="slSave" style="width:100%">💾 Salvez somnul de azi-noapte</button><div class="hint" id="slMsg"></div>' +
      barChart(sw.pts, s.goal, 'h') +
      '<div class="ft-note">' + (sw.avg != null ? 'Media ultimelor zile notate: <b>' + f1(sw.avg) + ' h</b> din ' + f1(s.goal) + ' h. ' + (sw.avg < s.goal - 1 ? 'Ești în deficit de somn, scade intensitatea și culcă-te mai devreme.' : sw.avg < s.goal - 0.25 ? 'Aproape de țintă, încă puțin mai devreme la culcare.' : 'Foarte bine, somnul susține creșterea musculară.') : 'Notează somnul câteva zile ca să vezi media.') + '</div>' +
      '<div class="ft-note">🌙 Ca să dormi <b>' + f1(s.goal) + ' h</b> și să te trezești la <b>' + esc(s.wake) + '</b>, culcă-te în jurul orei <b>' + bedtimeFor(s.wake, s.goal) + '</b> (inclusiv ~15 min ca să adormi). Evită ecranele și cofeina cu 1–2 ore înainte.</div></div>';
    var wk = [['gen', WARM.gen], ['up', WARM.up], ['low', WARM.low]];
    out += '<div class="card"><div class="card-title">🔥 Încălzire înainte de antrenament</div>' + wk.map(function(w){
      return '<details class="ft-det"><summary>' + esc(w[1].t) + '</summary><ol>' + w[1].s.map(function(x){ return '<li><b>' + esc(x[0]) + '</b> · ' + x[1] + ' s<br><span>' + esc(x[2]) + '</span></li>'; }).join('') + '</ol><button class="ghost-btn" data-warm="' + w[0] + '">▶ Pornește ghidat</button></details>'; }).join('') + '</div>';
    out += '<div class="card"><div class="card-title">🧘 Stretching după antrenament</div><div class="hint" style="margin-top:0">Ține fiecare poziție 30–40 de secunde, pe fiecare parte, fără durere ascuțită. Stretchingul static se face după antrenament, nu înainte.</div><details class="ft-det"><summary>Vezi cele ' + STRETCH.length + ' poziții</summary><ol>' + STRETCH.map(function(x){ return '<li><b>' + esc(x[0]) + '</b> · ' + x[2] + ' s<br><span>' + esc(x[1]) + '</span></li>'; }).join('') + '</ol></details><button class="ghost-btn" id="stGo" style="width:100%;margin-top:8px">▶ Pornește rutina ghidată (' + Math.round(STRETCH.reduce(function(a, x){ return a + x[2]; }, 0) / 60) + ' min)</button></div>';
    out += '<div class="card"><div class="card-title">🛡️ Prevenirea accidentărilor</div><ul class="ft-ul">' + TIPS.map(function(t){ return '<li>' + esc(t) + '</li>'; }).join('') + '</ul><div class="ft-warn"><b>Oprește antrenamentul și întreabă un medic dacă ai:</b><ul>' + REDFLAGS.map(function(t){ return '<li>' + esc(t) + '</li>'; }).join('') + '</ul></div><div class="ft-note">Informațiile sunt generale și nu înlocuiesc sfatul unui medic sau antrenor.</div></div>';
    root.innerHTML = out;
    $('slSave').addEventListener('click', function(){
      var bed = $('slBed').value, wake = $('slWake').value, goal = num($('slGoal').value), m = $('slMsg');
      if(!bed || !wake){ m.textContent = 'Completează ora de culcare și de trezire.'; return; }
      if(!goal || goal < 5 || goal > 11) goal = 8;
      var h = hoursBetween(bed, wake); if(h > 14){ m.textContent = 'Verifică orele, ies mai mult de 14 ore.'; return; }
      s.goal = goal; s.bed = bed; s.wake = wake; s.log = s.log || {}; s.log[tk] = { bed:bed, wake:wake, h:Math.round(h * 10) / 10 };
      var keep = {}; Object.keys(s.log).sort().slice(-120).forEach(function(k){ keep[k] = s.log[k]; }); s.log = keep;
      sleep.save(); toast('Somn salvat: ' + f1(h) + ' h'); renderRec();
    });
    root.querySelectorAll('[data-warm]').forEach(function(b){ b.addEventListener('click', function(){ var w = WARM[b.getAttribute('data-warm')]; guided('Încălzire', w.s); }); });
    $('stGo').addEventListener('click', function(){ guided('Stretching', STRETCH.map(function(x){ return [x[0], x[2], x[1]]; })); });
  }
  sleep.onRemote(renderRec);

  /* =====================================================================
     ANTRENOR
     ===================================================================== */
  var GOALS = { gain:['Masă musculară', '💪'], maintain:['Menținere', '⚖️'], lose:['Slăbit', '🔥'] };
  var PHASE_DAYS = { 1:5, 2:6, 3:3, 4:4, 5:2, 6:4 };
  function slope(ws){        // kg pe săptămână, regresie liniară
    var n = ws.length; if(n < 3) return null;
    var t0 = parse(ws[0].d).getTime(), xs = ws.map(function(w){ return (parse(w.d).getTime() - t0) / 86400000; });
    if(xs[n - 1] < 6) return null;
    var mx = 0, my = 0, i; for(i = 0; i < n; i++){ mx += xs[i]; my += ws[i].v; } mx /= n; my /= n;
    var num_ = 0, den = 0; for(i = 0; i < n; i++){ num_ += (xs[i] - mx) * (ws[i].v - my); den += (xs[i] - mx) * (xs[i] - mx); }
    return den ? num_ / den * 7 : null;
  }
  function analyze(){
    var z = window.__zData && window.__zData(); if(!z) return null;
    var rec = [], cards = [], goal = z.goal || 'maintain';
    // 1. greutate
    var cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 21); var recent = z.weights.filter(function(w){ return parse(w.d) >= cutoff; });
    var sl = slope(recent), pct = sl != null && z.kg ? sl / z.kg * 100 : null;
    if(pct == null){ cards.push(['⚖️', 'Greutate', 'Notează-ți greutatea în fila Azi de 3–4 ori pe săptămână, câteva săptămâni. Atunci pot calcula ritmul și ajusta caloriile.']); rec.push('Notează greutatea de 3–4 ori pe săptămână, dimineața.'); }
    else {
      var txt = (sl >= 0 ? '+' : '') + f1(sl) + ' kg/săptămână (' + (pct >= 0 ? '+' : '') + pct.toFixed(2).replace('.', ',') + '% din greutate)', kc = z.kcal, adj = 0, msg;
      if(goal === 'gain'){ if(pct < 0.1){ adj = 150; msg = 'Crești prea încet sau deloc.'; } else if(pct > 0.6){ adj = -150; msg = 'Crești prea repede, mare parte poate fi grăsime.'; } else msg = 'Ritm bun pentru masă musculară curată.'; }
      else if(goal === 'lose'){ if(pct > -0.3){ adj = -150; msg = 'Scazi prea încet.'; } else if(pct < -1.2){ adj = 150; msg = 'Scazi prea repede, riști să pierzi și mușchi.'; } else msg = 'Ritm sănătos de slăbit.'; }
      else { if(pct > 0.3){ adj = -100; msg = 'Urci ușor în greutate.'; } else if(pct < -0.3){ adj = 100; msg = 'Scazi ușor în greutate.'; } else msg = 'Greutatea e stabilă, cum ai vrut.'; }
      var line = txt + '. ' + msg + (adj && kc ? ' Încearcă <b>' + (adj > 0 ? '+' : '') + adj + ' kcal</b> pe zi (de la ' + kc + ' la ' + (kc + adj) + ') timp de 2 săptămâni, apoi vezi iar.' : '');
      cards.push(['⚖️', 'Greutate', line]); if(adj) rec.push('Calorii: ' + (adj > 0 ? 'adaugă' : 'scade') + ' ' + Math.abs(adj) + ' kcal pe zi 2 săptămâni.');
    }
    // 2. antrenament
    var wk = z.week, want = PHASE_DAYS[z.phase] || 3;
    if(wk){
      var a = wk.cur, p = wk.prev, m = 'Săptămâna asta: <b>' + a.w + '</b> din ' + want + ' antrenamente (' + a.s + ' serii). Săptămâna trecută: <b>' + p.w + '</b> (' + p.s + ' serii).';
      if(p.w === 0 && a.w === 0){ m += ' Bifează seriile în fila Sală, ca să pot vedea progresul.'; }
      else if(p.w < want - 1 && p.w < 3 && z.phase !== 5){ m += ' Programul tău cere mult. Un program cu mai puține zile, făcut constant, bate unul ambițios făcut pe jumătate.'; rec.push('Alege un program cu mai puține zile și fă-l constant.'); }
      else if(p.s && a.s >= p.s) m += ' Ai volum mai mare decât săptămâna trecută, bravo!';
      cards.push(['🏋️', 'Antrenamente', m]);
    }
    // 3. forță
    var pr = [], plat = [], today = new Date(), c28 = new Date(), k28; c28.setDate(today.getDate() - 28); k28 = dk(c28);
    Object.keys(z.klog).forEach(function(n){
      var L = (z.klog[n] || []).slice().sort(function(a, b){ return a.d < b.d ? -1 : 1; }); if(L.length < 2) return;
      var best = 0, bi = -1; L.forEach(function(x, i){ if(x.kg > best){ best = x.kg; bi = i; } });
      var prior = 0; L.slice(0, -1).forEach(function(x){ if(x.kg > prior) prior = x.kg; });
      if(L[L.length - 1].d >= k28 && L[L.length - 1].kg > prior) pr.push(n + ' ' + L[L.length - 1].kg + ' kg');
      else if(L.length >= 4 && bi <= L.length - 4) plat.push(n + ' (' + best + ' kg)');
    });
    if(pr.length) cards.push(['🏆', 'Recorduri noi', pr.slice(0, 3).map(esc).join(' · ')]);
    if(plat.length){ cards.push(['📉', 'Platou', 'Nu ai mai crescut la: ' + plat.slice(0, 3).map(esc).join(', ') + '. Încearcă o repetare în plus la fiecare serie, dormi mai mult sau fă o săptămână mai ușoară.']); rec.push('Platou la ' + plat[0].split(' (')[0] + ': încearcă +1 repetare sau o săptămână mai ușoară.'); }
    // 4. somn
    var sw = sleepWeek();
    if(sw.avg != null){ var low = sw.avg < sleep.get().goal - 1; cards.push(['😴', 'Somn', 'Media ta: <b>' + f1(sw.avg) + ' h</b>. ' + (low ? 'Prea puțin pentru recuperare și creștere. Încearcă să te culci cu 30–45 min mai devreme.' : 'Ok pentru recuperare.')]); if(low) rec.push('Culcă-te mai devreme, somnul e cel mai ieftin supliment.'); }
    else rec.push('Notează somnul în fila Recuperare, câteva zile.');
    // 5. proteine
    if(z.prot) cards.push(['🍗', 'Proteine', 'Ținta ta: <b>' + z.prot + ' g</b> pe zi (' + z.kcal + ' kcal). Împarte-le în 3–4 mese de 25–40 g.']);
    return { cards:cards, rec:rec, goal:goal, z:z };
  }

  /* ---- bază de cunoștințe: răspunsuri la întrebări ---- */
  var KB = [
    { k:['durere piept', 'durere in piept', 'dureri in piept', 'doare pieptul', 'ameteal', 'ameteli', 'lesin', 'nu pot respira', 'lipsa de aer', 'amorteal', 'furnicaturi'], a:'Dacă ai durere în piept, amețeală, leșin sau amorțeală, oprește antrenamentul și vorbește cu un medic. Nu forța și nu aștepta să treacă.' },
    { k:['creatin'], a:'Creatina monohidrat e unul dintre cele mai studiate suplimente pentru forță. De obicei se iau 3–5 g pe zi, în fiecare zi, oricând, cu apă. Nu e nevoie de „încărcare". Dacă ai probleme de rinichi sau iei medicamente, întreabă mai întâi medicul.' },
    { k:['whey', 'proteina praf', 'proteină praf', 'shake'], a:'Whey e doar o sursă comodă de proteină. Contează totalul pe zi, nu momentul. O porție are de obicei 20–40 g, după antrenament sau oricând îți lipsesc proteine. Dacă ai intoleranță la lactoză, alege izolat sau proteină vegetală.' },
    { k:['proteine', 'proteina', 'cate proteine', 'câte proteine'], a:'Pentru masă musculară, ținta uzuală e 1,6–2,2 g proteine pe kg corp pe zi. Aplicația îți calculează ținta în fila Mâncare, pe baza greutății tale. Împarte-o în 3–4 mese.' },
    { k:['omega', 'peste gras', 'pește gras'], a:'Omega-3 (EPA+DHA): de obicei 1–2 g pe zi împreună, la masă, sau pește gras de 2 ori pe săptămână. Dacă iei anticoagulante sau ai o boală, cere sfatul medicului. Respectă eticheta produsului.' },
    { k:['vitamina d', 'd3', 'k2'], a:'Vitamina D3 se ia la o masă cu grăsimi, iar K2 se asociază des cu ea. Doza depinde de analize și de eticheta produsului. Doze mari (peste 4.000 UI pe zi) se iau doar la recomandarea medicului.' },
    { k:['zinc'], a:'Zincul se ia la masă (pe stomacul gol poate da greață). Necesarul zilnic e de 8–11 mg. Peste 40 mg pe zi nu e recomandat pe termen lung. Respectă eticheta.' },
    { k:['magneziu'], a:'Magneziul se ia de obicei seara, 200–400 mg, forme ca glicinat sau citrat. Oxidul de magneziu poate da diaree. Poate ajuta la relaxare și somn.' },
    { k:['cofeina', 'cofeină', 'cafea', 'pre workout', 'preworkout'], a:'Cofeina ajută performanța în doze de aproximativ 3 mg/kg, la 30–60 minute înainte de antrenament. Evită-o seara, ca să nu-ți strice somnul. Dacă ai probleme cu inima sau tensiunea, întreabă medicul.' },
    { k:['somn', 'dormi', 'culc'], a:'Țintește 7–9 ore de somn. Somnul scurt scade forța, recuperarea și dispoziția. Notează-ți somnul în fila Sală → Recuperare.' },
    { k:['pauza intre', 'pauză între', 'odihna intre', 'cat ma odihnesc', 'cât mă odihnesc'], a:'La exerciții compuse (genuflexiuni, împins, ramat) odihnește-te 2–3 minute. La izolări, 60–90 de secunde.' },
    { k:['repetari', 'repetări', 'serii', 'cate serii', 'câte serii'], a:'Pentru masă: 6–12 repetări la compuse, 10–15 la izolări, aproape de eșec (cu 1–3 repetări rezervă). În total 10–20 de serii pe grupă pe săptămână, repartizate în 2 zile.' },
    { k:['frecventa', 'frecvență', 'de cate ori', 'de câte ori'], a:'O grupă musculară se antrenează bine de 2 ori pe săptămână. Începătorii pot merge cu 3 zile tot corpul.' },
    { k:['platou', 'nu mai cresc', 'stagnez', 'blocat'], a:'La platou verifică în ordine: somn, calorii și proteine suficiente, tehnica, apoi progresia (încearcă o repetare în plus înainte să crești greutatea). Dacă tot nu merge, fă o săptămână mai ușoară (deload).' },
    { k:['deload'], a:'Deload = o săptămână cu volum mai mic (aproximativ jumătate din serii) și greutăți puțin mai mici, la fiecare 4–8 săptămâni, ca să te recuperezi.' },
    { k:['cardio', 'alerg', 'pasi', 'pași'], a:'2–3 sesiuni de cardio ușor de 20–30 de minute pe săptămână, sau 7.000–10.000 de pași pe zi, ajută inima și recuperarea fără să-ți strice câștigul de masă.' },
    { k:['apa', 'apă', 'hidrat'], a:'Aproximativ 35 ml apă pe kg corp, plus 0,5 L în zilele cu antrenament. Aplicația îți calculează ținta în fila Mâncare. Urina galben-pal e semn bun.' },
    { k:['cat de repede', 'cât de repede', 'cand vad rezultate', 'când văd rezultate', 'rezultate'], a:'Forța crește vizibil în 4–8 săptămâni. Schimbarea vizuală durează de obicei 8–12 săptămâni. Începătorii pot câștiga aproximativ 0,5–1 kg de mușchi pe lună la început, mult mai lent după primul an.' },
    { k:['surplus', 'masa musculara', 'masă musculară', 'sa cresc in masa', 'să cresc în masă', 'bulk'], a:'Pentru masă ai nevoie de un mic surplus caloric (aproximativ +250–500 kcal sau +10%), proteine suficiente, antrenament progresiv și somn. Aplicația ți-l calculează când alegi obiectivul „Masă musculară".' },
    { k:['deficit', 'slabesc', 'slăbesc', 'grasime', 'grăsime', 'slabit', 'slăbit'], a:'Pentru slăbit: deficit de 300–500 kcal, proteină mare (2 g/kg), continui antrenamentul cu greutăți și te ții de ritm de 0,5–1% din greutate pe săptămână.' },
    { k:['febra musculara', 'febră musculară', 'doms', 'agujeala', 'agujeală'], a:'Febra musculară apare la 24–72 de ore și e normală după un antrenament nou. Mișcarea ușoară, somnul și proteinele ajută. Durerea ascuțită într-o articulație nu e febră musculară: oprește-te.' },
    { k:['accidentare', 'durere', 'doare', 'intins', 'întins'], a:'La o durere ascuțită sau care persistă, oprește mișcarea care o provoacă, nu forța și întreabă un medic sau un kinetoterapeut. Revino treptat, cu greutăți mici.' },
    { k:['incalzire', 'încălzire'], a:'Încălzirea durează 5–8 minute (mers rapid, mobilitate) și o serie ușoară la primul exercițiu. Găsești rutine ghidate în fila Sală → Recuperare.' },
    { k:['stretching', 'intindere', 'întindere'], a:'Stretchingul static (30–40 s pe poziție) se face după antrenament. Înainte de antrenament e mai bună încălzirea dinamică. Rutina ghidată e în fila Recuperare.' },
    { k:['tehnica', 'tehnică', 'forma corecta', 'forma corectă'], a:'Coboară controlat (aproximativ 2 secunde), fără avânt, cu abdomenul strâns. Dacă nu poți păstra forma, scade greutatea. Fiecare exercițiu din aplicație are desen și pași.' },
    { k:['mic dejun', 'pranz', 'prânz', 'cina', 'cină', 'mese', 'ce mananc', 'ce mănânc'], a:'La fiecare masă pune o sursă de proteine (25–40 g), carbohidrați (orez, cartofi, ovăz, pâine) și legume. Meniurile pe zile și variantele sunt în fila Mâncare.' },
    { k:['carbohidrat'], a:'Carbohidrații dau energie pentru antrenament. Mulți se descurcă bine cu 3–6 g pe kg corp pe zi. Alege orez, cartofi, ovăz, fructe. Ținta ta e în fila Mâncare.' },
    { k:['grasimi', 'grăsimi'], a:'Grăsimile sunt necesare pentru hormoni: cel puțin 0,8 g pe kg corp pe zi (ulei de măsline, nuci, pește, ouă).' },
    { k:['alcool'], a:'Alcoolul îți strică somnul și scade recuperarea și sinteza proteică. Dacă bei, fă-o rar și cu moderație.' },
    { k:['incepator', 'începător', 'cum incep', 'cum încep'], a:'Începe cu 2–3 zile pe săptămână tot corpul, la nivel Ușor, cu greutăți mici și tehnică bună. Fă testul „Alege-mi tu de unde încep" din fila Sală și crești de nivel când ești pregătit.' },
    { k:['zi de odihna', 'zi de odihnă', 'recuperare', 'odihna', 'odihnă'], a:'Ia 1–2 zile de odihnă pe săptămână, cu plimbare și stretching. Mușchiul crește în pauze, nu în sală. Vezi „Cât de odihnit ești azi" în fila Recuperare.' }
  ];
  function norm(t){ return String(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function answer(q){
    var n = norm(q), best = null, bs = 0;
    KB.forEach(function(e, idx){ var sc = 0; e.k.forEach(function(k){ if(n.indexOf(norm(k)) >= 0) sc += norm(k).length; }); if(idx === 0 && sc) sc += 100; if(sc > bs){ bs = sc; best = e; } });
    return best ? best.a : 'Nu am un răspuns exact pentru asta în baza mea. Încearcă o întrebare despre creatină, proteine, somn, serii și repetări, platou, deficit sau surplus, încălzire, stretching sau suplimente. Pentru probleme de sănătate, întreabă un medic.';
  }
  var CHIPS = ['Cât somn am nevoie?', 'Cum iau creatina?', 'De ce nu mai cresc?', 'Câte proteine pe zi?', 'Cât să mă odihnesc între serii?', 'Ce fac la febra musculară?'];
  var chat = [];
  function renderCoach(){
    var root = $('coachRoot'); if(!root) return;
    var A = analyze(), goal = A ? A.goal : 'maintain', out = '';
    out += '<div class="card"><div class="card-title">🎯 Obiectivul tău</div><div class="ft-pills" id="chGoal">' + Object.keys(GOALS).map(function(g){ return '<button data-g="' + g + '" class="' + (g === goal ? 'on' : '') + '">' + GOALS[g][1] + ' ' + GOALS[g][0] + '</button>'; }).join('') + '</div><div class="ft-note">' +
      (goal === 'gain' ? 'Mic surplus de calorii, 1,9 g proteine/kg, 6–12 repetări aproape de eșec, progres treptat la greutăți.' : goal === 'lose' ? 'Deficit moderat, proteine mari ca să păstrezi mușchiul, continui greutățile și faci pași zilnic.' : 'Calorii la nivelul consumului, 1,8 g proteine/kg, progres lent și constant.') + ' Obiectivul schimbă și caloriile din fila Mâncare.</div></div>';
    out += '<div class="card"><div class="card-title">🧠 Analiza antrenorului</div>';
    if(!A || !A.cards.length) out += '<div class="ft-empty">Notează greutatea și antrenamentele câteva zile și încep analiza.</div>';
    else out += A.cards.map(function(c){ return '<div class="ft-ins"><span>' + c[0] + '</span><div><b>' + c[1] + '</b><p>' + c[2] + '</p></div></div>'; }).join('');
    out += '</div>';
    if(A && A.rec.length) out += '<div class="card"><div class="card-title">✅ Planul pentru săptămâna asta</div><ul class="ft-ul">' + A.rec.slice(0, 5).map(function(r){ return '<li>' + esc(r) + '</li>'; }).join('') + '</ul></div>';
    out += '<div class="card"><div class="card-title">💬 Întreabă antrenorul</div><div class="ft-chips">' + CHIPS.map(function(c){ return '<button data-q="' + esc(c) + '">' + esc(c) + '</button>'; }).join('') + '</div>' +
      '<div class="ft-chat" id="chLog">' + chat.map(function(m){ return '<div class="ft-msg ' + m.r + '">' + esc(m.t) + '</div>'; }).join('') + '</div>' +
      '<div class="ft-ask"><input id="chIn" maxlength="200" placeholder="Scrie o întrebare despre fitness sau nutriție"><button id="chGo">Trimite</button></div>' +
      '<div class="ft-note">Răspunsurile vin din baza de cunoștințe a aplicației (generale, nu sfat medical) și analiza folosește datele tale din aplicație. Nu e un chat AI liber.</div></div>';
    root.innerHTML = out;
    root.querySelectorAll('#chGoal button').forEach(function(b){ b.addEventListener('click', function(){ if(window.__zGoal) window.__zGoal(b.getAttribute('data-g')); renderCoach(); }); });
    function ask(q){ q = (q || '').trim(); if(!q) return; chat.push({ r:'me', t:q }); chat.push({ r:'bot', t:answer(q) }); if(chat.length > 20) chat = chat.slice(-20); renderCoach(); var l = $('chLog'); if(l) l.scrollTop = l.scrollHeight; }
    root.querySelectorAll('[data-q]').forEach(function(b){ b.addEventListener('click', function(){ ask(b.getAttribute('data-q')); }); });
    $('chGo').addEventListener('click', function(){ ask($('chIn').value); });
    $('chIn').addEventListener('keydown', function(e){ if(e.key === 'Enter') ask($('chIn').value); });
  }

  /* ---------- pornire ---------- */
  function hook(){
    document.querySelectorAll('#sportSeg [data-sseg]').forEach(function(b){ b.addEventListener('click', function(){ var g = b.getAttribute('data-sseg'); setTimeout(function(){ if(g === 'rec') renderRec(); if(g === 'coach') renderCoach(); }, 0); }); });
    var pt = document.querySelector('.tab[data-view="profile"]'); if(pt) pt.addEventListener('click', function(){ setTimeout(renderBody, 0); });
    renderBody();
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', hook); else hook();
  window.zFit = { renderBody:renderBody, renderRec:renderRec, renderCoach:renderCoach, answer:answer, analyze:analyze, navyBF:navyBF };
})();
