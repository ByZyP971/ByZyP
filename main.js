(function(){
  var THEME_KEY = 'reset_theme_v2';
  var AMT_KEY_LOCAL = 'reset_monthly_amt_v2'; // local fallback only

  function safeGet(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } }
  function safeSet(k,v){ try{ localStorage.setItem(k,v); return true; }catch(e){ return false; } }

  var db = null;
  var useLocal = false;
  var writeChains = {};
  function chainWrite(path, fn){
    var prev = writeChains[path] || Promise.resolve();
    var next = prev.then(fn).catch(function(e){ console.error('db write failed', path, e); });
    writeChains[path] = next;
    return next;
  }

  /* theme */
  var root = document.documentElement;
  var themeBtn = document.getElementById('themeBtn');
  function applyTheme(t){
    if(t === 'light'){ root.setAttribute('data-theme','light'); themeBtn.textContent = '◑'; }
    else { root.removeAttribute('data-theme'); themeBtn.textContent = '◐'; }
  }
  applyTheme(safeGet(THEME_KEY) || 'dark');
  themeBtn.addEventListener('click', function(){
    var next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    applyTheme(next); safeSet(THEME_KEY, next);
  });

  /* tabs */
  var tabs = document.querySelectorAll('.tab');
  var views = document.querySelectorAll('.view');
  tabs.forEach(function(btn){
    btn.addEventListener('click', function(){
      var v = btn.getAttribute('data-view');
      tabs.forEach(function(t){ t.classList.toggle('active', t === btn); });
      views.forEach(function(s){ s.classList.toggle('active', s.id === 'view-' + v); });
      if(v === 'profile'){ renderWeightPanel(); renderGallery(); renderProfile(); }
    });
  });

  /* profile */
  var profile = {};
  var profName = document.getElementById('profName');
  var profHeight = document.getElementById('profHeight');
  var profAge = document.getElementById('profAge');
  var avatarWrap = document.getElementById('avatarWrap');
  var avatarInput = document.getElementById('avatarInput');
  var avatarBtn = document.getElementById('avatarBtn');
  function updateHeader(){
    document.getElementById('headerName').textContent = 'By ZyP';
    updateGreeting();
  }
  function updateGreeting(){
    var now = new Date();
    var h = now.getHours();
    var greeting;
    if(h < 5) greeting = 'Noapte bună';
    else if(h < 12) greeting = 'Bună dimineața';
    else if(h < 18) greeting = 'Bună ziua';
    else greeting = 'Bună seara';
    var dayNamesFull = ['Duminică','Luni','Marți','Miercuri','Joi','Vineri','Sâmbătă'];
    var dateStr = dayNamesFull[now.getDay()] + ', ' + now.getDate() + ' ' + monthFull[now.getMonth()];
    document.getElementById('headerName').textContent = 'By ZyP';
    var hh = String(now.getHours()).padStart(2,'0');
    var mm = String(now.getMinutes()).padStart(2,'0');
    var ss = String(now.getSeconds()).padStart(2,'0');
    document.getElementById('headerSub').innerHTML = '<span class="live-dot"></span>' + greeting + ' · ' + dateStr + ' · <span class="live-clock">' + hh + ':' + mm + ':' + ss + '</span>';
  }
  function renderAvatar(){
    avatarWrap.innerHTML = profile.photo ? '<img src="' + profile.photo + '">' : '<div class="avatar-placeholder">👤</div>';
  }
  function applyProfileToUI(){
    profName.value = profile.name || '';
    profHeight.value = profile.height || '';
    profAge.value = profile.age || '';
    updateHeader();
    renderAvatar();
    if(typeof renderProfile === 'function') renderProfile();
  }
  function writeProfile(){
    profile = { name: profName.value, height: profHeight.value, age: profAge.value, photo: profile.photo || null };
    updateHeader();
    renderProfile();
    if(useLocal){ safeSet('reset_profile_v1', JSON.stringify(profile)); return; }
    chainWrite('profile/main', function(){ return db.doc('profile/main').set(profile); });
  }
  [profName, profHeight, profAge].forEach(function(el){ el.addEventListener('input', writeProfile); });

  avatarBtn.addEventListener('click', function(){ avatarInput.click(); });
  document.getElementById('profEditToggle').addEventListener('click', function(){
    var e = document.getElementById('profEdit');
    var open = e.style.display === 'none';
    e.style.display = open ? 'block' : 'none';
    this.textContent = open ? '✓ Gata' : '✏️ Editează profilul';
  });
  avatarInput.addEventListener('change', function(){
    var file = avatarInput.files && avatarInput.files[0];
    if(!file) return;
    var reader = new FileReader();
    reader.onload = function(e){
      var img = new Image();
      img.onload = function(){
        var size = 300;
        var side = Math.min(img.width, img.height);
        var sx = (img.width - side) / 2, sy = (img.height - side) / 2;
        var canvas = document.createElement('canvas');
        canvas.width = size; canvas.height = size;
        var ctx = canvas.getContext('2d');
        ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
        var dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        profile = { name: profile.name || '', height: profile.height || '', age: profile.age || '', photo: dataUrl };
        renderAvatar();
        if(useLocal){ safeSet('reset_profile_v1', JSON.stringify(profile)); }
        else { chainWrite('profile/main', function(){ return db.doc('profile/main').set(profile); }); }
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });

  /* day data — in-memory mirror, kept in sync with db (or localStorage fallback) */
  var data = {};
  function dateKey(d){
    var y = d.getFullYear();
    var m = String(d.getMonth()+1).padStart(2,'0');
    var day = String(d.getDate()).padStart(2,'0');
    return y + '-' + m + '-' + day;
  }
  var dayNames = ['Duminică','Luni','Marți','Miercuri','Joi','Vineri','Sâmbătă'];
  var monthShort = ['ian','feb','mar','apr','mai','iun','iul','aug','sep','oct','noi','dec'];
  var monthFull = ['ianuarie','februarie','martie','aprilie','mai','iunie','iulie','august','septembrie','octombrie','noiembrie','decembrie'];
  function svgCheck(){ return '<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>'; }

  var today = new Date(); today.setHours(0,0,0,0);
  var todayKey = dateKey(today);
  document.getElementById('todayDate').textContent = dayNames[today.getDay()] + ', ' + today.getDate() + ' ' + monthShort[today.getMonth()];

  var HABITS = [
    { key:'nosmoke', label:'Fără țigări', ic:'🚭', sub:'Nicio țigară azi, nici una' },
    { key:'nosugar', label:'Fără zahăr', ic:'🍬', sub:'Fără dulciuri și sucuri' },
    { key:'water', label:'Doar apă', ic:'💧', sub:'Plată sau minerală, plus cafeaua simplă' },
    { key:'training', label:'Antrenament', ic:'💪', sub:'Sală sau odihnă planificată' },
    { key:'food', label:'Mâncare curată', ic:'🥗', sub:'Proteină + legume, fără procesate' }
  ];
  try{ var _pf = JSON.parse(localStorage.getItem('zyp_prefs_v1')||'null');
    if(_pf && Array.isArray(_pf.habits) && _pf.habits.length){ var _keep = HABITS.filter(function(h){ return _pf.habits.indexOf(h.key) >= 0; }); if(_keep.length){ HABITS.length = 0; _keep.forEach(function(h){ HABITS.push(h); }); } } }catch(e){}
  var QUOTES = [
    'Nu trebuie să fie perfect. Trebuie doar să fie azi.',
    'Pofta trece în câteva minute. Mândria că ai rezistat rămâne toată ziua.',
    'Fiecare zi fără fum e o investiție cu randament garantat: sănătatea ta.',
    'Disciplina e să alegi ce vrei cel mai mult, nu ce vrei acum.',
    'Omul care vrei să devii se construiește din zile banale, bifate una câte una.',
    'Nu te compara cu alții. Compară-te cu tine de ieri.',
    'Motivația te pornește. Obiceiul te duce până la capăt.',
    'Banii pe care nu-i mai dai pe țigări lucrează acum pentru tine.',
    'Corpul tău se repară în fiecare zi în care nu-l otrăvești.',
    'O zi grea nu e un motiv să renunți. E exact ziua care contează.',
    'Libertatea financiară și libertatea de țigări încep la fel: cu răbdare.',
    'Micile victorii de azi devin marea schimbare de peste un an.',
    'Nu negocia cu pofta. Ea pierde de fiecare dată când tu nu cedezi.',
    'Ai început o viață nouă. Azi e încă o pagină din ea.'
  ];
  var prevDone = -1;

  function parseKg(str){ var t = String(str == null ? '' : str).replace(',', '.').replace(/[^0-9.]/g, ''), i = t.indexOf('.'); if(i >= 0) t = t.slice(0, i + 1) + t.slice(i + 1).replace(/\./g, ''); var v = parseFloat(t); return (v >= 20 && v <= 400) ? Math.round(v * 1000) / 1000 : null; }
  function fmtKg(v){ var r = Math.round(v * 100); return (r / 100).toFixed(r % 10 === 0 ? 1 : 2); }
  function getEntry(key){
    var e = data[key];
    if(!e) return { habits:{}, note:'', weight:null, photo:null };
    // db snapshots are frozen — always hand back a plain, mutable clone
    try{ return JSON.parse(JSON.stringify(e)); }catch(err){ return { habits:{}, note:'', weight:null, photo:null }; }
  }
  function writeDay(key, entry){
    data[key] = entry;
    if(useLocal){ safeSet('reset_days_local_v1', JSON.stringify(data)); return Promise.resolve(); }
    return chainWrite('days/'+key, function(){ return db.doc('days/'+key).set(Object.assign({date:key}, entry)); });
  }

  var todayHabitsEl = document.getElementById('todayHabits');
  var todayNoteEl = document.getElementById('todayNote');
  var weightInput = document.getElementById('weightInput');
  var photoThumbWrap = document.getElementById('photoThumbWrap');
  var photoInput = document.getElementById('photoInput');
  var photoBtn = document.getElementById('photoBtn');

  function renderToday(){
    var entry = getEntry(todayKey);
    todayHabitsEl.innerHTML = '';
    HABITS.forEach(function(h){
      var row = document.createElement('div');
      row.className = 'habit' + (entry.habits[h.key] ? ' done' : '');
      row.innerHTML = '<div class="hb-ic">' + h.ic + '</div><div class="hb-txt"><div class="hb-t">' + h.label + '</div><div class="hb-s">' + h.sub + '</div></div><div class="check">' + svgCheck() + '</div>';
      row.addEventListener('click', function(){
        var e2 = getEntry(todayKey);
        e2.habits = Object.assign({}, e2.habits);
        e2.habits[h.key] = !e2.habits[h.key];
        writeDay(todayKey, e2);
        renderToday(); renderStreaks(); renderPastDays();
      });
      todayHabitsEl.appendChild(row);
    });
    todayNoteEl.value = entry.note || '';
    if(document.activeElement !== weightInput) weightInput.value = entry.weight != null ? entry.weight : '';      // never rewrite the field while it is being typed in
    if(entry.photo){
      photoThumbWrap.innerHTML = '<img class="photo-thumb" src="' + entry.photo + '">';
    } else {
      photoThumbWrap.innerHTML = '<div class="photo-placeholder">📷</div>';
    }
  }
  todayNoteEl.addEventListener('input', function(){
    var entry = getEntry(todayKey); entry.note = todayNoteEl.value;
    writeDay(todayKey, entry);
  });
  weightInput.addEventListener('input', function(){
    var entry = getEntry(todayKey);
    var kgv = parseKg(weightInput.value); if(kgv == null && weightInput.value.replace(/[^0-9]/g, '').length > 0 && weightInput.value.replace(/[^0-9]/g, '').length < 2) return;   /* too early to be a weight (e.g. the first digit): keep typing */
    entry.weight = kgv;
    writeDay(todayKey, entry);
    renderWeightPanel();
    renderProtein();
  });
  photoBtn.addEventListener('click', function(){ photoInput.click(); });
  photoInput.addEventListener('change', function(){
    var file = photoInput.files && photoInput.files[0];
    if(!file) return;
    var reader = new FileReader();
    reader.onload = function(e){
      var img = new Image();
      img.onload = function(){
        var maxW = 420;
        var scale = Math.min(1, maxW / img.width);
        var canvas = document.createElement('canvas');
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        var ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        var dataUrl = canvas.toDataURL('image/jpeg', 0.5);
        var entry = getEntry(todayKey);
        entry.photo = dataUrl;
        writeDay(todayKey, entry).then(function(){
          renderToday(); renderGallery();
        }).catch(function(){
          alert('Poza e prea mare — încearcă una mai mică sau fă poza mai simplă.');
        });
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });

  function allDone(entry){ if(!entry) return false; return HABITS.every(function(h){ return !!entry.habits[h.key]; }); }
  function doneCount(entry){ if(!entry) return 0; return HABITS.reduce(function(n,h){ return n + (entry.habits[h.key]?1:0); }, 0); }

  function renderStreaks(){
    var streak = 0, cursor = new Date(today);
    while(true){
      var key = dateKey(cursor);
      if(allDone(data[key])){ streak++; cursor.setDate(cursor.getDate()-1); } else break;
    }
    var keys = Object.keys(data).sort();
    var best = 0, run = 0, prevDate = null;
    keys.forEach(function(k){
      var d = new Date(k + 'T00:00:00');
      if(allDone(data[k])){
        run = (prevDate && Math.round((d-prevDate)/86400000)===1) ? run+1 : 1;
        best = Math.max(best, run); prevDate = d;
      } else { run = 0; prevDate = null; }
    });
    best = Math.max(best, streak);
    document.getElementById('streakNum').textContent = streak;
    document.getElementById('bestNum').textContent = best;

    var n = doneCount(data[todayKey]);
    var ringFg = document.getElementById('ringFg');
    if(ringFg){ ringFg.style.strokeDashoffset = String(289 * (1 - n/HABITS.length)); }
    var ringTxt = document.getElementById('ringTxt');
    if(ringTxt){ ringTxt.textContent = n + '/' + HABITS.length + ' bifate'; }
    var rp = document.getElementById('ringPct'); if(rp) rp.textContent = Math.round(n/HABITS.length*100) + '%';
    var rw = document.querySelector('.ring-wrap.big'); if(rw) rw.classList.toggle('full', n === HABITS.length);
    var pd = document.getElementById('perfectDay'); if(pd) pd.style.display = n === HABITS.length ? 'block' : 'none';
    if(prevDone >= 0 && prevDone < HABITS.length && n === HABITS.length) fireConfetti();
    prevDone = n;
    // consecutive smoke-free days (today counts once ticked; otherwise count up to yesterday)
    var sf = 0, c2 = new Date(today);
    if(!(data[todayKey] && data[todayKey].habits && data[todayKey].habits.nosmoke)) c2.setDate(c2.getDate()-1);
    while(true){ var k2 = dateKey(c2); if(data[k2] && data[k2].habits && data[k2].habits.nosmoke){ sf++; c2.setDate(c2.getDate()-1); } else break; }
    var sfe = document.getElementById('smokeFree'); if(sfe) sfe.textContent = sf;
    var keysAll = Object.keys(data).sort();
    var dn = 1; if(keysAll.length){ dn = Math.round((today - new Date(keysAll[0] + 'T00:00:00'))/86400000) + 1; }
    var dne = document.getElementById('dayNum'); if(dne) dne.textContent = Math.max(1, dn);
    var qe = document.getElementById('dayQuote');
    if(qe){ var doy = Math.floor((today - new Date(today.getFullYear(),0,0))/86400000); qe.textContent = '„' + QUOTES[doy % QUOTES.length] + '”'; }
    renderHeatmap();
    if(typeof renderGrowth === 'function' && typeof accounts !== 'undefined' && accounts) renderGrowth();
    var progEl = document.getElementById('todayProgress');
    if(n === HABITS.length){
      progEl.innerHTML = '<b>Toate bifate</b> — ziua intră la șir 🔥';
    } else {
      progEl.innerHTML = 'Mai ai <b>' + (HABITS.length-n) + '</b> de bifat ca ziua să intre la șir';
    }
  }

  function renderHeatmap(){
    var hm = document.getElementById('heatmap'); if(!hm) return;
    var mon = new Date(today); mon.setDate(mon.getDate() - ((mon.getDay()+6)%7) - 28);
    var html = '';
    for(var i=0;i<35;i++){
      var d = new Date(mon); d.setDate(d.getDate()+i);
      var k = dateKey(d), n = doneCount(data[k]);
      var fut = d > today, isNow = k === todayKey;
      var lv = n >= 5 ? 'l5' : n >= 4 ? 'l3' : n >= 2 ? 'l2' : n >= 1 ? 'l1' : '';
      html += '<div class="hm ' + lv + (fut?' fut':'') + (isNow?' now':'') + '" title="' + k + ' · ' + n + '/5">' + d.getDate() + '</div>';
    }
    hm.innerHTML = html;
  }

  function fireConfetti(){
    var box = document.getElementById('confetti'); if(!box) return;
    var cols = ['#3DE0C4','#A3FF12','#FF6F6F','#8B9DB3','#E8F0F7'];
    var html = '';
    for(var i=0;i<42;i++){
      html += '<i style="left:' + (Math.random()*100) + '%;background:' + cols[i%cols.length] + ';--dx:' + (Math.random()*120-60) + 'px;--rot:' + (Math.random()*720-360) + 'deg;animation-delay:' + (Math.random()*0.35) + 's"></i>';
    }
    box.innerHTML = html;
    try{ if(navigator.vibrate) navigator.vibrate([60,40,60]); }catch(e){}
    setTimeout(function(){ box.innerHTML = ''; }, 2600);
  }

  function goTab(view, segSel){
    var t = document.querySelector('.tab[data-view="' + view + '"]'); if(t) t.click();
    if(segSel){ var b = document.querySelector(segSel); if(b) b.click(); }
    try{ window.scrollTo(0,0); }catch(e){}
  }
  function renderPlanTiles(){
    var el = document.getElementById('planTiles'); if(!el || typeof WEEK === 'undefined' || !WEEK) return;
    var code = woOfDay(wIdx);
    var st = sp.sets[todayKey + '|' + code] || {};
    var sportSub = woSub(code), sportA = 'Deschide →';
    if(WO[code]){ var tot = WO[code].ex.reduce(function(a,e){ return a+e[1]; },0); var dn2 = Object.keys(st).filter(function(x){ return st[x]; }).length; sportA = dn2 + '/' + tot + ' serii · Începe →'; }
    var lunch = '', dinner = '';
    var md = document.querySelectorAll('.mm-day')[wIdx];
    if(md){ var foods = md.querySelectorAll('.mm-food'); lunch = foods[1] ? foods[1].textContent : ''; dinner = foods[3] ? foods[3].textContent : ''; }
    var nt = (typeof newsTarget !== 'undefined') ? newsTarget : null;
    var newsHtml;
    if(!window.SHOW_GOLD){ newsHtml = ''; }
    else if(nt){
      var hot = nt.i === 'High' && (nt.t.getTime() - Date.now()) < 2*3600000;
      newsHtml = '<div class="pt wide' + (hot?' hot':'') + '" data-go="news"><div class="pt-l">📰 Următoarea știre ' + (nt.i==='High'?'roșie':'importantă') + '</div><div class="pt-t">' + zEsc(nt.c) + ' — ' + zEsc(nt.title) + '</div><div class="pt-s">' + ['Du','Lu','Ma','Mi','Jo','Vi','Sâ'][nt.t.getDay()] + ' ' + nt.t.getDate() + ' ' + monthShort[nt.t.getMonth()] + ' la ' + hhmm(nt.t) + '</div><div class="pt-a">Vezi toate știrile →</div></div>';
    } else {
      newsHtml = '<div class="pt wide" data-go="news"><div class="pt-l">📰 Știri</div><div class="pt-t">Nicio știre importantă încărcată</div><div class="pt-a">Se actualizează automat · vezi știrile →</div></div>';
    }
    el.innerHTML =
      '<div class="pt" data-go="sport"><div class="pt-l">🏋️ Sport azi</div><div class="pt-t">' + woLabel(code) + '</div><div class="pt-s">' + sportSub + '</div><div class="pt-a">' + sportA + '</div></div>' +
      '<div class="pt" data-go="food"><div class="pt-l">🍽️ Prânz azi</div><div class="pt-t">' + (lunch || 'Vezi meniul') + '</div><div class="pt-s">' + (dinner ? 'Seara: ' + dinner : '') + '</div><div class="pt-a">Meniul complet →</div></div>' +
      newsHtml + goldTileHtml();
    el.querySelectorAll('.pt').forEach(function(t){ t.addEventListener('click', function(){
      var g = t.getAttribute('data-go');
      if(g === 'gold'){ var gt = document.querySelector('.tab[data-view="gold"]'); if(gt) gt.click(); try{ window.scrollTo(0,0); }catch(e){} return; }
      if(g === 'sport') goTab('sport', WO[code] ? '[data-sseg="gym"]' : '[data-sseg="plan"]');
      else if(g === 'food') goTab('food', '[data-fseg="menu"]');
      else goTab('money', '[data-seg="trading"]');
    }); });
  }


  function goldTileHtml(){
    if(!window.SHOW_GOLD) return '';
    if(typeof gold === 'undefined' || !gold) return '<div class="pt wide" data-go="gold"><div class="pt-l">🥇 Aur · XAUUSD</div><div class="pt-t">Se încarcă analiza…</div><div class="pt-a">Deschide fila Aur →</div></div>';
    var g = gold, p = (typeof liveSpot !== 'undefined' && liveSpot != null) ? liveSpot : g.price;
    var prevClose = g.price - g.change, ch = p - prevClose, up = ch >= 0;
    var v = (g.confluence || {}).verdict || g.bias;
    var vt = v === 'BUY' ? '🟢 BUY' : v === 'SELL' ? '🔴 SELL' : '⏳ AȘTEAPTĂ';
    var act = (g.ptrades || []).filter(function(t){ return !t.closed; });
    var open = act.filter(function(t){ return t.status !== 'în așteptare'; }).length, pend = act.length - open;
    var T = g.ptotal || {};
    return '<div class="pt wide gold-pt" data-go="gold"><div class="pt-l">🥇 Aur · XAUUSD' + (typeof liveSpot !== 'undefined' && liveSpot != null ? ' <span class="live-tag">● LIVE</span>' : '') + '</div>' +
      '<div class="gpt-row"><div class="pt-t" style="font-family:var(--mono);font-size:22px;">' + p.toLocaleString('en-US', { minimumFractionDigits:2, maximumFractionDigits:2 }) + '</div>' +
      '<div class="gpt-v ' + v + '">' + vt + '</div></div>' +
      '<div class="pt-s"><span style="color:' + (up ? 'var(--accent)' : 'var(--danger)') + '">' + (up ? '+' : '') + ch.toFixed(2) + ' (' + (up ? '+' : '') + (prevClose ? ch / prevClose * 100 : 0).toFixed(2) + '%)</span> azi · ' +
      (open ? open + ' tranzacții de test deschise' : 'nicio tranzacție de test deschisă') + (pend ? ' · ' + pend + ' ordine în așteptare' : '') +
      (T.n ? ' · ' + T.rate + '% câștigate' : '') + '</div><div class="pt-a">Deschide analiza completă →</div></div>';
  }
  var pastVisible = false;
  var pastDaysList = document.getElementById('pastDaysList');
  var pastDaysCard = document.getElementById('pastDaysCard');
  var pastToggle = document.getElementById('pastToggle');
  function renderPastDays(){
    pastDaysList.innerHTML = '';
    for(var i=1;i<=30;i++){
      var d = new Date(today); d.setDate(d.getDate()-i);
      var key = dateKey(d); var entry = data[key]; var n = doneCount(entry);
      if(!entry && i>14) continue;
      var dotClass = n===HABITS.length ? 'full' : (n>0?'partial':'none');
      var row = document.createElement('div'); row.className = 'past-day';
      row.innerHTML = '<span><span class="past-day-dot ' + dotClass + '"></span>' + dayNames[d.getDay()].slice(0,3) + ', ' + d.getDate() + ' ' + monthShort[d.getMonth()] + '</span><span class="past-day-frac">' + n + '/' + HABITS.length + '</span>';
      pastDaysList.appendChild(row);
    }
  }
  pastToggle.addEventListener('click', function(){
    pastVisible = !pastVisible;
    pastDaysCard.classList.toggle('show', pastVisible);
    pastToggle.textContent = pastVisible ? 'Ascunde zilele trecute' : 'Arată zilele trecute';
  });

  /* ===== sport tab ===== */
  /* ===== SPORT: doar sală · programe din pozele tale · variante noi în fiecare săptămână ===== */
  // fiecare exercițiu are 4 variante; în fiecare săptămână se folosește alta, ca mușchii să nu se obișnuiască
  var POOL = {
    benchP:['Împins la piept cu haltera (plat)|Picioarele pe podea, bara coboară la mijlocul pieptului, coatele la 45–70°, fără să sari cu bara|wo-c1.jpg',
      'Împins plat cu gantere|Ganterele în linie cu pieptul, coboară lent, strânge pieptul sus',
      'Împins la piept la mașină|Spatele lipit de spătar, împinge fără să blochezi coatele',
      'Împins cu haltera, pauză 1 s pe piept|Oprește bara 1 secundă pe piept, apoi împinge puternic'],
    inclP:['Împins înclinat cu gantere|Bancă la 30°, împinge deasupra pieptului de sus, coboară lent|wo-c2.jpg',
      'Împins înclinat cu haltera|Bancă la 30°, bara coboară spre claviculă',
      'Împins înclinat la mașină|Reglează scaunul ca mânerele să fie la nivelul pieptului de sus',
      'Împins înclinat cu gantere, priză neutră|Palmele față în față, coatele aproape de corp'],
    fly:['Fluturări la peck deck|Coatele ușor îndoite, strânge pieptul în față 1 s|wo-c3.jpg',
      'Fluturări la cabluri (la mijloc)|Un pas înainte, strânge mâinile în fața pieptului',
      'Fluturări înclinate cu gantere|Coboară larg până simți întinderea, urcă în arc',
      'Fluturări la mașină, o mână pe rând|Concentrează-te pe strângerea pieptului'],
    cross:['Cable crossover, de sus în jos|Trage mânerele în jos și împreună, pieptul strâns',
      'Cable crossover, de jos în sus|Trage de jos spre bărbie, lucrează pieptul de sus',
      'Flotări cu coborâre lentă|Coboară în 3 secunde, corp drept; pune greutate pe spate dacă e ușor',
      'Împins la scripete, o mână|Stai în pas, împinge înainte fără să rotești trunchiul'],
    pushdown:['Extensii triceps la scripete, cu coarda|Coatele lipite de corp, desparte coarda jos|wo-c6.jpg',
      'Extensii triceps cu bara dreaptă|Coatele fixe, extinde complet',
      'Extensii triceps la scripete, o mână|Controlat, fără să te legeni',
      'Extensii la scripete, priză inversă|Palma în sus, coatele lipite'],
    overhead:['Extensii deasupra capului cu ganteră, două mâini|Coatele spre tavan, coboară în spatele capului',
      'Extensii triceps peste cap la scripete|Cu coarda, coatele fixe, întinde complet',
      'Extensii deasupra capului cu bara EZ|Coatele aproape de urechi, coboară lent',
      'Extensii peste cap cu ganteră, o mână|Cotul sus, coboară în spatele capului'],
    skull:['Skull crushers cu bara EZ|Coboară bara spre frunte, coatele fixe',
      'Skull crushers cu gantere|Palmele față în față, coboară lateral de cap',
      'Împins la bancă, priză îngustă|Mâinile la lățimea umerilor, coatele aproape',
      'Flotări cu mâinile apropiate|Coatele lipite de corp, corpul drept'],
    dips:['Flotări pe bancă (bench dips)|Coboară până la 90° la coate, umerii departe de urechi',
      'Dips la paralele|Corpul ușor înclinat, coboară controlat',
      'Dips la mașină asistată|Coboară lent, împinge complet',
      'Kickback triceps cu ganteră|Cotul sus lângă corp, extinde spre spate'],
    lat:['Tracțiuni la helcometru, priză largă|Trage spre claviculă, omoplații în jos, nu te legăna',
      'Tracțiuni la helcometru, priză neutră|Coatele spre șolduri, pieptul sus',
      'Tracțiuni la bară (asistate dacă e nevoie)|Pornești agățat complet, bărbia peste bară',
      'Tracțiuni la helcometru, priză îngustă|Trage spre piept, strânge spatele'],
    rowH:['Ramat cu haltera, aplecat|Spatele drept, trage bara spre buric',
      'Ramat T-bar|Pieptul sus, trage spre abdomen, fără balans',
      'Ramat cu gantere, pieptul pe bancă înclinată|Ambele gantere odată, trage coatele în sus și în spate',
      'Ramat la Smith, priză inversă|Trage spre talie, coatele aproape'],
    rowC:['Ramat la cablu, așezat, priză largă|Spatele drept, strânge omoplații 1 s',
      'Ramat la cablu, priză neutră îngustă|Coatele pe lângă corp, trage spre abdomen',
      'Ramat pe bancă înclinată (incline high row)|Pieptul pe bancă, trage cu coatele larg',
      'Ramat la mașină, priză largă|Piept sprijinit, trage cu coatele'],
    sarm:['Pulldown cu brațele întinse|Brațe drepte, trage bara spre coapse cu spatele',
      'Face pull|Trage coarda spre față, coatele sus, strânge spatele',
      'Fluturări inverse la peck deck|Coatele ușor îndoite, deschide brațele',
      'Pullover cu ganteră|Coboară în spatele capului, trage cu spatele'],
    bb:['Flexii cu bara dreaptă|Coatele fixe lângă corp, fără balans',
      'Flexii cu bara EZ|Priză comodă pentru încheieturi, controlat',
      'Flexii la scripete jos|Tensiune constantă, coatele fixe',
      'Flexii la banca Scott (preacher)|Brațele sprijinite, strict, fără balans'],
    db:['Flexii alternative cu gantere|Rotește palma în sus, un braț pe rând',
      'Flexii pe bancă înclinată cu gantere|Brațele atârnă, întindere mare pentru biceps',
      'Flexii concentrate|Cotul pe interiorul coapsei, strânge sus',
      'Spider curl|Pieptul pe bancă înclinată, brațele atârnă drept în jos'],
    ham:['Flexii ciocan cu gantere|Palmele față în față, coatele fixe',
      'Flexii ciocan peste corp (cross-body)|Trage ganteră spre umărul opus',
      'Flexii ciocan la scripete, cu coarda|Tensiune constantă, coatele lângă corp',
      'Flexii ciocan pe bancă înclinată|Întindere mare, strânge sus'],
    squat:['Genuflexiuni libere cu haltera|Spatele drept, coboară până coapsele sunt paralele cu solul, genunchii în direcția vârfurilor',
      'Hack squat|Spatele lipit, coboară controlat, nu bloca genunchii',
      'Genuflexiuni goblet cu ganteră|Ține ganteră la piept, coboară adânc',
      'Genuflexiuni la Smith|Picioarele ușor în față, coboară controlat'],
    lpress:['Leg press 45°|Spatele lipit, nu bloca genunchii sus',
      'Leg press, picioarele sus pe platformă|Accent pe fese și ischiogambieri',
      'Fandări bulgărești|Piciorul din spate pe bancă, coboară drept',
      'Fandări mergând cu gantere|Pași lungi, genunchiul din spate aproape de sol'],
    lext:['Extensii picioare la mașină|Strânge cvadricepsul sus 1 s',
      'Extensii pe un picior|Pe rând, controlat',
      'Extensii cu pauză sus 2 s|Ține contracția 2 secunde',
      'Extensii cu coborâre lentă|Coboară în 3 secunde'],
    lcurl:['Flexii picioare, culcat|Șoldurile lipite de bancă, trage călcâiele spre fese',
      'Flexii picioare, așezat|Reglează spătarul, mișcare controlată',
      'Flexii culcat, coborâre lentă|Coboară în 3 secunde',
      'Flexii picioare pe un picior|Pe rând, fără să arcuiești spatele'],
    rdl:['Îndreptări românești cu haltera|Împinge șoldurile în spate, bara aproape de picioare',
      'Îndreptări românești cu gantere|Spatele drept, simți întinderea în spatele coapselor',
      'Îndreptări pe un picior|Echilibru, șoldurile drepte, ganteră aproape',
      'Îndreptări cu picioarele drepte (stiff-leg)|Mișcare din șold, spatele neutru'],
    quad2:['Deadlift clasic cu haltera|Bara aproape de tibii, spatele drept, împinge podeaua cu picioarele',
      'Good morning cu haltera|Bara pe spate, șoldurile în spate, spatele drept',
      'Step-up cu gantere|Pe o bancă, urcă cu piciorul din față, fără avânt',
      'Fandări cu haltera pe spate|Pas lung înainte, coboară drept, genunchiul aproape de sol',
      'Deadlift cu bara hexagonală|Stai în interiorul barei, spatele drept, împinge în sus',
      'Genuflexiuni split cu gantere|Piciorul din spate pe sol, coboară drept',
      'Hiperextensii pe bancă romană|Spatele drept, urcă controlat, fără să arcuiești',
      'Hack squat cu pauză|Ține 1 secundă jos, apoi împinge'],
    hip:['Hip thrust cu haltera|Bărbia în piept, strânge fesele sus 1 s',
      'Pod pentru fese la mașină|Împinge din călcâie, pauză sus',
      'Hip thrust cu ganteră|Ganteră pe șolduri, strânge sus',
      'Kickback la scripete|Piciorul în spate, strânge fesa'],
    calf:['Ridicări pe vârfuri la mașină, în picioare|Coboară complet, urcă pe vârfuri și ține 1 s',
      'Ridicări pe vârfuri, așezat|Genunchii la 90°, pauză sus',
      'Ridicări pe vârfuri la leg press|Împinge doar din vârfuri',
      'Ridicări pe vârfuri pe un picior|Pe o treaptă, ține-te de un suport'],
    add:['Adductori la mașină|Strânge coapsele controlat',
      'Genuflexiuni sumo cu ganteră|Picioarele larg, genunchii în afară',
      'Adductori la scripete|Trage piciorul spre cel de sprijin',
      'Adductori la mașină, lent|Pauză 1 s când strângi'],
    press:['Împins umeri cu gantere|Așezat, fără să arcuiești spatele, ganterele deasupra capului|wo-c4.jpg',
      'Arnold press|Rotește palmele în timpul împinsului',
      'Împins umeri la mașină|Reglează scaunul, coatele sub încheieturi',
      'Împins umeri cu haltera, așezat|Bara coboară la bărbie, apoi împinge sus'],
    lat2:['Ridicări laterale cu gantere|Coatele ușor îndoite, urcă până la nivelul umerilor|wo-c5.jpg',
      'Ridicări laterale la scripete|Tensiune constantă, fără balans',
      'Ridicări laterale la mașină|Strânge sus 1 s',
      'Ridicări laterale, sprijinit de un stâlp|Te ții cu o mână, ridici cu cealaltă'],
    front:['Ridicări frontale cu gantere|Până la nivelul ochilor, fără balans',
      'Ridicări frontale cu disc|Ține discul cu ambele mâini, urcă controlat',
      'Ridicări frontale la scripete|Tensiune constantă',
      'Ridicări frontale alternative|Un braț pe rând, controlat'],
    rear:['Fluturări inverse cu gantere|Aplecat, coatele ușor îndoite, strânge omoplații',
      'Fluturări inverse la mașină|Pieptul pe pernă, trage înapoi',
      'Fluturări inverse la scripete|Trage mânerele încrucișate',
      'Face pull|Trage spre față, coatele sus'],
    shrug:['Ridicări de umeri (shrug) cu gantere|Urcă umerii spre urechi, ține 1 s',
      'Shrug cu haltera|Fără să rotești umerii',
      'Shrug la Smith|Controlat, pauză sus',
      'Shrug la scripete|Tensiune constantă'],
    plank:['Plank pe antebrațe|Corp drept, fese strânse; oprește-te înainte să pierzi poziția',
      'Plank lateral|Șoldurile sus, corp drept, pe fiecare parte',
      'Plank cu atingerea umerilor|Fără să balansezi șoldurile',
      'Hollow hold|Spatele lipit de sol, picioarele și umerii ușor ridicate'],
    crunch:['Crunch invers pe podea|Ridică șoldurile cu abdomenul, fără balans',
      'Crunch la scripete|Rotunjește spatele, trage cu abdomenul',
      'Crunch la mașină|Controlat, expiră jos',
      'Ridicări de genunchi din atârnat|Fără să te legeni, urcă genunchii la piept'],
    lowb:['Hiperextensii pe bancă romană|Spatele drept, urcă controlat, fără să arcuiești',
      'Good morning cu bara ușoară|Șoldurile în spate, spatele drept, greutate mică',
      'Hiperextensii la mașină|Urcă controlat, strânge fesele sus',
      'Îndreptări cu bara hexagonală, ușor|Spatele drept, împinge din picioare'],
  };
  // tip: c = exercițiu mare (greu), i = izolare (ușor), t = pe timp
  var WAVE = [['Volum','Săptămână de volum: greutate medie, 8–12 repetări. Construiești baza.'],
              ['Forță','Săptămână de forță: greutăți mari, 6–8 repetări, pauze lungi.'],
              ['Pump','Săptămână de pump: greutăți mai mici, 12–20 repetări, pauze scurte, simți mușchiul.'],
              ['Mix','Săptămână mixtă: repetări de mijloc, tehnică perfectă.']];
  var WREPS = { c:['','6–8','10–12','8–10'], i:['','10–12','15–20','10–15'], t:['','45–60 s','30–45 s','45–60 s'] };
  var WREST = { c:[120,150,90,120], i:[75,90,60,75], t:[45,45,45,45] };
  // slot: [id, tip, serii, repetări în poză, decalaj variantă]
  var PLANS = {
    1:{ label:'5 zile · Luni–Vineri', days:[
      { code:'m1', name:'Push · Piept, Umeri, Triceps', focus:'Piept, umeri și triceps', img:'', off:0, slots:[['benchP','c',3,'10–12',0],['inclP','c',3,'10–12',0],['press','c',3,'10–12',0],['lat2','i',3,'12–15',0],['pushdown','i',3,'12–15',0],['crunch','i',3,'12–20',0]] },
      { code:'m2', name:'Pull · Spate, Biceps', focus:'Spate și biceps', img:'', off:0, slots:[['lat','c',3,'10–12',0],['rowC','c',3,'10–12',0],['rowH','c',3,'10–12',0],['rear','i',3,'12–15',0],['bb','i',3,'12–15',0],['ham','i',2,'12–15',0]] },
      { code:'m3', name:'Legs · Picioare', focus:'Picioare', img:'', off:0, slots:[['lpress','c',3,'10–12',0],['squat','c',3,'10–12',0],['rdl','c',3,'10–12',0],['lcurl','i',3,'12–15',0],['lext','i',3,'12–15',0],['calf','i',3,'15–20',0]] },
      { code:'m4', name:'Upper · Partea de sus', focus:'Piept, spate, umeri, brațe', img:'', off:0, slots:[['benchP','c',3,'10–12',2],['lat','c',3,'10–12',2],['press','c',3,'10–12',2],['rowC','c',3,'10–12',2],['pushdown','i',2,'12–15',2],['bb','i',2,'12–15',2]] },
      { code:'m5', name:'Lower · Picioare', focus:'Picioare și abdomen', img:'', off:0, slots:[['lpress','c',3,'10–12',2],['quad2','c',3,'10–12',2],['lcurl','i',3,'12–15',2],['lext','i',3,'12–15',2],['calf','i',3,'15–20',2],['crunch','i',3,'12–20',2]] }
    ], rest:[5,6] },
    2:{ label:'6 zile · Push / Pull / Legs ×2', days:[
      { code:'s1', name:'Push A · Piept, Umeri, Triceps', focus:'Piept, umeri și triceps', img:'', off:0, slots:[['benchP','c',3,'10–12',0],['inclP','c',3,'10–12',0],['press','c',3,'10–12',0],['lat2','i',3,'12–15',0],['pushdown','i',3,'12–15',0],['crunch','i',3,'12–20',0]] },
      { code:'s2', name:'Pull A · Spate, Biceps', focus:'Spate și biceps', img:'', off:0, slots:[['lat','c',3,'10–12',0],['rowC','c',3,'10–12',0],['rowH','c',3,'10–12',0],['rear','i',3,'12–15',0],['bb','i',3,'12–15',0],['ham','i',2,'12–15',0]] },
      { code:'s3', name:'Legs A · Picioare', focus:'Picioare', img:'', off:0, slots:[['lpress','c',3,'10–12',0],['squat','c',3,'10–12',0],['rdl','c',3,'10–12',0],['lcurl','i',3,'12–15',0],['lext','i',3,'12–15',0],['calf','i',3,'15–20',0]] },
      { code:'s4', name:'Push B · Piept, Umeri, Triceps', focus:'Piept, umeri și triceps', img:'', off:3, slots:[['benchP','c',3,'10–12',0],['inclP','c',3,'10–12',0],['press','c',3,'10–12',0],['lat2','i',3,'12–15',0],['pushdown','i',3,'12–15',0],['crunch','i',3,'12–20',0]] },
      { code:'s5', name:'Pull B · Spate, Biceps', focus:'Spate și biceps', img:'', off:3, slots:[['lat','c',3,'10–12',0],['rowC','c',3,'10–12',0],['rowH','c',3,'10–12',0],['rear','i',3,'12–15',0],['bb','i',3,'12–15',0],['ham','i',2,'12–15',0]] },
      { code:'s6', name:'Legs B · Picioare', focus:'Picioare', img:'', off:3, slots:[['lpress','c',3,'10–12',0],['squat','c',3,'10–12',0],['rdl','c',3,'10–12',0],['lcurl','i',3,'12–15',0],['lext','i',3,'12–15',0],['calf','i',3,'15–20',0]] }
    ], rest:[6] },
    3:{ label:'3 zile · Tot corpul', dayIdx:[0,2,4], days:[
      { code:'f1', name:'Tot corpul A', focus:'Tot corpul', img:'', off:0, slots:[['lpress','c',3,'10–12',0],['benchP','c',3,'10–12',0],['lat','c',3,'10–12',0],['rowC','c',3,'10–12',0],['press','c',2,'10–12',0],['lcurl','i',2,'12–15',0],['bb','i',2,'12–15',0],['plank','t',3,'30–40 s',0]] },
      { code:'f2', name:'Tot corpul B', focus:'Tot corpul', img:'', off:1, slots:[['lpress','c',3,'10–12',0],['benchP','c',3,'10–12',0],['lat','c',3,'10–12',0],['rowC','c',3,'10–12',0],['press','c',2,'10–12',0],['lcurl','i',2,'12–15',0],['bb','i',2,'12–15',0],['plank','t',3,'30–40 s',0]] },
      { code:'f3', name:'Tot corpul C', focus:'Tot corpul', img:'', off:2, slots:[['lpress','c',3,'10–12',0],['benchP','c',3,'10–12',0],['lat','c',3,'10–12',0],['rowC','c',3,'10–12',0],['press','c',2,'10–12',0],['lcurl','i',2,'12–15',0],['bb','i',2,'12–15',0],['plank','t',3,'30–40 s',0]] }
    ], rest:[1,3,5,6] },
    4:{ label:'4 zile · Upper / Lower', dayIdx:[0,1,3,4], days:[
      { code:'u1', name:'Upper A · Partea de sus', focus:'Piept, spate, umeri, brațe', img:'', off:0, slots:[['benchP','c',3,'10–12',0],['lat','c',3,'10–12',0],['press','c',3,'10–12',0],['rowC','c',3,'10–12',0],['pushdown','i',2,'12–15',0],['bb','i',2,'12–15',0]] },
      { code:'u2', name:'Lower A · Picioare', focus:'Picioare și abdomen', img:'', off:0, slots:[['lpress','c',3,'10–12',0],['squat','c',3,'10–12',0],['lcurl','i',3,'12–15',0],['lext','i',3,'12–15',0],['calf','i',3,'15–20',0],['crunch','i',3,'12–20',0]] },
      { code:'u3', name:'Upper B · Partea de sus', focus:'Piept, spate, umeri, brațe', img:'', off:3, slots:[['inclP','c',3,'10–12',0],['rowH','c',3,'10–12',0],['lat2','i',3,'12–15',0],['rear','i',3,'12–15',0],['pushdown','i',2,'12–15',0],['bb','i',2,'12–15',0]] },
      { code:'u4', name:'Lower B · Picioare', focus:'Picioare și spate jos', img:'', off:3, slots:[['rdl','c',3,'10–12',0],['quad2','c',3,'10–12',0],['ham','i',3,'12–15',0],['lext','i',2,'12–15',0],['calf','i',3,'15–20',0],['crunch','i',3,'12–20',0]] }
    ], rest:[2,5,6] },
    5:{ label:'2 zile · Tot corpul', dayIdx:[0,3], days:[
      { code:'d1', name:'Tot corpul A', focus:'Tot corpul', img:'', off:0, slots:[['lpress','c',3,'10–12',0],['benchP','c',3,'10–12',0],['lat','c',3,'10–12',0],['press','c',2,'10–12',0],['lcurl','i',2,'12–15',0],['plank','t',3,'30–40 s',0]] },
      { code:'d2', name:'Tot corpul B', focus:'Tot corpul', img:'', off:2, slots:[['squat','c',3,'10–12',0],['inclP','c',3,'10–12',0],['rowC','c',3,'10–12',0],['rdl','c',2,'10–12',0],['pushdown','i',2,'12–15',0],['crunch','i',3,'12–20',0]] }
    ], rest:[1,2,4,5,6] }
  };
  /* ===== desene: cum se face fiecare exercițiu (start / sfârșit) ===== */
  function Lp(pts, c){ return '<polyline class="' + c + '" points="' + pts.map(function(p){ return p[0] + ',' + p[1]; }).join(' ') + '"/>'; }
  function Cp(x, y, r, c){ return '<circle class="' + c + '" cx="' + x + '" cy="' + y + '" r="' + r + '"/>'; }
  function DB(p){ return Cp(p[0], p[1], 4, 'e'); }
  function BAR(p){ return Cp(p[0], p[1], 6, 'e') + Cp(p[0], p[1], 1.5, 'e'); }
  // figură din lateral: S umăr, P șold, K genunchi, A gleznă, H cap, arm [cot, mână]
  function fg(o){
    var s = Lp([o.S, o.P], 'b') + Lp([o.P, o.K, o.A], 'b') + Lp([o.A, [o.A[0] + 9, o.A[1] + (o.fy || 0)]], 'b') + Cp(o.H[0], o.H[1], 5, 'b');
    if(o.K2) s += Lp([o.P, o.K2, o.A2], 'b') + Lp([o.A2, [o.A2[0] - 9, o.A2[1]]], 'b');
    if(o.arm) s += Lp([o.S, o.arm[0], o.arm[1]], 'a');
    return s + (o.eq || '');
  }
  // figură din față: arm = [cot, mână] pentru stânga, se oglindește pentru dreapta
  function mir(p){ return [120 - p[0], p[1]]; }
  function fr(o){
    var sy = o.sy || 0, s = Cp(60, 14 + sy, 5, 'b') + Lp([[60, 20 + sy], [60, 46]], 'b') + Lp([[48, 24 + sy], [72, 24 + sy]], 'b');
    if(o.seat){ s += Lp([[54, 46], [54, 50], [o.kn[0], o.kn[1]], [o.ft[0], o.ft[1]]], 'b') + Lp([[66, 46], [66, 50], mir(o.kn), mir(o.ft)], 'b') + Lp([[44, 52], [76, 52]], 'e'); }
    else s += Lp([[54, 46], [52, 70]], 'b') + Lp([[66, 46], [68, 70]], 'b') + Lp([[54, 46], [66, 46]], 'b');
    if(o.arm){ s += Lp([[48, 24 + sy], o.arm[0], o.arm[1]], 'a') + Lp([[72, 24 + sy], mir(o.arm[0]), mir(o.arm[1])], 'a'); }
    return s + (o.eq || '');
  }
  function lyingBody(S, P, K, A, H){ return Lp([S, P], 'b') + Lp([P, K, A], 'b') + Cp(H[0], H[1], 5, 'b'); }
  var BENCHLINE = Lp([[8, 46], [76, 46]], 'e') + Lp([[14, 46], [14, 66]], 'e') + Lp([[70, 46], [70, 66]], 'e');
  var FIGS = {
    bench:{ t:'Împins culcat', f:[
      BENCHLINE + lyingBody([24,41],[52,41],[66,46],[66,62],[15,39]) + Lp([[24,41],[24,31],[24,21]], 'a') + BAR([24,21]),
      BENCHLINE + lyingBody([24,41],[52,41],[66,46],[66,62],[15,39]) + Lp([[24,41],[32,38],[24,33]], 'a') + BAR([24,33])],
      s:['Culcat pe bancă, picioarele pe podea, omoplații strânși. Ține bara sau ganterele deasupra pieptului, brațele întinse.','Coboară încet (2 secunde) până la mijlocul pieptului, coatele la ~45–70° de corp. Apoi împinge sus.','Nu săltă bara de pe piept. Fundul rămâne pe bancă. Nu bloca tare coatele sus.'] },
    incline:{ t:'Împins înclinat', f:[
      Lp([[20,38],[54,52]], 'e') + Lp([[54,52],[54,66]], 'e') + Lp([[28,34],[52,46]], 'b') + Lp([[52,46],[68,50],[68,66]], 'b') + Cp(23,30,5,'b') + Lp([[28,34],[30,24],[30,14]], 'a') + DB([30,14]),
      Lp([[20,38],[54,52]], 'e') + Lp([[54,52],[54,66]], 'e') + Lp([[28,34],[52,46]], 'b') + Lp([[52,46],[68,50],[68,66]], 'b') + Cp(23,30,5,'b') + Lp([[28,34],[38,36],[30,26]], 'a') + DB([30,26])],
      s:['Bancă la ~30°. Ganterele sus, deasupra părții de sus a pieptului, brațele aproape întinse.','Coboară controlat până când ganterele sunt la nivelul pieptului, apoi împinge în sus.','Nu ridica fundul de pe bancă. Nu pune bancă mai sus de 45° (se mută efortul pe umeri).'] },
    fly:{ t:'Fluturări / crossover', f:[
      fr({ arm:[[36,28],[26,34]], eq:DB([26,34]) + DB([94,34]) }),
      fr({ arm:[[44,34],[56,36]], eq:DB([56,36]) + DB([64,36]) })],
      s:['Brațele deschise lateral, coatele ușor îndoite (ca și cum ai îmbrățișa un copac mare). Pieptul scos în față.','Adu mâinile spre mijloc, în arc, strângând pieptul. Ține 1 secundă la mijloc.','Păstrează coatele îndoite la fel tot timpul. Nu coborî greutatea mai mult decât simți întinderea în piept.'] },
    pushdown:{ t:'Extensii triceps la scripete', f:[
      fg({ H:[58,14], S:[58,24], P:[58,46], K:[59,58], A:[58,70], arm:[[58,36],[68,30]], eq:Cp(72,4,3,'e') + Lp([[72,4],[68,30]], 'e') + DB([68,30]) }),
      fg({ H:[58,14], S:[58,24], P:[58,46], K:[59,58], A:[58,70], arm:[[58,36],[58,50]], eq:Cp(72,4,3,'e') + Lp([[72,4],[58,50]], 'e') + DB([58,50]) })],
      s:['În picioare, aproape de scripete. Coatele lipite de corp, antebrațele ridicate (la ~90°).','Împinge în jos până când brațele sunt drepte. Strânge tricepsul 1 secundă, apoi urcă încet.','Coatele nu se mișcă din loc. Nu te apleca peste greutate și nu o balansa cu corpul.'] },
    overhead:{ t:'Extensii triceps peste cap', f:[
      fg({ H:[58,14], S:[58,26], P:[58,48], K:[59,58], A:[58,70], arm:[[60,12],[50,14]], eq:DB([50,14]) }),
      fg({ H:[58,14], S:[58,26], P:[58,48], K:[59,58], A:[58,70], arm:[[58,13],[58,0]], eq:DB([58,0]) })],
      s:['Ține ganterele sau bara deasupra capului. Coatele spre tavan, apropiate de cap. Lasă greutatea în spatele capului.','Întinde brațele în sus până sunt drepte, mișcând doar antebrațul.','Coatele nu se desfac în lateral. Nu arcui spatele; strânge abdomenul.'] },
    skull:{ t:'Skull crushers', f:[
      BENCHLINE + lyingBody([24,41],[52,41],[66,46],[66,62],[15,39]) + Lp([[24,41],[24,31],[24,21]], 'a') + BAR([24,21]),
      BENCHLINE + lyingBody([24,41],[52,41],[66,46],[66,62],[15,39]) + Lp([[24,41],[24,28],[14,30]], 'a') + BAR([14,30])],
      s:['Culcat pe bancă, bara EZ sau ganterele deasupra pieptului, brațele întinse.','Îndoaie doar coatele și coboară greutatea spre frunte (sau puțin în spatele capului). Apoi întinde.','Coatele rămân fixe, îndreptate spre tavan, nu în lateral. Coboară lent ca să nu te lovești.'] },
    dips:{ t:'Dips pe bancă', f:[
      Lp([[8,44],[34,44]], 'e') + Lp([[14,44],[14,66]], 'e') + Lp([[28,26],[46,38]], 'b') + Lp([[46,38],[68,52],[90,66]], 'b') + Cp(26,16,5,'b') + Lp([[28,26],[27,35],[26,44]], 'a'),
      Lp([[8,44],[34,44]], 'e') + Lp([[14,44],[14,66]], 'e') + Lp([[28,38],[46,48]], 'b') + Lp([[46,48],[68,56],[90,66]], 'b') + Cp(26,28,5,'b') + Lp([[28,38],[38,42],[26,44]], 'a')],
      s:['Mâinile pe marginea băncii, în spatele tău. Picioarele întinse în față, brațele drepte, corpul aproape de bancă.','Coboară îndoind coatele la ~90°, până când umerii sunt la nivelul coatelor. Apoi împinge sus.','Coatele merg înapoi, nu în lateral. Nu coborî prea jos (te forțează umerii). Umerii nu se ridică spre urechi.'] },
    pushup:{ t:'Flotări', f:[
      Lp([[26,40],[60,48],[96,58]], 'b') + Cp(18,34,5,'b') + Lp([[26,40],[26,50],[26,58]], 'a') + Lp([[6,60],[110,60]], 'e'),
      Lp([[26,52],[60,56],[96,60]], 'b') + Cp(18,46,5,'b') + Lp([[26,52],[36,54],[26,60]], 'a') + Lp([[6,62],[110,62]], 'e')],
      s:['Mâinile sub umeri, corpul drept ca o scândură de la cap la călcâie, abdomenul și fesele strânse.','Coboară pieptul aproape de sol (coatele la ~45°), apoi împinge sus.','Nu lăsa șoldurile să cadă și nu le ridica. Dacă e greu, pune mâinile pe o bancă.'] },
    pulldown:{ t:'Tracțiuni (helcometru)', f:[
      fr({ arm:[[36,12],[30,0]], eq:Lp([[22,0],[98,0]], 'e') + Lp([[30,0],[30,-6]], 'e') + Lp([[90,0],[90,-6]], 'e') }),
      fr({ arm:[[38,34],[34,24]], eq:Lp([[22,24],[98,24]], 'e') + Lp([[30,24],[30,-6]], 'e') + Lp([[90,24],[90,-6]], 'e') })],
      s:['Apucă bara mai larg decât umerii, brațele sus, pieptul ridicat, trunchiul ușor înclinat înapoi.','Trage bara spre claviculă, ducând coatele în jos și spre șolduri. Strânge spatele 1 secundă.','Nu te legăna cu corpul și nu trage bara în spatele capului. Gândește-te că trag coatele, nu mâinile.'] },
    row:{ t:'Ramat', f:[
      fg({ H:[78,26], S:[70,30], P:[46,46], K:[50,58], A:[48,70], arm:[[70,42],[70,54]], eq:BAR([70,54]) }),
      fg({ H:[78,26], S:[70,30], P:[46,46], K:[50,58], A:[48,70], arm:[[56,38],[66,46]], eq:BAR([66,46]) })],
      s:['Genunchii ușor îndoiți, spatele drept, trunchiul aplecat la ~45°. Greutatea atârnă cu brațele întinse.','Trage greutatea spre buric, ducând coatele în spate. Strânge omoplații 1 secundă, apoi coboară încet.','Spatele rămâne drept tot timpul, nu rotunji. Nu te ridica din trunchi la fiecare repetare.'] },
    sarm:{ t:'Pulldown cu brațele întinse', f:[
      fg({ H:[58,14], S:[58,24], P:[58,46], K:[59,58], A:[58,70], arm:[[69,18],[80,12]], eq:Cp(86,2,3,'e') + Lp([[86,2],[80,12]], 'e') + DB([80,12]) }),
      fg({ H:[58,14], S:[58,24], P:[58,46], K:[59,58], A:[58,70], arm:[[58,36],[58,50]], eq:Cp(86,2,3,'e') + Lp([[86,2],[58,50]], 'e') + DB([58,50]) })],
      s:['În fața scripetelui de sus, brațele întinse în față și puțin în sus, ușor aplecat înainte.','Trage bara în jos spre coapse, cu brațele drepte, doar din spate. Strânge 1 secundă.','Brațele rămân întinse, nu face flexie la cot. Nu te lăsa cu tot corpul peste greutate.'] },
    curl:{ t:'Flexii biceps', f:[
      fg({ H:[58,14], S:[58,24], P:[58,46], K:[59,58], A:[58,70], arm:[[58,36],[58,48]], eq:DB([58,48]) }),
      fg({ H:[58,14], S:[58,24], P:[58,46], K:[59,58], A:[58,70], arm:[[58,36],[66,26]], eq:DB([66,26]) })],
      s:['În picioare, brațele întinse pe lângă corp, palmele în față (sau față în față la ciocan). Coatele lipite de corp.','Ridică greutatea spre umăr îndoind doar cotul. Strânge bicepsul sus, apoi coboară în 2–3 secunde.','Coatele nu se duc în față și nu te balansa cu spatele. Dacă trebuie să te legeni, greutatea e prea mare.'] },
    squat:{ t:'Genuflexiuni', f:[
      fg({ H:[58,12], S:[58,24], P:[58,46], K:[59,58], A:[58,70], eq:BAR([56,22]) + Lp([[58,24],[62,22]], 'a') }),
      fg({ H:[72,26], S:[66,34], P:[46,54], K:[70,54], A:[58,70], eq:BAR([64,32]) })],
      s:['Picioarele la lățimea umerilor, vârfurile ușor în afară. Bara pe spate (nu pe gât). Pieptul sus, abdomenul strâns.','Împinge șoldurile în spate și coboară până când coapsele sunt cel puțin paralele cu solul. Genunchii merg în direcția vârfurilor. Urcă împingând în podea.','Spatele rămâne drept, călcâiele pe sol, genunchii nu cad înăuntru. Respiră adânc înainte de coborâre.'] },
    lunge:{ t:'Fandări', f:[
      fg({ H:[58,14], S:[58,26], P:[58,46], K:[70,56], A:[70,70], K2:[48,60], A2:[38,70] }),
      fg({ H:[58,26], S:[58,38], P:[58,56], K:[72,56], A:[72,70], K2:[50,66], A2:[40,70] })],
      s:['Un pas lung înainte, trunchiul drept, greutatea pe ambele picioare. (La bulgărești piciorul din spate stă pe o bancă.)','Coboară drept în jos până când genunchiul din față e la ~90° și cel din spate aproape de sol. Împinge cu piciorul din față ca să urci.','Genunchiul din față nu depășește mult vârful piciorului și nu cade înăuntru. Nu te apleca înainte.'] },
    legpress:{ t:'Leg press', f:[
      Lp([[10,62],[40,62]], 'e') + Lp([[14,40],[28,60]], 'e') + lyingBody([22,44],[36,54],[58,38],[80,22],[14,38]) + Lp([[73,12],[87,32]], 'e'),
      Lp([[10,62],[40,62]], 'e') + Lp([[14,40],[28,60]], 'e') + lyingBody([22,44],[36,54],[48,34],[58,46],[14,38]) + Lp([[51,38],[65,54]], 'e')],
      s:['Spatele și fesele lipite de spătar, picioarele pe platformă la lățimea umerilor. Eliberează siguranțele.','Coboară platforma încet până când genunchii sunt la ~90°. Împinge înapoi cu toată talpa, fără să bloci genunchii sus.','Fundul nu se ridică de pe scaun. Nu lăsa genunchii să cadă spre interior. Nu bloca complet genunchii.'] },
    lext:{ t:'Extensii picioare', f:[
      Lp([[36,20],[36,50]], 'e') + Lp([[30,50],[66,50]], 'e') + Cp(40,12,5,'b') + Lp([[40,20],[40,46]], 'b') + Lp([[40,46],[62,46],[62,64]], 'b') + Cp(62,64,3,'e'),
      Lp([[36,20],[36,50]], 'e') + Lp([[30,50],[66,50]], 'e') + Cp(40,12,5,'b') + Lp([[40,20],[40,46]], 'b') + Lp([[40,46],[62,46],[84,46]], 'b') + Cp(84,46,3,'e')],
      s:['Spatele lipit de spătar, genunchii în dreptul axei mașinii, perna sprijinită pe gleznă.','Întinde picioarele până sus și strânge cvadricepsul 1 secundă. Coboară încet (2–3 secunde).','Nu balansa greutatea. Nu ridica fundul de pe scaun.'] },
    lcurl:{ t:'Flexii picioare', f:[
      Lp([[8,50],[104,50]], 'e') + lyingBody([22,44],[50,46],[74,46],[98,46],[14,42]) + Cp(98,46,3,'e'),
      Lp([[8,50],[104,50]], 'e') + lyingBody([22,44],[50,46],[74,46],[72,22],[14,42]) + Cp(72,22,3,'e')],
      s:['Culcat pe burtă (sau așezat), șoldurile lipite de bancă, perna deasupra călcâielor.','Trage călcâiele spre fese îndoind genunchii. Strânge spatele coapsei 1 secundă, apoi coboară în 3 secunde.','Șoldurile nu se ridică de pe bancă. Nu arcui spatele și nu balansa.'] },
    hinge:{ t:'Îndreptări românești', f:[
      fg({ H:[58,14], S:[58,24], P:[58,46], K:[59,58], A:[58,70], arm:[[58,36],[60,48]], eq:BAR([60,48]) }),
      fg({ H:[76,32], S:[70,36], P:[44,46], K:[48,58], A:[48,70], arm:[[72,48],[72,58]], eq:BAR([72,58]) })],
      s:['În picioare, bara în fața coapselor, brațele întinse, genunchii ușor îndoiți, spatele drept.','Împinge șoldurile în spate (ca și cum ai închide o ușă cu fundul), bara alunecă pe coapse până sub genunchi. Simți întinderea în spatele coapselor. Urcă strângând fesele.','Spatele rămâne drept tot timpul, bara aproape de picioare. Nu rotunji spatele și nu coborî mai jos decât poți ține spatele drept.'] },
    hip:{ t:'Hip thrust / pod pentru fese', f:[
      Lp([[8,42],[32,42]], 'e') + Lp([[14,42],[14,66]], 'e') + Lp([[26,44],[48,58]], 'b') + Lp([[48,58],[68,46],[68,70]], 'b') + Cp(18,38,5,'b') + BAR([48,56]),
      Lp([[8,42],[32,42]], 'e') + Lp([[14,42],[14,66]], 'e') + Lp([[26,44],[50,42]], 'b') + Lp([[50,42],[68,46],[68,70]], 'b') + Cp(18,38,5,'b') + BAR([50,40])],
      s:['Spatele de sus pe marginea unei bănci, picioarele pe podea, genunchii la ~90°. Greutatea pe șolduri.','Împinge din călcâie și ridică șoldurile până când corpul e drept de la umeri la genunchi. Strânge fesele 1 secundă.','Bărbia spre piept, nu arcui spatele jos. Privirea înainte, nu în tavan.'] },
    calf:{ t:'Ridicări pe vârfuri', f:[
      Lp([[44,70],[72,70]], 'e') + fg({ H:[58,14], S:[58,24], P:[58,46], K:[59,58], A:[58,66], fy:2 }),
      Lp([[44,70],[72,70]], 'e') + fg({ H:[58,8], S:[58,18], P:[58,40], K:[59,52], A:[58,62], fy:6 })],
      s:['În picioare cu vârful piciorului pe marginea unui suport, călcâiele în aer. Coboară călcâiele cât poți.','Urcă pe vârfuri cât de sus poți, ține 1 secundă sus, apoi coboară lent, simțind întinderea.','Genunchii rămân aproape drepți, nu săltă. Mișcarea completă contează mai mult decât greutatea.'] },
    crunch:{ t:'Abdomen', f:[
      Lp([[6,66],[110,66]], 'e') + lyingBody([24,62],[52,62],[64,46],[76,60],[16,62]),
      Lp([[6,66],[110,66]], 'e') + lyingBody([24,62],[50,54],[60,36],[70,46],[16,62])],
      s:['Culcat pe spate, genunchii îndoiți, mâinile pe lângă corp sau sub cap.','Ridică șoldurile de pe sol trăgând genunchii spre piept cu abdomenul (nu cu avântul). Ține 1 secundă sus.','Coboară încet, fără să balansezi picioarele. Respiră expirând când urci.'] },
    plank:{ t:'Plank', f:[
      Lp([[6,60],[110,60]], 'e') + Lp([[26,46],[60,52],[100,58]], 'b') + Cp(18,40,5,'b') + Lp([[26,46],[26,58],[42,58]], 'a'),
      Lp([[6,60],[110,60]], 'e') + Lp([[26,46],[60,52],[100,58]], 'b') + Cp(18,40,5,'b') + Lp([[26,46],[26,58],[42,58]], 'a')],
      s:['Pe antebrațe, coatele sub umeri, corpul drept ca o scândură de la cap la călcâie.','Strânge abdomenul și fesele și ține poziția 30–60 de secunde, respirând normal.','Nu lăsa șoldurile să cadă și nu le ridica în sus. Oprește-te când pierzi poziția.'] },
    lateral:{ t:'Ridicări laterale', f:[
      fr({ arm:[[44,36],[46,48]], eq:DB([46,48]) + DB([74,48]) }),
      fr({ arm:[[36,24],[24,24]], eq:DB([24,24]) + DB([96,24]) })],
      s:['În picioare, ganterele pe lângă corp, coatele ușor îndoite, abdomenul strâns.','Ridică brațele în lateral până la nivelul umerilor (nu mai sus), ca și cum ai turna o cană cu apă. Coboară încet.','Nu săltă din corp. Greutate mică și controlat funcționează mai bine decât greutate mare.'] },
    front:{ t:'Ridicări frontale', f:[
      fg({ H:[58,14], S:[58,24], P:[58,46], K:[59,58], A:[58,70], arm:[[58,36],[60,48]], eq:DB([60,48]) }),
      fg({ H:[58,14], S:[58,24], P:[58,46], K:[59,58], A:[58,70], arm:[[70,25],[82,24]], eq:DB([82,24]) })],
      s:['În picioare, ganterele în fața coapselor, brațele aproape drepte.','Ridică brațul în față până la nivelul ochilor (nu mai sus). Ține 1 secundă și coboară în 2–3 secunde.','Nu te legăna cu spatele. Greutate mică, mișcare curată.'] },
    press:{ t:'Împins umeri', f:[
      fr({ arm:[[38,32],[40,18]], eq:DB([40,18]) + DB([80,18]) }),
      fr({ arm:[[44,14],[50,0]], eq:DB([50,0]) + DB([70,0]) })],
      s:['Ganterele la nivelul umerilor, coatele în afară și puțin în față, abdomenul strâns (la mașină spatele lipit de spătar).','Împinge ganterele în sus deasupra capului până când brațele sunt aproape drepte. Coboară controlat la umeri.','Nu arcui spatele. Nu bloca brusc coatele. Coboară încet.'] },
    shrug:{ t:'Ridicări de umeri', f:[
      fr({ arm:[[46,36],[46,48]], eq:DB([46,48]) + DB([74,48]) }),
      fr({ sy:-5, arm:[[46,31],[46,43]], eq:DB([46,43]) + DB([74,43]) })],
      s:['În picioare, ganterele sau bara pe lângă corp, brațele drepte, umerii relaxați.','Ridică umerii spre urechi cât poți. Ține 1 secundă sus, apoi coboară încet.','Nu rotește umerii și nu îndoi coatele. Mișcare doar în sus și în jos.'] },
    adduct:{ t:'Adductori (interiorul coapselor)', f:[
      fr({ seat:true, kn:[38,52], ft:[36,68] }),
      fr({ seat:true, kn:[55,52], ft:[54,68] })],
      s:['Așezat la mașină, picioarele larg depărtate, pernele pe interiorul coapselor, spatele lipit de spătar.','Strânge coapsele una spre alta, ține 1 secundă, apoi deschide încet.','Nu folosi avânt. Alege o greutate cu care controlezi și deschiderea.'] }
  };
  function patOf(name){
    var n = name.toLowerCase();
    var R = [[/flotări pe bancă|dips/, 'dips'],[/flotări/, 'pushup'],[/fandări/, 'lunge'],[/ridicări pe vârfuri/, 'calf'],[/leg press/, 'legpress'],
      [/flexii picioare|flexii culcat/, 'lcurl'],[/extensii (picioare|cu coborâre|cu pauză|pe un picior)/, 'lext'],
      [/hip thrust|pod pentru|kickback la scripete/, 'hip'],[/deadlift|good morning|hiperextensii/, 'hinge'],[/step-up/, 'lunge'],[/ridicări de umeri|shrug/, 'shrug'],[/ridicări laterale/, 'lateral'],[/ridicări frontale/, 'front'],
      [/fluturări inverse|face pull/, 'lateral'],[/ramat/, 'row'],[/flexii|curl|spider/, 'curl'],[/împins umeri|arnold/, 'press'],[/împins.*înclinat/, 'incline'],
      [/împins la scripete|fluturări|crossover/, 'fly'],[/împins/, 'bench'],
      [/skull/, 'skull'],[/peste cap|deasupra capului/, 'overhead'],[/extensii|kickback/, 'pushdown'],[/tracțiuni/, 'pulldown'],[/pulldown|pullover/, 'sarm'],
      [/adductori/, 'adduct'],[/genuflexiuni|hack/, 'squat'],[/îndreptări/, 'hinge'],[/plank|hollow/, 'plank'],[/crunch|genunchi din atârnat/, 'crunch']];
    for(var i=0;i<R.length;i++) if(R[i][0].test(n)) return R[i][1];
    return 'bench';
  }
  function figHtml(key){
    var F = FIGS[key]; if(!F) return '';
    function box(svg, lab){ return '<div class="fg-box"><svg viewBox="0 -8 120 84" class="fg">' + svg + '</svg><span>' + lab + '</span></div>'; }
    return '<div class="fg-row">' + box(F.f[0], key === 'plank' ? 'POZIȚIE' : 'START') + box(F.f[1], key === 'plank' ? 'ȚINE 30–60 s' : 'SFÂRȘIT') + '</div>' +
      '<ol class="fg-steps"><li><b>Start:</b> ' + F.s[0] + '</li><li><b>Mișcarea:</b> ' + F.s[1] + '</li><li><b>Atenție:</b> ' + F.s[2] + '</li></ol>';
  }
  // căutări video (YouTube), în engleză, ca să iasă clipuri bune — aceeași ordine ca variantele din POOL
  var ENP = {
    benchP:['barbell bench press form','dumbbell bench press form','machine chest press form','paused bench press form'],
    inclP:['incline dumbbell press form','incline barbell bench press form','incline machine chest press form','neutral grip incline dumbbell press'],
    fly:['pec deck fly form','cable chest fly form','incline dumbbell fly form','single arm machine chest fly'],
    cross:['high to low cable crossover form','low to high cable fly form','slow tempo push up form','single arm cable chest press'],
    pushdown:['triceps rope pushdown form','straight bar triceps pushdown form','single arm cable triceps pushdown','reverse grip triceps pushdown'],
    overhead:['overhead dumbbell triceps extension form','cable overhead triceps extension form','overhead EZ bar triceps extension','single arm overhead dumbbell triceps extension'],
    skull:['EZ bar skull crushers form','dumbbell skull crushers form','close grip bench press form','close grip push ups form'],
    dips:['bench dips form','parallel bar dips form','assisted dip machine form','dumbbell triceps kickback form'],
    lat:['wide grip lat pulldown form',
      'neutral grip lat pulldown form',
      'assisted pull ups form',
      'close grip lat pulldown form'],
    rowH:['barbell bent over row form',
      'T bar row form',
      'chest supported dumbbell row form',
      'smith machine reverse grip row'],
    rowC:['seated cable row wide grip form',
      'seated cable row close neutral grip form',
      'incline bench chest supported row form',
      'wide grip machine row form'],
    sarm:['straight arm pulldown form',
      'face pull form',
      'reverse pec deck fly form',
      'dumbbell pullover form'],
    bb:['barbell curl form','EZ bar curl form','cable curl form','preacher curl form'],
    db:['dumbbell alternating curl form','incline dumbbell curl form','concentration curl form','spider curl form'],
    ham:['dumbbell hammer curl form','cross body hammer curl form','rope hammer curl cable form','incline hammer curl form'],
    squat:['barbell back squat form','hack squat form','goblet squat form','smith machine squat form'],
    lpress:['leg press form','leg press high foot placement glutes','bulgarian split squat form','walking lunges dumbbell form'],
    lext:['leg extension machine form','single leg extension form','leg extension pause form','slow tempo leg extension'],
    lcurl:['lying leg curl form','seated leg curl form','slow negative lying leg curl','single leg curl form'],
    rdl:['barbell romanian deadlift form','dumbbell romanian deadlift form','single leg romanian deadlift form','stiff leg deadlift form'],
    quad2:['conventional deadlift form','good morning barbell form','dumbbell step up form','barbell lunge form','trap bar deadlift form','dumbbell split squat form','back extension roman chair form','hack squat pause form'],
    hip:['barbell hip thrust form','glute bridge machine form','dumbbell hip thrust form','cable glute kickback form'],
    calf:['standing calf raise machine form','seated calf raise form','calf raise on leg press form','single leg calf raise form'],
    add:['hip adductor machine form','dumbbell sumo squat form','cable hip adduction form','slow adductor machine'],
    press:['seated dumbbell shoulder press form','arnold press form','machine shoulder press form','seated barbell overhead press form'],
    lat2:['dumbbell lateral raise form','cable lateral raise form','machine lateral raise form','leaning lateral raise form'],
    front:['dumbbell front raise form','plate front raise form','cable front raise form','alternating dumbbell front raise form'],
    rear:['bent over dumbbell reverse fly form','reverse pec deck fly form','cable reverse fly form','face pull form'],
    shrug:['dumbbell shrug form','barbell shrug form','smith machine shrug form','cable shrug form'],
    plank:['forearm plank form','side plank form','plank shoulder taps form','hollow body hold form'],
    crunch:['reverse crunch form','cable crunch form','ab crunch machine form','hanging knee raise form'],
    lowb:['45 degree back extension form',
      'good morning exercise form',
      'machine back extension form',
      'trap bar deadlift form'],
  };
  function ytUrl(q){ return 'https://www.youtube.com/results?search_query=' + encodeURIComponent(q); }
  // încă 4 variante la fiecare exercițiu → ciclu de 8 săptămâni fără repetări
  var POOL2 = {
    benchP:['Împins plat la Smith|Bara pe ghidaj, coboară controlat la piept','Împins plat cu gantere, coborâre lentă|Coboară în 3 secunde, urcă puternic','Împins la piept la mașină, o mână|Pe rând, concentrează-te pe piept','Împins la piept cu haltera, priză mai largă|Mâinile puțin mai late, accent pe piept'],
    inclP:['Împins înclinat la Smith|Bancă la 30°, bara pe ghidaj','Împins înclinat cu gantere, coborâre lentă|Coboară în 3 secunde','Împins înclinat cu haltera, priză largă|Accent pe pieptul de sus','Împins înclinat cu gantere, o mână|Pe rând, corpul stabil'],
    fly:['Fluturări la cabluri, de jos în sus|Ridici brațele în arc spre bărbie','Fluturări la peck deck, pauză 2 s|Ține 2 secunde cu pieptul strâns','Fluturări cu gantere pe bancă plată|Coboară larg, urcă în arc','Fluturări la cabluri, de sus în jos|Mâinile se întâlnesc în fața abdomenului'],
    cross:['Cable crossover, la nivelul pieptului|Mâinile se întâlnesc în fața pieptului','Împins la scripete, ambele mâini|Un pas înainte, împinge drept','Flotări cu picioarele ridicate|Picioarele pe bancă, accent pe pieptul de sus','Fluturări la scripete, o mână|Pe rând, strânge pieptul'],
    pushdown:['Extensii la scripete, cu coarda, pauză jos|Ține 1 secundă jos, tricepsul strâns','Extensii triceps cu bara V|Coatele lipite de corp','Extensii triceps cu coarda, o mână|Pe rând, controlat','Extensii triceps la scripete, coborâre lentă|Urcă în 3 secunde'],
    overhead:['Extensii peste cap cu coarda, la scripete jos|Coatele sus, fixe','Extensii deasupra capului, așezat, cu ganteră|Spătar drept, coboară adânc','Extensii triceps peste cap cu bara EZ, așezat|Coatele aproape de cap','Extensii peste cap, o mână, la scripete|Pe rând, întinde complet'],
    skull:['Skull crushers pe bancă înclinată|Bancă ușor înclinată, coatele fixe','Skull crushers la scripete|Tensiune constantă pe triceps','Skull crushers cu gantere, o mână|Pe rând, controlat','Skull crushers, pauză jos|Ține 1 secundă jos'],
    dips:['Dips la paralele, înclinat în față|Accent pe piept și triceps','Dips pe bancă, picioarele ridicate|Mai greu: picioarele pe altă bancă','Kickback triceps la scripete|Cotul sus, extinde spre spate','Dips la mașină, cu greutate ușoară|Coboară lent'],
    lat:['Tracțiuni la helcometru, priză inversă|Palmele spre tine, trage la piept',
      'Tracțiuni la bară, priză neutră|Palmele față în față, coboară controlat',
      'Tracțiuni la mașină, ambele brațe|Trage coatele în jos, pieptul sus',
      'Tracțiuni la helcometru, coborâre lentă|Urcă în 3 secunde, fără balans'],
    rowH:['Ramat cu haltera, priză inversă|Palmele în sus, trage spre buric',
      'Ramat cu gantere, aplecat, două mâini|Spatele drept, trage coatele sus',
      'Ramat la mașină, piept sprijinit|Piept pe pernă, strânge spatele',
      'Ramat Pendlay (din sol)|Fiecare repetare pornește din sol'],
    rowC:['Ramat la cablu, priză inversă|Palmele în sus, coatele aproape',
      'Ramat la mașină, priză neutră|Piept sprijinit, trage coatele pe lângă corp',
      'Ramat la cablu, cu pauză sus|Ține 1 secundă sus, apoi coboară lent',
      'Ramat la mașină, spate de sus|Trage spre piept cu coatele larg'],
    sarm:['Pulldown cu brațele întinse, la coardă|Coarda se desparte jos',
      'Pullover la scripete|Brațe drepte, trage cu spatele',
      'Pullover la mașină|Coatele sprijinite, trage în jos',
      'Face pull, priză largă|Trage spre frunte, coatele sus'],
    bb:['Flexii cu bara EZ, priză îngustă|Coatele fixe, accent pe interior','Flexii la scripete, cu bara|Tensiune constantă','Flexii 21 (7+7+7) cu bara|7 jos, 7 sus, 7 complete','Flexii cu bara, coborâre lentă|Coboară în 3 secunde'],
    db:['Flexii cu gantere, în picioare, simultan|Ambele brațe odată','Flexii cu gantere, priză supinată la bancă|Brațele pe bancă înclinată','Flexii la scripete, o mână|Pe rând, strânge sus','Flexii cu gantere, coborâre lentă|Coboară în 3 secunde'],
    ham:['Flexii ciocan, alternative|Un braț pe rând','Flexii ciocan, priză inversă|Palmele în jos, pentru antebraț','Flexii ciocan la scripete, o mână|Pe rând, controlat','Flexii ciocan, coborâre lentă|Coboară în 3 secunde'],
    squat:['Genuflexiuni cu pauză (1–2 s jos)|Ține 1–2 secunde jos, apoi urcă','Genuflexiuni frontale cu haltera|Bara pe umerii din față, coatele sus','Genuflexiuni la presa Hack, picioare joase|Accent pe cvadriceps','Genuflexiuni cu gantere, ținute la umeri|Gantere la umeri, pieptul sus'],
    lpress:['Leg press, picioare late|Accent pe interiorul coapselor','Fandări inverse cu gantere|Pas înapoi, coboară drept','Fandări laterale|Pas în lateral, șoldurile în spate','Leg press pe un picior|Pe rând, cu greutate mică'],
    lext:['Extensii picioare, pauză sus|Ține 2 secunde sus','Extensii picioare, vârfurile în afară|Accent pe interior','Extensii picioare, repetări parțiale sus|Doar jumătatea de sus, la final','Extensii picioare, serie lungă|Repetări multe, greutate mică'],
    lcurl:['Flexii picioare, vârfurile îndreptate în jos|Accent pe spatele coapsei','Flexii picioare, culcat, pauză sus|Ține 1 secundă sus','Flexii picioare cu gantera între glezne|Controlat, fără balans','Flexii picioare, pe un picior, așezat|Pe rând, controlat'],
    rdl:['Îndreptări românești la Smith|Bara pe ghidaj, șoldurile în spate','Îndreptări cu bara hexagonală|Spatele drept, împinge din picioare','Îndreptări românești, coborâre lentă|Coboară în 3 secunde','Îndreptări românești cu gantere, o mână|Echilibru, spatele drept'],
    hip:['Hip thrust la Smith|Bara pe șolduri, strânge sus','Hip thrust pe un picior|Pe rând, șoldurile drepte','Pod pentru fese cu gantera|Ganteră pe șolduri','Hip thrust, pauză 2 s sus|Ține 2 secunde sus'],
    calf:['Ridicări pe vârfuri la Smith|Pe un suport, coboară complet','Ridicări pe vârfuri, vârfurile în afară|Accent pe interior','Ridicări pe vârfuri cu gantere|Gantere în mâini, pe treaptă','Ridicări pe vârfuri, repetări lente|3 secunde urcare, 3 coborâre'],
    add:['Adductori la mașină, o parte|Pe rând, controlat','Fandări laterale cu ganteră (adductori)|Pas lateral, ganteră la piept','Adductori cu elastic|Strânge piciorul spre celălalt','Genuflexiuni sumo la Smith|Picioarele larg, genunchii în afară'],
    press:['Împins umeri la Smith|Bara pe ghidaj, fără arcuire','Împins umeri cu gantere, în picioare|Abdomenul strâns, nu arcui spatele','Împins umeri cu gantere, o mână|Pe rând, corpul stabil','Împins umeri, priză neutră, cu gantere|Palmele față în față'],
    lat2:['Ridicări laterale cu gantere, aplecat ușor|Mică înclinare spre înainte','Ridicări laterale la scripete, o mână, din spate|Tensiune constantă','Ridicări laterale cu pauză sus|Ține 1 secundă sus','Ridicări laterale, serie lungă|Repetări multe, greutate mică'],
    front:['Ridicări frontale cu bara|Bară la lățimea umerilor','Ridicări frontale la scripete, o mână|Pe rând, controlat','Ridicări frontale cu coarda, la scripete|Trage coarda în față','Ridicări frontale înclinat|Pe bancă înclinată, fără balans'],
    rear:['Fluturări inverse pe bancă înclinată|Pieptul pe bancă, trage înapoi','Fluturări inverse, o mână, la scripete|Pe rând, strânge omoplatul','Fluturări inverse cu elastic|Trage elasticul larg','Face pull la coardă, priză largă|Trage spre frunte'],
    shrug:['Shrug cu gantere, pauză sus|Ține 2 secunde sus','Shrug cu bara la spate|Bara în spatele corpului','Shrug la mașină|Controlat, fără rotire','Ridicări de umeri, aplecat|Ușor aplecat, pentru trapezul din mijloc'],
    plank:['Plank cu ridicarea unui picior|Alternezi picioarele, șoldurile fixe','Plank cu picioarele ridicate|Picioarele pe bancă','Plank dinamic (sus–jos pe mâini)|Treci de pe antebrațe pe mâini','Plank lateral cu rotație|Rotește trunchiul sub corp'],
    crunch:['Crunch cu picioarele ridicate|Picioarele în aer, urcă cu abdomenul','Crunch la scripete, în genunchi|Rotunjește spatele, trage cu abdomenul','Crunch invers, pe bancă înclinată|Ridică șoldurile încet','Ridicări de genunchi din atârnat, pe antebrațe|Fără balans, genunchii la piept'],
    lowb:['Hiperextensii cu pauză sus|Ține 1 secundă sus, fără arcuire',
      'Good morning la Smith|Bara pe ghidaj, șoldurile în spate',
      'Hiperextensii cu disc la piept|Disc ușor la piept, mișcare lentă',
      'Hiperextensii culcat (superman)|Ridică brațele și picioarele, ține 2 secunde'],
  };
  Object.keys(POOL2).forEach(function(k){ POOL[k] = POOL[k].concat(POOL2[k]); });
  var ENP2 = {
    benchP:['smith machine bench press form','slow tempo dumbbell bench press','single arm machine chest press','wide grip bench press form'],
    inclP:['smith machine incline press form','slow tempo incline dumbbell press','wide grip incline barbell bench press','single arm incline dumbbell press'],
    fly:['low to high cable fly form','pec deck fly pause form','dumbbell chest fly flat bench form','high to low cable fly form'],
    cross:['mid chest cable crossover form','double arm cable chest press form','decline push ups feet elevated form','single arm cable chest fly form'],
    pushdown:['triceps rope pushdown pause form','V bar triceps pushdown form','single arm rope triceps pushdown','slow negative triceps pushdown'],
    overhead:['low cable overhead rope triceps extension','seated overhead dumbbell triceps extension','seated overhead EZ bar triceps extension','single arm cable overhead triceps extension'],
    skull:['incline skull crushers form','cable skull crushers form','single arm dumbbell skull crushers','paused skull crushers form'],
    dips:['chest dips lean forward form','bench dips feet elevated form','cable triceps kickback form','assisted dips machine slow'],
    lat:['reverse grip lat pulldown form',
      'neutral grip pull ups form',
      'machine lat pulldown form',
      'slow negative lat pulldown'],
    rowH:['reverse grip barbell row form',
      'bent over dumbbell row both arms form',
      'chest supported machine row form',
      'pendlay row form'],
    rowC:['reverse grip cable row form',
      'hammer strength iso row form',
      'paused seated cable row form',
      'high row machine upper back form'],
    sarm:['rope straight arm pulldown form',
      'cable pullover form',
      'machine pullover form',
      'wide face pull rope form'],
    bb:['close grip EZ bar curl form','cable bar curl form','21s barbell curl form','slow negative barbell curl'],
    db:['standing dumbbell curl both arms form','supinated incline dumbbell curl form','single arm cable curl form','slow negative dumbbell curl'],
    ham:['alternating hammer curl form','reverse grip hammer curl form','single arm cable hammer curl form','slow negative hammer curl'],
    squat:['paused squat form','front squat form','hack squat low foot position form','dumbbell goblet front rack squat form'],
    lpress:['wide stance leg press form','reverse lunges dumbbell form','lateral lunges form','single leg leg press form'],
    lext:['leg extension peak contraction form','leg extension toes out form','leg extension partial reps','high rep leg extension'],
    lcurl:['lying leg curl toes pointed down form','lying leg curl pause form','dumbbell leg curl form','single leg seated leg curl form'],
    rdl:['smith machine romanian deadlift form','trap bar deadlift form','slow tempo romanian deadlift form','single arm dumbbell romanian deadlift form'],
    hip:['smith machine hip thrust form','single leg hip thrust form','dumbbell glute bridge form','paused hip thrust form'],
    calf:['smith machine calf raise form','toes out calf raise form','dumbbell calf raise form','slow tempo calf raise form'],
    add:['single side hip adductor machine','lateral lunge with dumbbell form','resistance band hip adduction form','smith machine sumo squat form'],
    press:['smith machine shoulder press form','standing dumbbell shoulder press form','single arm dumbbell shoulder press form','neutral grip dumbbell shoulder press form'],
    lat2:['leaning forward dumbbell lateral raise form','cable lateral raise behind back form','paused lateral raise form','high rep lateral raise'],
    front:['barbell front raise form','single arm cable front raise form','rope cable front raise form','incline bench front raise form'],
    rear:['incline bench reverse fly form','single arm cable reverse fly form','band reverse fly form','wide grip rope face pull form'],
    shrug:['paused dumbbell shrug form','behind the back barbell shrug form','machine shrug form','bent over shrug form'],
    plank:['plank with leg lift form','feet elevated plank form','plank up down form','side plank with rotation form'],
    crunch:['crunch legs raised form','kneeling cable crunch form','decline reverse crunch form','hanging knee raise on captain chair form'],
    lowb:['back extension pause form',
      'smith machine good morning form',
      'weighted back extension plate form',
      'superman back extension form'],
  };
  Object.keys(ENP2).forEach(function(k){ ENP[k] = ENP[k].concat(ENP2[k]); });
  // exercițiile unei zile, pentru o anumită săptămână (alta variantă la fiecare săptămână, ciclu de 8)
  function buildDay(plan, d, week){
    var wv = ((week - 1) % 4 + 4) % 4, ex = [];
    d.slots.forEach(function(s){
      var vi = (week - 1 + (d.off || 0) + (s[4] || 0)) % 8;
      var HARD = /haltera|T-bar|Pendlay|Arnold|21 \(|Good morning|Deadlift|hexagonală|un picior|bulgăr|mergând|laterale, sprijinit|elastic|cross-body|dinamic|rotație|atârnat|frontale|goblet|split|stiff|între glezne|disc|la bară|alternative|o mână|un braț|pe rând|aplecat|pauză|coborâre lentă|serie lungă|parțiale|stâlp|înclinată \(|Hollow|superman|Plank cu|priză inversă|vârfurile|Pullover cu|cu picioarele ridicate/i;
      var lvl = sp.level || 'mid';
      if(lvl !== 'hard'){ for(var tr = 0; tr < 8 && HARD.test(POOL[s[0]][vi].split('|')[0]); tr++) vi = (vi + 1) % 8;
      if(HARD.test(POOL[s[0]][vi].split('|')[0])) vi = (week - 1 + (d.off || 0) + (s[4] || 0)) % 8; }
      var p = POOL[s[0]][vi].split('|');
      var type = s[1], reps = wv === 0 ? s[3] : WREPS[type][wv];
      var tip = p[1] + (type === 't' ? '' : (wv === 1 ? ' · Greutate mare, oprește la 1–2 repetări rezervă.' : wv === 2 ? ' · Greutate mai mică, simte mușchiul.' : ''));
      var nsets = lvl === 'easy' ? Math.max(2, s[2] - 1) : lvl === 'hard' ? (type === 't' ? s[2] : Math.min(5, s[2] + 1)) : s[2];
      ex.push([p[0], nsets, reps, String(WREST[type][wv]), tip, '', patOf(p[0]), ytUrl(ENP[s[0]][vi])]);
    });
    return { name: d.name, focus: d.focus, ex: ex, img: '', code: d.code };
  }
  function buildWO(phase, week){ var o = {}; PLANS[phase].days.forEach(function(d){ o[d.code] = buildDay(PLANS[phase], d, week); }); return o; }
  window.__spBuild = buildWO; window.__patOf = patOf; window.__POOL = POOL;
  function buildWEEK(phase){
    var days = PLANS[phase].days, out = [];
    var di = PLANS[phase].dayIdx;
    for(var i=0;i<7;i++){ var dd = di ? days[di.indexOf(i)] : days[i]; out.push(dd ? [dd.code, '💪'] : ['rest', '😴']); }
    return out;
  }
  var WO = {}, WEEK = { 1:buildWEEK(1), 2:buildWEEK(2), 3:buildWEEK(3), 4:buildWEEK(4), 5:buildWEEK(5) };
  var WEEK_INFO = { rest:['Odihnă','Corpul crește în zilele de pauză. Somn bun, proteine, plimbare ușoară dacă vrei.'] };
  var PHASE_HINT = { 1:'Program clasic Push / Pull / Legs: Luni Push (piept, umeri, triceps), Marți Pull (spate, biceps), Miercuri Picioare, Joi Upper (sus), Vineri Lower (jos + lombar). Weekend odihnă.',
    2:'Push / Pull / Legs de două ori pe săptămână, cel mai cunoscut program din culturism: Luni Push, Marți Pull, Miercuri Picioare, Joi Push, Vineri Pull, Sâmbătă Picioare. Duminică odihnă.',
    3:'Tot corpul de 3 ori pe săptămână (Luni, Miercuri, Vineri): cel mai simplu program pentru început. Faci puțin din fiecare grupă, cu zile de odihnă între antrenamente.',
    4:'Upper / Lower de 4 ori pe săptămână: Luni Upper (partea de sus), Marți Lower (picioare), Joi Upper, Vineri Lower. Fiecare grupă o lucrezi de două ori pe săptămână, cu 2–3 zile libere. Echilibrul perfect dacă ai timp de 4 zile.',
    5:'Tot corpul de 2 ori pe săptămână (Luni și Joi): pentru când ai puțin timp sau reîncepi după o pauză. Două antrenamente complete, fiecare cu exerciții mari pentru tot corpul.' };
  var dayShortS = ['Lu','Ma','Mi','Jo','Vi','Sâ','Du'];
  var SP_KEY = 'byzyp_sport_v1';
  var sp = {}; try{ sp = JSON.parse(localStorage.getItem(SP_KEY) || '{}') || {}; }catch(e){ sp = {}; }
  function spSave(){ try{ localStorage.setItem(SP_KEY, JSON.stringify(sp)); }catch(e){} }
  sp.phase = ([2,3,4,5].indexOf(sp.phase) >= 0 ? sp.phase : 1); sp.level = (sp.level === 'easy' || sp.level === 'hard') ? sp.level : 'mid'; sp.sets = sp.sets || {}; sp.mob = sp.mob || {};
  function mondayOf(d){ var x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - ((x.getDay()+6)%7)); return x; }
  function mKey(d){ return dateKey(d); }
  var thisMon = mondayOf(new Date());
  function weeksBetween(aKey, bDate){ var a = new Date(aKey + 'T00:00:00'); return Math.round((mondayOf(bDate) - mondayOf(a)) / (7*86400000)); }
  if(!sp.progStart){ sp.progStart = mKey(thisMon); }
  delete sp.runWeek; delete sp.runStart;
  spSave();
  function progWeek(){ return Math.max(1, weeksBetween(sp.progStart, new Date()) + 1); }
  function rangeLabel(mon){ var e = new Date(mon); e.setDate(e.getDate()+6);
    return mon.getMonth() === e.getMonth() ? mon.getDate() + '–' + e.getDate() + ' ' + monthShort[e.getMonth()] : mon.getDate() + ' ' + monthShort[mon.getMonth()] + ' – ' + e.getDate() + ' ' + monthShort[e.getMonth()]; }
  var wIdx = (new Date().getDay() + 6) % 7;
  var selDay = wIdx;
  var curWo = null;
  var viewW = progWeek();
  function refreshWO(){ WO = buildWO(sp.phase, progWeek()); }
  refreshWO();

  function woOfDay(i){ return WEEK[sp.phase][i][0]; }
  function woLabel(code){ return WO[code] ? WO[code].name : WEEK_INFO[code][0]; }
  function woSub(code){ return WO[code] ? WO[code].focus + ' · ' + WO[code].ex.length + ' exerciții' : WEEK_INFO[code][1]; }
  function woGymCodes(){ return PLANS[sp.phase].days.map(function(d){ return d.code; }); }
  function imgBtn(src, alt){ return '<img class="wo-img" loading="lazy" src="' + src + '" alt="' + alt + '" data-big="' + src + '">'; }
  function bindImgs(root){
    root.querySelectorAll('[data-big]').forEach(function(im){ im.addEventListener('click', function(ev){ ev.stopPropagation(); openBig(im.getAttribute('data-big')); }); });
  }
  function openBig(src){
    var o = document.getElementById('bigImg');
    if(!o){ o = document.createElement('div'); o.id = 'bigImg'; o.className = 'big-img'; o.innerHTML = '<img alt=""><span>✕</span>'; o.addEventListener('click', function(){ o.classList.remove('show'); }); document.body.appendChild(o); }
    o.querySelector('img').src = src; o.classList.add('show');
  }

  function renderSpToday(){
    var code = woOfDay(wIdx);
    var el = document.getElementById('spToday');
    var tdy = new Date();
    var html = '<div class="spt-l">Azi · ' + ['Luni','Marți','Miercuri','Joi','Vineri','Sâmbătă','Duminică'][wIdx] + ' ' + tdy.getDate() + ' ' + monthShort[tdy.getMonth()] + ' · săpt. ' + progWeek() + ' · ' + WAVE[(progWeek()-1)%4][0] + '</div>' +
      '<div class="spt-t">' + woLabel(code) + '</div><div class="spt-s">' + woSub(code) + '</div>';
    if(WO[code]){
      var ex = WO[code].ex, sets = ex.reduce(function(a,e){ return a+e[1]; },0);
      var st = sp.sets[todayKey + '|' + code] || {};
      var done = Object.keys(st).filter(function(k){ return st[k]; }).length;
      html += '<div class="spt-meta"><div><b>' + ex.length + '</b><span>exerciții</span></div><div><b>' + sets + '</b><span>serii</span></div><div><b>' + done + '/' + sets + '</b><span>făcute</span></div></div>' +
        '<button class="primary-btn" id="spGo" style="margin-top:14px;">Începe antrenamentul →</button>';
    }
    el.innerHTML = html;
    var go = document.getElementById('spGo');
    if(go) go.addEventListener('click', function(){ if(WO[code]){ curWo = code; sshow('gym'); } });
  }
  function renderWeek(){
    var strip = document.getElementById('wkStrip');
    var nowW = progWeek(), wv = (viewW - 1) % 4;
    var mon = new Date(thisMon); mon.setDate(mon.getDate() + 7 * (viewW - nowW));
    document.getElementById('wkTitle').textContent = 'Săptămâna ' + viewW + ' · ' + rangeLabel(mon) + (viewW === nowW ? ' · acum' : '');
    document.getElementById('wkNav').innerHTML = '<button class="ghost-btn" id="wkPrev"' + (viewW <= 1 ? ' disabled' : '') + '>‹ înapoi</button><div class="wk-wave"><b>' + WAVE[wv][0] + '</b><span>' + WAVE[wv][1] + '</span></div><button class="ghost-btn" id="wkNext">înainte ›</button>';
    document.getElementById('wkPrev').addEventListener('click', function(){ if(viewW > 1){ viewW--; renderWeek(); } });
    document.getElementById('wkNext').addEventListener('click', function(){ viewW++; renderWeek(); });
    strip.innerHTML = WEEK[sp.phase].map(function(d,i){
      var dd = new Date(mon); dd.setDate(dd.getDate()+i);
      var past = viewW < nowW || (viewW === nowW && i < wIdx);
      var today = viewW === nowW && i === wIdx;
      return '<div class="wk-d' + (today?' today':'') + (i===selDay?' sel':'') + (past?' past':'') + '" data-i="' + i + '"><b>' + dayShortS[i] + '</b><em>' + dd.getDate() + '</em><span>' + d[1] + '</span></div>';
    }).join('');
    strip.querySelectorAll('.wk-d').forEach(function(d){ d.addEventListener('click', function(){ selDay = +d.getAttribute('data-i'); renderWeek(); }); });
    var code = woOfDay(selDay), dn = ['Luni','Marți','Miercuri','Joi','Vineri','Sâmbătă','Duminică'][selDay];
    var det = document.getElementById('wkDetail');
    if(code === 'rest'){
      det.innerHTML = '<div class="wk-detail"><div class="wk-dn">' + dn + '</div><b>😴 Odihnă</b><div>' + WEEK_INFO.rest[1] + '</div></div>';
    } else {
      var day = buildWO(sp.phase, viewW)[code];
      det.innerHTML = '<div class="wk-detail"><div class="wk-dn">' + dn + '</div><b>' + day.name + '</b>' +
        day.ex.map(function(e,i){ return '<div class="wk-ex"><span>' + (i+1) + '. ' + e[0] + '</span><em>' + e[1] + ' × ' + e[2] + '</em></div>'; }).join('') +
        (viewW === nowW ? '<button class="primary-btn" id="wkOpen" style="margin-top:12px;">Deschide antrenamentul →</button>' : '<div class="hint" style="margin-top:10px;">Așa arată săptămâna ' + viewW + '. Exercițiile se schimbă singure în fiecare luni.</div>') +
        '</div>';
      var wo = document.getElementById('wkOpen'); if(wo) wo.addEventListener('click', function(){ curWo = code; sshow('gym'); });
      bindImgs(det);
    }
    var ph = PHASE_HINT[sp.phase] + '\n\nEști în săptămâna ' + nowW + ' de antrenament.\n\nPe scurt: o serie înseamnă un set de repetări, apoi te odihnești 90 de secunde. Alege o greutate cu care ai mai fi putut face încă 2–3 repetări. Când faci ușor toate repetările maxime la două antrenamente la rând, crești puțin greutatea.';
    document.getElementById('phaseHint').textContent = ph;
    document.querySelectorAll('#phasePills .day-pill').forEach(function(p){ p.classList.toggle('active', +p.getAttribute('data-phase') === sp.phase); });
    document.querySelectorAll('#lvlPills .day-pill').forEach(function(p){ p.classList.toggle('active', p.getAttribute('data-lvl') === sp.level); });
    var lh = document.getElementById('lvlHint'); if(lh) lh.textContent = sp.level === 'easy' ? 'Ușor: mai puține serii, doar exerciții simple la mașini.' : sp.level === 'hard' ? 'Greu: mai multe serii și exerciții mai avansate, cu haltera și gantere.' : 'Mediu: 3 serii, exerciții simple și eficiente.';
  }
  document.querySelectorAll('#lvlPills .day-pill').forEach(function(p){
    p.addEventListener('click', function(){ sp.level = p.getAttribute('data-lvl'); spSave(); curWo = null; refreshWO(); renderSport(); renderPlanTiles(); });
  });
  document.querySelectorAll('#phasePills .day-pill').forEach(function(p){
    p.addEventListener('click', function(){ sp.phase = +p.getAttribute('data-phase'); spSave(); curWo = null; refreshWO(); renderSport(); renderPlanTiles(); });
  });

  function renderWoPills(){
    var codes = woGymCodes();
    if(!curWo || codes.indexOf(curWo) < 0){ var t = woOfDay(wIdx); curWo = codes.indexOf(t) >= 0 ? t : codes[0]; }
    var pills = document.getElementById('woPills');
    pills.innerHTML = codes.map(function(c){ var nm = WO[c].name.replace(/^Ziua \d · /, ''); return '<button class="day-pill' + (c===curWo?' active':'') + '" data-wo="' + c + '">' + nm + '</button>'; }).join('');
    pills.querySelectorAll('.day-pill').forEach(function(b){ b.addEventListener('click', function(){ curWo = b.getAttribute('data-wo'); renderWo(); }); });
  }
  var woOpen = {};
  function kgInfo(n){ var L = (sp.klog && sp.klog[n]) || [], td = todayKey, last = null, best = 0;
    L.forEach(function(x){ if(x.kg > best) best = x.kg; if(x.d !== td) last = x; });
    var cur = L.filter(function(x){ return x.d === td; })[0];
    return { cur: cur ? cur.kg : (last ? last.kg : ''), last: last, best: best }; }
  function kgRow(n){ var i = kgInfo(n), t = '';
    if(i.last) t += 'Ultima dată: <b>' + i.last.kg + ' kg</b>'; if(i.best) t += (t ? ' · ' : '') + 'Record: <b>' + i.best + ' kg</b>';
    return '<div class="kg-row"><label>Greutate</label><input class="kg-in" type="number" inputmode="decimal" step="0.5" min="0" max="500" placeholder="kg" value="' + i.cur + '" data-n="' + String(n).replace(/"/g,'&quot;') + '"><span class="kg-t">' + (t || 'Notează greutatea și îți arăt progresul.') + '</span></div>'; }
  function renderWo(){
    renderWoPills();
    var w = WO[curWo], key = todayKey + '|' + curWo;
    var st = sp.sets[key] || {};
    var total = w.ex.reduce(function(a,e){ return a+e[1]; },0);
    var done = Object.keys(st).filter(function(k){ return st[k]; }).length;
    var pw = progWeek(), wv = (pw - 1) % 4;
    var html = '<div class="wo-head"><div><div class="wo-name">' + w.name + '</div><div class="wo-focus">Săptămâna ' + pw + ' · ' + WAVE[wv][0] + ' · ' + w.ex.length + ' exerciții · ' + total + ' serii</div></div><div class="wo-prog">' + done + '/' + total + '</div></div>' +
      '<div class="wo-bar"><i style="width:' + (done/total*100) + '%"></i></div>' +
      '<div class="wo-warm">' + WAVE[wv][1] + '</div>' +
      '<div class="wo-warm">🔥 <b>Încălzire 5–8 min:</b> bicicletă sau bandă ușor, 10 rotiri de brațe, 10 balansări de picioare, apoi 2 serii ușoare din primul exercițiu. <b>1–2 repetări în rezervă</b> la fiecare serie de lucru.</div>';
    var nowEi = -1;
    w.ex.forEach(function(e,ei){ var d0 = 0; for(var q=0;q<e[1];q++){ if(st[ei + '-' + q]) d0++; } if(nowEi < 0 && d0 < e[1]) nowEi = ei; });
    w.ex.forEach(function(e,ei){
      var dn = 0; for(var q=0;q<e[1];q++){ if(st[ei + '-' + q]) dn++; }
      var fin = dn === e[1];
      if(fin && !woOpen[curWo + ei]){
        html += '<div class="ex ex-done ex-mini" id="ex' + ei + '" data-ei="' + ei + '"><span class="ex-bn">✓</span><div class="ex-tt"><span class="ex-n">' + e[0] + '</span><div class="ex-pills"><b>' + e[1] + ' × ' + e[2] + '</b><i>terminat</i></div></div><button class="ex-reopen" data-ei="' + ei + '">↩</button></div>';
        return;
      }
      html += '<div class="ex' + (fin ? ' ex-done' : '') + (ei === nowEi ? ' ex-now' : '') + '" id="ex' + ei + '">' + (ei === nowEi ? '<div class="ex-flag">ACUM</div>' : '') +
        '<div class="ex-top"><span class="ex-bn">' + (fin ? '✓' : (ei+1)) + '</span><div class="ex-tt"><span class="ex-n">' + e[0] + '</span>' +
        '<div class="ex-pills"><b>' + e[1] + ' × ' + e[2] + '</b><i>⏱ pauză ' + e[3] + ' s</i></div></div></div>' +
        (e[4] ? '<div class="ex-tip">' + e[4] + '</div>' : '') + kgRow(e[0]) +
        '<a class="yt-btn" href="' + e[7] + '" target="_blank" rel="noopener">▶️ Vezi video: cum se face</a>' +
        '<details class="ex-how"><summary>📖 Desen și pași</summary>' + figHtml(e[6]) + '</details><div class="ex-sets">';
      for(var si=0; si<e[1]; si++){ var k = ei + '-' + si; html += '<button class="set-b' + (st[k]?' on':'') + '" data-k="' + k + '" data-rest="' + e[3] + '">' + (st[k] ? '✓' : (si+1)) + '</button>'; }
      html += '<button class="rest-b" data-rest="' + e[3] + '">⏱ pauză</button></div>' +
        (fin ? '<button class="ex-fin undo" data-ei="' + ei + '" data-undo="1">↩ Nu e terminat</button>' : '<button class="ex-fin" data-ei="' + ei + '">✅ Am terminat exercițiul · următorul →</button>') + '</div>';
    });
    if(done === total) html += '<div class="wo-done">🏆 Antrenament complet! L-am bifat și pe fila Azi.</div>';
    html += '<div class="hint">Atinge fiecare serie după ce o termini (pornește pauza) sau apasă „Am terminat exercițiul” ca să treci la următorul. Progresul se resetează în fiecare zi. Luni viitoare exercițiile se schimbă.</div>';
    var card = document.getElementById('woCard');
    card.innerHTML = html;
    bindImgs(card);
    function afterChange(){
      var cur = sp.sets[key] || {}, d2 = Object.keys(cur).filter(function(x){ return cur[x]; }).length;
      if(d2 === total){
        var entry = getEntry(todayKey);
        if(!entry.habits.training){ entry.habits = Object.assign({}, entry.habits, { training:true }); writeDay(todayKey, entry); renderToday(); renderStreaks(); renderPastDays(); }
      }
      renderWo(); renderSpToday(); renderPlanTiles();
    }
    card.querySelectorAll('.set-b').forEach(function(b){
      b.addEventListener('click', function(){
        var k = b.getAttribute('data-k');
        var cur = sp.sets[key] || {}; cur[k] = !cur[k]; sp.sets[key] = cur; spSave();
        if(cur[k]) startRest(+b.getAttribute('data-rest'));
        afterChange();
      });
    });
    card.querySelectorAll('.ex-fin').forEach(function(b){
      b.addEventListener('click', function(){
        var ei = +b.getAttribute('data-ei'), undo = b.getAttribute('data-undo') === '1', cur = sp.sets[key] || {};
        for(var q=0;q<w.ex[ei][1];q++) cur[ei + '-' + q] = !undo;
        sp.sets[key] = cur; spSave(); delete woOpen[curWo + ei];
        afterChange();
        if(!undo){
          var allDone = true; for(var jj = 0; jj < w.ex.length; jj++){ var cc = 0; for(var rr = 0; rr < w.ex[jj][1]; rr++){ if(cur[jj + '-' + rr]) cc++; } if(cc < w.ex[jj][1]) allDone = false; }
          zToast(allDone ? zJoke(['🏆 Antrenament terminat! Du-te la muncă, Hercule, ai muncit destul pentru azi.','🦍 Gata! Mușchii zic mulțumesc, șeful zice „unde ești?".','🔥 Terminat! Acum whey, mâncare și somn. În ordinea asta.']) : zJoke(['💪 Încă unul în buzunar! Următorul, nu scrolla.','😎 Ușor ca un pui la tigaie. Mai departe!','🦵 Hai că nu te omoară. Încă un exercițiu!','🏋️ Bara zice „bravo". Gantera zice „și eu".','🔥 Mușchiul crește chiar acum. Stai liniștit și mergi la următorul.']));
          var nx = -1; for(var j=0;j<w.ex.length && nx<0;j++){ var c2 = 0; for(var r=0;r<w.ex[j][1];r++){ if(cur[j + '-' + r]) c2++; } if(c2 < w.ex[j][1]) nx = j; }
          var tgt = document.getElementById(nx >= 0 ? 'ex' + nx : 'woCard');
          if(tgt && tgt.scrollIntoView) setTimeout(function(){ tgt.scrollIntoView({ behavior:'smooth', block:'start' }); }, 60);
        }
      });
    });
    card.querySelectorAll('.ex-reopen').forEach(function(b){ b.addEventListener('click', function(){ woOpen[curWo + b.getAttribute('data-ei')] = true; renderWo(); }); });
    card.querySelectorAll('.rest-b').forEach(function(b){ b.addEventListener('click', function(){ startRest(+b.getAttribute('data-rest')); }); });
    card.querySelectorAll('.kg-in').forEach(function(inp){ inp.addEventListener('change', function(){
      var n = inp.getAttribute('data-n'), v = parseFloat(String(inp.value).replace(',', '.'));
      sp.klog = sp.klog || {}; var L = (sp.klog[n] || []).filter(function(x){ return x.d !== todayKey; });
      if(isFinite(v) && v > 0 && v <= 500){ L.push({ d: todayKey, kg: Math.round(v*2)/2 }); L.sort(function(a,b){ return a.d < b.d ? -1 : 1; }); sp.klog[n] = L.slice(-60);
        var prev = Math.max.apply(null, L.filter(function(x){ return x.d !== todayKey; }).map(function(x){ return x.kg; }).concat([0]));
        if(prev > 0 && v > prev) zToast(zJoke(['🏆 Record nou la ' + n + '! ' + v + ' kg. Hercule e mândru.','💥 ' + v + ' kg! Ai trecut de recordul de până acum.'])); }
      else { sp.klog[n] = L; }
      spSave(); }); });
  }

  /* rest timer */
  var rtEnd = 0, rtIv = null;
  var rtEl = document.getElementById('restTimer');
  function rtFmt(sec){ return Math.floor(sec/60) + ':' + String(sec%60).padStart(2,'0'); }
  function rtTick(){
    var left = Math.max(0, Math.ceil((rtEnd - Date.now())/1000));
    document.getElementById('rtTime').textContent = rtFmt(left);
    if(left <= 0){
      rtEl.classList.add('done'); document.getElementById('rtLabel').textContent = 'gata, următoarea serie!';
      try{ if(navigator.vibrate) navigator.vibrate([200,100,200]); }catch(e){}
      clearInterval(rtIv); rtIv = null;
      setTimeout(function(){ if(!rtIv) rtEl.classList.remove('show'); }, 6000);
    }
  }
  function startRest(sec){
    rtEnd = Date.now() + sec*1000; rtEl.classList.remove('done'); rtEl.classList.add('show');
    document.getElementById('rtLabel').textContent = 'pauză';
    if(rtIv) clearInterval(rtIv); rtIv = setInterval(rtTick, 250); rtTick();
  }
  document.getElementById('rtAdd').addEventListener('click', function(){ rtEnd = Math.max(rtEnd, Date.now()) + 15000; if(!rtIv){ rtEl.classList.remove('done'); rtIv = setInterval(rtTick,250); } rtTick(); });
  document.getElementById('rtStop').addEventListener('click', function(){ if(rtIv) clearInterval(rtIv); rtIv = null; rtEl.classList.remove('show'); });

  var sbtns = document.querySelectorAll('#sportSeg .seg-btn');
  function sshow(seg){
    sbtns.forEach(function(b){ b.classList.toggle('active', b.getAttribute('data-sseg') === seg); });
    document.querySelectorAll('[data-sseg-card]').forEach(function(c){ c.classList.toggle('seg-show', c.getAttribute('data-sseg-card') === seg); });
    if(seg === 'gym') renderWo();
    try{ window.scrollTo(0,0); }catch(e){}
  }
  sbtns.forEach(function(b){ b.addEventListener('click', function(){ sshow(b.getAttribute('data-sseg')); }); });
  var healthData = {};
  function renderFitness(){}

  /* ===== Suplimente: lista de azi + notificările vin din push-bot (09:00, 20:00, 22:00) ===== */
  var SUPP_CAT = [
    { id:'d3k2', g:0, ic:'☀️', n:'Vitamina D3 + K2', d:'Cu micul dejun, cu grăsime. Pentru oase și imunitate.' },
    { id:'d3', g:0, ic:'🌞', n:'Vitamina D3', d:'Cu micul dejun, cu grăsime. Pentru oase și imunitate.' },
    { id:'om3', g:0, ic:'🐟', n:'Omega 3', d:'Cu o masă care conține grăsime. Ajută inima și recuperarea.' },
    { id:'cre', g:0, ic:'⚡', n:'Creatină monohidrat', d:'În fiecare zi, și fără sală, cu apă. Îți crește forța.' },
    { id:'mv', g:0, ic:'🍊', n:'Multivitamine', d:'Cu micul dejun, cu mâncare. Completează lipsurile din alimentație.' },
    { id:'vc', g:0, ic:'🍋', n:'Vitamina C', d:'Cu mâncare. Pentru imunitate.' },
    { id:'vb', g:0, ic:'🧬', n:'Complex vitamina B', d:'Dimineața, cu mâncare. Pentru energie și metabolism.' },
    { id:'col', g:0, ic:'🦴', n:'Colagen', d:'Oricând, cu apă. Pentru piele și articulații.' },
    { id:'prob', g:0, ic:'🦠', n:'Probiotice', d:'Dimineața, cum scrie pe etichetă. Pentru digestie.' },
    { id:'fe', g:0, ic:'🩸', n:'Fier', d:'Doar dacă ai deficit confirmat de analize. Se ia separat de calciu.' },
    { id:'caf', g:1, ic:'☕', n:'Cafeină', d:'Cu 30–45 minute înainte de sală. Nu după ora 14:00.' },
    { id:'cit', g:1, ic:'🍉', n:'Citrulină', d:'Cu 30–45 minute înainte de sală. Pentru pump și rezistență.' },
    { id:'ba', g:1, ic:'🔥', n:'Beta-alanină', d:'Înainte de sală. Poate da furnicături pe piele, e normal.' },
    { id:'eaa', g:1, ic:'💧', n:'Aminoacizi (EAA / BCAA)', d:'În timpul antrenamentului, în apă.' },
    { id:'elec', g:1, ic:'🧂', n:'Electroliți', d:'În apă, în zilele cu transpirație multă.' },
    { id:'whey', g:2, ic:'🥤', n:'Proteină whey', d:'După sală, cu apă sau lapte. Ajută mușchiul să crească.' },
    { id:'gln', g:2, ic:'🧪', n:'Glutamină', d:'După sală sau seara, în apă.' },
    { id:'ca', g:3, ic:'🥛', n:'Calciu', d:'Cu cina. Nu în același timp cu fierul sau zincul.' },
    { id:'zn', g:3, ic:'🛡️', n:'Zinc', d:'Cu cina, nu pe stomacul gol. Pentru imunitate și hormoni.' },
    { id:'casein', g:4, ic:'🌙', n:'Cazeină', d:'Seara, înainte de somn. Proteină cu eliberare lentă.' },
    { id:'mg', g:4, ic:'🌙', n:'Magneziu', d:'Seara, la 1–2 ore după zinc. Te ajută la somn și la mușchi.' },
    { id:'ash', g:4, ic:'🌿', n:'Ashwagandha', d:'Seara. Nu o lua dacă ești însărcinată sau ai probleme de tiroidă, fără medic.' },
    { id:'mel', g:4, ic:'😴', n:'Melatonină', d:'Cu 30–60 minute înainte de somn, doza mică de pe etichetă. Doar ocazional.' }
  ];
  var SUPP_OWN = 'zyp_supps_v1';
  function suppOwn(){ try{ var o = JSON.parse(localStorage.getItem(SUPP_OWN) || 'null'); if(Array.isArray(o)) return o; }catch(e){} return ['d3k2','om3','cre','whey','zn','mg']; }
  var SUPPS = SUPP_CAT.filter(function(s){ return suppOwn().indexOf(s.id) >= 0; });
  var SUPP_G = [ { t:'09:00', l:'La micul dejun', ic:'🌅' }, { t:'17:30', l:'Înainte de sală', ic:'⚡' }, { t:'19:30', l:'După sală', ic:'💪' }, { t:'20:30', l:'La cină', ic:'🍽️' }, { t:'22:00', l:'Înainte de somn', ic:'🌙' } ];
  var SUPP_KEY = 'byzyp_supp_v1';
  function suppLoad(){ try{ return JSON.parse(localStorage.getItem(SUPP_KEY) || '{}') || {}; }catch(e){ return {}; } }
  function renderSupp(){
    var el = document.getElementById('suppCard'); if(!el) return;
    var all = suppLoad(), day = all[todayKey] || {};
    var got = SUPPS.filter(function(s){ return day[s.id]; }).length, pct = SUPPS.length ? Math.round(got / SUPPS.length * 100) : 0;
    var h = '<div class="sp-head"><div><div class="sp-big">' + got + '<span>/' + SUPPS.length + '</span></div><div class="sp-sub">' + (got === SUPPS.length ? 'Toate luate azi ✅' : 'luate azi') + '</div></div>' +
      '<div class="sp-ring" style="--p:' + pct + '"><b>' + pct + '%</b></div></div><div class="sp-bar"><i style="width:' + pct + '%"></i></div>';
    SUPP_G.forEach(function(g, gi){
      var items = SUPPS.filter(function(s){ return s.g === gi; }); if(!items.length) return;
      h += '<div class="sp-g"><span>' + g.ic + ' ' + g.l + '</span><em>' + g.t + '</em></div>';
      items.forEach(function(s){
        h += '<div class="supp-row' + (day[s.id] ? ' done' : '') + '" data-id="' + s.id + '"><div class="sp-ic">' + s.ic + '</div><div class="sp-tx"><div class="supp-n">' + s.n + '</div><div class="supp-d">' + s.d + '</div></div><div class="sp-ck">' + (day[s.id] ? '✓' : '') + '</div></div>';
      });
    });
    h += '<div class="hint" style="margin:12px 0 0;">🔔 Primești notificare puțin înainte de 09:00, 20:30 și 22:00. Dozele sunt cele de pe ambalaj sau de la medic. Zincul și magneziul nu se iau împreună.</div>';
    if(!SUPPS.length) h += '<div class="hint" style="margin:12px 0 0;">Nu ai ales niciun supliment. Apasă mai jos și alege-le pe ale tale.</div>';
    h += '<button class="onb-skip" id="suppPick" style="display:block;margin:10px 0 0;color:var(--gold);font-weight:700;">✏️ Alege suplimentele mele</button>';
    el.innerHTML = h;
    var spb = document.getElementById('suppPick'); if(spb) spb.addEventListener('click', suppPicker);
    el.querySelectorAll('.supp-row').forEach(function(r){ r.addEventListener('click', function(){
      var a = suppLoad(), d = a[todayKey] || {}; d[r.getAttribute('data-id')] = !d[r.getAttribute('data-id')]; a[todayKey] = d;
      Object.keys(a).sort().slice(0, -30).forEach(function(k){ delete a[k]; });
      try{ localStorage.setItem(SUPP_KEY, JSON.stringify(a)); }catch(e){}
      renderSupp();
    }); });
  }
  function suppPicker(){
    var el = document.getElementById('suppCard'); if(!el) return; var own = suppOwn().slice();
    var h = '<div class="card-title">Suplimentele mele</div><div class="hint" style="margin:0 0 12px;">Bifează doar ce ai deja. Nu cumpăra nimic fără motiv. Dozele sunt cele de pe etichetă sau de la medic.</div>';
    SUPP_G.forEach(function(g, gi){ var it = SUPP_CAT.filter(function(s){ return s.g === gi; }); if(!it.length) return; h += '<div class="sp-g"><span>' + g.ic + ' ' + g.l + '</span><em>' + g.t + '</em></div>';
      it.forEach(function(s){ h += '<label class="onb-opt" style="padding:11px 12px;margin-bottom:6px;"><span class="ic" style="font-size:20px;">' + s.ic + '</span><div><b style="font-size:14px;">' + s.n + '</b><span>' + s.d + '</span></div><input type="checkbox" data-s="' + s.id + '"' + (own.indexOf(s.id) >= 0 ? ' checked' : '') + '></label>'; }); });
    h += '<button class="onb-btn" id="suppSave" style="width:100%;margin-top:12px;">Salvează</button>';
    el.innerHTML = h;
    el.querySelectorAll('input[data-s]').forEach(function(i){ i.addEventListener('change', function(){ var id = i.getAttribute('data-s'), k = own.indexOf(id); if(i.checked && k < 0) own.push(id); if(!i.checked && k >= 0) own.splice(k, 1); }); });
    document.getElementById('suppSave').addEventListener('click', function(){ try{ localStorage.setItem(SUPP_OWN, JSON.stringify(own)); }catch(e){} SUPPS = SUPP_CAT.filter(function(s){ return own.indexOf(s.id) >= 0; }); renderSupp(); });
  }
  renderSupp();
  function renderSport(){ renderSpToday(); renderWeek(); if(document.querySelector('[data-sseg-card="gym"].seg-show')) renderWo(); }
  renderSport();
  sshow('plan');
  renderPlanTiles();
  // new day or new week while the app stays open → refresh so dates and weeks move forward
  function checkNewDay(){
    if(dateKey(new Date()) === todayKey) return;
    var ae = document.activeElement;
    if(ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA')) return; // don't interrupt typing; retry next minute
    try{ location.reload(); }catch(e){}
  }
  document.addEventListener('visibilitychange', function(){ if(!document.hidden) checkNewDay(); });
  setInterval(checkNewDay, 15000);

  /* weight panel (profile tab) */
  function collectWeights(){
    return Object.keys(data).filter(function(k){ return data[k] && data[k].weight != null; })
      .sort().map(function(k){ return { date:k, w: data[k].weight }; });
  }
  function renderWeightPanel(){
    var list = collectWeights();
    var nowEl = document.getElementById('weightNow');
    var deltaEl = document.getElementById('weightDelta');
    var histEl = document.getElementById('weightHistory');
    var spark = document.getElementById('weightSpark');
    if(!list.length){
      nowEl.textContent = '–'; deltaEl.textContent = ''; histEl.innerHTML = '';
      spark.innerHTML = ''; return;
    }
    var last = list[list.length-1];
    var first = list[0];
    nowEl.textContent = fmtKg(last.w) + ' kg';
    var diff = last.w - first.w;
    if(list.length > 1){
      deltaEl.textContent = (diff>=0?'+':'') + fmtKg(diff) + ' kg față de prima măsurătoare';
    } else { deltaEl.textContent = 'Prima măsurătoare'; }

    var recent = list.slice(-14);
    var min = Math.min.apply(null, recent.map(function(p){return p.w;}));
    var max = Math.max.apply(null, recent.map(function(p){return p.w;}));
    if(max === min){ max += 0.5; min -= 0.5; }
    var W = 300, H = 110, pad = 8;
    var xf = function(i){ return recent.length > 1 ? pad + i*(W-pad*2)/(recent.length-1) : W/2; };
    var yf = function(v){ return pad + (H-pad*2)*(1-(v-min)/(max-min)); };
    var line = recent.map(function(p,i){ return (i?'L':'M') + xf(i).toFixed(1) + ' ' + yf(p.w).toFixed(1); }).join(' ');
    var area = line + ' L' + xf(recent.length-1).toFixed(1) + ' ' + (H-pad) + ' L' + xf(0).toFixed(1) + ' ' + (H-pad) + ' Z';
    var lx = xf(recent.length-1).toFixed(1), ly = yf(recent[recent.length-1].w).toFixed(1);
    spark.innerHTML = '<defs><linearGradient id="wGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="var(--gold)" stop-opacity="0.35"/><stop offset="100%" stop-color="var(--gold)" stop-opacity="0"/></linearGradient></defs>' +
      (recent.length > 1 ? '<path d="' + area + '" fill="url(#wGrad)"/><path d="' + line + '" fill="none" stroke="var(--gold)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>' : '') +
      '<circle cx="' + lx + '" cy="' + ly + '" r="4" fill="var(--gold)" stroke="var(--bg-card)" stroke-width="2" vector-effect="non-scaling-stroke"/>';

    histEl.innerHTML = recent.slice().reverse().slice(0,6).map(function(p){
      var d = new Date(p.date + 'T00:00:00');
      return '<div class="trade-item"><span class="trade-item-date">' + d.getDate() + ' ' + monthShort[d.getMonth()] + '</span><span style="font-family:var(--mono)">' + fmtKg(p.w) + ' kg</span></div>';
    }).join('');
  }

  function renderGallery(){
    var g = document.getElementById('gallery');
    var keys = Object.keys(data).filter(function(k){ return data[k] && data[k].photo; }).sort().reverse();
    if(!keys.length){ g.innerHTML = '<div class="gallery-empty" style="grid-column:1/-1;">Nicio poză încă — adaugi din fila Azi.</div>'; return; }
    g.innerHTML = keys.map(function(k){
      var d = new Date(k + 'T00:00:00');
      return '<div class="gal-item" data-k="' + k + '"><img src="' + data[k].photo + '"><span>' + d.getDate() + ' ' + monthShort[d.getMonth()] + '</span></div>';
    }).join('');
    g.querySelectorAll('.gal-item').forEach(function(it){
      it.addEventListener('click', function(){
        var k = it.getAttribute('data-k'); var d = new Date(k + 'T00:00:00');
        document.getElementById('lbImg').src = data[k].photo;
        document.getElementById('lbCap').textContent = d.getDate() + ' ' + monthFull[d.getMonth()] + ' ' + d.getFullYear();
        document.getElementById('lightbox').classList.add('show');
      });
    });
  }
  document.getElementById('lightbox').addEventListener('click', function(){ this.classList.remove('show'); });

  function renderProfile(){
    var nameEl = document.getElementById('profHeroName');
    if(!nameEl) return;
    nameEl.textContent = profile.name ? profile.name : 'Profilul tău';
    var keys = Object.keys(data).sort();
    var sub = 'By ZyP';
    if(keys.length){ var fd = new Date(keys[0] + 'T00:00:00'); sub += ' · din ' + fd.getDate() + ' ' + monthShort[fd.getMonth()] + ' ' + fd.getFullYear(); }
    document.getElementById('profHeroSub').textContent = sub;

    var wk = keys.filter(function(k){ return data[k] && data[k].weight != null; });
    var w = wk.length ? data[wk[wk.length-1]].weight : null;
    var h = parseFloat(profile.height) || null;
    var imc = (w && h) ? (w / Math.pow(h/100, 2)) : null;
    var chip = function(v,l){ return '<div class="prof-chip"><b>' + v + '</b><span>' + l + '</span></div>'; };
    document.getElementById('profChips').innerHTML =
      chip(profile.age || '–', 'ani') + chip(h ? h : '–', 'cm') + chip(w ? fmtKg(w) : '–', 'kg') + chip(imc ? imc.toFixed(1) : '–', 'IMC');

    var cnt = function(key){ return keys.filter(function(k){ return data[k] && data[k].habits && data[k].habits[key]; }).length; };
    var perfect = keys.filter(function(k){ return allDone(data[k]); }).length;
    var noSmoke = cnt('nosmoke'), noSugar = cnt('nosugar'), train = cnt('training');
    var best = parseInt(document.getElementById('bestNum').textContent) || 0;
    var tradeSum = trades.reduce(function(a,t){ return a + (t.result||0); }, 0);
    var investSum = investments.reduce(function(a,i){ return a + (i.amount||0); }, 0);
    var tile = function(ic,v,l,cls){ return '<div class="stat-tile"><div class="st-ic">' + ic + '</div><div class="st-v ' + (cls||'') + '">' + v + '</div><div class="st-l">' + l + '</div></div>'; };
    document.getElementById('statGrid').innerHTML =
      tile('🚭', noSmoke, 'zile fără țigări', 'pos') +
      tile('🍬', noSugar, 'zile fără zahăr', 'pos') +
      tile('💪', train, 'zile de antrenament') +
      tile('⭐', perfect, 'zile perfecte (5/5)', 'gold') +
      tile('🔥', best, 'cel mai lung șir', 'gold') +
      tile('📊', (tradeSum>=0?'+':'-') + '€' + Math.abs(tradeSum).toFixed(2), 'trading total', tradeSum>=0?'pos':'neg') +
      tile('🪙', '€' + investSum.toFixed(0), 'investit total') +
      tile('📸', keys.filter(function(k){ return data[k] && data[k].photo; }).length, 'poze de progres');

    var hasWin = trades.some(function(t){ return t.result > 0; });
    var badges = [
      ['🚭','Prima zi fără țigări', noSmoke >= 1],
      ['🔥','7 zile fără țigări', noSmoke >= 7],
      ['🏆','30 zile fără țigări', noSmoke >= 30],
      ['👑','100 zile fără țigări', noSmoke >= 100],
      ['🍬','7 zile fără zahăr', noSugar >= 7],
      ['💪','Primul antrenament', train >= 1],
      ['🏋️','20 antrenamente', train >= 20],
      ['⭐','7 zile perfecte la rând', best >= 7],
      ['📈','Prima tranzacție pe plus', hasWin],
      ['🪙','3 luni investite', investments.length >= 3],
      ['⚖️','Prima cântărire', wk.length >= 1],
      ['📸','Prima poză de progres', keys.some(function(k){ return data[k] && data[k].photo; })]
    ];
    var on = badges.filter(function(b){ return b[2]; }).length;
    document.getElementById('badgeCount').textContent = on + ' din ' + badges.length + ' deblocate';
    document.getElementById('badgeGrid').innerHTML = badges.map(function(b){
      return '<div class="badge' + (b[2] ? ' on' : '') + '"><div class="bd-ic">' + b[0] + '</div><div class="bd-l">' + b[1] + '</div></div>';
    }).join('');
  }

  /* accounts / net worth */
  var accounts = [];

  function fmtEUR(n){ var sign = n<0?'-':''; return sign + '€' + Math.abs(n).toFixed(0); }

  var ACC_DEFAULT = [
    { k:'cash', n:'Cash', ic:'💵', c:'#A3FF12' },
    { k:'revolut', n:'Revolut', ic:'💳', c:'#6C8CFF' },
    { k:'icard', n:'iCard', ic:'🏦', c:'#B18CFF' },
    { k:'xtb', n:'XTB', ic:'📊', c:'#3DE0C4' },
    { k:'eth', n:'ETH · MetaMask', ic:'⟠', c:'#FF9A3C' }
  ];
  var ACC = ACC_DEFAULT.slice();                     // the list is yours: add / rename / delete (saved in the account as settings/accounts)
  var ACC_PAL = ['#A3FF12', '#6C8CFF', '#B18CFF', '#3DE0C4', '#FF9A3C', '#5FBF8F', '#E0685C', '#7FD1FF', '#F4A6D7', '#C8E36B'];
  var accTyped = {};
  function accClean(list){
    var out = []; (Array.isArray(list) ? list : []).forEach(function(x, i){ if(!x || typeof x.k !== 'string' || !/^[a-z0-9_]{1,24}$/i.test(x.k) || out.some(function(o){ return o.k === x.k; })) return;
      var n = String(x.n == null ? '' : x.n).trim().slice(0, 30); if(!n) return;
      out.push({ k:x.k, n:n, ic:String(x.ic || '💼').trim().slice(0, 6) || '💼', c:/^#[0-9a-f]{6}$/i.test(x.c || '') ? x.c : ACC_PAL[i % ACC_PAL.length] }); });
    return out.length ? out : null;
  }
  function accEsc(t){ return String(t == null ? '' : t).replace(/[&<>"']/g, function(ch){ return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]; }); }
  function accSaveList(){
    if(useLocal) safeSet('reset_acc_list_v1', JSON.stringify(ACC));
    else chainWrite('settings/accounts', function(){ return db.doc('settings/accounts').set({ list: ACC, v:1 }); });
    renderWorth();
  }
  function accStrip(key){        // remove a deleted account's values from the saved snapshots too (so re-adding it later starts clean)
    if(useLocal){ accounts.forEach(function(a){ delete a[key]; }); safeSet('reset_accounts_local_v1', JSON.stringify(accounts)); return; }
    accounts.forEach(function(a){ if(a._id && a[key] !== undefined){ var c = {}; Object.keys(a).forEach(function(f){ if(f !== key && f !== '_id') c[f] = a[f]; }); try{ db.doc('accounts/' + a._id).set(c); }catch(e){} } });
  }
  var AM_PRESETS = [['💵', 'Cash'], ['💳', 'Revolut'], ['🏦', 'Bancă'], ['📊', 'XTB'], ['📈', 'Trading 212'], ['🪙', 'Binance'], ['₿', 'Bitcoin'], ['⟠', 'ETH · MetaMask'], ['🥇', 'Aur fizic'], ['🏠', 'Economii'], ['🧾', 'Pilon III'], ['💼', 'Altceva']];
  function accAdd(ic, name){
    name = String(name || '').trim().slice(0, 30); if(!name) return false;
    var key = (name === 'ETH · MetaMask' && !ACC.some(function(x){ return x.k === 'eth'; })) ? 'eth' : 'c' + Date.now().toString(36) + Math.floor(Math.random() * 36).toString(36);
    ACC.push({ k:key, n:name, ic:String(ic || '💼').trim().slice(0, 6) || '💼', c:ACC_PAL[ACC.length % ACC_PAL.length] }); accSaveList(); return true;
  }
  function renderAccMgr(){
    var el = document.getElementById('accMgr'); if(!el) return;
    var ms = document.getElementById('accMgrSub'); if(ms) ms.textContent = ACC.length + (ACC.length === 1 ? ' cont' : ' conturi');
    var have = ACC.map(function(x){ return x.n.toLowerCase(); });
    var h = '<div class="hint" style="margin-top:0;">Alege ce conturi vrei să urmărești. Ce ștergi dispare din avere, grafic și istoric.</div>' +
      ACC.map(function(x){ return '<div class="am-row"><span class="am-ic" style="background:color-mix(in srgb, ' + x.c + ' 16%, var(--bg-card-2));">' + accEsc(x.ic) + '</span><b>' + accEsc(x.n) + '</b>' +
        '<button class="am-b" data-ed="' + x.k + '" aria-label="Editează">✏️</button><button class="am-b" data-del="' + x.k + '" aria-label="Șterge">🗑️</button></div>'; }).join('') +
      '<div class="am-h">➕ Adaugă un cont</div><div class="am-chips">' + AM_PRESETS.filter(function(p){ return have.indexOf(p[1].toLowerCase()) < 0 || p[1] === 'Altceva'; }).map(function(p){ return '<button data-pre="' + accEsc(p[0] + '|' + p[1]) + '">' + p[0] + ' ' + accEsc(p[1]) + '</button>'; }).join('') + '</div>' +
      '<div class="am-custom"><input id="amIc" placeholder="💼" maxlength="4" aria-label="Iconiță"><input id="amName" placeholder="Nume propriu (ex. Pensie privată)" maxlength="30"><button class="primary-btn" id="amAdd">Adaugă</button></div>';
    el.innerHTML = h;
    el.querySelectorAll('[data-pre]').forEach(function(b){ b.addEventListener('click', function(){ var q = b.getAttribute('data-pre').split('|'); if(q[1] === 'Altceva'){ var nm = prompt('Cum se numește contul?', ''); if(nm) accAdd(q[0], nm); } else accAdd(q[0], q[1]); }); });
    document.getElementById('amAdd').addEventListener('click', function(){ var nm = document.getElementById('amName').value; if(!nm.trim()){ document.getElementById('amName').focus(); return; } accAdd(document.getElementById('amIc').value || '💼', nm); });
    el.querySelectorAll('[data-ed]').forEach(function(b){ b.addEventListener('click', function(){ var x = ACC.filter(function(a){ return a.k === b.getAttribute('data-ed'); })[0]; if(!x) return;
      var nm = prompt('Nume cont', x.n); if(nm == null) return; nm = nm.trim().slice(0, 30); if(!nm) return; var ic = prompt('Iconiță (un emoji)', x.ic); x.n = nm; if(ic && ic.trim()) x.ic = ic.trim().slice(0, 6); accSaveList(); }); });
    el.querySelectorAll('[data-del]').forEach(function(b){ b.addEventListener('click', function(){ var k = b.getAttribute('data-del'), x = ACC.filter(function(a){ return a.k === k; })[0]; if(!x) return;
      if(ACC.length <= 1){ alert('Păstrează cel puțin un cont. Poți adăuga altul și apoi îl ștergi pe acesta.'); return; }
      if(!confirm('Ștergi contul „' + x.n + '”?\n\nDispare din avere, din grafic și din istoric (valorile lui nu se mai numără).')) return;
      ACC = ACC.filter(function(a){ return a.k !== k; }); delete accTyped[k]; accStrip(k); accSaveList(); }); });
  }
  function accInputs(){ return Array.prototype.slice.call(document.querySelectorAll('#accFields input[data-k]')); }
  function renderAccForm(last){
    var box = document.getElementById('accFields'); if(!box) return;
    var us = document.getElementById('accUpdSub'); if(us){ if(last){ var ld = new Date(last.date + 'T00:00:00'); us.textContent = 'ultima: ' + ld.getDate() + ' ' + monthShort[ld.getMonth()] + ' · €' + Math.round(accTotal(last)).toLocaleString('ro-RO'); } else us.textContent = 'încă nesalvat'; }
    if(box.contains(document.activeElement) && document.activeElement.tagName === 'INPUT' && box.querySelectorAll('input[data-k]').length === ACC.length) return;     // do not disturb typing
    box.innerHTML = ACC.map(function(x){ var v = accTyped[x.k] !== undefined ? accTyped[x.k] : ((last && last[x.k]) || '');
      return '<div class="field-row acc-f"><label><i style="background:' + x.c + '"></i>' + accEsc(x.ic) + ' ' + accEsc(x.n) + ' (€)</label><input type="number" data-k="' + x.k + '" inputmode="decimal" placeholder="0" value="' + accEsc(v) + '"></div>' +
        (x.k === 'eth' ? '<div class="hint" id="accEthHint" style="display:none;margin:-4px 0 8px;"></div>' : ''); }).join('');
    accInputs().forEach(function(el){ el.addEventListener('input', function(){ accTyped[el.getAttribute('data-k')] = el.value; updateLive(); }); });
    updateLive(); if(typeof paintEthHint === 'function') paintEthHint();
  }
  var worthGoal = 0;
  try{ worthGoal = parseFloat(localStorage.getItem('byzyp_goal')) || 0; }catch(e){}
  function accTotal(a){ return ACC.reduce(function(s2,x){ return s2 + (a[x.k]||0); }, 0); }
  function sortedAccounts(){ return accounts.slice().sort(function(a,b){ return a.date === b.date ? (a.ts||0)-(b.ts||0) : a.date.localeCompare(b.date); }); }
  function eur(n){ return (n<0?'-':'') + '€' + Math.abs(Math.round(n)).toLocaleString('ro-RO'); }
  function chip(diff, base, label){
    var pct = base ? ' ' + (diff>=0?'+':'') + (diff/Math.abs(base)*100).toFixed(1) + '%' : '';
    return '<span class="wh-chip ' + (diff>0?'pos':diff<0?'neg':'') + '">' + (diff>=0?'↑ +':'↓ ') + eur(diff).replace('-','') + pct + '<em>' + label + '</em></span>';
  }
  function renderWorth(){
    var list = sortedAccounts();
    var totalEl = document.getElementById('worthTotal'), deltaEl = document.getElementById('worthDelta');
    var histEl = document.getElementById('worthHistory'), chart = document.getElementById('worthChart');
    if(!list.length){
      totalEl.textContent = '€0';
      deltaEl.innerHTML = '<span class="wh-chip">Nicio înregistrare încă</span>';
      chart.innerHTML = '<div class="eq-empty">Completează soldurile mai jos și apasă „Salvează”. De la a doua salvare apare graficul.</div>';
      document.getElementById('wcFrom').textContent = ''; document.getElementById('wcTo').textContent = '';
      histEl.innerHTML = '<div class="hint" style="margin-top:0;">Încă nimic salvat.</div>';
      renderAlloc(null, null); renderGoal(0); renderAccForm(null); renderAccMgr();
      return;
    }
    var last = list[list.length-1], prev = list.length > 1 ? list[list.length-2] : null, first = list[0];
    var total = accTotal(last);
    totalEl.textContent = eur(total);
    var chips = '';
    if(prev) chips += chip(total - accTotal(prev), accTotal(prev), 'față de ultima');
    if(list.length > 2) chips += chip(total - accTotal(first), accTotal(first), 'de la început');
    var ld = new Date(last.date + 'T00:00:00');
    chips += '<span class="wh-chip">🕒 ' + ld.getDate() + ' ' + monthShort[ld.getMonth()] + '</span>';
    deltaEl.innerHTML = chips;

    // chart
    if(list.length < 2){
      chart.innerHTML = '<div class="eq-empty">Graficul apare de la a doua salvare.</div>';
      document.getElementById('wcFrom').textContent = ''; document.getElementById('wcTo').textContent = '';
    } else {
      var ys = list.map(accTotal), W = 320, H = 120, pad = 8;
      var mn = Math.min.apply(null, ys), mx = Math.max.apply(null, ys); if(mx === mn){ mx += 1; mn -= 1; }
      var X = function(i){ return pad + i*(W-pad*2)/(ys.length-1); }, Y = function(v){ return pad + (H-pad*2)*(1-(v-mn)/(mx-mn)); };
      var line = ys.map(function(v,i){ return (i?'L':'M') + X(i).toFixed(1) + ' ' + Y(v).toFixed(1); }).join(' ');
      var area = line + ' L' + X(ys.length-1).toFixed(1) + ' ' + (H-pad) + ' L' + X(0).toFixed(1) + ' ' + (H-pad) + ' Z';
      var col = ys[ys.length-1] >= ys[0] ? 'var(--accent)' : 'var(--danger)';
      chart.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none"><defs><linearGradient id="wcGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="' + col + '" stop-opacity="0.35"/><stop offset="100%" stop-color="' + col + '" stop-opacity="0"/></linearGradient></defs>' +
        '<path d="' + area + '" fill="url(#wcGrad)"/><path d="' + line + '" fill="none" stroke="' + col + '" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>' +
        ys.map(function(v,i){ return '<circle cx="' + X(i).toFixed(1) + '" cy="' + Y(v).toFixed(1) + '" r="' + (i===ys.length-1?4:2) + '" fill="' + col + '" stroke="var(--bg-card)" stroke-width="' + (i===ys.length-1?2:0) + '" vector-effect="non-scaling-stroke"/>'; }).join('') + '</svg>';
      var fd = new Date(first.date + 'T00:00:00');
      document.getElementById('wcFrom').textContent = fd.getDate() + ' ' + monthShort[fd.getMonth()];
      document.getElementById('wcTo').textContent = ld.getDate() + ' ' + monthShort[ld.getMonth()];
    }

    renderAlloc(last, prev);
    renderGoal(total);
    renderAccMgr();

    renderAccForm(last);

    var rev = list.slice().reverse().slice(0,12);
    histEl.innerHTML = rev.map(function(a, i){
      var d = new Date(a.date + 'T00:00:00'), t = accTotal(a);
      var older = rev[i+1], em = '';
      if(older){ var df = t - accTotal(older); em = '<em class="' + (df>0?'pos':df<0?'neg':'') + '">' + (df>=0?'+':'') + eur(df) + '</em>'; }
      else em = '<em>prima înregistrare</em>';
      return '<div class="wh-row"><span class="d">' + ['Du','Lu','Ma','Mi','Jo','Vi','Sâ'][d.getDay()] + ', ' + d.getDate() + ' ' + monthShort[d.getMonth()] + ' ' + d.getFullYear() + '</span><span class="v">' + eur(t) + em + '</span></div>';
    }).join('');
    renderDashboard();
  }
  function renderAlloc(last, prev){
    var donut = document.getElementById('donut'), legend = document.getElementById('allocLegend'), rows = document.getElementById('accRows');
    var total = last ? accTotal(last) : 0;
    document.getElementById('donutC').innerHTML = '<b>' + eur(total) + '</b><span>total</span>';
    var R = 48, C = 2*Math.PI*R, off = 0, svg = '<circle cx="60" cy="60" r="' + R + '" fill="none" stroke="var(--line)" stroke-width="14"/>';
    if(total > 0){
      ACC.forEach(function(x){
        var v = last[x.k]||0; if(v <= 0) return;
        var len = v/total*C;
        svg += '<circle cx="60" cy="60" r="' + R + '" fill="none" stroke="' + x.c + '" stroke-width="14" stroke-dasharray="' + Math.max(0,len-1.5).toFixed(2) + ' ' + C.toFixed(2) + '" stroke-dashoffset="' + (-off).toFixed(2) + '"/>';
        off += len;
      });
    }
    donut.innerHTML = svg;
    legend.innerHTML = ACC.map(function(x){
      var v = last ? (last[x.k]||0) : 0;
      return '<div class="al-row"><i style="background:' + x.c + '"></i><span>' + accEsc(x.n) + '</span><b>' + (total ? Math.round(v/total*100) : 0) + '%</b></div>';
    }).join('');
    rows.innerHTML = ACC.map(function(x){
      var v = last ? (last[x.k]||0) : 0;
      var d = (last && prev) ? v - (prev[x.k]||0) : null;
      var dh = d === null ? '<div class="acc-d">–</div>' : '<div class="acc-d ' + (d>0?'pos':d<0?'neg':'') + '">' + (d>0?'↑ +':d<0?'↓ ':'') + (d===0?'fără schimbare':eur(d).replace('-','')) + '</div>';
      return '<div class="acc-row"><div class="acc-ic" style="background:color-mix(in srgb, ' + x.c + ' 14%, var(--bg-card-2));">' + accEsc(x.ic) + '</div>' +
        '<div class="acc-mid"><div class="acc-n">' + accEsc(x.n) + '</div><div class="acc-bar"><i style="width:' + (total ? v/total*100 : 0) + '%;background:' + x.c + '"></i></div></div>' +
        '<div class="acc-r"><div class="acc-v">' + eur(v) + '</div>' + dh + '</div></div>';
    }).join('');
  }
  function renderGoal(total){
    var gi = document.getElementById('goalInput');
    if(document.activeElement !== gi) gi.value = worthGoal || '';
    var pctEl = document.getElementById('goalPct'), sub = document.getElementById('goalSub'), bar = document.getElementById('goalBar'), marks = document.getElementById('goalMarks');
    if(!worthGoal){ pctEl.textContent = '–'; sub.textContent = 'Setează o țintă, de exemplu €10.000'; bar.style.width = '0%'; marks.innerHTML = ''; return; }
    var p = Math.min(100, total/worthGoal*100);
    pctEl.textContent = p.toFixed(p < 10 ? 1 : 0) + '%';
    sub.textContent = total >= worthGoal ? '🏆 Obiectiv atins! Pune-ți unul nou.' : 'Îți mai trebuie ' + eur(worthGoal - total);
    bar.style.width = p + '%';
    marks.innerHTML = '<span>€0</span><span>' + eur(worthGoal/2) + '</span><span>' + eur(worthGoal) + '</span>';
  }
  document.getElementById('goalInput').addEventListener('input', function(){
    worthGoal = parseFloat(this.value) || 0;
    try{ localStorage.setItem('byzyp_goal', String(worthGoal)); }catch(e){}
    if(!useLocal && db){ chainWrite('settings/worth', function(){ return db.doc('settings/worth').set({ goal: worthGoal }); }); }
    var l = sortedAccounts(); renderGoal(l.length ? accTotal(l[l.length-1]) : 0);
  });
  function updateLive(){
    var t = accInputs().reduce(function(s2, el){ return s2 + (parseFloat(el.value) || 0); }, 0);
    document.getElementById('accLive').innerHTML = '<span>Total de salvat</span><b>' + eur(t) + '</b>';
  }
  document.getElementById('accSaveBtn').addEventListener('click', function(){
    var entry = { date: todayKey, ts: Date.now() };
    accInputs().forEach(function(el){ entry[el.getAttribute('data-k')] = parseFloat(el.value) || 0; });
    accTyped = {};
    if(useLocal){
      accounts.push(entry);
      safeSet('reset_accounts_local_v1', JSON.stringify(accounts));
      renderWorth();
    } else {
      db.collection('accounts').add(entry).catch(function(e){ console.error(e); });
    }
  });

  /* trade journal */
  var trades = [];
  var tradeAmt = document.getElementById('tradeAmt');
  var tradeLot = document.getElementById('tradeLot');
  var tradeEntry = document.getElementById('tradeEntry');
  var tradeResult = document.getElementById('tradeResult');

  function fmtSigned(n){ return (n>=0?'+':'-') + '€' + Math.abs(n).toFixed(2); }

  function renderTrades(){
    var totalAll = trades.reduce(function(s,t){ return s + t.result; }, 0);
    var totalEl = document.getElementById('tradeTotalAll');
    totalEl.textContent = fmtSigned(totalAll);
    totalEl.className = 'trade-current-num' + (totalAll < 0 ? ' neg' : '');

    var monthlyEl = document.getElementById('tradeMonthly');
    var listEl = document.getElementById('tradeList');

    if(!trades.length){
      monthlyEl.innerHTML = '<div class="hint" style="margin-top:0;">Adaugă prima tranzacție ca să vezi rezultatul pe lună.</div>';
      listEl.innerHTML = '';
      return;
    }
    var sorted = trades.slice().sort(function(a,b){ return a.date.localeCompare(b.date); });
    var months = {}, order = [];
    sorted.forEach(function(t){
      var mKey = t.date.slice(0,7);
      if(!months[mKey]){ months[mKey]=[]; order.push(mKey); }
      months[mKey].push(t);
    });
    var html = '';
    order.slice().reverse().forEach(function(mKey){
      var entries = months[mKey];
      var y = parseInt(mKey.slice(0,4)), m = parseInt(mKey.slice(5,7))-1;
      var sum = entries.reduce(function(s,t){ return s+t.result; }, 0);
      html += '<div class="month-row"><div class="month-row-head"><span class="month-row-name">' + monthFull[m] + ' ' + y + '</span>';
      html += '<span class="month-row-pl ' + (sum>=0?'pos':'neg') + '">' + fmtSigned(sum) + '</span></div>';
      html += '<div class="month-row-detail">' + entries.length + ' tranzacții</div></div>';
    });
    monthlyEl.innerHTML = html;

    listEl.innerHTML = sorted.slice().reverse().slice(0,8).map(function(t){
      var d = new Date(t.date + 'T00:00:00');
      var extra = [];
      if(t.lot) extra.push('lot ' + t.lot);
      if(t.entryPrice) extra.push('intrat la ' + t.entryPrice);
      var extraStr = extra.length ? ' · ' + extra.join(' · ') : '';
      return '<div class="trade-item"><span class="trade-item-date">' + d.getDate() + ' ' + monthShort[d.getMonth()] + ' · investit $' + t.amount.toFixed(0) + extraStr + '</span><span class="trade-item-pl ' + (t.result>=0?'pos':'neg') + '">' + fmtSigned(t.result) + '</span></div>';
    }).join('');
    renderDashboard();
  }
  document.getElementById('tradeAddBtn').addEventListener('click', function(){
    var amt = parseFloat(tradeAmt.value) || 0;
    var res = parseFloat(tradeResult.value);
    if(isNaN(res)) return;
    var lot = parseFloat(tradeLot.value) || null;
    var entryPrice = parseFloat(tradeEntry.value) || null;
    var entry = { date: todayKey, amount: amt, result: res, lot: lot, entryPrice: entryPrice };
    tradeAmt.value = ''; tradeLot.value = ''; tradeEntry.value = ''; tradeResult.value = '';
    if(useLocal){
      trades.push(entry);
      safeSet('reset_trades_local_v1', JSON.stringify(trades));
      renderTrades(); renderCalendar();
    } else {
      db.collection('trades').add(entry).catch(function(e){ console.error(e); });
    }
  });

  var tradeResetBtn = document.getElementById('tradeResetBtn');
  var tradeResetArmed = false;
  var tradeResetTimer = null;
  tradeResetBtn.addEventListener('click', function(){
    if(!tradeResetArmed){
      tradeResetArmed = true;
      tradeResetBtn.textContent = 'Apasă din nou ca să confirmi ștergerea';
      tradeResetBtn.style.color = 'var(--danger)';
      tradeResetBtn.style.borderColor = 'var(--danger)';
      clearTimeout(tradeResetTimer);
      tradeResetTimer = setTimeout(function(){
        tradeResetArmed = false;
        tradeResetBtn.textContent = 'Resetează jurnalul de trading';
        tradeResetBtn.style.color = '';
        tradeResetBtn.style.borderColor = '';
      }, 4000);
      return;
    }
    clearTimeout(tradeResetTimer);
    tradeResetArmed = false;
    tradeResetBtn.textContent = 'Resetează jurnalul de trading';
    tradeResetBtn.style.color = '';
    tradeResetBtn.style.borderColor = '';

    if(useLocal){
      trades = [];
      safeSet('reset_trades_local_v1', JSON.stringify(trades));
      renderTrades(); renderCalendar();
    } else {
      var toDelete = trades.slice();
      toDelete.forEach(function(t){
        if(t._id){ db.doc('trades/'+t._id).delete().catch(function(e){ console.error('delete failed', e); }); }
      });
    }
  });

  /* equity curve */
  var eqStart = 0;
  var eqStartInput = document.getElementById('eqStartInput');
  eqStartInput.addEventListener('input', function(){
    eqStart = parseFloat(eqStartInput.value) || 0;
    if(useLocal){ safeSet('reset_eq_start_v1', String(eqStart)); }
    else { chainWrite('settings/trading', function(){ return db.doc('settings/trading').set({ startBalance: eqStart }); }); }
    renderEquity(); renderGrowth();
  });
  function renderEquity(){
    var chart = document.getElementById('eqChart');
    if(!chart) return;
    var sorted = trades.slice().sort(function(a,b){ return a.date.localeCompare(b.date); });
    var pts = [eqStart];
    var run = eqStart;
    sorted.forEach(function(t){ run += t.result; pts.push(run); });
    var bal = run;
    var diff = bal - eqStart;
    document.getElementById('eqBal').textContent = (bal<0?'-':'') + '€' + Math.abs(bal).toFixed(2);
    var dEl = document.getElementById('eqDelta');
    var pct = eqStart > 0 ? (diff/eqStart*100) : null;
    dEl.textContent = fmtSigned(diff) + (pct!==null ? ' (' + (pct>=0?'+':'') + pct.toFixed(1) + '%)' : '') + ' de la pornire';
    dEl.className = 'eq-delta' + (diff>0?' pos':diff<0?' neg':'');
    var fromEl = document.getElementById('eqFrom'), toEl = document.getElementById('eqTo');
    if(sorted.length < 1){
      chart.innerHTML = '<div class="eq-empty">Graficul apare după prima tranzacție. Pune sus soldul cu care ai pornit contul.</div>';
      fromEl.textContent = ''; toEl.textContent = ''; return;
    }
    var fd = new Date(sorted[0].date+'T00:00:00'), ld = new Date(sorted[sorted.length-1].date+'T00:00:00');
    fromEl.textContent = fd.getDate() + ' ' + monthShort[fd.getMonth()];
    toEl.textContent = ld.getDate() + ' ' + monthShort[ld.getMonth()];
    var W = 320, H = 150, pad = 8;
    var min = Math.min.apply(null, pts), max = Math.max.apply(null, pts);
    if(max === min){ max += 1; min -= 1; }
    var x = function(i){ return pad + i * (W - pad*2) / (pts.length - 1); };
    var y = function(v){ return pad + (H - pad*2) * (1 - (v - min) / (max - min)); };
    var line = pts.map(function(v,i){ return (i?'L':'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1); }).join(' ');
    var area = line + ' L' + x(pts.length-1).toFixed(1) + ' ' + (H-pad) + ' L' + x(0).toFixed(1) + ' ' + (H-pad) + ' Z';
    var color = diff >= 0 ? 'var(--accent)' : 'var(--danger)';
    var baseY = y(eqStart).toFixed(1);
    var lx = x(pts.length-1).toFixed(1), ly = y(pts[pts.length-1]).toFixed(1);
    chart.innerHTML =
      '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none">' +
        '<defs><linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">' +
          '<stop offset="0%" stop-color="' + color + '" stop-opacity="0.35"/>' +
          '<stop offset="100%" stop-color="' + color + '" stop-opacity="0"/></linearGradient></defs>' +
        '<line x1="' + pad + '" x2="' + (W-pad) + '" y1="' + baseY + '" y2="' + baseY + '" stroke="var(--text-faint)" stroke-width="1" stroke-dasharray="3 4" vector-effect="non-scaling-stroke"/>' +
        '<path d="' + area + '" fill="url(#eqGrad)"/>' +
        '<path d="' + line + '" fill="none" stroke="' + color + '" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>' +
        '<circle cx="' + lx + '" cy="' + ly + '" r="4" fill="' + color + '" stroke="var(--bg-card)" stroke-width="2" vector-effect="non-scaling-stroke"/>' +
      '</svg>';
  }

  /* food tab */
  (function(){
    var fbtns = document.querySelectorAll('#foodSeg .seg-btn');
    function fshow(seg){
      fbtns.forEach(function(b){ b.classList.toggle('active', b.getAttribute('data-fseg') === seg); });
      document.querySelectorAll('[data-fseg-card]').forEach(function(c){ c.classList.toggle('seg-show', c.getAttribute('data-fseg-card') === seg); });
    }
    fbtns.forEach(function(b){ b.addEventListener('click', function(){ fshow(b.getAttribute('data-fseg')); }); });
    fshow('plan');

    var days = ['Luni','Marți','Miercuri','Joi','Vineri','Sâmbătă','Duminică'];
    var todayIdx = (new Date().getDay() + 6) % 7;
    var pills = document.getElementById('dayPills');
    pills.innerHTML = days.map(function(d,i){ return '<button class="day-pill' + (i===todayIdx?' today':'') + '" data-i="' + i + '">' + d.slice(0,2) + '</button>'; }).join('');
    function showDay(i){
      pills.querySelectorAll('.day-pill').forEach(function(p){ p.classList.toggle('active', +p.getAttribute('data-i') === i); });
      document.querySelectorAll('.mm-day').forEach(function(d,j){ d.classList.toggle('show', j === i); });
    }
    pills.querySelectorAll('.day-pill').forEach(function(p){ p.addEventListener('click', function(){ showDay(+p.getAttribute('data-i')); }); });
    showDay(todayIdx);

    var ipills = document.querySelectorAll('.idea-pill');
    function showIdea(k){
      ipills.forEach(function(p){ p.classList.toggle('active', p.getAttribute('data-idea') === k); });
      document.querySelectorAll('.idea-group').forEach(function(g){ g.classList.toggle('show', g.getAttribute('data-idea-g') === k); });
    }
    ipills.forEach(function(p){ p.addEventListener('click', function(){ showIdea(p.getAttribute('data-idea')); }); });
    showIdea('Dimineața');

    var GR_KEY = 'byzyp_grocery_v1';
    var grDone = {};
    try{ grDone = JSON.parse(localStorage.getItem(GR_KEY) || '{}') || {}; }catch(e){ grDone = {}; }
    var items = document.querySelectorAll('.gr-item');
    function grRender(){
      var n = 0;
      items.forEach(function(it){ var on = !!grDone[it.getAttribute('data-gr')]; it.classList.toggle('done', on); if(on) n++; });
      document.getElementById('grProgress').textContent = n + ' / ' + items.length + ' în coș';
    }
    items.forEach(function(it){ it.addEventListener('click', function(){
      var k = it.getAttribute('data-gr'); grDone[k] = !grDone[k];
      try{ localStorage.setItem(GR_KEY, JSON.stringify(grDone)); }catch(e){}
      grRender();
    }); });
    document.getElementById('grReset').addEventListener('click', function(){
      grDone = {}; try{ localStorage.setItem(GR_KEY, '{}'); }catch(e){} grRender();
    });
    grRender();
  })();

  function renderProtein(){
    if(typeof nuRender === 'function') nuRender();
    var box = document.getElementById('proteinBox');
    if(!box) return;
    var keys = Object.keys(data).filter(function(k){ return data[k] && data[k].weight != null; }).sort();
    if(!keys.length){
      box.innerHTML = '<div class="prot-sub" style="margin-top:0;">Notează-ți greutatea pe fila <b>Azi</b> și aici apare automat câte grame de proteină îți trebuie pe zi.</div>';
      return;
    }
    var w = data[keys[keys.length-1]].weight;
    var lo = Math.round(w*1.4), hi = Math.round(w*2.0), per = Math.round((lo+hi)/2/4);
    box.innerHTML = '<div class="prot-big">' + lo + '–' + hi + ' g</div>' +
      '<div class="prot-sub">proteină pe zi, pentru ' + fmtKg(w) + ' kg</div>' +
      '<div class="prot-meals">' +
        ['Dimineața','Prânz','Gustare','Seara'].map(function(m){ return '<div class="prot-meal"><b>~' + per + 'g</b><span>' + m + '</span></div>'; }).join('') +
      '</div>';
  }

  /* economic news */
  var newsData = { events: [] };
  var newsFilter = 'imp';
  var curNames = { USD:'dolar', EUR:'euro', GBP:'liră', JPY:'yen', CHF:'franc elvețian', AUD:'dolar australian', CAD:'dolar canadian', NZD:'dolar NZ', CNY:'yuan' };
  function fmtCountdown(ms){
    var m = Math.round(ms/60000);
    if(m < 1) return 'acum';
    if(m < 60) return m + ' min';
    var h = Math.floor(m/60), mm = m % 60;
    if(h < 24) return h + 'h ' + (mm<10?'0':'') + mm + 'm';
    var d = Math.floor(h/24); return d + 'z ' + (h%24) + 'h';
  }
  function hhmm(d){ return String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0'); }
  var newsTarget = null, newsSoon = null;
  function fmtLive(ms){
    if(ms <= 0) return 'ACUM';
    var t = Math.floor(ms/1000);
    var d = Math.floor(t/86400), h = Math.floor((t%86400)/3600), m = Math.floor((t%3600)/60), sec = t%60;
    var pad = function(n){ return (n<10?'0':'') + n; };
    if(d > 0) return d + 'z ' + pad(h) + ':' + pad(m) + ':' + pad(sec);
    return pad(h) + ':' + pad(m) + ':' + pad(sec);
  }
  function tickNews(){
    var now = Date.now();
    var c = document.getElementById('nxCount');
    if(c && newsTarget){
      var diff = newsTarget.t.getTime() - now;
      c.textContent = diff > 0 ? fmtLive(diff) : 'ACUM';
      if(diff < -60000){ renderNews(); return; }
    }
    var a = document.getElementById('alertCount');
    if(a && newsSoon){
      var d2 = newsSoon.t.getTime() - now;
      a.textContent = d2 > 0 ? fmtLive(d2) : 'ACUM';
    }
  }
  function renderNews(){
    var list = document.getElementById('newsList');
    if(!list) return;
    var now = Date.now();
    var evs = (newsData.events || []).map(function(e){ return { t:new Date(e.t), c:e.c, i:e.i, title:e.title, f:e.f, p:e.p }; })
      .filter(function(e){ return !isNaN(e.t); }).sort(function(a,b){ return a.t - b.t; });
    var shown = evs.filter(function(e){
      if(newsFilter === 'high') return e.i === 'High';
      if(newsFilter === 'imp') return e.i === 'High' || e.i === 'Medium';
      return true;
    }).filter(function(e){ return e.t.getTime() > now - 3*3600000; });

    var nextHigh = evs.filter(function(e){ return e.i === 'High' && e.t.getTime() > now - 60000; })[0];
    var nextImp = evs.filter(function(e){ return (e.i === 'High' || e.i === 'Medium') && e.t.getTime() > now - 60000; })[0];
    var nx = document.getElementById('newsNext');
    var target = nextHigh || nextImp;
    newsTarget = target || null;
    if(!evs.length){
      nx.className = 'nx';
      nx.innerHTML = '<div class="nx-l">Știrile nu s-au putut încărca acum</div><div class="nx-t" style="font-size:13px;font-weight:500;color:var(--text-dim);">Se reîncearcă automat. Între timp le vezi pe Forex Factory, cu butonul de mai jos.</div>';
    } else if(!target){
      nx.className = 'nx';
      nx.innerHTML = '<div class="nx-l">Liniște</div><div class="nx-t">Nu mai sunt știri importante în lista încărcată</div>';
    } else {
      var diff = target.t.getTime() - now;
      var hot = target.i === 'High' && diff < 2*3600000;
      nx.className = 'nx' + (hot ? ' hot' : '');
      nx.innerHTML = '<div class="nx-l">Următoarea știre ' + (target.i==='High' ? '🔴 roșie' : '🟠 medie') + ' · ' + hhmm(target.t) + '</div>' +
        '<div class="nx-t">' + zEsc(target.c) + ' — ' + zEsc(target.title) + '</div>' +
        '<div class="nx-c' + (target.i==='High' ? '' : ' calm') + '"><span class="nx-in">în</span> <span id="nxCount">' + fmtLive(diff) + '</span></div>';
    }

    if(!shown.length){
      list.innerHTML = evs.length ? '<div class="hint">Nicio știre pentru filtrul ales.</div>' : '';
    } else {
      var html = '', lastDay = '';
      var dn = ['Duminică','Luni','Marți','Miercuri','Joi','Vineri','Sâmbătă'];
      shown.forEach(function(e){
        var dk = e.t.toDateString();
        if(dk !== lastDay){
          lastDay = dk;
          var isToday = dk === new Date().toDateString();
          html += '<div class="news-day">' + (isToday ? 'Azi · ' : '') + dn[e.t.getDay()] + ' ' + e.t.getDate() + ' ' + monthShort[e.t.getMonth()] + '</div>';
        }
        var ms = e.t.getTime() - now;
        var cls = 'news-row' + (ms < -60000 ? ' past' : (ms < 3600000 ? ' soon' : ''));
        var fp = [];
        if(e.f) fp.push('prognoză ' + e.f);
        if(e.p) fp.push('anterior ' + e.p);
        html += '<div class="' + cls + '"><span class="news-time">' + hhmm(e.t) + '</span><span class="news-imp ' + e.i + '"></span>' +
          '<span class="news-cur">' + zEsc(e.c) + '</span><div class="news-body"><div class="news-title">' + zEsc(e.title) + '</div>' +
          (fp.length ? '<div class="news-fp">' + fp.join(' · ') + '</div>' : '') + '</div></div>';
      });
      list.innerHTML = html;
    }
    var meta = document.getElementById('newsMeta');
    if(newsData.updated){
      var ago = window.__newsCheckedAt ? Math.max(0, Math.round((Date.now() - window.__newsCheckedAt) / 1000)) : null;
      meta.innerHTML = '<span class="live-tag" style="margin:0 4px 0 0;">●</span>Verificat ' + (ago != null ? 'acum ' + (ago < 60 ? ago + ' s' : Math.round(ago / 60) + ' min') : 'automat') + ' · se reverifică la fiecare minut · sursa: Forex Factory · ore pe fusul orar al telefonului.';
    } else meta.textContent = '';

    // alert on Azi tab: high impact within 60 min
    var al = document.getElementById('newsAlert');
    if(al){
      var soon = evs.filter(function(e){ var d = e.t.getTime() - now; return e.i === 'High' && d > -5*60000 && d < 60*60000; })[0];
      newsSoon = soon || null;
      if(soon){
        var d2 = soon.t.getTime() - now;
        al.style.display = 'block';
        al.innerHTML = '⚠️ Știre roșie în <b id="alertCount">' + fmtLive(d2) + '</b>: ' + zEsc(soon.c) + ' — ' + zEsc(soon.title) + '. Atenție la tranzacții.';
      } else { al.style.display = 'none'; }
    }
    if(typeof renderPlanTiles === 'function') renderPlanTiles();
  }
  document.querySelectorAll('.news-f').forEach(function(b){
    b.addEventListener('click', function(){
      newsFilter = b.getAttribute('data-nf');
      document.querySelectorAll('.news-f').forEach(function(x){ x.classList.toggle('active', x === b); });
      renderNews();
    });
  });
  setInterval(renderNews, 30000);
  setInterval(tickNews, 1000);

  /* ===== XAUUSD analysis ===== */
  var gold = null, goldRisk = 1, goldSide = null, goldOpen = {}, goldBal = null, goldChart = 'a', goldChartSide = null;

  var SGUIDE = {
    trend:{ ic:'📈', short:'Trend EMA', what:'Tranzacționezi doar în direcția trendului mare, arătat de mediile mobile EMA 20, 50 și 200. Când sunt aliniate (20 peste 50 peste 200 = trend în sus), cumperi la retrageri.',
      how:['Verifică ordinea mediilor: EMA20 > EMA50 > EMA200 = doar BUY; invers = doar SELL.','Nu intra la vârf: așteaptă ca prețul să revină spre EMA20.','Pe H1 caută o lumânare de respingere (fitil) la EMA20.','SL cam 1×ATR dincolo de EMA20, TP1 la 1.5R, TP2 la 3R.','Dacă prețul închide o zi întreagă dincolo de EMA50, trendul slăbește: stai deoparte.'] },
    sr:{ ic:'🧱', short:'Suport/Rezistență', what:'Prețul reacționează des la aceleași niveluri: podele (suporturi) unde apar cumpărătorii și plafoane (rezistențe) unde apar vânzătorii.',
      how:['Marchează suportul și rezistența cele mai apropiate (le ai în Analiză).','Nu cumpăra în mijlocul intervalului: așteaptă prețul la nivel.','La suport: caută fitil lung în jos sau engulfing verde pe H1, apoi BUY.','La rezistență: fitil lung în sus sau engulfing roșu, apoi SELL.','SL puțin dincolo de nivel, TP la nivelul opus.'] },
    breakout:{ ic:'💥', short:'Breakout', what:'Când prețul sparge maximul sau minimul ultimelor 20 de zile, deseori pornește o mișcare puternică în acea direcție.',
      how:['Urmărește maximul și minimul pe 20 de zile.','Intră doar după o lumânare H4/D1 închisă dincolo de nivel, nu doar la o atingere.','Cea mai sigură intrare e la retestul nivelului spart (fostul plafon devine podea).','SL înapoi în interiorul canalului, TP la 1.5–3×ATR.','Atenție la spargerile false chiar înainte de știri.'] },
    rsi:{ ic:'🌡️', short:'RSI extrem', what:'RSI măsoară cât de „întins” e prețul. Peste 70 = supracumpărat, sub 30 = supravândut, adică posibilă revenire.',
      how:['Folosește-o mai ales când piața merge lateral (ADX sub 20).','RSI sub 30 + suport = cumpărare; RSI peste 70 + rezistență = vânzare.','Așteaptă ca RSI să iasă înapoi din zona extremă înainte de intrare.','Țintă modestă: EMA20 sau mijlocul intervalului.','Într-un trend puternic RSI poate sta mult timp la extreme: nu te opune trendului.'] },
    macd:{ ic:'〽️', short:'MACD', what:'MACD arată accelerarea sau încetinirea mișcării. Când linia MACD trece peste linia de semnal, momentumul devine pozitiv.',
      how:['BUY la încrucișarea MACD peste semnal, mai ales sub linia 0.','SELL la încrucișarea sub semnal, mai ales peste linia 0.','Confirmă cu trendul EMA; încrucișările contra trendului sunt slabe.','Histograma care scade arată că mișcarea obosește.','SL la ultimul minim/maxim local.'] },
    bb:{ ic:'🎯', short:'Bollinger', what:'Benzile Bollinger arată volatilitatea. Când se strâng (squeeze), urmează de obicei o mișcare mare; atingerea benzilor arată întindere.',
      how:['Squeeze: nu ghici direcția, intră după ce o lumânare închide în afara benzii.','Piață laterală: vânzare la banda de sus, cumpărare la banda de jos, țintă banda de mijloc.','Trend puternic: prețul „merge” pe bandă, nu vinde doar pentru că atinge banda de sus.','SL dincolo de ultima lumânare extremă.'] },
    fib:{ ic:'🌀', short:'Fibonacci', what:'După o mișcare mare, prețul revine des în zona 50–61.8% (zona de aur) înainte să continue.',
      how:['Identifică ultimul impuls (minim → maxim pentru BUY).','Așteaptă retragerea în zona 50–61.8%.','Caută confirmare pe H1 (respingere, engulfing).','SL sub 78.6%, TP1 la maximul impulsului, TP2 la extensia 127.2%.','Dacă prețul trece de 78.6%, impulsul e anulat.'] },
    pivot:{ ic:'📍', short:'Pivot', what:'Pivotul zilei (calculat din ziua de ieri) împarte ziua în bias pozitiv (peste pivot) și negativ (sub pivot). R1/R2 și S1/S2 sunt țintele intraday.',
      how:['Peste pivot: caută BUY cu țintă R1, apoi R2.','Sub pivot: caută SELL cu țintă S1, apoi S2.','Retestul pivotului e un punct bun de intrare.','E o strategie intraday: închide pozițiile până seara.'] },
    fvg:{ ic:'🧠', short:'Fair Value Gap', what:'Smart Money: un „gol” de preț lăsat de o mișcare foarte rapidă. Prețul revine des să-l „umple”, iar acolo intră instituțiile.',
      how:['Un FVG bullish sub preț e o zonă de cumpărare la revenire.','Un FVG bearish deasupra prețului e o zonă de vânzare la revenire.','Intră când prețul atinge zona și arată respingere pe H1.','SL dincolo de capătul golului, TP la ultimul maxim/minim.'] },
    mtf:{ ic:'🧭', short:'Timeframe-uri', what:'Cele mai bune tranzacții sunt când trendul zilnic (D1), pe 4 ore (H4) și pe o oră (H1) arată toate în aceeași direcție.',
      how:['Direcția o dă D1.','Pe H4 aștepți o retragere contra ei.','Pe H1 intri când trendul revine în direcția D1.','Dacă timeframe-urile se contrazic, stai deoparte.'] },
    ichi:{ ic:'☁️', short:'Ichimoku', what:'Sistem japonez complet: norul arată trendul și zonele de suport, iar liniile Tenkan și Kijun dau semnalele.',
      how:['Preț deasupra norului + Tenkan peste Kijun = doar BUY.','Preț sub nor + Tenkan sub Kijun = doar SELL.','Intrare la retragerea spre Kijun.','Preț în interiorul norului = indecizie, nu tranzacționa.','SL dincolo de Kijun sau de nor.'] },
    stoch:{ ic:'🔁', short:'Stochastic', what:'Oscilator ca RSI, dar mai rapid: arată unde e prețul față de intervalul ultimelor 14 zile.',
      how:['BUY: %K trece peste %D sub nivelul 20–30.','SELL: %K trece sub %D peste nivelul 70–80.','Cel mai bine funcționează în piață laterală.','Confirmă cu suport/rezistență.'] },
    pa:{ ic:'🕯️', short:'Lumânări', what:'Price action: formațiile de lumânări arată cine a câștigat lupta zilei. Engulfing, pin bar și inside bar sunt cele mai folosite.',
      how:['Uită-te doar la lumânări închise (ziua de ieri, H4 închis).','Engulfing verde/pin bar la suport = BUY; engulfing roșu/shooting star la rezistență = SELL.','Inside bar: pui ordine peste maximul și sub minimul zilei-mamă.','SL dincolo de capătul lumânării, TP la 1.5–2R.'] },
    adx:{ ic:'💪', short:'ADX', what:'ADX nu arată direcția, ci puterea trendului: peste 25 e trend puternic, sub 20 piața merge lateral.',
      how:['ADX peste 25: folosește strategii de trend (EMA, Supertrend, Breakout).','ADX sub 20: folosește strategii de interval (S/R, RSI, Stochastic, Bollinger).','+DI peste −DI = presiune de cumpărare, invers = de vânzare.','ADX care urcă = trendul se întărește.'] },
    st:{ ic:'🚦', short:'Supertrend', what:'Linie care urmărește prețul: verde sub preț = trend în sus, roșie peste preț = trend în jos. E folosită și ca Stop Loss mobil.',
      how:['Schimbarea culorii e semnalul de intrare.','Intră în direcția culorii, cu SL pe linia Supertrend.','Mută SL-ul pe linie în fiecare zi (trailing stop).','Ieși când linia își schimbă culoarea.','În piață laterală dă multe semnale false: verifică ADX.'] },
    london:{ ic:'🇬🇧', short:'London breakout', what:'Noaptea, în sesiunea asiatică, aurul face un interval mic. La deschiderea Londrei (07:00 UTC) prețul îl sparge des cu putere.',
      how:['Notează maximul și minimul dintre 00:00 și 07:00 UTC.','BUY la spargerea maximului, SELL la spargerea minimului.','SL la mijlocul intervalului.','TP = 1× și 2× mărimea intervalului.','Dacă nu se sparge până la prânz, anulezi.'] },
    round:{ ic:'🔢', short:'Niveluri rotunde', what:'Traderii pun ordine la prețuri rotunde (4300, 4350). Acolo prețul reacționează des: se oprește sau accelerează.',
      how:['Folosește nivelurile rotunde ca ținte (TP) și nu pune SL chiar pe ele.','Nivelurile de 100 sunt mai puternice decât cele de 50.','Respingere la nivel rotund + altă strategie = semnal mai bun.','O spargere clară a unui nivel de 100 duce deseori spre următorul.'] },
    psar:{ ic:'🎯', short:'Parabolic SAR', what:'Puncte care urmăresc prețul: sub preț = trend în sus, peste preț = trend în jos. Când sar pe partea cealaltă, trendul s-a întors.',
      how:['Intri în direcția punctelor după ce își schimbă partea.','SL pe ultimul punct SAR.','Mută SL-ul pe fiecare punct nou, în fiecare zi.','Ieși când punctele trec pe partea cealaltă.','Merge bine în trend, dă multe semnale false în piață laterală (verifică ADX).'] },
    turtle:{ ic:'🐢', short:'Turtle 55', what:'Sistemul legendar al traderilor „Turtle” (anii ’80): cumperi la spargerea maximului pe 55 de zile și vinzi la spargerea minimului.',
      how:['BUY când prețul trece de maximul ultimelor 55 de zile.','SELL când trece de minimul ultimelor 55 de zile.','SL la 2×ATR de la intrare.','Ieși când prețul atinge extrema opusă pe 20 de zile.','Acceptă multe pierderi mici: câștigă din puținele trenduri mari.'] },
    keltner:{ ic:'📏', short:'Keltner', what:'Canal în jurul EMA20, lat de 2×ATR. O închidere în afara canalului arată un impuls puternic.',
      how:['Închidere peste canal = impuls în sus, în jos invers.','Intri la închiderea lumânării, nu în mijlocul ei.','SL la mijlocul canalului (EMA20).','Ieși când prețul revine în interiorul canalului.'] },
    wr:{ ic:'📉', short:'Williams %R', what:'Oscilator rapid care arată unde e prețul față de maximul și minimul pe 14 zile. Sub −80 = supravândut, peste −20 = supracumpărat.',
      how:['Sub −80: caută cumpărări, mai ales la suport.','Peste −20: caută vânzări, mai ales la rezistență.','Intri când iese din zona extremă.','Nu te opune unui trend puternic.'] },
    cci:{ ic:'🧭', short:'CCI', what:'Commodity Channel Index: măsoară cât de departe e prețul de media lui. Peste +100 = impuls în sus, sub −100 = impuls în jos.',
      how:['Trecerea peste +100 = semnal de cumpărare pe impuls.','Trecerea sub −100 = semnal de vânzare pe impuls.','Peste ±250 prețul e foarte întins: nu intra târziu.','Ieși când CCI revine spre 0.'] },
    ha:{ ic:'🟩', short:'Heikin-Ashi', what:'Lumânări „netezite” care filtrează zgomotul. Mai multe lumânări verzi la rând fără fitil jos = trend în sus curat.',
      how:['Lumânări verzi fără fitil jos = rămâi pe BUY.','Lumânări roșii fără fitil sus = rămâi pe SELL.','Lumânările mici cu fitile în ambele părți arată indecizie: ieși sau așteaptă.','Folosește-le pentru a ține poziția, nu pentru intrări la preț exact.'] },
    gcross:{ ic:'✨', short:'Golden Cross', what:'Când media de 50 de zile trece peste cea de 200 (Golden Cross), începe de obicei un trend lung în sus. Invers e Death Cross.',
      how:['Golden Cross = favorizezi BUY săptămâni sau luni.','Death Cross = favorizezi SELL.','E un semnal lent: folosește-l pentru direcție, nu pentru intrare.','Intrările le cauți cu strategii mai rapide (EMA 9/21, S/R).'] },
    div:{ ic:'↗️', short:'Divergență RSI', what:'Când prețul face un minim nou, dar RSI nu, vânzătorii obosesc (divergență bullish). Invers la maxime (bearish).',
      how:['Compară ultimele două minime sau maxime ale prețului cu cele ale RSI.','Divergență bullish la suport = cumpărare.','Divergență bearish la rezistență = vânzare.','Așteaptă o lumânare de confirmare.','SL dincolo de extrema divergenței.'] },
    dbl:{ ic:'〰️', short:'Dublu max/min', what:'Formație clasică: prețul lovește de două ori același nivel și nu trece. Dublu maxim = întoarcere în jos, dublu minim = în sus.',
      how:['Identifică cele două vârfuri (sau funduri) la același nivel.','Marchează „linia gâtului” dintre ele.','Intri doar după închiderea dincolo de linia gâtului.','Ținta = înălțimea formației, proiectată de la gât.','SL dincolo de vârfuri sau funduri.'] },
    ob:{ ic:'🏦', short:'Order Block', what:'Smart Money: ultima lumânare opusă înainte de o mișcare puternică. Acolo au intrat instituțiile, iar prețul revine des în zona asta.',
      how:['Order block bullish = zonă de cumpărare când prețul revine în ea.','Order block bearish = zonă de vânzare.','Intri la prima revenire în zonă, cu confirmare pe H1.','SL puțin dincolo de zonă.','Nu mai e valid după ce a fost atins de câteva ori.'] },
    bos:{ ic:'🏗️', short:'Structura', what:'Citești trendul din maxime și minime: tot mai sus = trend în sus. BOS = continuare, CHoCH = prima spargere în sens opus (posibilă întoarcere).',
      how:['Maxime și minime tot mai sus = cauți doar BUY.','Maxime și minime tot mai jos = cauți doar SELL.','CHoCH (spargerea ultimului minim într-un trend în sus) = semnal de atenție sau de schimbare.','Intră după retestul nivelului spart.'] },
    sweep:{ ic:'🪤', short:'Liquidity sweep', what:'Prețul trece puțin peste maximul (sau sub minimul) de ieri, declanșează stop-urile altora, apoi se întoarce. E o capcană care dă intrări bune în sens opus.',
      how:['Urmărește maximul și minimul de ieri.','Dacă prețul trece de ele și închide înapoi, e un sweep.','Intri în sens opus, cu SL dincolo de fitil.','Ținta e partea opusă a zilei de ieri.'] },
    dxy:{ ic:'💵', short:'Dolarul (DXY)', what:'Aurul e cotat în dolari: când dolarul se întărește, aurul tinde să scadă, iar când slăbește, aurul tinde să crească.',
      how:['DXY în scădere = vânt din spate pentru BUY pe aur.','DXY în creștere = vânt din spate pentru SELL.','Folosește-l ca filtru: nu cumpăra aur când dolarul explodează.','Știrile USD (roșii) mișcă ambele.'] },
    yields:{ ic:'🏛️', short:'Randamente 10Y', what:'Aurul nu plătește dobândă. Când randamentele obligațiunilor SUA cresc, aurul devine mai puțin atractiv, iar când scad, mai atractiv.',
      how:['Randamente în scădere = favorabil pentru aur.','Randamente în creștere = presiune pe aur.','E un factor macro: îți dă contextul săptămânii, nu intrarea exactă.'] },
    cam:{ ic:'📐', short:'Camarilla', what:'Pivoți intraday calculați din ziua de ieri. H3/L3 sunt zone de întoarcere, H4/L4 zone de spargere.',
      how:['La H3: caută vânzare cu respingere, SL peste H4.','La L3: caută cumpărare cu respingere, SL sub L4.','Spargere peste H4 sau sub L4: mergi cu impulsul.','E pentru intraday: închide până seara.'] },
    nr7:{ ic:'🗜️', short:'NR7', what:'Ziua cu cel mai mic interval din ultimele 7. După o comprimare ca asta vine de obicei o expansiune mare.',
      how:['Marchează maximul și minimul zilei NR7.','Pui ordin de cumpărare peste maxim și de vânzare sub minim.','Când unul se execută, îl anulezi pe celălalt.','SL la capătul opus al zilei NR7.'] },
    gap:{ ic:'🕳️', short:'Gap weekend', what:'Luni aurul poate deschide mai sus sau mai jos decât a închis vineri. Aceste „goluri” se umplu des în primele zile.',
      how:['Gap în sus = posibilă vânzare spre închiderea de vineri.','Gap în jos = posibilă cumpărare spre închiderea de vineri.','Nu merge contra unui gap făcut de o știre mare din weekend.','Ținta e închiderea de vineri.'] },
    elder:{ ic:'🔋', short:'Elder Impulse', what:'Sistemul lui Alexander Elder: combină direcția EMA13 cu histograma MACD. Verde = cumpărătorii au impuls, roșu = vânzătorii, albastru = neutru.',
      how:['Pe bară verde nu vinzi.','Pe bară roșie nu cumperi.','Pe bară albastră poți intra în orice direcție, cu alte confirmări.','Se combină bine cu timeframe-uri multiple (D1 + H4).'] },
    aroon:{ ic:'📡', short:'Aroon', what:'Arată cât de recent a făcut prețul un maxim sau un minim în ultimele 25 de zile. Aroon Up mare = maxime recente = trend în sus.',
      how:['Up peste 70 și Down sub 30 = trend în sus.','Down peste 70 și Up sub 30 = trend în jos.','Ambele joase = piață laterală.','Încrucișarea liniilor arată schimbarea trendului.'] },
    chand:{ ic:'🕯', short:'Chandelier', what:'Stop mobil agățat de cel mai mare maxim pe 22 de zile, minus 3×ATR. Te ține în trend și te scoate când se întoarce.',
      how:['Cât timp prețul e peste linia long, trendul în sus e valid.','Folosește linia ca Stop Loss mobil.','Mut-o în fiecare zi, doar în direcția tranzacției.','Ieși când prețul închide dincolo de linie.'] },
    ema921:{ ic:'⚡', short:'EMA 9/21', what:'Varianta rapidă a strategiei de trend: încrucișarea mediilor de 9 și 21 de zile arată impulsul pe termen scurt.',
      how:['EMA9 trece peste EMA21 = impuls în sus; sub = în jos.','Intrare la prima retragere spre EMA21 după încrucișare.','SL puțin dincolo de EMA21.','Mai sigur când e în aceeași direcție cu EMA200.'] }
  };
  var goldStrat = 'all';
  try{ goldStrat = localStorage.getItem('byzyp_gstrat') || 'all'; }catch(e){}
  function renderStratPage(){
    var el = document.getElementById('sxDetail'); if(!el || !gold) return;
    document.querySelectorAll('.sx-chip').forEach(function(c){ c.classList.toggle('on', c.getAttribute('data-sx') === goldStrat); });
    if(goldStrat === 'all'){ el.innerHTML = goldAllHtml; bindStratList(el); return; }
    var x = (gold.strategies || []).filter(function(s){ return s.id === goldStrat; })[0];
    var G = SGUIDE[goldStrat] || { ic:'•', short:goldStrat, what:'', how:[] };
    if(!x){ el.innerHTML = '<div class="hint">Strategia apare la următoarea actualizare.</div>'; return; }
    var dots = ''; for(var k=0;k<3;k++) dots += k < x.strength ? '●' : '○';
    var vtxt = x.verdict === 'BUY' ? '🟢 Spune CUMPĂRARE' : x.verdict === 'SELL' ? '🔴 Spune VÂNZARE' : x.verdict === 'AȘTEAPTĂ' ? '⏳ Spune AȘTEAPTĂ' : '◻️ Neutru acum';
    var h = '<div class="sx-head"><div class="sx-ic">' + G.ic + '</div><div><div class="sx-t">' + x.name + '</div><div class="sx-v ' + x.verdict + '">' + vtxt + ' <span class="st-dots">' + dots + '</span></div></div></div>';
    h += '<div class="nar"><h4>📌 Ce spune acum</h4><p>' + x.why + (x.info ? ' ' + x.info : '') + '</p></div>';
    if(x.entry != null){
      h += '<div class="st-lv" style="margin-top:12px;"><div><b>' + f2(x.entry) + '</b><span>INTRARE</span></div><div class="slv"><b>' + f2(x.sl) + '</b><span>STOP LOSS</span></div><div class="tpv"><b>' + f2(x.tp1) + '</b><span>TP1</span></div><div class="tpv"><b>' + f2(x.tp2) + '</b><span>TP2</span></div></div>' +
        '<div class="sx-rr">Risc ' + f2(Math.abs(x.entry - x.sl)) + ' $/uncie · R:R până la TP1 1:' + x.rr + '</div>' +
        '<div class="ch-wrap" id="sxChart" style="margin-top:10px;"></div>';
    }
    var myT = (gold.ptrades || []).filter(function(t){ return t.sid === goldStrat; }).slice().reverse();
    h += '<div class="nar"><h4>📊 Cum a mers strategia asta (tranzacții de test)</h4>' + ptStatsBox((gold.pstats || {})[goldStrat]) +
      (myT.length ? hxHtml('st-' + goldStrat, 'tranzacțiile strategiei (' + myT.length + ')', myT.slice(0, 8).map(function(t){ return ptRow(t, false); }).join('')) : '') + '</div>';
    h += '<div class="nar"><h4>' + G.ic + ' Ce e strategia asta</h4><p>' + G.what + '</p></div>';
    h += '<div class="nar plan"><h4>🧭 Cum o folosești, pas cu pas</h4>' + G.how.map(function(t, i){ return '<p>' + (i+1) + '. ' + t + '</p>'; }).join('') + '</div>';
    h += '<div class="hint">O singură strategie nu e suficientă: e mai sigur când mai multe spun același lucru (vezi verdictul din Plan).</div>';
    el.innerHTML = h;
    if(x.entry != null){
      var A = gold.atr || Math.abs(x.entry - x.sl);
      drawGoldChart('sxChart', { side:x.verdict, entry:x.entry, sl:x.sl, tp1:x.tp1, tp2:x.tp2, zone:[x.entry - 0.15*A, x.entry + 0.15*A] }, { tf: goldTf.sxChart || 'D1' });
    }
  }

  function ptRow(t, showName){
    var dd = new Date(t.date + 'T00:00:00');
    var res = '', cls = 'hs-open';
    if(t.closed && t.resultR != null){ cls = t.resultR > 0 ? 'hs-win' : 'hs-loss'; res = (t.resultR > 0 ? '+' : '') + t.resultR + 'R · ' + (t.pnlOz >= 0 ? '+' : '-') + '$' + Math.abs(t.pnlOz).toFixed(2); }
    else if(t.closed){ cls = 'hs-none'; res = 'expirată'; }
    else if(t.floatR != null){ res = 'acum ' + (t.floatR >= 0 ? '+' : '') + t.floatR + 'R'; }
    else res = 'așteaptă ' + f2(t.entry);
    if(!t.closed) res = '<span class="pt-live" data-side="' + t.side + '" data-entry="' + t.entry + '" data-sl="' + t.sl + '" data-tp1="' + t.tp1 + '" data-st="' + t.status + '">' + res + '</span>';
    var ic = t.closed ? (t.resultR == null ? '⏸' : t.resultR > 0 ? '✅' : '❌') : (t.status === 'în așteptare' ? '🕒' : '⏳');
    return '<div class="pt-r" data-tid="' + t.id + '"><div class="pt-l">' + (showName ? '<div class="pt-n">' + ((SGUIDE[t.sid] || {}).ic || '•') + ' ' + t.strat + '</div>' : '') +
      '<div class="pt-d">' + dd.getDate() + ' ' + monthShort[dd.getMonth()] + ' · <b class="' + (t.side === 'BUY' ? 'hs-win' : 'hs-loss') + '">' + t.side + '</b> ' + f2(t.entry) + ' · SL ' + f2(t.sl) + ' · TP ' + f2(t.tp1) + '</div>' +
      '<div class="pt-s">' + t.status + '</div></div><div class="pt-res ' + cls + '">' + ic + ' ' + res + '</div></div>';
  }
  function ptStatsBox(v){
    if(!v) return '<div class="hint" style="margin-top:0;">Încă nicio tranzacție de test pentru strategia asta. Robotul intră automat când strategia dă semnal BUY/SELL cu niveluri.</div>';
    return '<div class="hist-sum"><div><b>' + v.n + '</b><span>ÎNCHISE</span></div><div><b>' + (v.rate != null ? v.rate + '%' : '–') + '</b><span>CÂȘTIGATE</span></div>' +
      '<div><b class="' + (v.r >= 0 ? 'hs-win' : 'hs-loss') + '">' + (v.r >= 0 ? '+' : '') + v.r + 'R</b><span>TOTAL</span></div>' +
      '<div><b class="' + (v.oz >= 0 ? 'hs-win' : 'hs-loss') + '">' + (v.oz >= 0 ? '+' : '-') + '$' + Math.abs(v.oz).toFixed(0) + '</b><span>LA 0.01 LOT</span></div></div>' +
      '<div class="pt-meta">' + v.wins + ' câștigate · ' + v.losses + ' pierdute · ' + v.open + ' deschise · ' + v.pending + ' în așteptare' + (v.expired ? ' · ' + v.expired + ' expirate' : '') + '</div>';
  }
  var hxHtml = window.hxHtml;
  var goldAllHtml = '';
  function bindStratList(root){
    root.querySelectorAll('.st-h').forEach(function(h){ h.addEventListener('click', function(){ var st = h.parentNode; st.classList.toggle('open'); var nm = st.querySelector('.st-n').textContent; goldOpen[nm] = st.classList.contains('open'); }); });
  }
  var goldSeg = 'plan', goldLiveLoaded = false;
  try{ goldSeg = localStorage.getItem('byzyp_gseg') || 'plan'; }catch(e){}
  function loadGoldLive(){
    if(goldLiveLoaded) return; goldLiveLoaded = true;
    var el = document.getElementById('goldLive'); if(!el) return;
    var dark = document.documentElement.getAttribute('data-theme') !== 'light';
    el.innerHTML = '<div class="tradingview-widget-container" style="height:100%;width:100%"><div class="tradingview-widget-container__widget" style="height:100%;width:100%"></div></div>';
    var sc = document.createElement('script');
    sc.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js'; sc.async = true;
    sc.innerHTML = JSON.stringify({ autosize:true, symbol:'OANDA:XAUUSD', interval:'15', timezone:'Etc/UTC', theme: dark ? 'dark' : 'light', style:'1', locale:'ro',
      allow_symbol_change:true, hide_side_toolbar:false, withdateranges:true, details:false, calendar:false,
      studies:['STD;EMA','STD;RSI'], support_host:'https://www.tradingview.com' });
    el.firstChild.appendChild(sc);
  }
  function applyGoldSeg(){
    document.querySelectorAll('#goldSeg button').forEach(function(b){ b.classList.toggle('on', b.getAttribute('data-gs') === goldSeg); });
    document.querySelectorAll('[data-gsp]').forEach(function(c){ c.style.display = c.getAttribute('data-gsp') === goldSeg ? '' : 'none'; });
    if(goldSeg === 'live' && document.getElementById('view-gold').classList.contains('active')) loadGoldLive();
    if(goldSeg === 'photo' && typeof renderPhotoPane === 'function') renderPhotoPane();
  }
  document.querySelectorAll('#goldSeg button').forEach(function(b){ b.addEventListener('click', function(){
    goldSeg = b.getAttribute('data-gs'); try{ localStorage.setItem('byzyp_gseg', goldSeg); }catch(e){}
    applyGoldSeg(); redrawLiveCharts();
  }); });
  document.querySelectorAll('.tab[data-view="gold"]').forEach(function(t){ t.addEventListener('click', function(){ setTimeout(function(){ applyGoldSeg(); fetchIntraday(); redrawLiveCharts(); }, 30); }); });

  var liveSpot = null, liveAt = 0, liveSrc = '', tickWs = null, tickMid = null, tickAt = 0, tickOff = null, tickPaint = 0, tickRetry = 0, tickTimer = null;
  function spotStale(j){ try{ var ds = j.data_state || {}, st = String(ds.status || '').toLowerCase();
      if(/^(stale|delayed|unavailable|closed|error|offline)$/.test(st)) return true;
      var ts = ds.as_of || ds.updated_at || j.as_of || j.updated_at || j.timestamp; if(ts){ var t = typeof ts === 'number' ? (ts > 1e11 ? ts : ts * 1000) : Date.parse(ts); if(t && Date.now() - t > 150000) return true; }
    }catch(e){} return false; }
  function setSpot(v, src){ if(!(v > 500 && v < 20000)) return; liveSpot = +v; liveAt = Date.now(); liveSrc = src;
    if(tickMid != null && Date.now() - tickAt < 20000){ var o = liveSpot - tickMid; tickOff = tickOff == null ? o : 0.6 * tickOff + 0.4 * o; }     // calibrate the per-second stream on the real spot quote
    paintLive(); }
  function fetchSpot(){      // a STALE quote is never used: if xaus.com says stale/delayed (or is old) we go to the next source
    fetch('https://xaus.com/api/v1/spot?compact=1', { cache:'no-store' }).then(function(r){ if(!r.ok) throw 0; return r.json(); }).then(function(j){
      var v = j.spot_usd_oz || (j.xau && j.xau.price); if(!v || spotStale(j)) throw 0; setSpot(v, 'xaus');
    }).catch(function(){
      fetch('https://api.gold-api.com/price/XAU', { cache:'no-store' }).then(function(r){ return r.json(); }).then(function(j){
        if(!(j && j.price)) throw 0; var t = j.updatedAt ? Date.parse(j.updatedAt) : 0; if(t && Date.now() - t > 240000) throw 0; setSpot(j.price, 'gold-api');
      }).catch(function(){
        fetch('https://api.binance.com/api/v3/ticker/price?symbol=PAXGUSDT', { cache:'no-store' }).then(function(r){ return r.json(); }).then(function(j){ if(j && j.price) setSpot(j.price, 'PAXG'); }).catch(function(){});
      });
    });
  }
  // second-by-second price: Binance PAXG (tokenised gold) order-book stream + the offset to the real spot quote
  function startTicks(){
    try{
      if(tickWs && (tickWs.readyState === 0 || tickWs.readyState === 1)) return;
      tickWs = new WebSocket('wss://stream.binance.com:9443/ws/paxgusdt@bookTicker');
      tickWs.onopen = function(){ tickRetry = 0; };
      tickWs.onmessage = function(ev){ try{ var d = JSON.parse(ev.data), b = +d.b, a = +d.a; if(!(b > 0 && a > 0)) return;
        tickMid = (b + a) / 2; tickAt = Date.now();
        if(tickOff == null && liveSpot != null) tickOff = liveSpot - tickMid;
        if(tickOff != null && Date.now() - tickPaint >= 900){ tickPaint = Date.now(); liveSpot = tickMid + tickOff; liveAt = Date.now(); liveSrc = 'live·PAXG'; paintLive(); } }catch(e){} };
      tickWs.onerror = function(){ try{ tickWs.close(); }catch(e){} };
      tickWs.onclose = function(){ tickWs = null; clearTimeout(tickTimer); if(!document.hidden) tickTimer = setTimeout(startTicks, Math.min(30000, 1500 * (++tickRetry))); };
    }catch(e){}
  }
  document.addEventListener('visibilitychange', function(){ if(document.hidden){ clearTimeout(tickTimer); try{ if(tickWs){ var w = tickWs; tickWs = null; w.onclose = null; w.close(); } }catch(e){} } else { fetchSpot(); startTicks(); } });
  function paintLvlNear(){
    var el = document.getElementById('lvlNear'); if(!el || !gold || !gold.watch) return;
    var p = liveSpot != null ? liveSpot : gold.price, best = null;
    gold.watch.levels.forEach(function(w){ var d = Math.abs(w.v - p); if(best === null || d < best.d) best = { d:d, w:w }; });
    if(!best){ el.textContent = ''; return; }
    var kind = p > best.w.v ? 'suport' : 'rezistență', near = best.d <= (gold.watch.appr || 0);
    el.innerHTML = 'Cel mai apropiat nivel: <b>' + (best.w.label && best.w.label !== 'PIVOT' ? best.w.label + ' · ' : '') + kind + ' ' + f2(best.w.v) + '</b> · la <b class="' + (near ? 'hs-loss' : '') + '">' + f2(best.d) + ' $</b>' + (near ? ' · 🔔 în zona de alertă' : '');
  }
  function paintLive(){
    if(!gold) return;
    paintLvlNear();
    var g = gold, prevClose = g.price - g.change;
    var p = liveSpot != null ? liveSpot : g.price;
    var ch = p - prevClose, pc = prevClose ? ch / prevClose * 100 : 0, up = ch >= 0;
    var el = document.getElementById('gdPrice'); if(el) el.textContent = f2(p);
    var c = document.getElementById('gdChg'); if(c){ c.className = 'gd-chg ' + (up ? 'pos' : 'neg'); c.textContent = (up?'+':'') + f2(ch) + ' (' + (up?'+':'') + pc.toFixed(2) + '%) azi'; }
    var tg = document.getElementById('gdLiveTag'); if(tg) tg.innerHTML = liveSpot != null ? '● LIVE' : '';
    var fr = document.getElementById('gdFresh');
    if(fr){
      var upd = new Date(g.updated), mins = Math.round((Date.now() - upd.getTime()) / 60000);
      var age = mins < 60 ? mins + ' min' : Math.floor(mins / 60) + ' h ' + (mins % 60) + ' min';
      var moved = liveSpot != null ? liveSpot - g.price : 0;
      var warn = liveSpot != null && Math.abs(moved) > 0.35 * (g.atr || 30);
      fr.className = 'gd-fresh' + (warn ? ' warn' : '');
      fr.innerHTML = (liveSpot != null ? ((Date.now() - tickAt < 5000 && tickOff != null) ? '⚡ Preț live la secundă (PAXG calibrat pe spot) · ' : 'Preț live (' + (liveSrc || 'spot') + ') actualizat acum ' + Math.max(0, Math.round((Date.now() - liveAt) / 1000)) + ' s · ') : '') +
        'Analiza (niveluri, strategii) calculată la ' + hhmm(upd) + ', acum ' + age + ' la prețul ' + f2(g.price) + '.' +
        (warn ? '<br>⚠️ Prețul s-a mișcat ' + (moved > 0 ? '+' : '') + f2(moved) + ' $ de atunci: unele niveluri pot fi deja depășite. Verifică pe Live înainte de orice intrare.' : '');
    }
    var mp = document.getElementById('gmPrice'); if(mp) mp.textContent = f2(p);
    // live P/L of active test trades (between robot runs)
    if(liveSpot != null) document.querySelectorAll('.pt-live').forEach(function(el){
      var buy = el.getAttribute('data-side') === 'BUY', en = +el.getAttribute('data-entry'), sl = +el.getAttribute('data-sl'), tp1 = +el.getAttribute('data-tp1'), st = el.getAttribute('data-st');
      var risk = Math.abs(en - sl) || 1, mv = buy ? liveSpot - en : en - liveSpot;
      if(st === 'în așteptare'){ var dist = Math.abs(liveSpot - en); el.innerHTML = '<span class="lv-dot"></span>la ' + f2(dist) + ' $ de intrare'; el.parentNode.className = 'pt-res hs-open'; return; }
      var r = /^TP1/.test(st) ? 0.5 * Math.abs(tp1 - en) / risk + 0.5 * Math.max(0, mv) / risk : mv / risk;
      el.innerHTML = '<span class="lv-dot"></span>live ' + (r >= 0 ? '+' : '') + r.toFixed(2) + 'R · ' + (mv >= 0 ? '+' : '−') + '$' + Math.abs(mv).toFixed(2);
      el.parentNode.className = 'pt-res ' + (r >= 0 ? 'hs-win' : 'hs-loss');
    });
    if(typeof renderPlanTiles === 'function' && document.getElementById('view-today') && document.getElementById('view-today').classList.contains('active')) renderPlanTiles();
  }
  fetchSpot(); setInterval(fetchSpot, 15000); setInterval(paintLive, 15000); startTicks();

  function activeTrades(){ return (gold && gold.ptrades || []).filter(function(t){ return !t.closed; }).slice().reverse(); }
  function activeEntriesHtml(max){
    var act = activeTrades();
    if(!act.length) return '<div class="hint" style="margin-top:0;">Nicio intrare activă acum. Când o strategie intră, apare aici și primești notificare.</div>';
    var open = act.filter(function(t){ return t.status !== 'în așteptare'; }), pend = act.length - open.length;
    return '<div class="ae-sum"><b>' + open.length + '</b> deschise · <b>' + pend + '</b> ordine în așteptare · atinge una ca s-o vezi pe grafic</div>' +
      act.slice(0, max || 8).map(function(t){ return ptRow(t, true); }).join('') +
      (act.length > (max || 8) ? '<div class="hint">+ încă ' + (act.length - (max || 8)) + ' în 🥇 Aur → Istoric</div>' : '');
  }
  function openOnly(){ return activeTrades().filter(function(t){ return t.status !== 'în așteptare'; }); }
  function renderOpenPane(){
    var el = document.getElementById('openPane'), cnt = document.getElementById('openCnt'); if(!el) return;
    var op = openOnly().slice().sort(function(a, b){ return String(b.opened || b.date).localeCompare(String(a.opened || a.date)); });
    if(cnt) cnt.textContent = op.length ? op.length : '';
    if(!op.length){ el.innerHTML = '<div class="card-title">⚡ Tranzacții deschise</div><div class="op-empty">Nicio tranzacție deschisă acum.<br><span>Când o strategie intră, apare aici pe loc și primești notificare cu intrarea, SL și TP.</span></div>'; return; }
    var p = liveSpot != null ? liveSpot : gold.price, totR = 0, totUsd = 0, buys = 0;
    op.forEach(function(t){ var risk = Math.abs(t.entry - t.sl) || 1, mv = t.side === 'BUY' ? p - t.entry : t.entry - p;
      var r = /^TP1/.test(t.status) ? 0.5 * Math.abs(t.tp1 - t.entry) / risk + 0.5 * Math.max(0, mv) / risk : mv / risk;
      totR += r; totUsd += /^TP1/.test(t.status) ? 0.5 * Math.abs(t.tp1 - t.entry) + 0.5 * Math.max(0, mv) : mv; if(t.side === 'BUY') buys++; });
    el.innerHTML = '<div class="card-title">⚡ Tranzacții deschise</div>' +
      '<div class="op-sum"><div><b>' + op.length + '</b><span>deschise</span></div><div><b class="up">' + buys + '</b><span>BUY</span></div><div><b class="dn">' + (op.length - buys) + '</b><span>SELL</span></div>' +
      '<div><b class="' + (totR >= 0 ? 'hs-win' : 'hs-loss') + '"><span class="lv-dot"></span>' + (totR >= 0 ? '+' : '') + totR.toFixed(2) + 'R</b><span>' + (totUsd >= 0 ? '+' : '−') + '$' + Math.abs(totUsd).toFixed(2) + ' la 0.01</span></div></div>' +
      op.map(function(t){ return ptRow(t, true); }).join('') +
      '<div class="hint">Doar tranzacțiile în care strategiile au intrat deja (fără ordinele în așteptare). Profitul se mișcă live cu prețul aurului. Atinge una ca s-o vezi pe grafic, cu intrarea, SL și TP.</div>';
    if(typeof paintLive === 'function') paintLive();
  }
  setInterval(function(){ if(goldSeg === 'open' && document.getElementById('view-gold') && document.getElementById('view-gold').classList.contains('active')) renderOpenPane(); }, 15000);
  function renderActiveEntries(){
    renderOpenPane();
    var a = document.getElementById('planActive'); if(a) a.innerHTML = '<div class="gd-sec">⏳ Intrările active acum</div>' + activeEntriesHtml(8);
    var b = document.getElementById('tradingGoldActive'); if(b) b.innerHTML = activeEntriesHtml(6);
    if(typeof paintLive === 'function') paintLive();
  }
  function drawPlanChart(){
    if(!gold || !document.getElementById('planChart')) return;
    var g = gold, v = (g.confluence || {}).verdict;
    var sc = (v === 'BUY' || v === 'SELL') ? g.scenarios.filter(function(x){ return x.side === v; })[0] : (g.scenarios.filter(function(x){ return x.main; })[0] || g.scenarios[0]);
    var mk = activeTrades().filter(function(t){ return t.status !== 'în așteptare'; }).slice(0, 6).map(function(t){
      return { t:t.side, p:t.entry, col: t.side === 'BUY' ? '#5FBF8F' : '#E0685C', ts: Math.floor(new Date(t.opened || (t.date + 'T00:00:00')).getTime() / 1000), d:t.date }; });
    drawGoldChart('planChart', sc, { tf: goldTf.planChart || '15m', plan:true, marks: mk });
    renderActiveEntries();
    var n = document.getElementById('planChartNote');
    if(n) n.textContent = (v === 'BUY' || v === 'SELL' ? 'Planul de azi: ' + (v === 'BUY' ? '🟢 BUY' : '🔴 SELL') : '⏳ Plan în așteptare, arăt scenariul ' + sc.side) +
      ' · zonă ' + f2(sc.zone[0]) + '–' + f2(sc.zone[1]) + ' · SL ' + f2(sc.sl) + ' · TP1 ' + f2(sc.tp1) + '. Lumânările se actualizează live, la fiecare minut; nivelurile se recalculează la fiecare 30 de minute. Săgețile ↑↓ arată nivelurile aflate în afara graficului.';
  }

  /* ===== trade sheet: the trade drawn on the chart ===== */
  var tdCurrent = null;
  function openTrade(id){
    var t = (gold && gold.ptrades || []).filter(function(x){ return x.id === id; })[0] || (window.__mt5Trades || {})[id]; if(!t) return;
    tdCurrent = id;
    var sh = document.getElementById('tdSheet');
    if(!sh){ sh = document.createElement('div'); sh.id = 'tdSheet'; sh.className = 'td-sheet'; document.body.appendChild(sh);
      sh.addEventListener('click', function(e){ if(e.target === sh || e.target.closest('.td-x')){ sh.classList.remove('open'); tdCurrent = null; } }); }
    var G = SGUIDE[t.sid] || { ic: t.sid === 'mt5' ? '📊' : '•' };
    var buy = t.side === 'BUY', risk = Math.abs(t.entry - t.sl) || 1;
    var p = liveSpot != null ? liveSpot : gold.price, mv = buy ? p - t.entry : t.entry - p;
    var liveTxt = t.closed ? (t.resultR != null ? 'Rezultat final: ' + (t.resultR >= 0 ? '+' : '') + t.resultR + 'R · ' + (t.pnlOz >= 0 ? '+' : '−') + '$' + Math.abs(t.pnlOz).toFixed(2) + ' la 0.01 lot' : 'Ordinul a expirat fără să se execute.') :
      t.status === 'în așteptare' ? 'Așteaptă prețul la ' + f2(t.entry) + ' · acum la ' + f2(Math.abs(p - t.entry)) + ' $ distanță' :
      'Acum: ' + (mv >= 0 ? '+' : '−') + '$' + Math.abs(mv).toFixed(2) + ' pe uncie · ' + (mv / risk >= 0 ? '+' : '') + (mv / risk).toFixed(2) + 'R';
    var op = t.opened ? new Date(t.opened) : new Date(t.date + 'T00:00:00');
    sh.innerHTML = '<div class="td-card"><button class="td-x" aria-label="Închide">✕</button>' +
      '<div class="td-h"><span class="td-side ' + t.side + '">' + t.side + '</span><div><div class="td-n">' + G.ic + ' ' + t.strat + '</div>' +
      '<div class="td-s">Intrat ' + op.getDate() + ' ' + monthShort[op.getMonth()] + (t.opened ? ' la ' + hhmm(op) : '') + ' · ' + t.status + '</div></div></div>' +
      '<div class="td-live ' + (t.closed ? (t.resultR > 0 ? 'hs-win' : 'hs-loss') : (mv >= 0 ? 'hs-win' : 'hs-loss')) + '">' + (t.closed ? '' : '<span class="lv-dot"></span>') + liveTxt + '</div>' +
      '<div class="ch-wrap" id="tdChart"></div>' +
      '<div class="st-lv" style="margin-top:10px;"><div><b>' + f2(t.entry) + '</b><span>intrare</span></div><div class="slv"><b>' + f2(t.sl) + '</b><span>stop loss</span></div><div class="tpv"><b>' + f2(t.tp1) + '</b><span>TP1</span></div><div class="tpv"><b>' + f2(t.tp2) + '</b><span>TP2</span></div></div>' +
      (function(){
        var bal = eqStart + trades.reduce(function(x, y){ return x + (y.result || 0); }, 0), fx = 1.08, d = Math.abs(t.entry - t.sl); if(!(bal > 0) || !(d > 0) || t.sid === 'mt5') return '';
        var lot = Math.floor(bal * fx * 0.02 / d) / 100, g1 = Math.abs(t.tp1 - t.entry);
        var marg = t.entry / 20 / fx;
        if(bal < marg) return '<div class="td-risk warn">❌ Marja pentru <b>0.01 lot</b> e ≈ <b>€' + marg.toFixed(0) + '</b> (levier 1:20 la aur, XTB). Cu <b>€' + bal.toFixed(2) + '</b> în cont nu poți deschide tranzacția. Dacă ai avea marjă: risc la SL ≈ €' + (d / fx).toFixed(2) + ', la TP1 ≈ +€' + (g1 / fx).toFixed(2) + '.</div>';
        return lot >= 0.01 ? '<div class="td-risk">💶 Pentru contul tău de <b>€' + bal.toFixed(2) + '</b> (risc 2%): <b>lot ' + lot.toFixed(2) + '</b> → risc ≈ €' + (lot * 100 * d / fx).toFixed(2) + ' · la TP1 ≈ +€' + (lot * 100 * g1 / fx).toFixed(2) + '</div>'
          : '<div class="td-risk warn">⚠️ Cu <b>€' + bal.toFixed(2) + '</b> în cont, chiar și <b>0.01 lot</b> riscă ≈ €' + (d / fx).toFixed(2) + ' (' + Math.round(d / fx / bal * 100) + '% din cont). SL-ul e la ' + d.toFixed(2) + ' $ de intrare: prea larg pentru contul tău. La TP1 ≈ +€' + (g1 / fx).toFixed(2) + '.</div>';
      })() +
      (t.exit != null && t.closed ? '<div class="hint">Ieșire la ' + f2(t.exit) + (t.closedDate ? ' pe ' + t.closedDate.slice(8) + '.' + t.closedDate.slice(5, 7) : '') + '.</div>' : '') +
      '<div class="hint">Pe grafic: punctul auriu = unde a intrat' + (t.closed ? ', punctul alb = unde a ieșit' : '') + '. Liniile: SL (roșu), TP1 și TP2 (verde). Linia LIVE e prețul de acum.</div></div>';
    sh.classList.add('open');
    drawTradeChart(t);
  }
  function drawTradeChart(t){
    var el = document.getElementById('tdChart'); if(!el) return;
    var fresh = (Date.now() - new Date(t.opened || (t.date + 'T00:00:00')).getTime()) < 2 * 86400000;
    if(!goldTf.tdChart || goldTf._tdFor !== t.id){ goldTf.tdChart = fresh ? '15m' : 'D1'; goldTf._tdFor = t.id; }
    var marks = [{ t:'INTRARE', p:t.entry, col:'var(--gold)', ts: Math.floor(new Date(t.opened || (t.date + 'T00:00:00')).getTime() / 1000), d:t.date }];
    if(t.closed && t.exit != null) marks.push({ t:'IEȘIRE', p:t.exit, col:'#F4EFE6', ts: t.closedDate ? Math.floor(new Date(t.closedDate + 'T20:00:00Z').getTime() / 1000) : Math.floor(Date.now() / 1000), d:t.closedDate || t.date });
    if(goldTf.tdChart !== 'D1') fetchIntraday();
    drawGoldChart('tdChart', { side:t.side, entry:t.entry, sl:t.sl, tp1:t.tp1, tp2:t.tp2, zone:[t.entry, t.entry] }, { tf: goldTf.tdChart, marks: marks });
  }
  document.addEventListener('click', function(e){
    var r = e.target.closest ? e.target.closest('.pt-r[data-tid]') : null; if(!r) return;
    openTrade(r.getAttribute('data-tid'));
  });

  /* ===== MT5 account (MetaApi → robot → Supabase 'mt5/state') ===== */
  var mt5State = null;
  function isGoldSym(sym){ return /XAU|GOLD/i.test(sym || ''); }
  function mt5Live(p){
    if(!isGoldSym(p.symbol) || liveSpot == null || p.price == null) return { profit:p.profit, price:p.price };
    var dir = p.side === 'BUY' ? 1 : -1;
    return { profit: p.profit + (liveSpot - p.price) * dir * p.volume * 100, price: liveSpot };
  }
  function renderMt5(){
    var el = document.getElementById('mt5Body'); if(!el) return;
    var S = mt5State;
    var card = document.getElementById('mt5Card');
    if(!S || !S.info){ if(card) card.style.display = 'none'; return; }
    if(card) card.style.display = '';
    var cur = S.info.currency === 'USD' ? '$' : (S.info.currency || '') + ' ';
    var money = function(v){ return (v >= 0 ? '+' : '−') + cur + Math.abs(v).toFixed(2); };
    var pos = S.positions || [], lives = pos.map(mt5Live), fl = lives.reduce(function(a, x){ return a + (x.profit || 0); }, 0);
    var eqLive = S.info.balance + fl;
    var at = S._at ? new Date(S._at) : null, ago = at ? Math.max(0, Math.round((Date.now() - at.getTime()) / 60000)) : null;
    window.__mt5Trades = {};
    var h = '<div class="mt5-top"><div><div class="mt5-l">Equity · live</div><div class="mt5-eq">' + cur + eqLive.toFixed(2) + '</div>' +
      '<div class="mt5-fl ' + (fl >= 0 ? 'hs-win' : 'hs-loss') + '">' + (pos.length ? money(fl) + ' în poziții deschise' : 'nicio poziție deschisă') + '</div></div>' +
      '<div class="mt5-mini"><div><span>Balanță</span><b>' + cur + S.info.balance.toFixed(2) + '</b></div><div><span>Marjă liberă</span><b>' + cur + (S.info.freeMargin != null ? S.info.freeMargin.toFixed(2) : '–') + '</b></div>' +
      (S.info.marginLevel != null && pos.length ? '<div><span>Nivel marjă</span><b class="' + (S.info.marginLevel < 150 ? 'hs-loss' : '') + '">' + S.info.marginLevel + '%</b></div>' : '<div><span>Levier</span><b>1:' + (S.info.leverage || '–') + '</b></div>') + '</div></div>';
    if(pos.length){
      h += '<div class="gd-sec">⏳ Poziții deschise</div>' + pos.map(function(p, i){
        var L = lives[i], tid = 'mt5-' + p.id, gold1 = isGoldSym(p.symbol);
        if(gold1) window.__mt5Trades[tid] = { id:tid, sid:'mt5', strat:'MT5 · ' + p.symbol + ' ' + p.volume + ' lot', side:p.side, entry:p.open, sl:p.sl || p.open, tp1:p.tp || p.open, tp2:p.tp || p.open,
          status:'deschisă', opened:p.time, date:(p.time || '').slice(0, 10), closed:false };
        return '<div class="pt-r"' + (gold1 ? ' data-tid="' + tid + '"' : '') + '><div class="pt-l"><div class="pt-t">' + p.symbol + ' <span class="' + (p.side === 'BUY' ? 'up' : 'dn') + '">' + p.side + '</span> ' + p.volume + '</div>' +
          '<div class="pt-meta">' + p.open + ' → ' + (L.price != null ? (gold1 ? f2(L.price) : L.price) : '–') + ' · SL ' + (p.sl || '<b class="hs-loss">lipsă</b>') + ' · TP ' + (p.tp || '–') + '</div></div>' +
          '<div class="pt-res ' + (L.profit >= 0 ? 'hs-win' : 'hs-loss') + '">' + (gold1 && liveSpot != null ? '<span class="lv-dot"></span>' : '') + money(L.profit) + '</div></div>';
      }).join('');
    }
    if((S.orders || []).length) h += '<div class="gd-sec">🕒 Ordine în așteptare</div>' + S.orders.map(function(o){
      return '<div class="pt-r"><div class="pt-l"><div class="pt-t">' + o.symbol + ' <span class="' + (o.side === 'BUY' ? 'up' : 'dn') + '">' + o.side + '</span> ' + o.volume + '</div><div class="pt-meta">la ' + o.price + ' · SL ' + (o.sl || '–') + ' · TP ' + (o.tp || '–') + '</div></div><div class="pt-res hs-open">în așteptare</div></div>'; }).join('');
    var cl = S.closed || [];
    if(cl.length){
      var mk = todayKey.slice(0, 7), mth = cl.filter(function(c){ return String(c.closeTime || '').slice(0, 7) === mk; });
      var mp = mth.reduce(function(a, c){ return a + (c.profit || 0); }, 0), mw = mth.filter(function(c){ return c.profit > 0; }).length;
      h += '<div class="mt5-stats"><div><b class="' + (mp >= 0 ? 'hs-win' : 'hs-loss') + '">' + money(mp) + '</b><span>luna asta</span></div><div><b>' + mth.length + '</b><span>tranzacții</span></div><div><b>' + (mth.length ? Math.round(mw / mth.length * 100) + '%' : '–') + '</b><span>pe plus</span></div></div>';
      h += hxHtml('mt5hist', 'istoricul MT5 (' + cl.length + ')', cl.slice(0, 25).map(function(c){
        var d = c.closeTime ? new Date(c.closeTime) : null;
        return '<div class="pt-r"><div class="pt-l"><div class="pt-t">' + c.symbol + ' <span class="' + (c.side === 'BUY' ? 'up' : 'dn') + '">' + c.side + '</span> ' + c.volume + '</div><div class="pt-meta">' + (d ? d.getDate() + ' ' + monthShort[d.getMonth()] + ' ' + hhmm(d) + ' · ' : '') + (c.open || '–') + ' → ' + c.close + ' · ' + (c.reason === 'TP' ? 'TP atins' : c.reason === 'SL' ? 'SL atins' : c.reason) + '</div></div><div class="pt-res ' + (c.profit >= 0 ? 'hs-win' : 'hs-loss') + '">' + money(c.profit) + '</div></div>'; }).join(''));
    }
    h += '<div class="hint">' + (S.info.broker ? S.info.broker + ' · ' : '') + (S.info.login ? 'cont ' + S.info.login + ' · ' : '') + 'actualizat de robot ' + (ago != null ? (ago < 1 ? 'acum' : 'acum ' + ago + ' min') : '') + (pos.some(function(p){ return isGoldSym(p.symbol); }) ? ' · profitul pe aur se mișcă live cu prețul' : '') + '. Atinge o poziție pe aur ca s-o vezi pe grafic.</div>';
    el.innerHTML = h;
  }
  setInterval(function(){ if(mt5State && document.getElementById('view-money') && document.getElementById('view-money').classList.contains('active')) renderMt5(); }, 15000);
  function openTradingFromLink(){
    if(!/trading/.test(location.hash)) return;
    var t = document.querySelector('.tab[data-view="money"]'); if(t) t.click();
    setTimeout(function(){ var b = document.querySelector('[data-seg="trading"]'); if(b) b.click(); }, 150);
  }
  window.addEventListener('hashchange', openTradingFromLink);
  setTimeout(openTradingFromLink, 1500);

  /* ===== 📸 Poză: analiză AI a unei capturi de grafic (Supabase Edge Function → Claude vision) ===== */
  var shotHist = [], photoSt = { busy:false, err:null, setup:false, img:null, res:null, ctx:'', fromHist:null, tg:{ lv:true, us:true, sc:true } };
  var PH_FN = 'https://bskujbfaynbeqjonqydb.supabase.co/functions/v1/analyze-chart', PH_KEY = 'sb_publishable_iFv52BsojpLXTxuBzqGU1Q_cCFVZUAX';
  function phNum(v){ return (v == null || v === '' || isNaN(+v)) ? null : +v; }
  function phEsc(t){ return String(t == null ? '' : t).replace(/[&<>]/g, function(c){ return { '&':'&amp;', '<':'&lt;', '>':'&gt;' }[c]; }); }
  function phIsGold(r){ return /XAU|GOLD|AUR/i.test((r && r.symbol) || '') || (r && !r.symbol && r.price_now > 1500 && r.price_now < 9000); }
  function phBalance(){ try{ return eqStart + trades.reduce(function(a, t){ return a + (t.result || 0); }, 0); }catch(e){ return 0; } }
  function phMoney(entry, sl, tp1){            // risk 2% of YOUR trading balance, XTB gold 1:20
    var bal = phBalance(), fx = 1.08, d = Math.abs(entry - sl), g = tp1 != null ? Math.abs(tp1 - entry) : null;
    if(!(bal > 0) || !(d > 0)) return '';
    var marg = entry / 20 / fx;
    if(bal < marg) return '<div class="td-risk warn">❌ Cu <b>€' + bal.toFixed(2) + '</b> nu poți deschide nici 0.01 lot (marja ≈ €' + marg.toFixed(0) + '). Risc la SL ≈ €' + (d / fx).toFixed(2) + (g != null ? ', la TP ≈ +€' + (g / fx).toFixed(2) : '') + '.</div>';
    var lot = Math.floor(bal * fx * 0.02 / d) / 100;
    if(lot >= 0.01) return '<div class="td-risk">💶 Pentru <b>€' + bal.toFixed(2) + '</b> (risc 2%): <b>lot ' + lot.toFixed(2) + '</b> → risc ≈ €' + (lot * 100 * d / fx).toFixed(2) + (g != null ? ' · la TP ≈ +€' + (lot * 100 * g / fx).toFixed(2) : '') + '</div>';
    return '<div class="td-risk warn">⚠️ Cu <b>€' + bal.toFixed(2) + '</b>, chiar și 0.01 lot riscă ≈ €' + (d / fx).toFixed(2) + ' (' + Math.round(d / fx / bal * 100) + '% din cont)' + (g != null ? '; la TP ≈ +€' + (g / fx).toFixed(2) : '') + '.</div>';
  }
  function phShrink(file, cb){
    var fr = new FileReader();
    fr.onerror = function(){ cb('Nu pot citi fișierul.'); };
    fr.onload = function(){ var im = new Image(); im.onerror = function(){ cb('Nu pot citi imaginea. Încearcă o captură de ecran (PNG sau JPEG).'); };
      im.onload = function(){
        var k = Math.min(1, 1568 / Math.max(im.width, im.height)), w = Math.max(1, Math.round(im.width * k)), h = Math.max(1, Math.round(im.height * k));
        var cv = document.createElement('canvas'); cv.width = w; cv.height = h; var cx = cv.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, w, h); cx.drawImage(im, 0, 0, w, h);
        var k2 = Math.min(1, 640 / Math.max(w, h)), c2 = document.createElement('canvas'); c2.width = Math.round(w * k2); c2.height = Math.round(h * k2); c2.getContext('2d').drawImage(cv, 0, 0, c2.width, c2.height);
        cb(null, { full: cv.toDataURL('image/jpeg', 0.85), thumb: c2.toDataURL('image/jpeg', 0.6), w:w, h:h });
      }; im.src = fr.result; };
    fr.readAsDataURL(file);
  }
  function phContext(userText){
    var out = ['Contul utilizatorului: ~€' + phBalance().toFixed(2) + ' (jurnalul de trading), risc dorit 2% pe tranzacție, broker XTB (aur: levier 1:20, 0.01 lot = 1 uncie).'];
    if(userText) out.push('Ce spune utilizatorul: ' + userText);
    try{ if(gold){ var c = gold.confluence || {}, L = gold.levels || {}, T = gold.trend || {};
      out.push('Analiza aplicației pe XAUUSD (doar pentru comparație, dacă poza e cu aur): preț acum ' + f2(liveSpot != null ? liveSpot : gold.price) + ', verdict ' + (c.verdict || gold.bias) + ' (BUY ' + (c.buyN || 0) + ' / SELL ' + (c.sellN || 0) + '), suporturi S1 ' + L.S1 + ', S2 ' + L.S2 + ', rezistențe R1 ' + L.R1 + ', R2 ' + L.R2 + '.' +
        (T.sup ? ' Linie de trend suport ' + T.sup.now + '.' : '') + (T.res ? ' Linie de trend rezistență ' + T.res.now + '.' : '')); } }catch(e){}
    return out.join('\n');
  }
  function phFail(msg, setup){ photoSt.busy = false; photoSt.err = msg; photoSt.setup = !!setup; renderPhotoPane(); }
  function runPhotoAnalysis(){
    var st = photoSt; if(!st.img) return;
    st.busy = true; st.err = null; st.setup = false; st.res = null; st.fromHist = null; renderPhotoPane();
    var sbc = window.__sb; if(!sbc || !sbc.auth) return phFail('Analiza din poză cere cont online. Intră în cont și încearcă din nou.');
    sbc.auth.getSession().then(function(r){
      var tok = r && r.data && r.data.session && r.data.session.access_token; if(!tok) throw { msg:'Intră în cont ca să poți folosi analiza din poză.' };
      return fetch(PH_FN, { method:'POST', headers:{ 'Content-Type':'application/json', Authorization:'Bearer ' + tok, apikey:PH_KEY },
        body: JSON.stringify({ image: st.img.full.split(',')[1], mime:'image/jpeg', context: phContext(st.ctx) }) });
    }).then(function(resp){
      return resp.json().catch(function(){ return {}; }).then(function(j){
        if(resp.status === 404) throw { msg:'Funcția „analyze-chart” nu e creată încă în Supabase.', setup:true };
        if(!resp.ok || j.error) throw { msg: j.error || ('Eroare ' + resp.status), setup: j.code === 'nokey' };
        return j; });
    }).then(function(j){
      st.busy = false; st.res = j.result || { ok:false, reason:'Răspuns gol.' };
      if(st.res.ok) phSave(); renderPhotoPane();
    }).catch(function(e){ phFail((e && e.msg) || 'Aplicația nu ajunge la funcția „analyze-chart” din Supabase. De obicei înseamnă că funcția nu e creată încă sau că are pornit „Verify JWT”.', !(e && e.msg)); });
  }
  function phSave(){
    var st = photoSt, id = String(Date.now()), rec = { ts:Date.now(), thumb: st.img.thumb, res: st.res, ctx: st.ctx || '' };
    shotHist.unshift(Object.assign({ id:id }, rec));
    try{ chainWrite('shots/' + id, function(){ return db.doc('shots/' + id).set(rec); }); }catch(e){}
    shotHist.slice(25).forEach(function(x){ try{ db.doc('shots/' + x.id).delete(); }catch(e){} });
    shotHist = shotHist.slice(0, 25);
  }
  // price → y (fraction of image height): linear fit on the axis labels the AI read; fallback to the AI's own y
  function phYFn(r){
    var ax = (r.axis || []).filter(function(a){ return a && isFinite(a.y) && isFinite(a.price); }); if(ax.length < 2) return null;
    var n = ax.length, sx = 0, sy = 0, sxx = 0, sxy = 0; ax.forEach(function(a){ sx += a.price; sy += a.y; sxx += a.price * a.price; sxy += a.price * a.y; });
    var den = n * sxx - sx * sx; if(Math.abs(den) < 1e-9) return null;
    var m = (n * sxy - sx * sy) / den, c = (sy - m * sx) / n, worst = 0; ax.forEach(function(a){ worst = Math.max(worst, Math.abs(a.y - (m * a.price + c))); });
    return (worst < 0.03 && Math.abs(m) > 1e-9) ? function(pr){ return m * pr + c; } : null;
  }
  function phOverlay(r, ratio){
    var Yf = phYFn(r), items = [], lines = '';
    var Y = function(pr, fy){ var v = Yf && pr != null ? Yf(pr) : phNum(fy); return (v == null || v < 0.005 || v > 0.995) ? null : v; };
    (r.levels || []).forEach(function(l){ var pr = phNum(l.price), y = Y(pr, l.y); if(y == null || pr == null) return;
      items.push({ y:y, t:(l.type === 'support' ? 'S ' : 'R ') + pr, c: l.type === 'support' ? 'sup' : 'res', g:'lv', d:0 }); });
    var u = r.user_trade; if(u && u.found){ [['entry', 'INTRARE ', 'ent'], ['sl', 'SL ', 'slx'], ['tp', 'TP ', 'tpx']].forEach(function(a){ var pr = phNum(u[a[0]]), y = Y(pr, u[a[0] + '_y']); if(y != null && pr != null) items.push({ y:y, t:a[1] + pr, c:a[2], g:'us', d:0 }); }); }
    var sc = r.scenario; if(sc && sc.side && sc.side !== 'WAIT'){ [['entry', 'PLAN ', 'ent'], ['sl', 'SL ', 'slx'], ['tp1', 'TP1 ', 'tpx'], ['tp2', 'TP2 ', 'tpx']].forEach(function(a){ var pr = phNum(sc[a[0]]), y = Yf && pr != null ? Yf(pr) : null; if(y != null && y > 0.005 && y < 0.995) items.push({ y:y, t:a[1] + pr, c:a[2], g:'sc', d:1 }); }); }
    items.forEach(function(it){ lines += '<line class="g-' + it.g + ' ph-ln ' + it.c + '" x1="0" x2="100" y1="' + (it.y * 100).toFixed(2) + '" y2="' + (it.y * 100).toFixed(2) + '"' + (it.d ? ' stroke-dasharray="3 2"' : '') + '/>'; });
    (r.trendlines || []).slice(0, 2).forEach(function(t){ var a = t.a, b = t.b; if(!a || !b || !isFinite(a.x) || !isFinite(b.x) || Math.abs(b.x - a.x) < 0.02) return;
      var sl = (b.y - a.y) / (b.x - a.x), y0 = a.y - sl * a.x, y1 = a.y + sl * (1 - a.x);
      lines += '<line class="g-lv ph-ln tl ' + (t.type === 'support' ? 'sup' : 'res') + '" x1="0" y1="' + (y0 * 100).toFixed(2) + '" x2="100" y2="' + (y1 * 100).toFixed(2) + '"/>'; });
    var gap = 15 / (320 * (ratio || 1.4)) * 100, sorted = items.slice().sort(function(a, b){ return a.y - b.y; }), last = -9;
    sorted.forEach(function(it){ var py = it.y * 100; if(py < last + gap) py = last + gap; it.py = py; last = py; });
    var lbls = sorted.map(function(it){ return '<span class="ph-lb g-' + it.g + ' ' + it.c + '" style="top:' + it.py.toFixed(2) + '%">' + phEsc(it.t) + '</span>'; }).join('');
    return '<svg class="ph-svg" viewBox="0 0 100 100" preserveAspectRatio="none">' + lines + '</svg><div class="ph-lbs">' + lbls + '</div>';
  }
  function phList(a, ic){ return (a && a.length) ? '<ul class="ph-ul">' + a.slice(0, 5).map(function(x){ return '<li>' + ic + ' ' + phEsc(x) + '</li>'; }).join('') + '</ul>' : ''; }
  function phResultHtml(r, src, ratio){
    var gold1 = phIsGold(r), h = '';
    var trTxt = r.trend === 'up' ? '↗ trend urcător' : r.trend === 'down' ? '↘ trend coborâtor' : '↔ în interval';
    h += '<div class="ph-head"><b>' + phEsc(r.symbol || 'Grafic') + (r.timeframe ? ' · ' + phEsc(r.timeframe) : '') + '</b>' + (r.price_now != null ? '<span>' + phEsc(r.price_now) + '</span>' : '') + '<i class="ph-tr ' + (r.trend || '') + '">' + trTxt + '</i></div>';
    h += '<div class="ph-tg"><button data-tg="lv" class="on">📍 Niveluri</button><button data-tg="us" class="on">🧾 Ce am făcut</button><button data-tg="sc" class="on">🧭 Plan</button></div>';
    h += '<div class="ph-wrap"><img class="ph-img" src="' + src + '" alt="captura ta">' + phOverlay(r, ratio) + '</div>';
    h += '<div class="ph-sum">' + phEsc(r.summary || r.trend_text || '') + '</div>';
    var u = r.user_trade;
    h += '<div class="ph-card"><div class="ph-h">🧾 Ce ai făcut</div>';
    if(u && u.found){
      var en = phNum(u.entry), sl = phNum(u.sl), tp = phNum(u.tp), risk = en != null && sl != null ? Math.abs(en - sl) : null, rew = en != null && tp != null ? Math.abs(tp - en) : null;
      h += '<div class="ph-vals"><span class="td-side ' + (u.side === 'SELL' ? 'SELL' : 'BUY') + '">' + phEsc(u.side || '?') + '</span>' +
        '<div><span>intrare</span><b>' + (en != null ? en : '–') + '</b></div><div><span>SL</span><b class="hs-loss">' + (sl != null ? sl : 'lipsă') + '</b></div><div><span>TP</span><b class="hs-win">' + (tp != null ? tp : 'lipsă') + '</b></div>' +
        (risk && rew ? '<div><span>risc : câștig</span><b>1 : ' + (rew / risk).toFixed(1) + '</b></div>' : '') + '</div>';
      if(u.verdict) h += '<div class="ph-vd ' + phEsc(u.verdict) + '">Verdict: ' + phEsc(u.verdict) + '</div>';
      h += '<div class="ph-tx">' + phEsc(u.comment || '') + '</div>' + phList(u.good, '✅') + phList(u.problems, '⚠️');
      if(gold1 && en != null && sl != null) h += phMoney(en, sl, tp);
    } else h += '<div class="ph-tx dim">Nu văd nicio tranzacție desenată pe poză (intrare, SL sau TP). Desenează-le pe grafic și trimite din nou, ca să ți le evaluez.</div>';
    h += '</div>';
    var sc = r.scenario;
    if(sc && sc.side){
      h += '<div class="ph-card"><div class="ph-h">🧭 Scenariu propus</div><div class="ph-vals"><span class="td-side ' + (sc.side === 'SELL' ? 'SELL' : sc.side === 'BUY' ? 'BUY' : 'WAIT') + '">' + phEsc(sc.side === 'WAIT' ? 'AȘTEAPTĂ' : sc.side) + '</span>' +
        (sc.side !== 'WAIT' ? '<div><span>intrare</span><b>' + (phNum(sc.entry) != null ? sc.entry : '–') + '</b></div><div><span>SL</span><b class="hs-loss">' + (phNum(sc.sl) != null ? sc.sl : '–') + '</b></div><div><span>TP1</span><b class="hs-win">' + (phNum(sc.tp1) != null ? sc.tp1 : '–') + '</b></div>' + (phNum(sc.tp2) != null ? '<div><span>TP2</span><b class="hs-win">' + sc.tp2 + '</b></div>' : '') : '') + '</div>' +
        '<div class="ph-tx">' + phEsc(sc.why || '') + '</div>' + (sc.invalid_if ? '<div class="ph-tx dim">❌ Nu mai e valabil dacă: ' + phEsc(sc.invalid_if) + '</div>' : '');
      if(gold1 && sc.side !== 'WAIT' && phNum(sc.entry) != null && phNum(sc.sl) != null) h += phMoney(+sc.entry, +sc.sl, phNum(sc.tp1));
      try{ if(gold1 && gold && sc.side !== 'WAIT'){ var av = (gold.confluence || {}).verdict; if(av === 'BUY' || av === 'SELL') h += '<div class="ph-cmp ' + (av === sc.side ? 'ok' : 'no') + '">' + (av === sc.side ? '✅ Se potrivește cu analiza aplicației: majoritatea strategiilor spun ' + av + '.' : '⚠️ Aplicația spune altceva: majoritatea strategiilor spun ' + av + '. Gândește-te de două ori.') + '</div>'; } }catch(e){}
      h += '</div>';
    }
    var lv = (r.levels || []);
    if(lv.length || (r.patterns || []).length) h += '<div class="ph-card"><div class="ph-h">📍 Ce văd pe grafic</div>' +
      lv.map(function(l){ return '<div class="ph-lv ' + (l.type === 'support' ? 'sup' : 'res') + '"><b>' + (l.type === 'support' ? 'Suport' : 'Rezistență') + ' ' + phEsc(l.price) + '</b><span>' + phEsc(l.note || '') + '</span></div>'; }).join('') +
      ((r.patterns || []).length ? '<div class="ph-chips">' + r.patterns.slice(0, 5).map(function(x){ return '<i>' + phEsc(x) + '</i>'; }).join('') + '</div>' : '') + '</div>';
    if((r.risks || []).length) h += '<div class="ph-card"><div class="ph-h">⚠️ Atenție</div>' + phList(r.risks, '•') + '</div>';
    h += '<div class="hint">Analiză făcută de AI din poză: poate citi greșit un preț sau o linie. Verifică întotdeauna pe grafic. Nu e sfat financiar, iar decizia rămâne a ta.</div>';
    return h;
  }
  function renderPhotoPane(){
    var el = document.getElementById('photoPane'); if(!el) return;
    var st = photoSt, h = '<div class="card-title">📸 Analiză din poză</div>';
    if(st.busy){
      el.innerHTML = h + '<div class="ph-busy"><div class="ph-spin"></div><div>Analizez poza…<br><span>de obicei 10–25 de secunde</span></div></div>' + (st.img ? '<img class="ph-img dim" src="' + st.img.full + '" alt="">' : ''); return; }
    if(st.res && st.res.ok){
      var src = st.fromHist ? st.fromHist.thumb : (st.img && st.img.full), ratio = st.img ? st.img.h / st.img.w : 1.8;
      el.innerHTML = h + '<div class="ph-actions"><button class="ghost-btn" id="phNew">← Poză nouă</button>' + (st.fromHist ? '<button class="ghost-btn" id="phDel" style="color:var(--danger);">🗑️ Șterge</button>' : '') + '</div>' + phResultHtml(st.res, src, ratio);
      var wrap = el.querySelector('.ph-wrap'); if(wrap) wrap.setAttribute('data-off', ['lv', 'us', 'sc'].filter(function(k){ return !st.tg[k]; }).join(' '));
      el.querySelectorAll('.ph-tg button').forEach(function(b){ var k = b.getAttribute('data-tg'); b.classList.toggle('on', !!st.tg[k]);
        b.addEventListener('click', function(){ st.tg[k] = !st.tg[k]; b.classList.toggle('on', st.tg[k]); if(wrap) wrap.setAttribute('data-off', ['lv', 'us', 'sc'].filter(function(x){ return !st.tg[x]; }).join(' ')); }); });
      document.getElementById('phNew').addEventListener('click', function(){ st.res = null; st.fromHist = null; st.img = null; renderPhotoPane(); });
      var dl = document.getElementById('phDel'); if(dl) dl.addEventListener('click', function(){ var id = st.fromHist.id; if(!confirm('Ștergi această analiză?')) return;
        try{ db.doc('shots/' + id).delete(); }catch(e){} shotHist = shotHist.filter(function(x){ return x.id !== id; }); st.res = null; st.fromHist = null; renderPhotoPane(); });
      return;
    }
    h += '<div class="hint" style="margin-top:0;">Alege o captură de ecran cu graficul (TradingView, MT5, XTB). AI-ul citește graficul, marchează nivelurile, îți <b>evaluează tranzacția</b> dacă ai desenat intrarea, SL și TP, și îți propune un scenariu, cu riscul pe contul tău.</div>';
    if(st.res && !st.res.ok) h += '<div class="td-risk warn">⚠️ ' + phEsc(st.res.reason || 'Nu am găsit un grafic de preț în poză.') + '</div>';
    if(st.err) h += '<div class="td-risk warn">⚠️ ' + phEsc(st.err) + (st.setup ? '<br>Analiza din poză trebuie activată o singură dată în Supabase: funcția „analyze-chart” + secretul ANTHROPIC_API_KEY. Deschide în Safari adresa funcției ca să vezi ce lipsește.' : '') + '</div>';
    h += '<textarea id="phCtx" class="ph-ta" rows="3" placeholder="Opțional: ce ai făcut sau ce vrei să verifici (ex. am intrat BUY la 4300, SL 4285)">' + phEsc(st.ctx) + '</textarea>';
    h += '<label class="primary-btn ph-pick">📸 Alege captura<input type="file" accept="image/*" id="phFile" hidden></label>';
    if(shotHist.length) h += hxHtml('shotHist', 'analizele tale (' + shotHist.length + ')', shotHist.map(function(x){ var d = new Date(x.ts), r = x.res || {}, sc = r.scenario || {};
      return '<div class="ph-row" data-sid="' + x.id + '"><img src="' + x.thumb + '" alt=""><div><b>' + phEsc(r.symbol || 'Grafic') + (r.timeframe ? ' · ' + phEsc(r.timeframe) : '') + '</b><span>' + d.getDate() + ' ' + monthShort[d.getMonth()] + ' ' + hhmm(d) +
        (sc.side ? ' · plan ' + phEsc(sc.side) : '') + (r.user_trade && r.user_trade.found ? ' · ' + phEsc(r.user_trade.side || '') + ' evaluat' : '') + '</span></div></div>'; }).join(''));
    el.innerHTML = h;
    var inp = document.getElementById('phFile'), ta = document.getElementById('phCtx');
    if(ta) ta.addEventListener('input', function(){ st.ctx = ta.value; });
    if(inp) inp.addEventListener('change', function(){ var f = inp.files && inp.files[0]; if(!f) return; st.ctx = ta ? ta.value : st.ctx; st.err = null;
      phShrink(f, function(err, img){ if(err) return phFail(err); st.img = img; runPhotoAnalysis(); }); });
    el.querySelectorAll('.ph-row').forEach(function(r){ r.addEventListener('click', function(){ var x = shotHist.filter(function(s){ return s.id === r.getAttribute('data-sid'); })[0]; if(!x) return;
      st.res = x.res; st.fromHist = x; st.img = null; renderPhotoPane(); }); });
  }
  window.__openPhoto = function(){ if(!window.SHOW_GOLD) return; var t = document.querySelector('.tab[data-view="gold"]'); if(t) t.click(); setTimeout(function(){ var b = document.querySelector('#goldSeg [data-gs="photo"]'); if(b) b.click(); }, 80); };

  /* ===== ⟠ Ethereum: live per second (Binance stream), smooth chart, and how much YOUR money grew ===== */
  var eth = { pos:null, live:null, ch24:null, open24:null, hi24:null, lo24:null, range:'1L', pts:[], err:null, edit:false, tLive:0, tChart:0, busy:false, ws:null, wsAt:0, wsPaint:0, wsRetry:0, wsTimer:null, shown:null };
  var ETH_R = { '1Z':{ iv:'15m', n:96, cg:1, l:'1 zi' }, '7Z':{ iv:'1h', n:168, cg:7, l:'7 zile' }, '1L':{ iv:'4h', n:180, cg:30, l:'1 lună' }, '3L':{ iv:'1d', n:90, cg:90, l:'3 luni' }, '1A':{ iv:'1d', n:365, cg:365, l:'1 an' } };
  try{ var _rg = safeGet('reset_eth_range_v1'); if(_rg && ETH_R[_rg]) eth.range = _rg; }catch(e){}
  function ethJson(url){ return fetch(url, { cache:'no-store' }).then(function(r){ if(!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }); }
  function ethEur(v, d){ if(v == null || isNaN(v)) return '–'; return '€' + Number(v).toLocaleString('ro-RO', { minimumFractionDigits: d == null ? 2 : d, maximumFractionDigits: d == null ? 2 : d }); }
  function ethSgn(v, d){ return (v >= 0 ? '+' : '−') + ethEur(Math.abs(v), d); }
  function ethLive(){
    return ethJson('https://api.binance.com/api/v3/ticker/24hr?symbol=ETHEUR').then(function(j){ return { p:+j.lastPrice, ch:+j.priceChangePercent, open:+j.openPrice, hi:+j.highPrice, lo:+j.lowPrice }; })
      .catch(function(){ return ethJson('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=eur&include_24hr_change=true').then(function(j){ return { p:+j.ethereum.eur, ch:+j.ethereum.eur_24h_change }; }); });
  }
  function ethSeries(rk){ var R = ETH_R[rk];
    return ethJson('https://api.binance.com/api/v3/klines?symbol=ETHEUR&interval=' + R.iv + '&limit=' + R.n).then(function(a){ return a.map(function(k){ return [k[0], +k[4]]; }); })
      .catch(function(){ return ethJson('https://api.coingecko.com/api/v3/coins/ethereum/market_chart?vs_currency=eur&days=' + R.cg).then(function(j){ return j.prices.map(function(x){ return [x[0], +x[1]]; }); }); });
  }
  function ethPriceOn(dateStr){      // daily open of that day (UTC); today → live price
    if(dateStr >= dateKey(new Date())) return Promise.resolve(eth.live);
    var t = Date.parse(dateStr + 'T00:00:00Z');
    return ethJson('https://api.binance.com/api/v3/klines?symbol=ETHEUR&interval=1d&startTime=' + t + '&limit=1').then(function(a){ if(!a.length) throw 0; return +a[0][1]; })
      .catch(function(){ var d = dateStr.split('-'); return ethJson('https://api.coingecko.com/api/v3/coins/ethereum/history?date=' + d[2] + '-' + d[1] + '-' + d[0]).then(function(j){ return +j.market_data.current_price.eur; }); });
  }
  function ethRefresh(force){
    var now = Date.now(); if(eth.busy && !force) return;
    var needLive = force || now - eth.tLive > 15000, needChart = force || !eth.pts.length || now - eth.tChart > 60000; if(!needLive && !needChart) return;
    eth.busy = true; var rk = eth.range;
    var pl = needLive ? ethLive().then(function(x){ eth.live = x.p; eth.ch24 = x.ch; if(x.open > 0){ eth.open24 = x.open; eth.hi24 = x.hi; eth.lo24 = x.lo; } eth.tLive = Date.now(); }) : Promise.resolve();
    var pc = needChart ? ethSeries(rk).then(function(pts){ if(rk === eth.range){ eth.pts = pts; eth.tChart = Date.now(); } }) : Promise.resolve();
    Promise.all([pl.catch(function(e){ return { e:e }; }), pc.catch(function(e){ return { e:e }; })]).then(function(r){
      eth.busy = false; var bad = r.filter(function(x){ return x && x.e; });
      eth.err = (!eth.live && bad.length) ? 'Nu pot lua prețul Ethereum acum (Binance și CoinGecko nu răspund). Verifică internetul.' : null; renderEth(); });
  }
  function ethLogo(sz){ return '<svg viewBox="0 0 32 32" width="' + sz + '" height="' + sz + '" aria-hidden="true"><polygon points="16,2 6.5,16.3 16,12.2" fill="#D7DDFF"/><polygon points="16,2 25.5,16.3 16,12.2" fill="#9AA9FF"/><polygon points="16,12.2 6.5,16.3 16,20.6 25.5,16.3" fill="#6677E8"/><polygon points="6.5,18.1 16,30 16,22.4" fill="#D7DDFF"/><polygon points="25.5,18.1 16,30 16,22.4" fill="#9AA9FF"/></svg>'; }
  function ethSmooth(P){          // monotone cubic curve through the points (smooth, never overshoots)
    var n = P.length, i; if(n < 3) return P.map(function(q, k){ return (k ? 'L' : 'M') + q[0].toFixed(1) + ' ' + q[1].toFixed(1); }).join(' ');
    var dx = [], m = [], t = [];
    for(i = 0; i < n - 1; i++){ dx[i] = P[i + 1][0] - P[i][0]; m[i] = dx[i] ? (P[i + 1][1] - P[i][1]) / dx[i] : 0; }
    t[0] = m[0]; t[n - 1] = m[n - 2]; for(i = 1; i < n - 1; i++) t[i] = (m[i - 1] * m[i] <= 0) ? 0 : (m[i - 1] + m[i]) / 2;
    for(i = 0; i < n - 1; i++){ if(m[i] === 0){ t[i] = 0; t[i + 1] = 0; continue; } var a = t[i] / m[i], b = t[i + 1] / m[i], h = a * a + b * b; if(h > 9){ var k = 3 / Math.sqrt(h); t[i] = k * a * m[i]; t[i + 1] = k * b * m[i]; } }
    var d = 'M' + P[0][0].toFixed(1) + ' ' + P[0][1].toFixed(1);
    for(i = 0; i < n - 1; i++) d += ' C' + (P[i][0] + dx[i] / 3).toFixed(1) + ' ' + (P[i][1] + t[i] * dx[i] / 3).toFixed(1) + ',' + (P[i + 1][0] - dx[i] / 3).toFixed(1) + ' ' + (P[i + 1][1] - t[i + 1] * dx[i] / 3).toFixed(1) + ',' + P[i + 1][0].toFixed(1) + ' ' + P[i + 1][1].toFixed(1);
    return d;
  }
  var ETHG = { W:320, H:196, pl:6, pr:50, pt:16, pb:22 };
  function ethBounds(pts, entry){
    var vals = pts.map(function(x){ return x[1]; }), lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
    if(entry != null){ lo = Math.min(lo, entry); hi = Math.max(hi, entry); } var m = (hi - lo) * 0.1 || 1; return { lo:lo - m, hi:hi + m, t0:pts[0][0], t1:pts[pts.length - 1][0], raw:{ lo:Math.min.apply(null, vals), hi:Math.max.apply(null, vals) } };
  }
  function ethChart(pts, entry){
    var G = ETHG; if(pts.length < 2) return '<div class="hint" style="padding:30px 0;text-align:center;">Se încarcă graficul…</div>';
    var B = ethBounds(pts, entry), X = function(t){ return G.pl + (t - B.t0) / (B.t1 - B.t0 || 1) * (G.W - G.pl - G.pr); }, Y = function(v){ return G.pt + (B.hi - v) / (B.hi - B.lo) * (G.H - G.pt - G.pb); };
    var step = Math.max(1, Math.ceil(pts.length / 110)), th = pts.filter(function(q, i){ return i % step === 0 || i === pts.length - 1; });
    var P = th.map(function(q){ return [X(q[0]), Y(q[1])]; }), line = ethSmooth(P), first = pts[0][1], last = pts[pts.length - 1][1], up = last >= first;
    var col = up ? '#5FBF8F' : '#E0685C', iMax = 0, iMin = 0; pts.forEach(function(q, i){ if(q[1] > pts[iMax][1]) iMax = i; if(q[1] < pts[iMin][1]) iMin = i; });
    var fmt = function(t){ var q = new Date(t); return eth.range === '1Z' ? hhmm(q) : q.getDate() + ' ' + monthShort[q.getMonth()]; };
    var svg = '<svg id="ethSvg" viewBox="0 0 ' + G.W + ' ' + G.H + '"><defs><linearGradient id="ethg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + col + '" stop-opacity=".34"/><stop offset="1" stop-color="' + col + '" stop-opacity="0"/></linearGradient>' +
      '<filter id="ethGl" x="-5%" y="-30%" width="110%" height="160%"><feGaussianBlur stdDeviation="2.4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>';
    for(var gi = 1; gi <= 3; gi++){ var gv = B.lo + (B.hi - B.lo) * gi / 4; svg += '<line x1="' + G.pl + '" x2="' + (G.W - G.pr) + '" y1="' + Y(gv).toFixed(1) + '" y2="' + Y(gv).toFixed(1) + '" stroke="var(--line)" stroke-width="0.6" stroke-dasharray="2 4"/><text x="' + (G.W - G.pr + 5) + '" y="' + (Y(gv) + 3).toFixed(1) + '" font-size="8.5" fill="var(--text-faint)" font-family="sans-serif">' + Math.round(gv).toLocaleString('ro-RO') + '</text>'; }
    svg += '<path d="' + line + ' L' + X(B.t1).toFixed(1) + ' ' + (G.H - G.pb) + ' L' + X(B.t0).toFixed(1) + ' ' + (G.H - G.pb) + ' Z" fill="url(#ethg)"/><path d="' + line + '" fill="none" stroke="' + col + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" filter="url(#ethGl)"/>';
    var yLast = Y(last);
    if(entry != null){ var ye = Y(entry), yt = ye; if(Math.abs(ye - yLast) < 17) yt = ye <= yLast ? yLast - 17 : yLast + 17; svg += '<line x1="' + G.pl + '" x2="' + (G.W - G.pr) + '" y1="' + ye.toFixed(1) + '" y2="' + ye.toFixed(1) + '" stroke="#A3FF12" stroke-width="1.1" stroke-dasharray="5 3"/><rect x="' + (G.W - G.pr + 2) + '" y="' + (yt - 7.5).toFixed(1) + '" width="' + (G.pr - 3) + '" height="15" rx="4" fill="#A3FF12"/><text x="' + (G.W - G.pr / 2 + 0.5).toFixed(1) + '" y="' + (yt + 3).toFixed(1) + '" text-anchor="middle" font-size="8.5" font-weight="800" fill="#1A1307" font-family="sans-serif">intrare</text>'; }
    [[iMax, -7], [iMin, 13]].forEach(function(a){ var q = pts[a[0]], x = X(q[0]), y = Y(q[1]); if(a[0] === pts.length - 1) return; var anc = x > G.W - G.pr - 46 ? 'end' : (x < 40 ? 'start' : 'middle');
      svg += '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="2.3" fill="var(--bg)" stroke="' + col + '" stroke-width="1.2"/><text x="' + x.toFixed(1) + '" y="' + (y + a[1]).toFixed(1) + '" text-anchor="' + anc + '" font-size="8.5" font-weight="700" fill="var(--text-dim)" font-family="sans-serif">' + Math.round(q[1]).toLocaleString('ro-RO') + '</text>'; });
    var xl = X(B.t1), yl = Y(last);
    svg += '<circle cx="' + xl.toFixed(1) + '" cy="' + yl.toFixed(1) + '" r="3.6" fill="' + col + '"><animate attributeName="r" values="3.6;6.5;3.6" dur="2s" repeatCount="indefinite"/><animate attributeName="opacity" values="1;.35;1" dur="2s" repeatCount="indefinite"/></circle><circle cx="' + xl.toFixed(1) + '" cy="' + yl.toFixed(1) + '" r="3.6" fill="' + col + '"/>' +
      '<rect x="' + (G.W - G.pr + 2) + '" y="' + (yl - 7.5).toFixed(1) + '" width="' + (G.pr - 3) + '" height="15" rx="4" fill="' + col + '"/><text x="' + (G.W - G.pr / 2 + 0.5).toFixed(1) + '" y="' + (yl + 3).toFixed(1) + '" text-anchor="middle" font-size="8.8" font-weight="800" fill="#0B0B0B" font-family="sans-serif">' + Math.round(last).toLocaleString('ro-RO') + '</text>';
    svg += '<text x="' + G.pl + '" y="' + (G.H - 6) + '" font-size="8.5" fill="var(--text-faint)" font-family="sans-serif">' + fmt(B.t0) + '</text><text x="' + ((G.pl + G.W - G.pr) / 2).toFixed(1) + '" y="' + (G.H - 6) + '" text-anchor="middle" font-size="8.5" fill="var(--text-faint)" font-family="sans-serif">' + fmt((B.t0 + B.t1) / 2) + '</text><text x="' + (G.W - G.pr) + '" y="' + (G.H - 6) + '" text-anchor="end" font-size="8.5" fill="var(--text-faint)" font-family="sans-serif">' + fmt(B.t1) + '</text>';
    svg += '<line id="ethCh" x1="0" x2="0" y1="' + G.pt + '" y2="' + (G.H - G.pb) + '" stroke="var(--text-dim)" stroke-width="0.7" stroke-dasharray="2 2" style="display:none"/><circle id="ethDot" r="4" fill="var(--bg)" stroke="' + col + '" stroke-width="2" style="display:none"/></svg>';
    return svg;
  }
  function ethHover(){
    var svg = document.getElementById('ethSvg'), bub = document.getElementById('ethBub'); if(!svg || !bub || eth.pts.length < 2) return;
    var G = ETHG, pts = eth.pts, en = eth.pos ? eth.pos.entry : null, B = ethBounds(pts, en), wrap = svg.parentNode;
    function hide(){ document.getElementById('ethCh').style.display = 'none'; document.getElementById('ethDot').style.display = 'none'; bub.style.opacity = 0; }
    function move(ev){ var r = svg.getBoundingClientRect(), cx = ((ev.touches ? ev.touches[0].clientX : ev.clientX) - r.left) / r.width * G.W;
      var f = Math.max(0, Math.min(1, (cx - G.pl) / (G.W - G.pl - G.pr))), p = pts[Math.round(f * (pts.length - 1))];
      var x = G.pl + (p[0] - B.t0) / (B.t1 - B.t0 || 1) * (G.W - G.pl - G.pr), y = G.pt + (B.hi - p[1]) / (B.hi - B.lo) * (G.H - G.pt - G.pb);
      var ln = document.getElementById('ethCh'), dt = document.getElementById('ethDot'); ln.setAttribute('x1', x); ln.setAttribute('x2', x); ln.style.display = ''; dt.setAttribute('cx', x); dt.setAttribute('cy', y); dt.style.display = '';
      var q = new Date(p[0]); bub.innerHTML = '<b>' + ethEur(p[1]) + '</b><span>' + q.getDate() + ' ' + monthShort[q.getMonth()] + (eth.range === '3L' || eth.range === '1A' ? '' : ' · ' + hhmm(q)) + '</span>' + (eth.pos ? '<em>poziția ta: ' + ethEur(eth.pos.qty * p[1]) + '</em>' : '');
      var px = x / G.W * r.width, bw = bub.offsetWidth || 120; bub.style.left = Math.max(4, Math.min(r.width - bw - 4, px - bw / 2)) + 'px'; bub.style.opacity = 1; }
    svg.addEventListener('pointermove', move); svg.addEventListener('pointerdown', move); svg.addEventListener('pointerleave', hide); svg.style.touchAction = 'pan-y';
  }
  function ethCalc(){ var L = eth.live, p = eth.pos; if(!p || L == null) return null; var val = p.qty * L, pl = val - p.invested; return { val:val, pl:pl, pc: p.invested ? pl / p.invested * 100 : 0, up: pl >= 0 }; }
  function ethChg(){ if(eth.open24 > 0 && eth.live != null) return (eth.live / eth.open24 - 1) * 100; return eth.ch24; }
  function ethBarHtml(){
    var p = eth.pos, L = eth.live; if(!p || L == null) return '';
    var lo = Math.min(p.entry, L) * 0.985, hi = Math.max(p.entry, L) * 1.015, f = function(v){ return ((v - lo) / (hi - lo) * 100).toFixed(1); }, a = Math.min(+f(p.entry), +f(L)), b = Math.max(+f(p.entry), +f(L));
    return '<div class="eth-bar"><i class="eth-bf" style="left:' + a + '%;width:' + (b - a).toFixed(1) + '%"></i><i class="eth-be" style="left:' + f(p.entry) + '%"></i><i class="eth-bn" style="left:' + f(L) + '%"></i></div><div class="eth-bl"><span>intrare ' + ethEur(p.entry, 0) + '</span><span>acum ' + ethEur(L, 0) + '</span></div>';
  }
  function ethR24Html(){
    if(!(eth.hi24 > eth.lo24) || eth.live == null) return '';
    var f = Math.max(0, Math.min(100, (eth.live - eth.lo24) / (eth.hi24 - eth.lo24) * 100));
    return '<div class="eth-r24"><span>' + ethEur(eth.lo24, 0) + '</span><div class="eth-r24b"><i id="ethR24m" style="left:' + f.toFixed(1) + '%"></i></div><span>' + ethEur(eth.hi24, 0) + '</span></div><div class="eth-r24l">Interval ultimele 24 de ore</div>';
  }
  function renderEth(){
    var el = document.getElementById('ethBody'); if(!el) return;
    if(useLocal && !eth._ll){ eth._ll = 1; try{ var lp = JSON.parse(safeGet('reset_eth_v1') || 'null'); if(lp && lp.qty > 0) eth.pos = lp; }catch(e){} }
    var h = '', L = eth.live, pos = eth.pos;
    window.__ethPos = pos;
    if(eth.err && L == null){ el.innerHTML = '<div class="td-risk warn">⚠️ ' + eth.err + '</div><button class="ghost-btn" id="ethRetry" style="margin-top:8px;">↻ Reîncearcă</button>'; document.getElementById('ethRetry').addEventListener('click', function(){ ethRefresh(true); }); return; }
    var ch = ethChg(), C = ethCalc();
    h += '<div class="eth-hd"><div class="eth-logo">' + ethLogo(26) + '</div><div class="eth-hn"><b>Ethereum</b><span><i class="lv-dot"></i>ETH / EUR · <u id="ethAgo">live</u></span></div>' +
      (ch != null && !isNaN(ch) ? '<div class="eth-ch ' + (ch >= 0 ? 'hs-win' : 'hs-loss') + '" id="ethChg">' + (ch >= 0 ? '▲ +' : '▼ ') + ch.toFixed(2) + '%<span>24 ore</span></div>' : '') + '</div>';
    h += '<div class="eth-p" id="ethPrice">' + (L != null ? ethEur(L) : '…') + '</div>' + ethR24Html();
    if(C){
      var d = new Date(pos.date + 'T00:00:00');
      h += '<div class="eth-pos ' + (C.up ? 'up' : 'dn') + '" id="ethPos"><div class="eth-ph"><span>Poziția ta</span><em>din ' + d.getDate() + ' ' + monthShort[d.getMonth()] + '</em></div>' +
        '<div class="eth-pl"><b id="ethPL">' + ethSgn(C.pl) + '</b><span id="ethPC">' + (C.up ? '▲ +' : '▼ −') + Math.abs(C.pc).toFixed(2) + '%</span></div>' +
        '<div class="eth-sub" id="ethPS">' + (C.up ? 'Ai câștigat' : 'Ai pierdut') + ' de când ai pus <b>' + ethEur(pos.invested, 0) + '</b></div>' + ethBarHtml() +
        '<div class="eth-grid"><div><span>Valoare acum</span><b id="ethVal">' + ethEur(C.val) + '</b></div><div><span>Ai investit</span><b>' + ethEur(pos.invested) + '</b></div><div><span>Preț intrare</span><b>' + ethEur(pos.entry) + '</b></div><div><span>Cantitate</span><b>' + pos.qty.toFixed(5) + ' ETH</b></div></div></div>';
    }
    h += '<div class="eth-rg">' + Object.keys(ETH_R).map(function(k){ return '<button data-r="' + k + '" class="' + (k === eth.range ? 'on' : '') + '">' + k + '</button>'; }).join('') + '</div>';
    var ps = eth.pts, rc = ps.length > 1 ? (ps[ps.length - 1][1] / ps[0][1] - 1) * 100 : null;
    h += '<div class="eth-chart">' + ethChart(ps, pos ? pos.entry : null) + '<div class="eth-bub" id="ethBub"></div></div>';
    if(ps.length > 1){ var vv = ps.map(function(x){ return x[1]; }); h += '<div class="eth-st"><div><span>Minim</span><b>' + ethEur(Math.min.apply(null, vv), 0) + '</b></div><div><span>Maxim</span><b>' + ethEur(Math.max.apply(null, vv), 0) + '</b></div><div><span>În ' + ETH_R[eth.range].l + '</span><b class="' + (rc >= 0 ? 'hs-win' : 'hs-loss') + '">' + (rc >= 0 ? '+' : '') + rc.toFixed(2) + '%</b></div></div>'; }
    if(!pos || eth.edit){
      h += '<div class="eth-form"><div class="eth-fh">' + (pos ? 'Modifică poziția' : 'Pune suma pe care ai investit-o în ETH') + '</div>' +
        '<div class="field-row"><label>Suma investită (€)</label><input type="number" id="ethAmt" inputmode="decimal" placeholder="ex. 500"></div>' +
        '<div class="field-row"><label>Data cumpărării</label><input type="date" id="ethDate" value="' + dateKey(new Date()) + '" max="' + dateKey(new Date()) + '"></div>' +
        '<div class="field-row"><label>Preț cumpărare € (opțional)</label><input type="number" id="ethBuy" inputmode="decimal" placeholder="gol = prețul din ziua aleasă"></div>' +
        '<div class="hint" id="ethMsg" style="margin:4px 0 8px;">Azi = prețul live de acum. Pentru o dată din trecut iau prețul real al zilei.</div>' +
        '<div class="eth-btns"><button class="primary-btn" id="ethSet">' + (pos ? 'Înlocuiește poziția' : 'Salvează') + '</button>' + (pos ? '<button class="ghost-btn" id="ethAdd">➕ Adaugă la poziție</button>' : '') + '</div></div>';
    } else h += '<div class="eth-btns"><button class="ghost-btn" id="ethEdit">✏️ Modifică / adaugă sumă</button><button class="ghost-btn" id="ethDel" style="color:var(--danger);">🗑️ Șterge</button></div>';
    if(pos) h += '<div class="hint" style="margin-top:10px;">🔔 Vrei notificare cu câștigul tău? Profil → Notificări → <b>Copiază codul</b> și pune-l în GitHub la <b>PUSH_SUB</b> (o dată, și după ce schimbi suma).</div>';
    h += '<div class="hint">Prețul vine de la Binance (rezerva: CoinGecko) și se mișcă la secundă cât ai cardul deschis. Câștigul se calculează după prețul real al ETH în euro, fără comisioane sau taxe de rețea.</div>';
    el.innerHTML = h; eth.shown = L;
    el.querySelectorAll('.eth-rg button').forEach(function(b){ b.addEventListener('click', function(){ eth.range = b.getAttribute('data-r'); safeSet('reset_eth_range_v1', eth.range); eth.pts = []; renderEth(); ethRefresh(true); }); });
    ethHover();
    var set = document.getElementById('ethSet'), add = document.getElementById('ethAdd'), ed = document.getElementById('ethEdit'), dl = document.getElementById('ethDel');
    if(ed) ed.addEventListener('click', function(){ eth.edit = true; renderEth(); });
    if(dl) dl.addEventListener('click', function(){ if(!confirm('Ștergi poziția ETH? (prețul și graficul rămân)')) return; ethSave(null); });
    function go(mode){
      var amt = parseFloat((document.getElementById('ethAmt').value || '').replace(',', '.')), date = document.getElementById('ethDate').value || dateKey(new Date()), buy = parseFloat((document.getElementById('ethBuy').value || '').replace(',', '.')), msg = document.getElementById('ethMsg');
      if(!(amt > 0)){ msg.textContent = 'Scrie suma în euro, de exemplu 500.'; msg.style.color = 'var(--gold)'; return; }
      msg.style.color = ''; msg.textContent = 'Caut prețul…'; if(set) set.disabled = true; if(add) add.disabled = true;
      var pr = buy > 0 ? Promise.resolve(buy) : (eth.live != null || date < dateKey(new Date()) ? ethPriceOn(date) : ethLive().then(function(x){ eth.live = x.p; return x.p; }));
      pr.then(function(entry){ if(!(entry > 0)) throw 0; var q = amt / entry, np;
        if(mode === 'add' && eth.pos){ var inv = eth.pos.invested + amt, qty = eth.pos.qty + q; np = { invested:inv, qty:qty, entry:inv / qty, date:eth.pos.date }; }
        else np = { invested:amt, qty:q, entry:entry, date:date };
        eth.edit = false; ethSave(np); }).catch(function(){ msg.style.color = 'var(--gold)'; msg.textContent = 'Nu am găsit prețul pentru data aleasă. Scrie tu prețul de cumpărare sau încearcă altă dată.'; if(set) set.disabled = false; if(add) add.disabled = false; });
    }
    if(set) set.addEventListener('click', function(){ go('set'); }); if(add) add.addEventListener('click', function(){ go('add'); });
    paintEthHint();
  }
  // per-second update: only the numbers change (no flicker, the chart keeps its touch state)
  function ethPaintLive(){
    var L = eth.live; if(L == null) return; var pe = document.getElementById('ethPrice'); if(!pe){ renderEth(); return; }
    var txt = ethEur(L); if(pe.textContent !== txt){ var dir = (eth.shown != null && L < eth.shown) ? 'dn' : 'up'; pe.textContent = txt; if(eth.shown != null){ pe.classList.remove('up', 'dn'); void pe.offsetWidth; pe.classList.add(dir); } eth.shown = L; }
    var ch = ethChg(), ce = document.getElementById('ethChg'); if(ce && ch != null && !isNaN(ch)){ ce.className = 'eth-ch ' + (ch >= 0 ? 'hs-win' : 'hs-loss'); ce.innerHTML = (ch >= 0 ? '▲ +' : '▼ ') + ch.toFixed(2) + '%<span>24 ore</span>'; }
    var C = ethCalc(), box = document.getElementById('ethPos');
    if(C && box){ box.className = 'eth-pos ' + (C.up ? 'up' : 'dn'); var s1 = document.getElementById('ethPL'), s2 = document.getElementById('ethPC'), s3 = document.getElementById('ethPS'), s4 = document.getElementById('ethVal');
      if(s1) s1.textContent = ethSgn(C.pl); if(s2) s2.textContent = (C.up ? '▲ +' : '▼ −') + Math.abs(C.pc).toFixed(2) + '%'; if(s4) s4.textContent = ethEur(C.val);
      if(s3) s3.innerHTML = (C.up ? 'Ai câștigat' : 'Ai pierdut') + ' de când ai pus <b>' + ethEur(eth.pos.invested, 0) + '</b>';
      var bar = box.querySelector('.eth-bar'); if(bar){ var tmp = document.createElement('div'); tmp.innerHTML = ethBarHtml(); var nb = tmp.firstChild, nl = tmp.lastChild; bar.parentNode.replaceChild(nb, bar); var ol = box.querySelector('.eth-bl'); if(ol) ol.parentNode.replaceChild(nl, ol); } }
    var m = document.getElementById('ethR24m'); if(m && eth.hi24 > eth.lo24) m.style.left = Math.max(0, Math.min(100, (L - eth.lo24) / (eth.hi24 - eth.lo24) * 100)).toFixed(1) + '%';
    paintEthHint(); ethAgo();
  }
  function ethAgo(){ var a = document.getElementById('ethAgo'); if(!a) return; a.textContent = (Date.now() - eth.wsAt < 4000) ? '⚡ la secundă' : 'actualizat acum ' + Math.max(0, Math.round((Date.now() - eth.tLive) / 1000)) + ' s'; }
  function ethWsStart(){
    try{
      if(eth.ws && eth.ws.readyState <= 1) return;
      eth.ws = new WebSocket('wss://stream.binance.com:9443/ws/etheur@bookTicker');
      eth.ws.onopen = function(){ eth.wsRetry = 0; };
      eth.ws.onmessage = function(ev){ try{ var d = JSON.parse(ev.data), b = +d.b, a = +d.a; if(!(b > 0 && a > 0)) return; eth.live = (b + a) / 2; eth.wsAt = eth.tLive = Date.now();
        if(Date.now() - eth.wsPaint >= 900){ eth.wsPaint = Date.now(); ethPaintLive(); } }catch(e){} };
      eth.ws.onerror = function(){ try{ eth.ws.close(); }catch(e){} };
      eth.ws.onclose = function(){ eth.ws = null; clearTimeout(eth.wsTimer); eth.wsTimer = setTimeout(ethWsSync, Math.min(30000, 1500 * (++eth.wsRetry))); };
    }catch(e){}
  }
  function ethWsStop(){ clearTimeout(eth.wsTimer); try{ if(eth.ws){ var w = eth.ws; eth.ws = null; w.onclose = null; w.close(); } }catch(e){} }
  function ethWsSync(){ var c = document.getElementById('ethCard'); (c && c.offsetParent !== null && !document.hidden) ? ethWsStart() : ethWsStop(); }

  /* ===== Știri Ethereum (CryptoCompare, rezervă Cointelegraph) ===== */
  var enT = 0;
  function enAgo(ts){ var m = Math.max(0, Math.round((Date.now() - ts) / 60000)); return m < 60 ? 'acum ' + Math.max(1, m) + ' min' : m < 1440 ? 'acum ' + Math.round(m / 60) + ' ore' : 'acum ' + Math.round(m / 1440) + ' zile'; }
  function enRender(items){
    var el = document.getElementById('ethNews'); if(!el) return;
    if(!items.length){ el.innerHTML = '<div class="hint" style="margin-top:0;">Nu am putut încărca știrile acum. Încearcă mai târziu.</div>'; return; }
    el.innerHTML = items.slice(0, 8).map(function(x){ return '<a class="en-it" href="' + accEsc(x.url) + '" target="_blank" rel="noopener"><div class="en-t">' + accEsc(x.title) + '</div><div class="en-m">' + accEsc(x.src) + ' · ' + enAgo(x.t) + '</div></a>'; }).join('') +
      '<div class="hint" style="margin-bottom:0;">Titlurile sunt în engleză. Atinge o știre ca s-o citești.</div>';
  }
  function loadEthNews(force){
    if(!force && Date.now() - enT < 300000) return; enT = Date.now();
    fetch('https://min-api.cryptocompare.com/data/v2/news/?lang=EN&categories=ETH', { cache:'no-store' }).then(function(r){ if(!r.ok) throw 0; return r.json(); }).then(function(j){
      var d = (j && j.Data) || []; if(!d.length) throw 0;
      enRender(d.map(function(x){ return { title:x.title, url:x.url, src:x.source_info && x.source_info.name || x.source || '', t:(x.published_on || 0) * 1000 }; }));
    }).catch(function(){
      fetch('https://api.rss2json.com/v1/api.json?rss_url=' + encodeURIComponent('https://cointelegraph.com/rss/tag/ethereum')).then(function(r){ return r.json(); }).then(function(j){
        enRender(((j && j.items) || []).map(function(x){ return { title:x.title, url:x.link, src:'Cointelegraph', t:new Date(String(x.pubDate).replace(' ', 'T') + 'Z').getTime() || Date.now() }; }));
      }).catch(function(){ enRender([]); });
    });
  }
  loadEthNews(true);
  document.querySelectorAll('.tab[data-view="money"]').forEach(function(t){ t.addEventListener('click', function(){ setTimeout(function(){ loadEthNews(false); }, 60); }); });

  /* ===== Portofel MetaMask: doar adresa publică, doar citire ===== */
  var WL_KEY = 'reset_wallet_v1', wl = { addr:'', bal:null, err:'', t:0, h:null, hErr:'', hBusy:false };
  try{ var wls = JSON.parse(localStorage.getItem(WL_KEY) || '{}'); if(wls && /^0x[0-9a-fA-F]{40}$/.test(wls.addr || '')) wl.addr = wls.addr; }catch(e){}
  var WL_RPC = ['https://ethereum-rpc.publicnode.com', 'https://eth.llamarpc.com', 'https://cloudflare-eth.com'];
  function wlFetch(i){
    if(i >= WL_RPC.length) return Promise.reject(new Error('rpc'));
    return fetch(WL_RPC[i], { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ jsonrpc:'2.0', id:1, method:'eth_getBalance', params:[wl.addr, 'latest'] }) })
      .then(function(r){ if(!r.ok) throw 0; return r.json(); })
      .then(function(j){ if(!j || typeof j.result !== 'string' || !/^0x[0-9a-fA-F]+$/.test(j.result)) throw 0; return Number(BigInt(j.result)) / 1e18; })
      .catch(function(){ return wlFetch(i + 1); });
  }
  function wlLoad(){
    if(!wl.addr) return; wl.err = '';
    wlFetch(0).then(function(v){ wl.bal = v; wl.t = Date.now(); renderWallet(); }).catch(function(){ wl.err = 'Nu am putut citi soldul acum. Încearcă din nou peste puțin.'; renderWallet(); });
  }
  function wlShort(a){ return a.slice(0, 6) + '…' + a.slice(-4); }
  function renderWallet(){
    var el = document.getElementById('walletBody'); if(!el) return;
    if(!wl.addr){
      el.innerHTML = '<div class="hint" style="margin:0 0 10px;">Lipește adresa publică (începe cu 0x). Aplicația doar citește soldul. Nu poate trimite bani și nu cere niciodată fraza secretă.</div>' +
        '<input class="wl-in" id="wlIn" placeholder="0x…" autocomplete="off" autocapitalize="off" spellcheck="false">' +
        '<div class="wl-row"><button class="pri" id="wlSave">Salvează adresa</button></div><div class="hint" id="wlMsg" style="color:var(--loss, #e5645a);"></div>';
      document.getElementById('wlSave').addEventListener('click', function(){
        var v = document.getElementById('wlIn').value.trim();
        if(!/^0x[0-9a-fA-F]{40}$/.test(v)){ document.getElementById('wlMsg').textContent = 'Adresa nu e validă. Trebuie să înceapă cu 0x și să aibă 42 de caractere.'; return; }
        wl.addr = v; wl.bal = null; wl.h = null; try{ localStorage.setItem(WL_KEY, JSON.stringify({ addr:v })); }catch(e){} renderWallet(); wlLoad();
      });
      return;
    }
    var val = (wl.bal != null && eth.live != null) ? wl.bal * eth.live : null;
    el.innerHTML = (wl.bal == null && !wl.err ? '<div class="hint" style="margin:0;">Se citește soldul…</div>' : wl.bal != null ? '<div class="wl-big">' + wl.bal.toLocaleString('ro-RO', { maximumFractionDigits:4 }) + ' ETH</div><div class="wl-sub">' + (val != null ? '≈ ' + ethEur(val) : 'Prețul se încarcă…') + '</div>' : '') +
      (wl.err ? '<div class="hint" style="margin:0;">' + accEsc(wl.err) + '</div>' : '') +
      '<div class="wl-sub">' + accEsc(wlShort(wl.addr)) + ' · doar citire</div>' +
      '<div class="wl-row"><button id="wlRef">Actualizează</button><button id="wlDel">Șterge adresa</button></div><div id="walletHist"></div>';
    renderWalletHist();
    document.getElementById('wlRef').addEventListener('click', function(){ wlLoad(); wlHistLoad(true); });
    document.getElementById('wlDel').addEventListener('click', function(){ wl.addr = ''; wl.bal = null; wl.h = null; try{ localStorage.removeItem(WL_KEY); }catch(e){} renderWallet(); });
  }

  var wlPx = {};
  function wlPriceOn(d){ if(wlPx[d] != null) return Promise.resolve(wlPx[d]); return ethPriceOn(d).then(function(p){ wlPx[d] = p; return p; }).catch(function(){ return null; }); }
  function wlHistLoad(force){
    if(!wl.addr || wl.hBusy || (wl.h && !force)) return; wl.hBusy = true; wl.hErr = ''; var ad = wl.addr.toLowerCase();
    fetch('https://eth.blockscout.com/api/v2/addresses/' + wl.addr + '/transactions', { headers:{ 'Accept':'application/json' } })
      .then(function(r){ if(!r.ok) throw 0; return r.json(); })
      .then(function(j){
        var rows = ((j && j.items) || []).filter(function(t){ return t && t.to && String(t.to.hash).toLowerCase() === ad && t.value && t.value !== '0' && (t.result === 'success' || t.status === 'ok'); })
          .slice(0, 30).map(function(t){ return { ts: new Date(t.timestamp).getTime(), eth: Number(BigInt(t.value)) / 1e18, from: t.from && t.from.hash || '' }; })
          .filter(function(t){ return t.ts > 0 && t.eth > 0; });
        var days = {}; rows.forEach(function(t){ t.d = new Date(t.ts).toISOString().slice(0, 10); days[t.d] = 1; });
        return Promise.all(Object.keys(days).slice(0, 20).map(function(d){ return wlPriceOn(d); })).then(function(){ rows.forEach(function(t){ t.px = wlPx[t.d]; }); wl.h = rows; });
      })
      .catch(function(){ wl.hErr = 'Nu am putut citi istoricul acum.'; })
      .then(function(){ wl.hBusy = false; renderWalletHist(); });
  }
  function renderWalletHist(){
    var el = document.getElementById('walletHist'); if(!el) return;
    if(wl.hBusy && !wl.h){ el.innerHTML = '<div class="hint">Se citește istoricul…</div>'; return; }
    if(wl.hErr && !wl.h){ el.innerHTML = '<div class="hint">' + accEsc(wl.hErr) + '</div>'; return; }
    if(!wl.h){ wlHistLoad(); return; }
    if(!wl.h.length){ el.innerHTML = '<div class="hint">Nu am găsit intrări de ETH în ultimele tranzacții.</div>'; return; }
    var live = eth.live, totEth = 0, totEur = 0, ok = 0;
    wl.h.forEach(function(t){ totEth += t.eth; if(t.px != null){ totEur += t.eth * t.px; ok++; } });
    var tot = '';
    if(ok === wl.h.length && live != null){ var gain = totEth * live - totEur; tot = '<div class="wl-sum"><div><span>Primit în total</span><b>' + totEth.toLocaleString('ro-RO', { maximumFractionDigits:4 }) + ' ETH</b></div><div><span>Valoare la primire (estimat)</span><b>' + ethEur(totEur, 0) + '</b></div><div><span>Acum</span><b>' + ethEur(totEth * live, 0) + '</b></div><div><span>Diferență</span><b class="' + (gain >= 0 ? 'hs-win' : 'hs-loss') + '">' + (gain >= 0 ? '+' : '−') + ethEur(Math.abs(gain), 0) + '</b></div></div>'; }
    var mn = ['ian','feb','mar','apr','mai','iun','iul','aug','sep','oct','nov','dec'];
    el.innerHTML = '<div class="wl-h">Intrări de ETH în portofel</div>' + tot + wl.h.slice(0, 8).map(function(t){
      var d = new Date(t.ts), dt = d.getUTCDate() + ' ' + mn[d.getUTCMonth()] + ' ' + d.getUTCFullYear();
      var then = t.px != null ? t.eth * t.px : null, g = (then != null && live != null) ? t.eth * live - then : null;
      return '<div class="wl-tx"><div><b>+' + t.eth.toLocaleString('ro-RO', { maximumFractionDigits:4 }) + ' ETH</b><span>' + dt + ' · de la ' + accEsc(wlShort(t.from)) + '</span></div><div class="wl-r">' + (then != null ? '≈ ' + ethEur(then, 0) + ' atunci' : '–') + (g != null ? '<span class="' + (g >= 0 ? 'hs-win' : 'hs-loss') + '">' + (g >= 0 ? '+' : '−') + ethEur(Math.abs(g), 0) + ' față de acum</span>' : '') + '</div></div>';
    }).join('') + '<div class="hint">Sumele „atunci" sunt estimate: ETH primit × prețul din ziua respectivă. Nu arată banii plătiți efectiv la bursă, pentru că blockchain-ul nu vede cumpărarea cu euro.</div>';
  }
  renderWallet(); wlLoad();
  setInterval(function(){ if(wl.addr && wl.bal != null && eth.live != null) renderWallet(); }, 20000);
  function ethSave(np){
    eth.pos = np; renderEth();
    if(useLocal){ safeSet('reset_eth_v1', np ? JSON.stringify(np) : ''); }
    else chainWrite('settings/eth', function(){ return np ? db.doc('settings/eth').set(np) : db.doc('settings/eth').delete(); });
  }
  function paintEthHint(){
    var hnt = document.getElementById('accEthHint'); if(!hnt) return;
    if(!eth.pos || eth.live == null){ hnt.style.display = 'none'; return; }
    var v = eth.pos.qty * eth.live; hnt.style.display = 'block'; hnt.innerHTML = '⟠ Valoarea live a pozițiilor tale ETH: <b>' + ethEur(v) + '</b> · <a href="#" id="accEthUse" style="color:var(--gold);font-weight:700;">Folosește-o</a>';
    var a = document.getElementById('accEthUse'); if(a) a.addEventListener('click', function(e){ e.preventDefault(); var inp = document.querySelector('#accFields input[data-k="eth"]'); if(inp){ inp.value = v.toFixed(2); inp.dispatchEvent(new Event('input')); } });
  }
  document.querySelectorAll('.tab, [data-seg]').forEach(function(b){ b.addEventListener('click', function(){ setTimeout(function(){ ethWsSync(); if(b.getAttribute('data-view') === 'money' || b.getAttribute('data-seg') === 'worth') ethRefresh(true); }, 80); }); });
  document.addEventListener('visibilitychange', function(){ setTimeout(ethWsSync, 50); });
  setInterval(function(){ ethWsSync(); var c = document.getElementById('ethCard'); if(c && c.offsetParent !== null && !document.hidden){ ethRefresh(false); ethAgo(); } }, 3000);
  setInterval(ethAgo, 1000);
  setTimeout(function(){ renderEth(); }, 0);

  /* ===== collapsible cards (closed until you need them) + hide amounts ===== */
  (function(){
    document.querySelectorAll('.cp-head').forEach(function(h){
      var key = 'reset_cp_' + h.getAttribute('data-cp') + '_v1', body = h.parentNode.querySelector('.cp-body');
      function set(open){ h.setAttribute('aria-expanded', open ? 'true' : 'false'); h.parentNode.classList.toggle('open', open); if(body) body.hidden = !open; safeSet(key, open ? '1' : '0'); }
      set(safeGet(key) === '1' ? true : false);
      h.addEventListener('click', function(){ set(h.getAttribute('aria-expanded') !== 'true'); });
    });
    var eye = document.getElementById('amtEye');
    function hide(on){ document.body.classList.toggle('hide-amt', on); if(eye){ eye.textContent = on ? '🙈 Arată sumele' : '👁 Ascunde sumele'; eye.setAttribute('aria-pressed', on ? 'true' : 'false'); } safeSet('reset_hide_amt_v1', on ? '1' : '0'); }
    hide(safeGet('reset_hide_amt_v1') === '1');
    if(eye) eye.addEventListener('click', function(){ hide(!document.body.classList.contains('hide-amt')); });
  })();
  /* ===== 🧮 Calculator zilnic ===== */
  var NU_F = {
    pui:{ n:'Piept de pui (crud)', ic:'🍗', k:120, p:22.5, c:0, f:2.6 },
    curcan:{ n:'Piept de curcan (crud)', ic:'🦃', k:105, p:23, c:0, f:1 },
    vita:{ n:'Carne de vită slabă (crudă)', ic:'🥩', k:133, p:21, c:0, f:5 },
    somon:{ n:'Somon (crud)', ic:'🐟', k:208, p:20, c:0, f:13 },
    ton:{ n:'Ton la conservă în apă (scurs)', ic:'🐟', k:116, p:26, c:0, f:1 },
    oua:{ n:'Ouă', ic:'🥚', k:143, p:12.6, c:0.7, f:9.5, piece:55 },
    iaurt:{ n:'Iaurt grecesc 2%', ic:'🥛', k:73, p:9.5, c:4, f:2 },
    cottage:{ n:'Brânză cottage slabă', ic:'🧀', k:72, p:12.4, c:2.7, f:1 },
    linte:{ n:'Linte (uscată)', ic:'🫘', k:352, p:25, c:60, f:1.1 },
    ovaz:{ n:'Fulgi de ovăz (uscați)', ic:'🥣', k:370, p:13.5, c:60, f:7 },
    orez:{ n:'Orez (uscat)', ic:'🍚', k:360, p:7, c:79, f:0.6 },
    paste:{ n:'Paste integrale (uscate)', ic:'🍝', k:350, p:13, c:68, f:2.5 },
    quinoa:{ n:'Quinoa (uscată)', ic:'🌾', k:368, p:14, c:64, f:6 },
    cartof:{ n:'Cartofi', ic:'🥔', k:77, p:2, c:17, f:0.1 },
    cartofd:{ n:'Cartofi dulci', ic:'🍠', k:86, p:1.6, c:20, f:0.1 },
    paine:{ n:'Pâine integrală', ic:'🍞', k:250, p:10, c:43, f:3.5 },
    fructe:{ n:'Banane sau mere', ic:'🍓', k:55, p:0.7, c:13, f:0.3 },
    legume:{ n:'Legume / salată', ic:'🥗', k:25, p:1.5, c:4, f:0.3 },
    ulei:{ n:'Ulei de măsline', ic:'🫒', k:884, p:0, c:0, f:100, spoon:13 },
    nuci:{ n:'Nuci', ic:'🌰', k:654, p:15, c:14, f:65 },
    migdale:{ n:'Migdale', ic:'🌰', k:579, p:21, c:22, f:50 },
    avocado:{ n:'Avocado', ic:'🥑', k:160, p:2, c:9, f:15 }
  };
  var NU_T = {
    b:[ { n:'Ovăz cu iaurt natural, fructe și nuci', p:'iaurt', c:'ovaz', f:'nuci', fx:[['fructe', 100]] },
        { n:'Omletă cu legume și pâine integrală', p:'oua', pcap:165, palt:'cottage', c:'paine', f:'ulei', fx:[['legume', 120]] },
        { n:'Cottage cu ovăz, fructe și nuci', p:'cottage', c:'ovaz', f:'nuci', fx:[['fructe', 120]] } ],
    l:[ { n:'Pui cu orez și legume', p:'pui', c:'orez', f:'ulei', fx:[['legume', 250]] },
        { n:'Ton cu cartofi și salată', p:'ton', c:'cartof', cap:300, alt:'paine', f:'ulei', fx:[['legume', 250]] },
        { n:'Pui cu paste și legume', p:'pui', c:'paste', f:'ulei', fx:[['legume', 250]] },
        { n:'Linte cu orez și legume', p:'linte', c:'orez', f:'ulei', fx:[['legume', 250]] } ],
    d:[ { n:'Ton cu cartofi dulci și salată', p:'ton', c:'cartofd', cap:300, alt:'paine', f:'ulei', fx:[['legume', 300]] },
        { n:'Ouă cu legume și pâine', p:'oua', pcap:165, palt:'ton', c:'paine', f:'ulei', fx:[['legume', 200]] },
        { n:'Pui cu cartofi fierți și salată', p:'pui', c:'cartof', cap:300, alt:'paine', f:'ulei', fx:[['legume', 300]] },
        { n:'Vită slabă cu orez și legume', p:'vita', c:'orez', f:'ulei', fx:[['legume', 250]] } ]
  };
  var NU_M = [ { k:'b', n:'Dimineața', ic:'🌅', kc:0.28, pr:0.30 }, { k:'l', n:'La prânz', ic:'☀️', kc:0.40, pr:0.35 }, { k:'d', n:'Seara', ic:'🌙', kc:0.32, pr:0.35 } ];
  function nuCalc(kg, cm, age, sex, act, goal){
    var bmr = 10 * kg + 6.25 * cm - 5 * age + (sex === 'f' ? -161 : 5), tdee = bmr * act;
    var kcal = tdee * (goal === 'lose' ? 0.85 : goal === 'gain' ? 1.10 : 1), floor = sex === 'f' ? 1300 : 1600; if(kcal < floor) kcal = floor;
    var P = kg * (goal === 'lose' ? 2.0 : goal === 'gain' ? 1.9 : 1.8), F = Math.max(0.8 * kg, 0.25 * kcal / 9), C = Math.max(0, (kcal - 4 * P - 9 * F) / 4);
    return { bmr:bmr, tdee:tdee, kcal:kcal, P:P, F:F, C:C, fiber: kcal / 1000 * 14, water: kg * 0.035 };
  }
  function nuGauss(A, b){          // solves A x = b (n x n), null if singular
    var n = b.length, M = A.map(function(r, i){ return r.concat([b[i]]); }), i, j, k;
    for(i = 0; i < n; i++){ var mx = i; for(j = i + 1; j < n; j++) if(Math.abs(M[j][i]) > Math.abs(M[mx][i])) mx = j;
      if(Math.abs(M[mx][i]) < 1e-9) return null; var t = M[i]; M[i] = M[mx]; M[mx] = t;
      for(j = i + 1; j < n; j++){ var f = M[j][i] / M[i][i]; for(k = i; k <= n; k++) M[j][k] -= f * M[i][k]; } }
    var x = new Array(n); for(i = n - 1; i >= 0; i--){ var s = M[i][n]; for(j = i + 1; j < n; j++) s -= M[i][j] * x[j]; x[i] = s / M[i][i]; } return x;
  }
  function nuSolveRows(foods, rows, b){            // foods[j] fills row rows[j]; a food that would need a negative amount is dropped and its row relaxed
    var g = foods.map(function(){ return 0; }), act = foods.map(function(_, i){ return i; });
    for(var tries = 0; tries < 3 && act.length; tries++){
      var A = act.map(function(i){ return act.map(function(j){ return foods[j][rows[i]] / 100; }); }), x = nuGauss(A, act.map(function(i){ return b[i]; }));
      if(!x) break; var neg = -1, nv = 0; x.forEach(function(v, q){ if(v < nv){ nv = v; neg = q; } });
      if(neg < 0){ act.forEach(function(j, q){ g[j] = x[q]; }); break; } act.splice(neg, 1);
    }
    return g;
  }
  function nuRoundG(k, g){
    var d = NU_F[k]; if(g < 2.5) return 0;
    if(d.piece) return Math.max(1, Math.round(g / d.piece)) * d.piece;
    if(d.spoon) return Math.round(g / (d.spoon / 2)) * (d.spoon / 2);
    return Math.max(5, Math.round(g / 5) * 5);
  }
  function nuMeal(kind, T, vi){
    var list = NU_T[kind], tpl = list[((vi || 0) % list.length + list.length) % list.length], items = [], got = { p:0, c:0, f:0 };
    var add = function(k, g){ if(g <= 0) return; items.push({ k:k, g:g }); var d = NU_F[k]; got.p += d.p * g / 100; got.c += d.c * g / 100; got.f += d.f * g / 100; };
    tpl.fx.forEach(function(q){ add(q[0], q[1]); });
    var P = NU_F[tpl.p], C = NU_F[tpl.c], Fa = NU_F[tpl.f], rem = function(){ return [T.p - got.p, T.c - got.c, T.f - got.f]; };
    var g1 = nuSolveRows([P, C, Fa], ['p', 'c', 'f'], rem()), gp = nuRoundG(tpl.p, g1[0]);                          // 1) protein food (eggs: whole pieces)
    if(tpl.pcap && gp > tpl.pcap){ var exP = (gp - tpl.pcap) * P.p / 100, pa = NU_F[tpl.palt]; add(tpl.p, tpl.pcap); add(tpl.palt, nuRoundG(tpl.palt, exP / (pa.p / 100))); }   // too many eggs: cap them, rest from a leaner protein
    else add(tpl.p, gp);
    var r2 = rem(), g2 = nuSolveRows([C, Fa], ['c', 'f'], [r2[1], r2[2]]), gc = nuRoundG(tpl.c, g2[0]);                // 2) carbs, re-solved after rounding
    if(tpl.cap && gc > tpl.cap){ var extra = (gc - tpl.cap) * C.c / 100, alt = NU_F[tpl.alt]; add(tpl.c, tpl.cap); add(tpl.alt, nuRoundG(tpl.alt, extra / (alt.c / 100))); }   // bulky carb: cap it, cover the rest with a denser one
    else add(tpl.c, gc);
    var r3 = rem(); add(tpl.f, nuRoundG(tpl.f, Math.max(0, r3[2]) / (Fa.f / 100)));                                    // 3) fat
    var over = got.p - T.p, pi = items.filter(function(it){ return it.k === tpl.p; })[0];                               // 4) trim: carbs/veg also carry protein; if that pushed it >8% over, take it off the protein food
    if(pi && over > 0.08 * T.p){ var step = P.piece || 5, cut = Math.floor(over / (P.p * step / 100)) * step; if(cut > 0 && pi.g - cut >= step){ pi.g -= cut; got.p -= P.p * cut / 100; got.c -= P.c * cut / 100; got.f -= P.f * cut / 100; } }
    var tot = { kcal:0, p:0, c:0, f:0 }; items.forEach(function(it){ var d = NU_F[it.k]; tot.kcal += d.k * it.g / 100; tot.p += d.p * it.g / 100; tot.c += d.c * it.g / 100; tot.f += d.f * it.g / 100; });
    items.sort(function(a, b){ var o = { p:0, c:1, f:3 }, ra = a.k === tpl.p || a.k === tpl.palt ? 0 : a.k === tpl.c || a.k === tpl.alt ? 1 : a.k === tpl.f ? 3 : 2, rb = b.k === tpl.p || b.k === tpl.palt ? 0 : b.k === tpl.c || b.k === tpl.alt ? 1 : b.k === tpl.f ? 3 : 2; return ra - rb; });
    return { name:tpl.n, items:items, tot:tot, n:list.length };
  }
  function nuDay(kg, cm, age, sex, act, goal, vs){
    var c = nuCalc(kg, cm, age, sex, act, goal), meals = NU_M.map(function(m){
      var kcalM = c.kcal * m.kc, P = c.P * m.pr, F = c.F * m.kc, C = Math.max(0, (kcalM - 4 * P - 9 * F) / 4);
      var r = nuMeal(m.k, { p:P, c:C, f:F }, (vs || {})[m.k] || 0); r.m = m; r.target = { kcal:kcalM, p:P, c:C, f:F }; return r; });
    return { c:c, meals:meals };
  }
  var nu = { sex:'m', act:1.55, goal:'maintain', v:{ b:0, l:0, d:0 }, log:{}, D:null, W:null, open:false, _t:null };
  function nuKgNow(){ var keys = Object.keys(data).sort(); for(var i = keys.length - 1; i >= 0; i--){ var e = data[keys[i]]; if(e && e.weight != null && +e.weight >= 20 && +e.weight <= 400 && keys[i] <= todayKey) return { kg:+e.weight, date:keys[i] };   /* ignore impossible values (e.g. left by the old typing bug) */ } return null; }
  function nuProf(){ var pr = (typeof profile !== 'undefined' && profile) || {}; return { cm: parseFloat(pr.height) || 172, age: parseInt(pr.age, 10) || 26 }; }
  function nuCompute(){ var W = nuKgNow(); if(!W) return null; var P = nuProf(); var D = nuDay(W.kg, P.cm, P.age, nu.sex, nu.act, nu.goal, nu.v); D.W = W; D.P = P; return D; }
  function nuKgTxt(v){ var r = Math.round(v * 100); return Number(r / 100).toLocaleString('ro-RO', { minimumFractionDigits: r % 10 === 0 ? 1 : 2, maximumFractionDigits: 2 }); }
  function nuN(v, d){ return Number(v).toLocaleString('ro-RO', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 }); }
  function nuSaveCfg(){ var cfg = { sex:nu.sex, act:nu.act, goal:nu.goal, v:nu.v };
    if(useLocal) safeSet('reset_nutri_v1', JSON.stringify(cfg)); else chainWrite('settings/nutri', function(){ return db.doc('settings/nutri').set(cfg); }); }
  function nuSaveLog(){ var o = {}; Object.keys(nu.log).sort().slice(-21).forEach(function(k){ o[k] = nu.log[k]; }); nu.log = o;
    if(useLocal) safeSet('reset_meals_v1', JSON.stringify(o)); else chainWrite('settings/meals', function(){ return db.doc('settings/meals').set({ log:o }); }); }
  function nuQty(k, g){
    var d = NU_F[k];
    if(d.piece){ var n = Math.round(g / d.piece); return n + (n === 1 ? ' ou' : ' ouă') + ' (' + g + ' g)'; }
    if(d.spoon){ var sp = g / d.spoon, w = Math.floor(sp + 0.001), half = Math.abs(sp - w - 0.5) < 0.1; return (sp < 0.75 ? '½ lingură' : (w + (half ? '½' : '')) + (sp < 1.25 ? ' lingură' : ' linguri')) + ' (≈ ' + Math.round(g) + ' g)'; }
    return Math.round(g) + ' g';
  }
  function nuEaten(D){ var m = nu.log[todayKey] || 0, t = { kcal:0, p:0 }; D.meals.forEach(function(x, i){ if(m & (1 << i)){ t.kcal += x.tot.kcal; t.p += x.tot.p; } }); return t; }
  function nuRender(){
    var top = document.getElementById('nuTop'), main = document.getElementById('nuMain'); if(!top || !main) return;
    if(useLocal && !nu._ll){ nu._ll = 1; try{ var c = JSON.parse(safeGet('reset_nutri_v1') || 'null'); if(c){ nu.sex = c.sex === 'f' ? 'f' : 'm'; if([1.375, 1.55, 1.725].indexOf(+c.act) >= 0) nu.act = +c.act; if(['lose', 'maintain', 'gain'].indexOf(c.goal) >= 0) nu.goal = c.goal; nu.v = Object.assign({ b:0, l:0, d:0 }, c.v || {}); } var l = JSON.parse(safeGet('reset_meals_v1') || 'null'); if(l) nu.log = l; }catch(e){} }
    var W = nuKgNow(), P = nuProf(); nu.W = W;
    if(!document.getElementById('nuKg')){
      top.innerHTML = '<div class="nu-w"><div class="nu-wl"><span>Greutatea ta azi</span><div class="nu-kg"><input id="nuKg" type="text" maxlength="7" inputmode="decimal" autocomplete="off" placeholder="0.0" aria-label="Greutate în kg"><em>kg</em></div><small id="nuKgNote"></small></div><div class="nu-bmi"><b id="nuBmi">–</b><span>IMC</span></div></div>';
      var inp = document.getElementById('nuKg');
      function push(){ var v = parseKg(inp.value); if(!(v >= 30 && v <= 250)) return; var cur = nuKgNow(); if(cur && cur.date === todayKey && cur.kg === v) return;      /* unchanged: do not re-render (it would swallow the next tap) */
        var wi = document.getElementById('weightInput'); if(wi){ wi.value = String(v); wi.dispatchEvent(new Event('input', { bubbles:true })); } }
      inp.addEventListener('input', function(){ clearTimeout(nu._t); nu._t = setTimeout(push, 700); }); inp.addEventListener('change', function(){ clearTimeout(nu._t); push(); });
    }
    var inp2 = document.getElementById('nuKg'); if(document.activeElement !== inp2) inp2.value = W ? W.kg : '';
    var note = document.getElementById('nuKgNote'), bmi = document.getElementById('nuBmi');
    if(W){ var d0 = new Date(W.date + 'T00:00:00'); note.textContent = W.date === todayKey ? 'Scrie-o în fiecare dimineață: totul se recalculează singur' : 'ultima notată: ' + d0.getDate() + ' ' + monthShort[d0.getMonth()] + ' · scrie greutatea de azi ca să recalculez'; bmi.textContent = nuN(W.kg / Math.pow(P.cm / 100, 2), 1); }
    else { note.textContent = 'Scrie greutatea și calculez ce ai nevoie'; bmi.textContent = '–'; }
    if(!W){ main.innerHTML = '<div class="nu-empty">⚖️ Scrie mai sus greutatea ta în kg și îți calculez caloriile, proteina și cât trebuie să mănânci la fiecare masă, în grame.</div>'; nu.D = null; return; }
    var D = nuDay(W.kg, P.cm, P.age, nu.sex, nu.act, nu.goal, nu.v); D.W = W; D.P = P; nu.D = D; var c = D.c, eaten = nuEaten(D), mask = nu.log[todayKey] || 0;
    var sum = { kcal:0, p:0, c:0, f:0 }; D.meals.forEach(function(m){ sum.kcal += m.tot.kcal; sum.p += m.tot.p; sum.c += m.tot.c; sum.f += m.tot.f; });
    var h = '<div class="nu-hero"><div class="nu-kc"><b>' + nuN(Math.round(c.kcal / 10) * 10) + '</b><span>kcal pe zi</span></div><div class="nu-mac">' +
      '<div style="--c:#5FBF8F"><b>' + nuN(c.P) + ' g</b><span>Proteină</span></div><div style="--c:#A3FF12"><b>' + nuN(c.C) + ' g</b><span>Carbohidrați</span></div><div style="--c:#E0685C"><b>' + nuN(c.F) + ' g</b><span>Grăsimi</span></div></div>' +
      '<div class="nu-bars"><div><span>Mâncat azi · calorii</span><em>' + nuN(eaten.kcal) + ' / ' + nuN(Math.round(c.kcal / 10) * 10) + '</em><i style="--w:' + Math.min(100, eaten.kcal / c.kcal * 100).toFixed(0) + '%"></i></div><div><span>Mâncat azi · proteină</span><em>' + nuN(eaten.p) + ' / ' + nuN(c.P) + ' g</em><i style="--w:' + Math.min(100, eaten.p / c.P * 100).toFixed(0) + '%;--b:#5FBF8F"></i></div></div>' +
      '<div class="nu-sub">💧 Apă: <b>' + nuN(c.water, 1) + ' L</b> (+0,5 L în zilele de sală sau alergat) · 🌾 Fibre: <b>≥ ' + nuN(c.fiber) + ' g</b></div></div>';
    D.meals.forEach(function(m, i){
      var done = !!(mask & (1 << i));
      h += '<div class="nu-meal' + (done ? ' done' : '') + '" data-m="' + i + '"><div class="nu-mh"><span class="nu-mi">' + m.m.ic + '</span><div class="nu-mt0"><b>' + m.m.n + '</b><small>≈ ' + nuN(m.tot.kcal) + ' kcal · ' + nuN(m.tot.p) + ' g proteină</small></div><button class="nu-eat" data-eat="' + i + '">' + (done ? '✓ Mâncat' : 'Am mâncat') + '</button></div>' +
        '<div class="nu-mn">' + m.name + '</div><ul class="nu-it">' + m.items.map(function(it){ var d = NU_F[it.k]; return '<li><i>' + d.ic + '</i><span>' + d.n + '</span><b>' + nuQty(it.k, it.g) + '</b></li>'; }).join('') + '</ul>' +
        '<div class="nu-mx"><span>P <b>' + nuN(m.tot.p) + '</b></span><span>C <b>' + nuN(m.tot.c) + '</b></span><span>G <b>' + nuN(m.tot.f) + '</b></span><span><b>' + nuN(m.tot.kcal) + '</b> kcal</span></div>' +
        '<button class="ghost-btn nu-var" data-var="' + i + '">↻ Altă variantă (' + ((((nu.v[m.m.k] || 0) % m.n) + m.n) % m.n + 1) + '/' + m.n + ')</button></div>';
    });
    var agg = {}; D.meals.forEach(function(m){ m.items.forEach(function(it){ agg[it.k] = (agg[it.k] || 0) + it.g; }); });
    h += '<div class="nu-shop"><div class="nu-sh">🛒 Tot ce îți trebuie azi</div><div class="nu-chips">' + Object.keys(agg).sort(function(a, b){ return agg[b] - agg[a]; }).map(function(k){ return '<span>' + NU_F[k].ic + ' ' + NU_F[k].n.split(' (')[0] + ' <b>' + nuQty(k, agg[k]) + '</b></span>'; }).join('') + '</div></div>';
    h += '<button class="ghost-btn nu-cfg" id="nuCfg" aria-expanded="' + (nu.open ? 'true' : 'false') + '">⚙️ Setări și cum am calculat ' + (nu.open ? '▴' : '▾') + '</button>';
    if(nu.open){
      var pill = function(grp, val, txt, on){ return '<button data-g="' + grp + '" data-v="' + val + '" class="' + (on ? 'on' : '') + '">' + txt + '</button>'; };
      h += '<div class="nu-set"><div class="nu-sl">Sex</div><div class="nu-pills">' + pill('sex', 'm', 'Bărbat', nu.sex === 'm') + pill('sex', 'f', 'Femeie', nu.sex === 'f') + '</div>' +
        '<div class="nu-sl">Cât te miști</div><div class="nu-pills">' + pill('act', '1.375', 'Ușor · 1–3 antrenamente', nu.act === 1.375) + pill('act', '1.55', 'Mediu · 3–5', nu.act === 1.55) + pill('act', '1.725', 'Mult · 6–7', nu.act === 1.725) + '</div>' +
        '<div class="nu-sl">Obiectiv</div><div class="nu-pills">' + pill('goal', 'lose', 'Slăbesc', nu.goal === 'lose') + pill('goal', 'maintain', 'Mențin', nu.goal === 'maintain') + pill('goal', 'gain', 'Cresc masa', nu.goal === 'gain') + '</div>' +
        '<div class="nu-how"><b>Cum am calculat</b><br>Date: ' + nuKgTxt(W.kg) + ' kg, ' + P.cm + ' cm, ' + P.age + ' ani.<br>Metabolism de bază (Mifflin-St Jeor): <b>' + nuN(c.bmr) + ' kcal</b>. Cu mișcarea ta: <b>' + nuN(c.tdee) + ' kcal</b>. ' + (nu.goal === 'lose' ? 'Slăbești încet: −15%.' : nu.goal === 'gain' ? 'Masă musculară: +10%.' : 'Menținere: fără schimbare.') + '<br>Proteină <b>' + (nu.goal === 'lose' ? '2,0' : nu.goal === 'gain' ? '1,9' : '1,8') + ' g/kg</b>, grăsimi cel puțin 0,8 g/kg (min. 25% din calorii), restul carbohidrați. Mesele: 28% dimineața, 40% la prânz, 32% seara.<br>Cântărești carnea <b>crudă</b>; orezul, pastele, ovăzul, quinoa și lintea <b>uscate</b>.</div></div>';
    }
    h += '<div class="hint">Estimare orientativă, nu sfat medical. Dacă ai probleme de sănătate sau ești însărcinată, vorbește cu medicul sau cu un dietetician. Fără zahăr adăugat și fără produse procesate, cum ți-ai propus.</div>';
    main.innerHTML = h;
    main.querySelectorAll('[data-eat]').forEach(function(b){ b.addEventListener('click', function(){ var i = +b.getAttribute('data-eat'); nu.log[todayKey] = (nu.log[todayKey] || 0) ^ (1 << i); nuSaveLog(); nuRender(); }); });
    main.querySelectorAll('[data-var]').forEach(function(b){ b.addEventListener('click', function(){ var k = NU_M[+b.getAttribute('data-var')].k; nu.v[k] = ((nu.v[k] || 0) + 1) % NU_T[k].length; nuSaveCfg(); nuRender(); }); });
    var cf = document.getElementById('nuCfg'); if(cf) cf.addEventListener('click', function(){ nu.open = !nu.open; nuRender(); });
    main.querySelectorAll('.nu-pills button').forEach(function(b){ b.addEventListener('click', function(){ var g = b.getAttribute('data-g'), v = b.getAttribute('data-v'); if(g === 'sex') nu.sex = v; else if(g === 'act') nu.act = +v; else nu.goal = v; nuSaveCfg(); nuRender(); }); });
  }
  function nuAnswer(t){        // for Jarvis
    var D = nuCompute(); if(!D) return 'ZyP, nu ai notat încă greutatea. Scrie-o în Mâncare, Calculator, și îți spun tot.';
    var c = D.c, pick = /dimineata|mic dejun/.test(t) ? 0 : /pranz/.test(t) ? 1 : /seara|cina/.test(t) ? 2 : -1;
    if(pick >= 0){ var m = D.meals[pick]; return 'ZyP, ' + m.m.n.toLowerCase() + ' mănânci ' + m.name.toLowerCase() + ': ' + m.items.map(function(it){ return NU_F[it.k].n.split(' (')[0].toLowerCase().replace(' / ', ' sau ') + ' ' + nuQty(it.k, it.g).replace(/ \(.*\)/, '').replace(' g', ' de grame'); }).join(', ') + '. Asta înseamnă aproximativ ' + nuN(m.tot.kcal) + ' calorii și ' + nuN(m.tot.p) + ' grame de proteină.'; }
    var e = nuEaten(D);
    return 'ZyP, la ' + nuKgTxt(D.W.kg) + ' kilograme ai nevoie azi de aproximativ ' + nuN(Math.round(c.kcal / 10) * 10) + ' calorii și ' + nuN(c.P) + ' grame de proteină, adică ' + nuN(D.meals[0].target.p) + ' dimineața, ' + nuN(D.meals[1].target.p) + ' la prânz și ' + nuN(D.meals[2].target.p) + ' seara. Plus ' + nuN(c.water, 1) + ' litri de apă. ' + (e.kcal ? 'Ai mâncat deja ' + nuN(e.kcal) + ' calorii și ' + nuN(e.p) + ' grame de proteină.' : '');
  }
  setTimeout(function(){ var b = document.querySelector('[data-fseg="calc"]'); if(b) b.click(); nuRender(); }, 0);
  function renderGoldMini(){
    var m = document.getElementById('goldMini'); if(!m) return; if(!window.SHOW_GOLD){ m.style.display = 'none'; return; } if(!gold) return;
    var g = gold, up = g.change >= 0, c = g.confluence || { verdict: g.bias };
    m.innerHTML = '<div class="card-title">XAUUSD · Aur</div><div class="gm-row"><div><div class="gm-p" id="gmPrice">' + f2(liveSpot != null ? liveSpot : g.price) + '</div>' +
      '<div class="gd-chg ' + (up?'pos':'neg') + '">' + (up?'+':'') + f2(g.change) + ' (' + (up?'+':'') + g.changePct + '%)</div></div>' +
      '<div style="text-align:right"><div class="gm-v ' + c.verdict + '">' + (c.verdict === 'BUY' ? '🟢 BUY' : c.verdict === 'SELL' ? '🔴 SELL' : '⏳ AȘTEAPTĂ') + '</div>' +
      '<div class="gd-sub">' + (g.strategies ? g.strategies.length + ' strategii' : '') + '</div></div></div>' +
      '<button class="primary-btn" id="gmOpen" style="margin-top:12px;">Deschide analiza completă →</button>';
    document.getElementById('gmOpen').addEventListener('click', function(){ var t = document.querySelector('.tab[data-view="gold"]'); if(t) t.click(); try{ window.scrollTo(0,0); }catch(e){} });
  }
  function drawGoldChart(wrapId, scOv, opt){
    opt = opt || {};
    var wrap = document.getElementById(wrapId || 'chWrap'); if(!wrap || !gold) return;
    if(!wrapId && goldChart === 'tv'){
      if(wrap.getAttribute('data-tv') === '1') return;
      wrap.setAttribute('data-tv','1');
      var dark = !document.documentElement.getAttribute('data-theme') || document.documentElement.getAttribute('data-theme') !== 'light';
      wrap.innerHTML = '<div class="tradingview-widget-container tv-box"><div class="tradingview-widget-container__widget" style="height:100%;width:100%"></div></div>';
      var sc = document.createElement('script');
      sc.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js'; sc.async = true;
      sc.innerHTML = JSON.stringify({ autosize:true, symbol:'OANDA:XAUUSD', interval:'60', timezone:'Etc/UTC', theme: dark ? 'dark' : 'light', style:'1', locale:'ro',
        allow_symbol_change:true, hide_side_toolbar:false, withdateranges:true, studies:['STD;EMA','STD;RSI'], support_host:'https://www.tradingview.com' });
      wrap.firstChild.appendChild(sc);
      return;
    }
    wrap.removeAttribute('data-tv');
    var g = gold, C = g.candles || [];
    if(!C.length){ wrap.innerHTML = '<div class="hint" style="padding:12px;margin:0;">Graficul apare la următoarea actualizare automată.</div>'; return; }
    var tf = opt.tf || 'D1', intra = tf !== 'D1';
    var e20, e50;
    if(intra){
      C = intradayCandles(tf);
      if(C.length < 3){
        var myId0 = wrapId || 'chWrap';
        wrap.innerHTML = '<div class="ch-tf">' + ['5m','15m','1h','D1'].map(function(t){ return '<button data-tf="' + t + '" class="' + (t === tf ? 'on' : '') + '">' + t + '</button>'; }).join('') + '</div>' +
          '<div class="hint" style="padding:12px;margin:0;">' + (intraFailed ? 'Prețurile intraday nu sunt disponibile acum. Apasă D1 sau încearcă din nou peste un minut.' : 'Se încarcă prețurile live…') + '</div>';
        wrap.querySelectorAll('.ch-tf button').forEach(function(b){ b.addEventListener('click', function(){ goldTf[myId0] = b.getAttribute('data-tf'); var o2 = {}; for(var k in opt) o2[k] = opt[k]; o2.tf = goldTf[myId0]; if(o2.tf !== 'D1'){ intraAt = 0; fetchIntraday(); } drawGoldChart(wrapId, scOv, o2); }); });
        goldCharts[myId0] = { scOv:scOv, opt:opt };
        return;
      }
      var cl = C.map(function(k){ return k[4]; });
      e20 = emaJS(cl, 20); e50 = emaJS(cl, 50);
    } else {
      C = liveD1(C).slice(-60);
      e20 = (g.ema20s || []).slice(-60); e50 = (g.ema50s || []).slice(-60);
      if(e20.length < C.length){ e20 = e20.concat([null]); e50 = e50.concat([null]); }
      e20 = e20.slice(-C.length); e50 = e50.slice(-C.length);
    }
    var nowP = liveSpot != null ? liveSpot : g.price;
    var side = goldChartSide || (g.scenarios.filter(function(x){ return x.main; })[0] || g.scenarios[0]).side;
    var sc2 = scOv || g.scenarios.filter(function(x){ return x.side === side; })[0];
    var W = 360, H = 230, padL = 4, padR = 64, padT = 10, padB = 18;
    var lo = Infinity, hi = -Infinity;
    C.forEach(function(k){ lo = Math.min(lo, k[3]); hi = Math.max(hi, k[2]); });
    lo = Math.min(lo, nowP); hi = Math.max(hi, nowP);
    var tlNow = [g.trend && g.trend.sup && g.trend.sup.now, g.trend && g.trend.res && g.trend.res.now].filter(function(v){ return v != null; });
    if(!intra){ [g.levels.R1, g.levels.S1, sc2.sl, sc2.tp1].concat(tlNow).forEach(function(v){ lo = Math.min(lo, v); hi = Math.max(hi, v); }); }
    else {
      var span = Math.max(hi - lo, (g.atr || 30) * 0.25);
      [sc2.entry, sc2.sl, sc2.tp1, g.levels.R1, g.levels.S1, g.pivots && g.pivots.P].concat(tlNow).forEach(function(v){ if(v != null && v > lo - span * 0.8 && v < hi + span * 0.8){ lo = Math.min(lo, v); hi = Math.max(hi, v); } });
    }
    var pad = (hi - lo) * 0.04; lo -= pad; hi += pad;
    var cw = (W - padL - padR) / C.length;
    var X = function(i){ return padL + i * cw + cw / 2; };
    var Y = function(v){ return padT + (H - padT - padB) * (1 - (v - lo) / (hi - lo)); };
    var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg">';
    // grid
    for(var gi=0; gi<=4; gi++){ var gv = lo + (hi - lo) * gi / 4, gy = Y(gv).toFixed(1);
      svg += '<line x1="' + padL + '" x2="' + (W - padR) + '" y1="' + gy + '" y2="' + gy + '" stroke="var(--line)" stroke-width="0.5"/>'; }
    // entry zone band
    var clampY = function(v){ return Math.max(padT, Math.min(H - padB, Y(v))); };
    var zy1 = clampY(sc2.zone[1]), zy2 = clampY(sc2.zone[0]);
    svg += '<rect x="' + padL + '" y="' + zy1.toFixed(1) + '" width="' + (W - padL - padR) + '" height="' + Math.max(1, zy2 - zy1).toFixed(1) + '" fill="var(--gold)" opacity="0.13"/>';
    // horizontal levels
    var labels = [], offTop = [], offBot = [];
    function hline(v, col, dash, label, strong){
      if(v == null) return;
      if(v > hi || v < lo){
        var arr = v > hi ? offTop : offBot, ex = arr.filter(function(o){ return Math.abs(o.v - v) < 0.01; })[0];
        if(ex) ex.t = label + '·' + ex.t; else arr.push({ v:v, t:label, col:col }); return;
      }
      var y = Y(v).toFixed(1);
      svg += '<line x1="' + padL + '" x2="' + (W - padR) + '" y1="' + y + '" y2="' + y + '" stroke="' + col + '" stroke-width="' + (strong ? 1.1 : 0.7) + '"' + (dash ? ' stroke-dasharray="4 3"' : '') + ' opacity="0.9"/>';
      var same = labels.filter(function(l){ return Math.abs(l.v - v) < (hi - lo) * 0.004; })[0];
      if(same){ same.t = label + '·' + same.t; if(strong){ same.col = col; } }
      else labels.push({ v:v, y:+y, t:label, col:col, strong:strong });
    }
    function drawLabels(){
      labels.sort(function(a,b){ return a.y - b.y; });
      var gap = 11.5;
      for(var i=1;i<labels.length;i++){ if(labels[i].y - labels[i-1].y < gap) labels[i].y = labels[i-1].y + gap; }
      for(var j=labels.length-1;j>=0;j--){ var maxY = H - padB - 2 - (labels.length - 1 - j) * gap; if(labels[j].y > maxY) labels[j].y = maxY; if(j>0 && labels[j].y - labels[j-1].y < gap) labels[j-1].y = labels[j].y - gap; }
      labels.forEach(function(l){
        svg += '<rect x="' + (W - padR + 1) + '" y="' + (l.y - 5.5).toFixed(1) + '" width="' + (padR - 2) + '" height="11" rx="2" fill="' + l.col + '" opacity="0.22"/>' +
          '<text x="' + (W - padR + 3.5) + '" y="' + (l.y + 3).toFixed(1) + '" font-size="' + (l.t.length > 9 ? 6.4 : 7.5) + '" font-weight="700" fill="' + l.col + '" font-family="monospace">' + l.t + ' ' + l.v.toFixed(0) + '</text>';
      });
    }
    hline(g.levels.R2, 'var(--danger)', true, 'R2'); hline(g.levels.R1, 'var(--danger)', true, 'R1');
    hline(g.levels.S1, 'var(--accent)', true, 'S1'); hline(g.levels.S2, 'var(--accent)', true, 'S2');
    hline(sc2.tp2, '#3DE0C4', false, 'TP2', true); hline(sc2.tp1, '#3DE0C4', false, 'TP1', true);
    hline(sc2.sl, '#FF4D4D', false, 'SL', true); hline(sc2.entry, 'var(--gold)', false, 'IN', true);
    // trend lines (from the daily analysis)
    var cpId = 'tlc' + String(wrapId || 'chWrap').replace(/[^a-z0-9]/gi, '');
    svg += '<clipPath id="' + cpId + '"><rect x="' + padL + '" y="' + padT + '" width="' + (W - padL - padR) + '" height="' + (H - padT - padB) + '"/></clipPath>';
    ['sup', 'res'].forEach(function(k){
      var t = g.trend && g.trend[k]; if(!t) return;
      var col = k === 'sup' ? 'var(--accent)' : 'var(--danger)', dash = t.conf ? '' : ' stroke-dasharray="5 3"', arr = t.dir === 'asc' ? '↗' : '↘';
      var x0, y0, x1, y1, a1 = null, a2 = null;
      if(!intra){
        var i1 = -1, i2 = -1; C.forEach(function(c, j){ if(c[0] === t.p1.d) i1 = j; if(c[0] === t.p2.d) i2 = j; });
        var st = i1 >= 0 ? i1 : 0, last = C.length - 1;
        x0 = X(st); y0 = Y(t.now + t.slope * (st - last)); x1 = X(last); y1 = Y(t.now);       // anchored on today's value, so it also works when the anchors are older than the chart
        if(i1 >= 0) a1 = [X(i1), Y(t.p1.p)]; if(i2 >= 0) a2 = [X(i2), Y(t.p2.p)];
      } else { x0 = padL; x1 = W - padR; y0 = y1 = Y(t.now); }
      svg += '<g clip-path="url(#' + cpId + ')"><line x1="' + x0.toFixed(1) + '" y1="' + y0.toFixed(1) + '" x2="' + x1.toFixed(1) + '" y2="' + y1.toFixed(1) + '" stroke="' + col + '" stroke-width="' + (t.status === 'broken' ? 1 : 1.7) + '"' + dash + (t.status === 'broken' ? ' opacity="0.45"' : '') + '/>';
      [a1, a2].forEach(function(a){ if(a) svg += '<circle cx="' + a[0].toFixed(1) + '" cy="' + a[1].toFixed(1) + '" r="3" fill="var(--bg)" stroke="' + col + '" stroke-width="1.4"/>'; });
      svg += '</g>';
      labels.push({ v:t.now, y:Y(t.now), t:'TREND' + arr, col:col, strong:true });
    });
    // EMAs
    function pathOf(arr, col){ var d = ''; arr.forEach(function(v, i){ if(v == null) return; d += (d ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(v).toFixed(1); });
      return '<path d="' + d + '" fill="none" stroke="' + col + '" stroke-width="1.1" opacity="0.85"/>'; }
    svg += pathOf(e50, 'var(--gold)') + pathOf(e20, '#6C8CFF');
    // candles
    C.forEach(function(k, i){
      var up = k[4] >= k[1], col = up ? 'var(--accent)' : 'var(--danger)', x = X(i);
      var yo = Y(k[1]), yc = Y(k[4]);
      svg += '<line x1="' + x.toFixed(1) + '" x2="' + x.toFixed(1) + '" y1="' + Y(k[2]).toFixed(1) + '" y2="' + Y(k[3]).toFixed(1) + '" stroke="' + col + '" stroke-width="0.8"/>' +
        '<rect x="' + (x - cw * 0.34).toFixed(1) + '" y="' + Math.min(yo, yc).toFixed(1) + '" width="' + (cw * 0.68).toFixed(1) + '" height="' + Math.max(0.8, Math.abs(yc - yo)).toFixed(1) + '" fill="' + col + '"/>';
    });
    // trade markers: where it entered / where it closed
    (opt.marks || []).forEach(function(mk){
      var idx = -1;
      for(var mi = 0; mi < C.length; mi++){ var key = intra ? C[mi][5] : C[mi][0]; if(key <= (intra ? mk.ts : mk.d)) idx = mi; }
      if(idx < 0) return;
      var mx = X(idx), my = Y(mk.p);
      if(my < padT || my > H - padB) return;
      svg += '<line x1="' + mx.toFixed(1) + '" x2="' + mx.toFixed(1) + '" y1="' + padT + '" y2="' + (H - padB) + '" stroke="' + mk.col + '" stroke-width="0.6" stroke-dasharray="2 2" opacity="0.7"/>' +
        '<circle cx="' + mx.toFixed(1) + '" cy="' + my.toFixed(1) + '" r="4.5" fill="' + mk.col + '" stroke="var(--bg)" stroke-width="1.5"/>' +
        '<rect x="' + (mx - 20).toFixed(1) + '" y="' + (my - 17).toFixed(1) + '" width="40" height="11" rx="3" fill="' + mk.col + '"/>' +
        '<text x="' + mx.toFixed(1) + '" y="' + (my - 9).toFixed(1) + '" text-anchor="middle" font-size="7" font-weight="800" fill="#111" font-family="sans-serif">' + mk.t + '</text>';
    });
    // last price marker
    var lp = Y(nowP).toFixed(1);
    svg += '<line x1="' + padL + '" x2="' + (W - padR) + '" y1="' + lp + '" y2="' + lp + '" stroke="var(--text)" stroke-width="0.5" stroke-dasharray="1 2"/>';
    // date labels
    [0, Math.floor(C.length / 2), C.length - 1].forEach(function(i){ var dd = intra ? new Date(C[i][5] * 1000) : new Date(C[i][0] + 'T00:00:00');
      svg += '<text x="' + X(i).toFixed(1) + '" y="' + (H - 5) + '" font-size="7.5" fill="var(--text-faint)" text-anchor="' + (i === 0 ? 'start' : i === C.length - 1 ? 'end' : 'middle') + '" font-family="monospace">' + (intra ? hhmm(dd) : dd.getDate() + ' ' + monthShort[dd.getMonth()]) + '</text>'; });
    labels.push({ v:nowP, y:+lp, t:(liveSpot != null ? 'LIVE' : 'ACUM'), col:'var(--text)' });
    drawLabels();
    function offText(arr, y, arrow){
      if(!arr.length) return;
      arr.sort(function(a,b){ return arrow === '↑' ? a.v - b.v : b.v - a.v; });
      var x = padL + 4;
      svg += '<rect x="' + padL + '" y="' + (y - 8) + '" width="' + (W - padL - padR) + '" height="11" fill="var(--bg-card-2)" opacity="0.75"/>';
      arr.forEach(function(o){ var t = arrow + ' ' + o.t + ' ' + o.v.toFixed(0);
        svg += '<text x="' + x + '" y="' + y + '" font-size="7" font-weight="700" fill="' + o.col + '" font-family="monospace">' + t + '</text>'; x += t.length * 4.3 + 8; });
    }
    offText(offTop, padT + 1, '↑'); offText(offBot, H - padB - 2, '↓');
    svg += '</svg>';
    var tfBar = opt.noTf ? '' : '<div class="ch-tf">' + ['5m','15m','1h','D1'].map(function(t){ return '<button data-tf="' + t + '" class="' + (t === tf ? 'on' : '') + '">' + t + '</button>'; }).join('') + '<span class="ch-live">' + (intra ? '● LIVE' : 'D1 + preț live') + '</span></div>';
    wrap.innerHTML = tfBar + (scOv && !opt.plan ? '' : opt.plan ? '' : '<div class="ch-scn"><button data-s="BUY" class="' + (side==='BUY'?'on':'') + '">🟢 Arată BUY</button><button data-s="SELL" class="' + (side==='SELL'?'on':'') + '">🔴 Arată SELL</button></div>') + svg +
      '<div class="ch-leg"><span><i style="background:#6C8CFF"></i>EMA20</span><span><i style="background:var(--gold)"></i>EMA50</span><span><i style="background:var(--accent);height:2px"></i>linie trend</span><span><i style="background:var(--gold);opacity:.4;height:8px"></i>zonă intrare</span><span><i style="background:#FF4D4D"></i>SL</span><span><i style="background:#3DE0C4"></i>TP</span><span>' + (intra ? C.length + ' lumânări · ' + tf : '60 zile · D1') + '</span></div>';
    var myId = wrapId || 'chWrap';
    wrap.querySelectorAll('.ch-scn button').forEach(function(b){ b.addEventListener('click', function(){ goldChartSide = b.getAttribute('data-s'); drawGoldChart(wrapId, scOv, opt); }); });
    wrap.querySelectorAll('.ch-tf button').forEach(function(b){ b.addEventListener('click', function(){
      goldTf[myId] = b.getAttribute('data-tf'); try{ localStorage.setItem('byzyp_gtf', JSON.stringify(goldTf)); }catch(e){}
      var o2 = {}; for(var k in opt) o2[k] = opt[k]; o2.tf = goldTf[myId];
      if(o2.tf !== 'D1') fetchIntraday();
      drawGoldChart(wrapId, scOv, o2); }); });
    goldCharts[myId] = { scOv:scOv, opt:opt };
  }
  /* ---- live intraday data (xaus.com, 2-min samples, 48h) ---- */
  var goldTf = { chWrap:'15m', planChart:'15m', sxChart:'D1' }, goldCharts = {}, intraPts = [], intraAt = 0, intraK = {}, intraFailed = false;
  try{ var _t = JSON.parse(localStorage.getItem('byzyp_gtf') || '{}'); for(var _k in _t) goldTf[_k] = _t[_k]; }catch(e){}
  function fetchIntraday(){
    if(Date.now() - intraAt < 50000 && (intraPts.length || Object.keys(intraK).length)) return;
    intraAt = Date.now();
    var hosts = ['https://data-api.binance.vision', 'https://api.binance.com'];
    var tfs = { '5m':'5m', '15m':'15m', '1h':'1h' }, pending = 3, anyOk = false;
    function done(){ if(--pending > 0) return; if(!anyOk) fetchXaus(); else { intraFailed = false; redrawLiveCharts(); } }
    Object.keys(tfs).forEach(function(tf){
      (function tryHost(i){
        if(i >= hosts.length){ done(); return; }
        fetch(hosts[i] + '/api/v3/klines?symbol=PAXGUSDT&interval=' + tfs[tf] + '&limit=' + (tf === '1h' ? 48 : 64), { cache:'no-store' })
          .then(function(r){ if(!r.ok) throw 0; return r.json(); })
          .then(function(a){ intraK[tf] = a.map(function(k){ return [Math.floor(k[0] / 1000), +k[1], +k[2], +k[3], +k[4]]; }); anyOk = true; done(); })
          .catch(function(){ tryHost(i + 1); });
      })(0);
    });
  }
  function fetchXaus(){
    fetch('https://xaus.com/api/v1/intraday?symbol=xau&hours=48', { cache:'no-store' }).then(function(r){ if(!r.ok) throw 0; return r.json(); }).then(function(j){
      intraPts = (j.points || []).filter(function(x){ return x && x.t && x.p; }).sort(function(a,b){ return a.t - b.t; });
      intraFailed = intraPts.length < 10; redrawLiveCharts();
    }).catch(function(){ intraFailed = true; redrawLiveCharts(); });
  }
  function intradayCandles(tf){
    var sec = tf === '5m' ? 300 : tf === '1h' ? 3600 : 900, maxN = tf === '1h' ? 48 : 64;
    var K = intraK[tf];
    if(K && K.length > 2){
      // PAXG tracks 1 oz of gold; shift it onto the live XAUUSD spot so levels line up
      var off = liveSpot != null ? liveSpot - K[K.length - 1][4] : 0;
      var out2 = K.map(function(k){ return ['', k[1] + off, k[2] + off, k[3] + off, k[4] + off, k[0]]; });
      if(liveSpot != null){ var lk = out2[out2.length - 1]; lk[4] = liveSpot; lk[2] = Math.max(lk[2], liveSpot); lk[3] = Math.min(lk[3], liveSpot); }
      return out2.slice(-maxN);
    }
    var pts = intraPts.slice();
    if(liveSpot != null) pts.push({ t: Math.floor(Date.now() / 1000), p: liveSpot });
    var out = [], cur = null;
    pts.forEach(function(x){ var b = Math.floor(x.t / sec) * sec;
      if(!cur || cur[5] !== b){ cur = ['', x.p, x.p, x.p, x.p, b]; out.push(cur); }
      else { cur[2] = Math.max(cur[2], x.p); cur[3] = Math.min(cur[3], x.p); cur[4] = x.p; } });
    return out.slice(-maxN);
  }
  function emaJS(v, n){ var k = 2 / (n + 1), e = null, out = [];
    v.forEach(function(x, i){ e = e == null ? x : x * k + e * (1 - k); out.push(i >= Math.min(n, v.length) - 1 ? e : null); }); return out; }
  function liveD1(C){
    C = (C || []).map(function(k){ return k.slice(); });
    if(liveSpot == null || !C.length) return C;
    var today = new Date().toISOString().slice(0, 10), last = C[C.length - 1];
    if(last[0] === today){ last[4] = liveSpot; last[2] = Math.max(last[2], liveSpot); last[3] = Math.min(last[3], liveSpot); }
    else if(new Date().getUTCDay() !== 6){ C.push([today, last[4], Math.max(last[4], liveSpot), Math.min(last[4], liveSpot), liveSpot]); }
    return C;
  }
  function redrawLiveCharts(){
    Object.keys(goldCharts).forEach(function(id){
      var el = document.getElementById(id); if(!el || el.offsetParent === null) return;
      var c = goldCharts[id], o2 = {}; for(var k in c.opt) o2[k] = c.opt[k]; o2.tf = goldTf[id] || o2.tf || 'D1';
      drawGoldChart(id === 'chWrap' ? undefined : id, c.scOv, o2);
    });
  }
  setInterval(function(){ fetchIntraday(); redrawLiveCharts(); if(tdCurrent && document.getElementById('tdSheet') && document.getElementById('tdSheet').classList.contains('open')) openTrade(tdCurrent); }, 60000);
  try{ goldRisk = parseFloat(localStorage.getItem('byzyp_gold_risk')) || 1; }catch(e){}
  function f2(n){ return Number(n).toLocaleString('en-US', { minimumFractionDigits:2, maximumFractionDigits:2 }); }
  function curBalance(){
    var st = (typeof eqStart === 'number') ? eqStart : 0;
    return st + trades.reduce(function(a,t){ return a + (t.result||0); }, 0);
  }
  function loadGold(){
    fetch('xauusd.json?t=' + Date.now(), { cache:'no-store' }).then(function(r){ if(!r.ok) throw new Error(r.status); return r.json(); })
      .then(function(j){ gold = j; renderGold(); })
      .catch(function(){ var b = document.getElementById('goldBox'); if(b && !gold){ var tp = document.getElementById('goldTop'); if(tp) tp.innerHTML = '<div class="hint" style="margin-top:0;">Analiza apare după prima rulare automată pe GitHub.</div>'; } });
  }
  function renderGold(){
    var box = document.getElementById('goldBox'); if(!box || !gold) return;
    var g = gold, up = g.change >= 0;
    var meter = ''; for(var i=-5;i<=5;i++){ if(i===0) continue; var on = (g.score>0 && i>0 && i<=g.score) || (g.score<0 && i<0 && i>=g.score); meter += '<i class="' + (on ? (i>0?'on-b':'on-s') : '') + '"></i>'; }
    var upd = new Date(g.updated);
    var html = '<div class="gd-btns"><a class="term-btn" href="https://www.tradingview.com/chart/?symbol=OANDA%3AXAUUSD" target="_blank" rel="noopener">📈 TradingView</a><button class="term-btn" data-act="terminal">🖥️ Terminal</button></div><div class="gd-top"><div><div class="gd-sym">XAUUSD · AUR <span class="live-tag" id="gdLiveTag"></span></div><div class="gd-price" id="gdPrice">' + f2(g.price) + '</div>' +
      '<div class="gd-chg ' + (up?'pos':'neg') + '" id="gdChg">' + (up?'+':'') + f2(g.change) + ' (' + (up?'+':'') + g.changePct + '%) azi</div></div>' +
      '<div class="gd-bias"><div class="gd-badge ' + g.bias + '">' + g.bias + '</div><div class="gd-meter">' + meter + '</div><div class="gd-sub">scor ' + (g.score>0?'+':'') + g.score + ' din 5</div></div></div>';

    html += '\u0001head\u0002';
    // USD red news soon
    var evs = (newsData && newsData.events) ? newsData.events : [];
    var now = Date.now();
    var hot = evs.filter(function(e){ var t = new Date(e.t).getTime(); return e.i === 'High' && e.c === 'USD' && t > now - 30*60000 && t < now + 6*3600000; })
      .sort(function(a,b){ return new Date(a.t) - new Date(b.t); })[0];
    if(hot){ var ht = new Date(hot.t); html += '<div class="gd-alert">⚠️ <b>Știre roșie USD</b> la ' + hhmm(ht) + ': ' + zEsc(hot.title) + '. Aurul se poate mișca brusc cu zeci de dolari. Mulți traderi nu deschid poziții cu 30 min înainte și după.</div>'; }

    html += '\u0001nar\u0002';
    // plain-language explanation + plan
    if(g.story){
      html += '<div class="nar"><h4>📖 Ce s-a întâmplat</h4>' + g.story.map(function(t){ return '<p>' + t + '</p>'; }).join('') + '</div>';
      html += '<div class="nar"><h4>📍 Unde suntem acum</h4>' + g.where.map(function(t){ return '<p>' + t + '</p>'; }).join('') + '</div>';
      html += '<div class="nar plan"><h4>🧭 Ce ar trebui să faci, pas cu pas</h4>' + g.plan.map(function(t){ return '<p>' + t + '</p>'; }).join('') + '</div>';
    }

    // chart: own analysis chart + live TradingView
    html += '\u0001chart\u0002<div class="ch-wrap" id="chWrap" style="margin-top:0;"></div>';

    html += '\u0001conf\u0002';
    // confluence + multi-timeframe + session
    html += '<div class="gd-sec" style="margin-top:0;">📡 Planul pe graficul live</div><div class="ch-wrap" id="planChart" style="margin-top:0;"></div><div class="hint" id="planChartNote" style="margin-top:6px;"></div><div id="planActive"></div>';
    if(g.confluence){
      var c = g.confluence, tw = Math.max(1, c.total), wait = tw - c.buy - c.sell;
      var cvText = c.verdict === 'BUY' ? 'Mai multe strategii spun CUMPĂRARE' : c.verdict === 'SELL' ? 'Mai multe strategii spun VÂNZARE' : 'Strategiile nu sunt de acord: răbdare';
      html += '<div class="cf"><div class="cf-top"><div><div class="cf-l">Verdictul celor ' + g.strategies.length + ' strategii</div><div class="cf-v ' + c.verdict + '">' + (c.verdict === 'AȘTEAPTĂ' ? '⏳ AȘTEAPTĂ' : (c.verdict === 'BUY' ? '🟢 BUY' : '🔴 SELL')) + '</div></div>' +
        '<div style="text-align:right;font-size:11.5px;color:var(--text-dim);max-width:52%;">' + cvText + '</div></div>' +
        '<div class="cf-bar"><i class="b" style="width:' + (c.buy/tw*100) + '%"></i><i class="w" style="width:' + (wait/tw*100) + '%"></i><i class="s" style="width:' + (c.sell/tw*100) + '%"></i></div>' +
        '<div class="cf-leg"><span>BUY ' + c.buyN + '</span><span>neutre ' + c.waitN + '</span><span>SELL ' + c.sellN + '</span></div></div>';
    }
    if(g.mtf){
      var arrow = function(d){ return d === 'UP' ? '▲' : d === 'DOWN' ? '▼' : '◆'; };
      html += '<div class="mtf">' + ['D1','H4','H1'].map(function(k){ var m = g.mtf[k]; if(!m) return '<div><span style="color:var(--text-faint)">' + k + '</span><b style="color:var(--text-faint)">–</b></div>';
        return '<div class="' + m.dir + '"><span style="color:var(--text-faint)">' + k + '</span><b>' + arrow(m.dir) + ' ' + (m.dir === 'UP' ? 'SUS' : m.dir === 'DOWN' ? 'JOS' : 'MIXT') + '</b></div>'; }).join('') + '</div>';
    }
    if(g.session){ html += '<div class="sess">🕒 Sesiune (la ultima actualizare): <b>' + g.session.active.join(' + ') + '</b>. ' + g.session.note + '</div>'; }

    var allStart = html.length;
    html += '\u0001strat\u0002';
    // scenarios (main first)
    var sc = g.scenarios.slice().sort(function(a,b){ return (b.main?1:0) - (a.main?1:0); });
    html += '<div class="gd-sec">Scenarii de azi</div>';
    sc.forEach(function(x){
      html += '<div class="sc' + (x.main?' main':'') + '"><div class="sc-h"><div class="sc-t ' + x.side + '">' + (x.side==='BUY'?'🟢 BUY':'🔴 SELL') + '</div>' +
        '<span class="sc-tag' + (x.main?'':' alt') + '">' + (x.main ? 'ÎN DIRECȚIA TRENDULUI' : (g.bias==='NEUTRU' ? 'PIAȚĂ NEUTRĂ' : 'CONTRA TREND · RISC MARE')) + '</span></div>' +
        '<div class="sc-row"><span>Zonă intrare</span><b>' + f2(x.zone[0]) + ' – ' + f2(x.zone[1]) + '</b></div>' +
        '<div class="sc-row"><span>Stop Loss</span><b class="sl">' + f2(x.sl) + '<em>' + f2(x.slDist) + ' $</em></b></div>' +
        '<div class="sc-row"><span>Take Profit 1</span><b class="tp">' + f2(x.tp1) + '<em>R:R 1:' + x.rr1 + '</em></b></div>' +
        '<div class="sc-row"><span>Take Profit 2</span><b class="tp">' + f2(x.tp2) + '<em>R:R 1:' + x.rr2 + '</em></b></div>' +
        '<div class="sc-c">' + x.cond + ' ' + x.inval + ' La TP1 poți închide jumătate și muta SL-ul la intrare.</div></div>';
    });

    html += '\u0001strat\u0002';
    // strategies
    if(g.strategies && g.strategies.length){
      html += '<div class="gd-sec">Toate strategiile · atinge pentru detalii</div>';
      g.strategies.forEach(function(x, i){
        var dots = ''; for(var k=0;k<3;k++) dots += k < x.strength ? '●' : '○';
        var lv = x.entry != null ? '<div class="st-lv"><div><b>' + f2(x.entry) + '</b><span>INTRARE</span></div><div class="slv"><b>' + f2(x.sl) + '</b><span>SL</span></div><div class="tpv"><b>' + f2(x.tp1) + '</b><span>TP1</span></div><div class="tpv"><b>' + f2(x.tp2) + '</b><span>TP2</span></div></div>' +
          '<div style="margin-top:6px;font-family:var(--mono);font-size:10.5px;color:var(--text-faint);">R:R până la TP1 1:' + x.rr + '</div>' : '';
        html += '<div class="st' + (goldOpen[x.name] ? ' open' : '') + '" data-i="' + i + '"><div class="st-h"><span class="st-v ' + x.verdict + '">' + x.verdict + '</span><span class="st-n">' + x.name + '</span><span class="st-dots" title="putere">' + dots + '</span></div>' +
          '<div class="st-b">' + x.why + (x.info ? ' <i>' + x.info + '</i>' : '') + lv + '</div></div>';
      });
    }

    // strategies: remember the "all" view, then replace it with bar + detail container
    var stratKeyPos = html.indexOf('\u0001strat\u0002', allStart);
    goldAllHtml = html.slice(stratKeyPos).split('\u0001strat\u0002').join('');
    html = html.slice(0, stratKeyPos);
    var chips = '<button class="sx-chip" data-sx="all">📋 Toate</button>' + (g.strategies || []).map(function(x){ var G = SGUIDE[x.id] || { ic:'•', short:x.name };
      var ps = (g.pstats || {})[x.id]; var wr = ps && ps.n ? ' <em class="sx-wr">' + ps.rate + '%</em>' : '';
      return '<button class="sx-chip" data-sx="' + x.id + '"><i class="dot ' + x.verdict + '"></i>' + G.ic + ' ' + G.short + wr + '</button>'; }).join('');
    html += '\u0001strat\u0002<div class="sx-bar">' + chips + '</div><div id="sxDetail"></div>';
    html += '\u0001risk\u0002';
    // risk calculator
    if(!goldSide) goldSide = (sc[0] && sc[0].side) || 'BUY';
    var bal = curBalance();
    html += '<div class="gd-sec">Calculator de risc</div><div class="rc">' +
      '<div class="field-row"><label>Sold cont ($)</label><input type="number" id="rcBal" inputmode="decimal" value="' + (goldBal != null ? goldBal : (bal>0 ? bal.toFixed(2) : '')) + '" placeholder="5"></div>' +
      '<div class="field-row"><label>Risc pe tranzacție</label><select id="rcRisk">' + [0.5,1,2,3,5].map(function(r){ return '<option value="' + r + '"' + (r===goldRisk?' selected':'') + '>' + r + '%</option>'; }).join('') + '</select></div>' +
      '<div class="field-row"><label>Scenariu</label><select id="rcSide"><option value="BUY"' + (goldSide==='BUY'?' selected':'') + '>BUY</option><option value="SELL"' + (goldSide==='SELL'?' selected':'') + '>SELL</option></select></div>' +
      '<div class="rc-out" id="rcOut"></div></div>';

    html += '\u0001chart\u0002';
    // levels ladder
    var L = [
      { k:'R2', v:g.levels.R2, c:'res' }, { k:'R1', v:g.levels.R1, c:'res' }, { k:'PIVOT', v:g.pivots.P, c:'' },
      { k:'PREȚ', v:g.price, c:'now' }, { k:'S1', v:g.levels.S1, c:'sup' }, { k:'S2', v:g.levels.S2, c:'sup' }
    ].concat(['sup', 'res'].map(function(k){ var t = g.trend && g.trend[k]; return t && t.status === 'ok' ? { k:'TREND' + (t.dir === 'asc' ? '↗' : '↘'), v:t.now, c:k } : null; }).filter(Boolean)).sort(function(a,b){ return b.v - a.v; });
    var W = g.watch || { appr:0, levels:[] };
    var tlHtml = (function(){
      var T = g.trend || {}, out = '';
      [['sup', 'Suport', 'sub preț'], ['res', 'Rezistență', 'deasupra prețului']].forEach(function(a){
        var t = T[a[0]]; if(!t) return;
        var dn = t.dir === 'asc' ? 'ascendentă ↗' : 'descendentă ↘', d = Math.abs(t.dist);
        var st = t.status === 'broken' ? '<b class="hs-loss">spartă</b> · prețul e cu ' + f2(d) + ' $ ' + (a[0] === 'sup' ? 'sub' : 'peste') + ' ea' : 'prețul e la <b>' + f2(d) + ' $</b> ' + (a[0] === 'sup' ? 'deasupra' : 'dedesubt');
        out += '<div class="tln-row ' + a[0] + '"><div class="tln-t">' + a[1] + ' · linie ' + dn + (t.conf ? '' : ' <i>(provizorie)</i>') + '</div>' +
          '<div class="tln-v">' + f2(t.now) + '</div><div class="tln-s">' + st + ' · atinsă de ' + t.touches + ' ori · mâine ≈ ' + f2(t.next) + '</div></div>';
      });
      return out ? '<div class="gd-sec">📐 Linii de trend</div>' + out + '<div class="hint">Linia e trasă prin ultimele minime (suport) și maxime (rezistență), pe graficul zilnic. Primești alertă și la ea: se apropie · respinsă (BUY/SELL) · spartă. Pe graficele de 5m/15m/1h apare ca o linie orizontală, la valoarea de azi.</div>' : '<div class="gd-sec">📐 Linii de trend</div><div class="hint" style="margin-top:0;">Acum nu e nicio linie de trend clară pe grafic. Piața e în interval, fără minime sau maxime care urcă sau coboară regulat.</div>';
    })();
    var wFor = function(v){ return W.levels.filter(function(w){ return Math.abs(w.v - v) <= 0.15 * (g.atr || 50); })[0]; };
    var BADGE = { near:['se apropie', 'near'], touched:['atins · urmărește', 'touch'] };
    html += tlHtml + '<div class="gd-sec">Niveluri cheie</div><div class="lad">' + L.map(function(l){
      var d = l.v - g.price, w = l.c === 'now' ? null : wFor(l.v), bd = '';
      if(w){ if(BADGE[w.phase]) bd = ' <i class="lad-b ' + BADGE[w.phase][1] + '">' + BADGE[w.phase][0] + '</i>'; else if(w.phase === 'done') bd = w.out === 'reject' ? ' <i class="lad-b ok">respins ✓</i>' : ' <i class="lad-b bad">spart</i>'; else bd = ' <i class="lad-b bell">🔔</i>'; }
      return '<div class="lad-r ' + l.c + '"><span>' + l.k + bd + '</span><b>' + f2(l.v) + (l.c==='now' ? '' : '<em>' + (d>0?'+':'') + f2(d) + '</em>') + '</b></div>'; }).join('') + '</div>' +
      '<div class="lvl-note"><b>🔔 Alerte pe niveluri</b> (le primești pe telefon):<br>① prețul se apropie la ≤ <b>$' + (W.appr || '–') + '</b> de un nivel, ca să poți verifica graficul · ② a ajuns la el · ③ <b>respins</b> → plan BUY (la suport) sau SELL (la rezistență) cu SL, TP și riscul tău · ④ <b>spart</b> → avertizare.' +
      '<div id="lvlNear" class="lvl-near"></div></div>' +
      (function(){ var ev = (g.events || []).filter(function(e){ return String(e.id).indexOf('lvl|') === 0; }).slice(-6).reverse();
        return ev.length ? hxHtml('lvlHist', 'alertele de nivel recente (' + ev.length + ')', ev.map(function(e){ var dd = new Date(e.t);
          return '<div class="lvl-ev"><span>' + dd.getDate() + ' ' + monthShort[dd.getMonth()] + ' ' + hhmm(dd) + '</span><div><b>' + zEsc(e.title) + '</b><div>' + zEsc(String(e.body).split('\n').slice(0, 3).join(' · ')) + '</div></div></div>'; }).join('')) : ''; })();

    // indicators + reasons
    html += '<div class="gd-sec">Indicatori (zilnic)</div><div class="gd-ind">' +
      '<div><b>' + f2(g.ema20) + '</b><span>EMA 20</span></div><div><b>' + f2(g.ema50) + '</b><span>EMA 50</span></div><div><b>' + f2(g.ema200) + '</b><span>EMA 200</span></div>' +
      '<div><b>' + g.rsi + '</b><span>RSI 14</span></div><div><b>' + f2(g.atr) + '</b><span>ATR 14 ($/zi)</span></div><div><b>' + f2(g.dayHigh - g.dayLow) + '</b><span>RANGE AZI</span></div></div>' +
      '<ul class="gd-notes">' + g.notes.map(function(n){ return '<li>' + n + '</li>'; }).join('') + '</ul>';

    html += '\u0001avoid\u0002';
    if(g.avoid){ html += '<div class="nar avoid"><h4>⛔ Ce să eviți</h4>' + g.avoid.map(function(t){ return '<p>' + t + '</p>'; }).join('') + '</div>'; }
    html += '\u0001hist\u0002';
    if(g.pstats){
      var T = g.ptotal || {};
      var rows = Object.keys(g.pstats).map(function(k){ return g.pstats[k]; }).sort(function(a,b){ return (b.r - a.r) || ((b.rate||0) - (a.rate||0)); });
      html += '<div class="gd-sec" style="margin-top:0;">🏆 Clasamentul strategiilor · tranzacții de test</div>' +
        '<div class="hist-sum"><div><b>' + (T.n || 0) + '</b><span>ÎNCHISE</span></div><div><b>' + (T.rate != null ? T.rate + '%' : '–') + '</b><span>CÂȘTIGATE</span></div>' +
        '<div><b class="' + ((T.r||0) >= 0 ? 'hs-win' : 'hs-loss') + '">' + ((T.r||0) >= 0 ? '+' : '') + (T.r || 0) + 'R</b><span>TOTAL</span></div><div><b>' + ((T.open||0) + (T.pending||0)) + '</b><span>ACTIVE</span></div></div>' +
        '<div class="lb">' + rows.map(function(v, i){ var G = SGUIDE[v.sid] || { ic:'•' };
          return '<div class="lb-r" data-sx="' + v.sid + '"><span class="lb-i">' + (i === 0 && v.n ? '🥇' : i === 1 && v.n ? '🥈' : i === 2 && v.n ? '🥉' : (i+1)) + '</span>' +
            '<span class="lb-n">' + G.ic + ' ' + v.name + '<em>' + v.n + ' închise · ' + (v.rate != null ? v.rate + '% câștig' : 'fără rezultate încă') + (v.open + v.pending ? ' · ' + (v.open + v.pending) + ' active' : '') + '</em></span>' +
            '<span class="lb-r2 ' + (v.r >= 0 ? 'hs-win' : 'hs-loss') + '">' + (v.r >= 0 ? '+' : '') + v.r + 'R</span></div>'; }).join('') + '</div>';
      var act = (g.ptrades || []).filter(function(t){ return !t.closed; }).slice().reverse();
      html += '<div class="gd-sec">⏳ Tranzacții active acum (' + act.length + ')</div>' + (act.length ? act.map(function(t){ return ptRow(t, true); }).join('') : '<div class="hint" style="margin-top:0;">Nicio tranzacție activă.</div>');
      var cl = (g.ptrades || []).filter(function(t){ return t.closed; }).slice().reverse().slice(0, 15);
      if(cl.length) html += '<div class="gd-sec">✔️ Ultimele închise</div>' + hxHtml('goldClosed', 'tranzacțiile închise (' + cl.length + ')', cl.map(function(t){ return ptRow(t, true); }).join(''));
      html += '<div class="hint">Tranzacții simulate (nu reale): robotul „intră” automat când o strategie dă semnal, cu intrarea, SL-ul și TP-urile ei, apoi le urmărește pe lumânările zilnice. La TP1 închide jumătate și mută SL-ul la intrare. Dacă SL și TP apar în aceeași zi, se consideră SL (varianta prudentă). R = câte riscuri ai câștigat sau pierdut; $ la 0.01 lot = 1 uncie.</div>';
      html += '<div class="gd-sec">📜 Planul zilnic combinat</div>';
    }
    if(g.history && g.history.length){
      var tr = g.track || {};
      var cls = function(st){ return /TP/.test(st) ? 'hs-win' : /SL/.test(st) ? 'hs-loss' : /desfășurare|așteaptă/.test(st) ? 'hs-open' : 'hs-none'; };
      var ico = function(st){ return /TP2/.test(st) ? '✅✅' : /TP/.test(st) ? '✅' : /SL/.test(st) ? '❌' : /desfășurare/.test(st) ? '⏳' : /așteaptă intrarea/.test(st) ? '🕒' : '⏸'; };
      html += '<div class="gd-sec">📜 Cum au ieșit analizele anterioare</div><div class="rc">' +
        '<div class="hist-sum"><div><b>' + (tr.closed || 0) + '</b><span>ÎNCHISE</span></div><div><b class="hs-win">' + (tr.wins || 0) + '</b><span>CÂȘTIGATE</span></div><div><b>' + (tr.rate != null ? tr.rate + '%' : '–') + '</b><span>RATĂ</span></div></div>' +
        hxHtml('goldPlans', 'planurile zilelor trecute', g.history.slice().reverse().slice(0, 10).map(function(h){ var dd = new Date(h.date + 'T00:00:00');
          return '<div class="hist-r"><span class="d">' + dd.getDate() + ' ' + monthShort[dd.getMonth()] + ' · ' + (h.side === 'AȘTEAPTĂ' ? '—' : h.side + ' ' + f2(h.entry)) + '</span><span class="st2 ' + cls(h.status) + '">' + ico(h.status) + ' ' + h.status + '</span></div>'; }).join('')) +
        '<div class="hint">Verificat automat pe lumânările zilnice, după publicarea fiecărui plan. Rezultatele trecute nu garantează rezultate viitoare.</div></div>';
    }
    html += '\u0001foot\u0002';
    html += '<div class="hint">Analiză automată pe reguli: 38 de strategii tehnice, Smart Money și macro (dolar, randamente), actualizată din oră în oră · ' + g.source + ' · ' +
      upd.getDate() + ' ' + monthShort[upd.getMonth()] + ' ' + hhmm(upd) + '. Nu e sfat financiar: e un punct de plecare. Confirmă pe grafic și decide tu. Prețul brokerului poate diferi cu câțiva dolari.</div>';
    var parts = html.split(/\u0001(\w+)\u0002/), B = { top:'' }, key = 'top';
    for(var pi=0; pi<parts.length; pi++){ if(pi % 2 === 1){ key = parts[pi]; } else { B[key] = (B[key] || '') + parts[pi]; } }
    var top = document.getElementById('goldTop');
    if(top) top.innerHTML = (B.top || '') + '<div class="gd-fresh" id="gdFresh"></div>' + (B.head || '');
    paintLive();
    var sec = function(k, inner){ return '<div class="card" data-gsp="' + k + '">' + inner + '</div>'; };
    box.innerHTML =
      sec('plan', (B.conf || '') + (B.nar || '') + (B.avoid || '') + (B.foot || '')) +
      sec('chart', '<div class="card-title">Graficul analizei · D1</div>' + (B.chart || '')) +
      sec('strat', '<div class="card-title">Strategii · alege una din bară</div>' + (B.strat || '')) +
      sec('risk', (B.risk || '')) +
      sec('hist', (B.hist || '<div class="hint" style="margin-top:0;">Istoricul apare după primele zile de analiză.</div>'));
    if(typeof renderPlanTiles === 'function') renderPlanTiles();
    applyGoldSeg();
    box.querySelectorAll('.lb-r').forEach(function(r){ r.addEventListener('click', function(){ goldStrat = r.getAttribute('data-sx'); try{ localStorage.setItem('byzyp_gstrat', goldStrat); }catch(e){}
      goldSeg = 'strat'; try{ localStorage.setItem('byzyp_gseg', goldSeg); }catch(e){} applyGoldSeg(); renderStratPage(); try{ window.scrollTo(0,0); }catch(e){} }); });
    goldChart = 'a'; drawGoldChart(undefined, undefined, { tf: goldTf.chWrap });
    drawPlanChart();
    fetchIntraday();
    renderGoldMini();
    box.querySelectorAll('.sx-chip').forEach(function(c){ c.addEventListener('click', function(){ goldStrat = c.getAttribute('data-sx'); try{ localStorage.setItem('byzyp_gstrat', goldStrat); }catch(e){} renderStratPage(); }); });
    if(goldStrat !== 'all' && !(g.strategies || []).some(function(x){ return x.id === goldStrat; })) goldStrat = 'all';
    renderStratPage();

    function calc(){
      var b = parseFloat(document.getElementById('rcBal').value) || 0;
      var r = parseFloat(document.getElementById('rcRisk').value) || 1;
      var side = document.getElementById('rcSide').value;
      var x = g.scenarios.filter(function(s){ return s.side === side; })[0];
      var riskUsd = b * r / 100, per001 = x.slDist; // $ lost per 0.01 lot at SL (1 oz)
      var lots = Math.floor(riskUsd / (x.slDist * 100) * 100) / 100;
      var out = document.getElementById('rcOut');
      if(!b){ out.innerHTML = 'Scrie soldul contului.'; return; }
      if(lots < 0.01){
        out.innerHTML = '<div class="rc-warn">Contul e prea mic pentru acest stop loss.</div>' +
          'Cel mai mic lot, <b>0.01</b>, te costă <b>' + f2(per001) + ' $</b> dacă atinge SL-ul, adică <b>' + Math.round(per001/b*100) + '%</b> din cont (tu ai ales ' + r + '% = ' + f2(riskUsd) + ' $). ' +
          'Variante: aștepți un setup cu SL mai mic, alimentezi contul sau folosești contul demo până crește.';
      } else {
        var p1 = Math.abs(x.tp1 - x.entry) * lots * 100, p2 = Math.abs(x.tp2 - x.entry) * lots * 100;
        out.innerHTML = 'Lot recomandat<div class="rc-lot">' + lots.toFixed(2) + '</div>' +
          'Risc la SL: <b>-' + f2(x.slDist * lots * 100) + ' $</b> · la TP1: <b>+' + f2(p1) + ' $</b> · la TP2: <b>+' + f2(p2) + ' $</b>' +
          '<div style="margin-top:4px;font-size:11px;color:var(--text-faint);">Calcul pentru 1 lot = 100 oz (standardul la majoritatea brokerilor). Verifică specificația XAUUSD la brokerul tău.</div>';
      }
    }
    document.getElementById('rcBal').addEventListener('input', function(){ goldBal = this.value; calc(); });
    document.getElementById('rcRisk').addEventListener('change', function(){ goldRisk = parseFloat(this.value); try{ localStorage.setItem('byzyp_gold_risk', String(goldRisk)); }catch(e){} calc(); });
    document.getElementById('rcSide').addEventListener('change', function(){ goldSide = this.value; calc(); });
    calc();
  }
  loadGold();
  setInterval(loadGold, 10*60*1000);


  /* ===== weekly report ===== */
  var rpOffset = 0;
  function weekStart(off){ var d = new Date(); d.setHours(0,0,0,0); var wd = (d.getDay() + 6) % 7; d.setDate(d.getDate() - wd + off * 7); return d; }
  function inRange(k, a, b){ return k >= a && k <= b; }
  function weekStats(off){
    var ws = weekStart(off), we = new Date(ws); we.setDate(we.getDate() + 6);
    var today = new Date(); today.setHours(0,0,0,0);
    var last = we > today ? today : we;
    var a = dateKey(ws), b = dateKey(we), lk = dateKey(last);
    var days = []; for(var d = new Date(ws); d <= last; d.setDate(d.getDate() + 1)) days.push(dateKey(d));
    var n = days.length || 1;
    var hab = {}; HABITS.forEach(function(h){ hab[h.key] = 0; });
    var perfect = 0, done = 0, photos = 0, weights = [], bestDay = null, bestN = -1;
    days.forEach(function(k){ var e = data[k]; if(!e) return;
      HABITS.forEach(function(h){ if(e.habits && e.habits[h.key]){ hab[h.key]++; done++; } });
      var c = doneCount(e); if(c === HABITS.length) perfect++; if(c > bestN){ bestN = c; bestDay = k; }
      if(e.photo) photos++; if(e.weight != null) weights.push({ k:k, v:+e.weight }); });
    var pct = Math.round(done / (n * HABITS.length) * 100);
    // smoke-free streak up to the end of this week
    var streak = 0; for(var d2 = new Date(last); ; d2.setDate(d2.getDate() - 1)){ var e2 = data[dateKey(d2)]; if(e2 && e2.habits && e2.habits.nosmoke) streak++; else break; if(streak > 999) break; }
    // weight: last known before the week vs last in week
    var prevW = null; Object.keys(data).sort().forEach(function(k){ if(k < a && data[k] && data[k].weight != null) prevW = +data[k].weight; });
    var wStart = weights.length ? weights[0].v : null, wEnd = weights.length ? weights[weights.length - 1].v : null;
    // net worth
    var sa = (typeof sortedAccounts === 'function') ? sortedAccounts() : [];
    var before = null, inWeek = null; sa.forEach(function(x){ if(x.date < a) before = x; if(inRange(x.date, a, b)) inWeek = x; });
    var worthEnd = inWeek ? accTotal(inWeek) : (before ? accTotal(before) : null), worthStart = before ? accTotal(before) : (inWeek ? accTotal(sa.filter(function(x){ return inRange(x.date, a, b); })[0]) : null);
    // trading journal
    var tw = (trades || []).filter(function(t){ return inRange(t.date, a, b); });
    var pnl = tw.reduce(function(s2, t){ return s2 + (t.result || 0); }, 0), wins = tw.filter(function(t){ return t.result > 0; }).length;
    var best = tw.reduce(function(m, t){ return m == null || t.result > m ? t.result : m; }, null), worst = tw.reduce(function(m, t){ return m == null || t.result < m ? t.result : m; }, null);
    // investments (month of this week)
    var months = {}; months[a.slice(0,7)] = 1; months[b.slice(0,7)] = 1;
    var inv = (investments || []).filter(function(x){ return months[x.month]; }).reduce(function(s2, x){ return s2 + (+x.amount || 0); }, 0);
    // gold paper trades
    var gp = (typeof gold !== 'undefined' && gold && gold.ptrades) ? gold.ptrades : [];
    var gOpened = gp.filter(function(t){ return inRange(t.date, a, b); }).length;
    var gClosed = gp.filter(function(t){ return t.closedDate && inRange(t.closedDate, a, b) && t.resultR != null; });
    var gR = gClosed.reduce(function(s2, t){ return s2 + t.resultR; }, 0), gW = gClosed.filter(function(t){ return t.resultR > 0; }).length;
    var byS = {}; gClosed.forEach(function(t){ byS[t.strat] = (byS[t.strat] || 0) + t.resultR; });
    var bestS = Object.keys(byS).sort(function(x, y){ return byS[y] - byS[x]; })[0];
    // gold price over the week (daily candles)
    var gc = (typeof gold !== 'undefined' && gold && gold.candles) ? gold.candles.filter(function(c){ return inRange(c[0], a, b); }) : [];
    var gPrev = (typeof gold !== 'undefined' && gold && gold.candles) ? gold.candles.filter(function(c){ return c[0] < a; }).pop() : null;
    var hd = (typeof healthData !== 'undefined') ? days.map(function(k){ return healthData[k]; }).filter(Boolean) : [];
    var fsum = function(m){ return hd.reduce(function(a, x){ return a + (+x[m] || 0); }, 0); };
    var fit = hd.length ? { n:hd.length, steps:fsum('steps') / hd.length, kcal:fsum('kcal'), exMin:fsum('exMin'), distKm:fsum('distKm') } : null;
    return { fit:fit, ws:ws, we:we, n:n, hab:hab, pct:pct, perfect:perfect, photos:photos, streak:streak, bestDay:bestDay, bestN:bestN,
      prevW:prevW, wStart:wStart, wEnd:wEnd, worthStart:worthStart, worthEnd:worthEnd,
      tw:tw.length, pnl:pnl, wins:wins, best:best, worst:worst, inv:inv, gOpened:gOpened, gClosed:gClosed.length, gR:gR, gW:gW, bestS:bestS, bestSR:bestS ? byS[bestS] : null,
      goldFrom: gPrev ? gPrev[4] : (gc[0] ? gc[0][1] : null), goldTo: gc.length ? gc[gc.length - 1][4] : null, current: off === 0 };
  }
  function sgn(v, d, pre, suf){ if(v == null || isNaN(v)) return '–'; return (v > 0 ? '+' : v < 0 ? '−' : '') + (pre || '') + Math.abs(v).toFixed(d) + (suf || ''); }
  function renderWeekReport(){
    var body = document.getElementById('rpBody'); if(!body) return;
    var W = weekStats(rpOffset), P = weekStats(rpOffset - 1);
    var fmt = function(d){ return d.getDate() + ' ' + monthShort[d.getMonth()]; };
    document.getElementById('rpWeek').innerHTML = (rpOffset === 0 ? 'Săptămâna asta' : rpOffset === -1 ? 'Săptămâna trecută' : 'Acum ' + (-rpOffset) + ' săptămâni') + '<span>' + fmt(W.ws) + ' – ' + fmt(W.we) + (W.current ? ' · în desfășurare' : '') + '</span>';
    document.getElementById('rpNext').disabled = rpOffset >= 0;
    var sc = W.pct, dsc = sc - P.pct;
    var msg = sc >= 90 ? ['Săptămână de campion 🏆', 'Aproape tot bifat. Asta e disciplina care schimbă o viață.'] : sc >= 70 ? ['Săptămână foarte bună 💪', 'Ai ținut ritmul. Mai strânge puțin la obiceiul cel mai slab.'] : sc >= 45 ? ['Săptămână ok, se poate mai bine', 'Ai făcut pași. Alege un singur obicei pe care să-l bifezi zilnic săptămâna viitoare.'] : ['Săptămână grea', 'Se întâmplă. Nu contează căderea, contează că revii. Începe mâine cu cel mai ușor obicei.'];
    var C = 2 * Math.PI * 30, col = sc >= 70 ? 'var(--accent)' : sc >= 45 ? 'var(--gold)' : 'var(--danger)';
    var h = '<div class="rp-score"><svg class="rp-ring" viewBox="0 0 74 74"><circle cx="37" cy="37" r="30" fill="none" stroke="var(--line)" stroke-width="7"/><circle cx="37" cy="37" r="30" fill="none" stroke="' + col + '" stroke-width="7" stroke-linecap="round" stroke-dasharray="' + (C * sc / 100).toFixed(1) + ' ' + C.toFixed(1) + '" transform="rotate(-90 37 37)"/><text x="37" y="42" text-anchor="middle" font-size="17" font-weight="800" fill="var(--text)" font-family="monospace">' + sc + '%</text></svg>' +
      '<div class="rp-msg"><b>' + msg[0] + '</b><span>' + msg[1] + (rpOffset > -52 ? '<br>Față de săptămâna dinainte: <b style="display:inline;font-size:12px" class="' + (dsc >= 0 ? 'rp-good' : 'rp-bad') + '">' + sgn(dsc, 0, '', ' puncte') + '</b>' : '') + '</span></div></div>';
    // habits
    h += '<div class="rp-sec"><h4>✅ Obiceiuri · ' + W.n + ' zile</h4><div class="rp-hab">' + HABITS.map(function(x){ var v = W.hab[x.key]; return '<div><i>' + x.ic + '</i><b class="' + (v === W.n ? 'rp-good' : v <= W.n / 2 ? 'rp-bad' : '') + '">' + v + '/' + W.n + '</b><span>' + ({ nosmoke:'țigări', nosugar:'zahăr', water:'apă', training:'sport', food:'mâncare' }[x.key] || x.label) + '</span></div>'; }).join('') + '</div>' +
      '<div class="rp-row" style="margin-top:8px;"><span>Zile perfecte (5/5)</span><b>' + W.perfect + '</b></div><div class="rp-row"><span>Zile la rând fără țigări</span><b class="rp-good">' + W.streak + '</b></div>' +
      (W.photos ? '<div class="rp-row"><span>Poze de progres</span><b>' + W.photos + '</b></div>' : '') + '</div>';
    // body
    var wd = (W.wEnd != null && (W.prevW != null || W.wStart != null)) ? W.wEnd - (W.prevW != null ? W.prevW : W.wStart) : null;
    h += '<div class="rp-sec"><h4>⚖️ Corp</h4><div class="rp-row"><span>Greutate la final</span><b>' + (W.wEnd != null ? fmtKg(W.wEnd) + ' kg' : 'nenotată') + '</b></div>' +
      '<div class="rp-row"><span>Schimbare în săptămână</span><b class="' + (wd == null ? '' : wd <= 0 ? 'rp-good' : 'rp-bad') + '">' + sgn(wd, 2, '', ' kg') + '</b></div>' +
      '<div class="rp-row"><span>Antrenamente bifate</span><b>' + W.hab.training + ' / ' + W.n + '</b></div></div>';
    if(W.fit){
      var pf = P.fit;
      h += '<div class="rp-sec"><h4>❤️ Fitness (din Sănătate)</h4><div class="rp-row"><span>Pași pe zi (medie)</span><b>' + Math.round(W.fit.steps).toLocaleString('ro-RO') + (pf ? ' <span class="' + (W.fit.steps >= pf.steps ? 'rp-good' : 'rp-bad') + '" style="font-size:10.5px">' + sgn(W.fit.steps - pf.steps, 0) + '</span>' : '') + '</b></div>' +
        '<div class="rp-row"><span>Calorii active (total)</span><b>' + Math.round(W.fit.kcal).toLocaleString('ro-RO') + ' kcal</b></div>' +
        '<div class="rp-row"><span>Minute de exercițiu (total)</span><b>' + Math.round(W.fit.exMin) + ' min</b></div>' +
        '<div class="rp-row"><span>Distanță mers + alergat</span><b>' + W.fit.distKm.toFixed(1) + ' km</b></div></div>';
    }
    // money
    var dw = (W.worthEnd != null && W.worthStart != null) ? W.worthEnd - W.worthStart : null;
    if(window.SHOW_MONEY) h += '<div class="rp-sec"><h4>💼 Bani</h4><div class="rp-row"><span>Avere totală</span><b>' + (W.worthEnd != null ? '€' + Math.round(W.worthEnd).toLocaleString('ro-RO') : '–') + '</b></div>' +
      '<div class="rp-row"><span>Schimbare</span><b class="' + (dw == null ? '' : dw >= 0 ? 'rp-good' : 'rp-bad') + '">' + sgn(dw, 0, '€') + '</b></div>' +
      '<div class="rp-row"><span>Investit luna asta</span><b>€' + Math.round(W.inv) + '</b></div></div>';
    // trading
    if(window.SHOW_MONEY) h += '<div class="rp-sec"><h4>📈 Trading (jurnalul tău)</h4>' + (W.tw ? '<div class="rp-row"><span>Tranzacții</span><b>' + W.tw + ' · ' + Math.round(W.wins / W.tw * 100) + '% pe plus</b></div>' +
      '<div class="rp-row"><span>Rezultat</span><b class="' + (W.pnl >= 0 ? 'rp-good' : 'rp-bad') + '">' + sgn(W.pnl, 2, '€') + '</b></div>' +
      '<div class="rp-row"><span>Cea mai bună / cea mai slabă</span><b>' + sgn(W.best, 2, '€') + ' / ' + sgn(W.worst, 2, '€') + '</b></div>' : '<div class="rp-row"><span>Nicio tranzacție notată</span><b>–</b></div>') + '</div>';
    // gold
    var gch = (W.goldFrom && W.goldTo) ? W.goldTo - W.goldFrom : null;
    if(window.SHOW_GOLD) h += '<div class="rp-sec"><h4>🥇 Aur &amp; strategii (test)</h4><div class="rp-row"><span>Aurul în săptămână</span><b class="' + (gch == null ? '' : gch >= 0 ? 'rp-good' : 'rp-bad') + '">' + (gch == null ? '–' : sgn(gch, 2, '$') + ' (' + sgn(gch / W.goldFrom * 100, 2, '', '%') + ')') + '</b></div>' +
      '<div class="rp-row"><span>Tranzacții de test deschise</span><b>' + W.gOpened + '</b></div>' +
      '<div class="rp-row"><span>Închise · câștigate</span><b>' + W.gClosed + ' · ' + (W.gClosed ? Math.round(W.gW / W.gClosed * 100) + '%' : '–') + '</b></div>' +
      '<div class="rp-row"><span>Rezultat total</span><b class="' + (W.gR >= 0 ? 'rp-good' : 'rp-bad') + '">' + sgn(W.gR, 2, '', 'R') + '</b></div>' +
      (W.bestS ? '<div class="rp-row"><span>Strategia săptămânii</span><b class="rp-good">' + W.bestS + ' (' + sgn(W.bestSR, 2, '', 'R') + ')</b></div>' : '') + '</div>';
    // tip
    var weakest = HABITS.slice().sort(function(x, y){ return W.hab[x.key] - W.hab[y.key]; })[0];
    var tip = W.hab[weakest.key] >= W.n ? 'Ai bifat totul în fiecare zi. Păstrează exact același ritm și săptămâna viitoare. 🔥' :
      'Obiectivul pentru săptămâna viitoare: <b>' + weakest.ic + ' ' + weakest.label + '</b> (acum ' + W.hab[weakest.key] + '/' + W.n + '). Concentrează-te doar pe el și bifează-l zilnic.';
    h += '<div class="rp-tip">🎯 ' + tip + '</div>';
    h += '<button class="ghost-btn" id="rpCopy" style="margin-top:12px;">📋 Copiază raportul (ca text)</button>';
    body.innerHTML = h;
    document.getElementById('rpCopy').addEventListener('click', function(){
      var t = 'By ZyP · Raport ' + fmt(W.ws) + ' – ' + fmt(W.we) + '\nScor: ' + sc + '% (' + msg[0] + ')\n' +
        HABITS.map(function(x){ return x.ic + ' ' + x.label + ': ' + W.hab[x.key] + '/' + W.n; }).join('\n') +
        '\nZile perfecte: ' + W.perfect + ' · fără țigări la rând: ' + W.streak +
        '\nGreutate: ' + (W.wEnd != null ? fmtKg(W.wEnd) + ' kg (' + sgn(wd, 2, '', ' kg') + ')' : '–') +
        '\nAvere: ' + (W.worthEnd != null ? '€' + Math.round(W.worthEnd) + ' (' + sgn(dw, 0, '€') + ')' : '–') +
        (W.fit ? '\nFitness: ' + Math.round(W.fit.steps) + ' pași/zi, ' + Math.round(W.fit.kcal) + ' kcal, ' + Math.round(W.fit.exMin) + ' min exercițiu' : '') +
        '\nTrading: ' + W.tw + ' tranzacții, ' + sgn(W.pnl, 2, '€') +
        '\nStrategii aur (test): ' + W.gClosed + ' închise, ' + sgn(W.gR, 2, '', 'R') + (W.bestS ? ', cea mai bună: ' + W.bestS : '');
      t = t.split('\n').filter(function(l){ return !/^(Avere|Trading|Fitness|Strategii aur)/.test(l); }).join('\n');
      var btn = this;
      var ok = function(){ btn.textContent = '✓ Copiat'; setTimeout(function(){ btn.textContent = '📋 Copiază raportul (ca text)'; }, 2000); };
      if(navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(ok, ok); else ok();
    });
  }
  document.getElementById('rpPrev').addEventListener('click', function(){ rpOffset--; renderWeekReport(); });
  document.getElementById('rpNext').addEventListener('click', function(){ if(rpOffset < 0){ rpOffset++; renderWeekReport(); } });
  document.querySelectorAll('.tab[data-view="profile"]').forEach(function(t){ t.addEventListener('click', function(){ setTimeout(renderWeekReport, 30); }); });
  function openReportFromLink(){
    if(!/raport/.test(location.hash + location.search)) return;
    var t = document.querySelector('.tab[data-view="profile"]'); if(t) t.click();
    setTimeout(function(){ var c = document.getElementById('reportCard'); if(c && c.scrollIntoView) c.scrollIntoView({ behavior:'smooth', block:'start' }); }, 400);
  }
  window.addEventListener('hashchange', openReportFromLink);
  setTimeout(openReportFromLink, 1500);

  /* =====================================================================
     JARVIS · voice assistant over everything in the app
     ===================================================================== */
  function jNorm(t){ return String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim(); }
  function jHas(t, words){ return words.some(function(w){ return t.indexOf(w) >= 0; }); }
  function jNum(n, d){ return Number(n).toLocaleString('ro-RO', { minimumFractionDigits:d || 0, maximumFractionDigits:d || 0 }); }
  function jSmokeFree(){ var sf = 0, c2 = new Date(today); if(!(data[todayKey] && data[todayKey].habits && data[todayKey].habits.nosmoke)) c2.setDate(c2.getDate() - 1);
    while(true){ var k2 = dateKey(c2); if(data[k2] && data[k2].habits && data[k2].habits.nosmoke){ sf++; c2.setDate(c2.getDate() - 1); } else break; } return sf; }
  function jDayNum(){ var ks = Object.keys(data).sort(); return ks.length ? Math.max(1, Math.round((today - new Date(ks[0] + 'T00:00:00')) / 86400000) + 1) : 1; }
  function jLeft(){ var e = data[todayKey] || { habits:{} }; return HABITS.filter(function(h){ return !(e.habits && e.habits[h.key]); }); }
  function jTick(key){
    var i = HABITS.map(function(h){ return h.key; }).indexOf(key); if(i < 0) return false;
    var e = data[todayKey]; if(e && e.habits && e.habits[key]) return 'already';
    var rows = document.querySelectorAll('#todayHabits .habit'); if(rows[i]){ rows[i].click(); return true; } return false;
  }
  function jWorth(){ var sa = (typeof sortedAccounts === 'function') ? sortedAccounts() : []; if(!sa.length) return null;
    var last = accTotal(sa[sa.length - 1]), prev = sa.length > 1 ? accTotal(sa[sa.length - 2]) : null, first = accTotal(sa[0]); return { now:last, prev:prev, first:first }; }
  function jGold(){ if(!gold) return null; var p = liveSpot != null ? liveSpot : gold.price, pc = gold.price - gold.change; return { p:p, ch:p - pc, pct:(p - pc) / pc * 100, v:(gold.confluence || {}).verdict || gold.bias, c:gold.confluence || {} }; }

  function jAnswer(raw){
    var t = jNorm(raw), h = new Date().getHours();
    var hi = h < 12 ? 'Bună dimineața' : h < 18 ? 'Bună ziua' : 'Bună seara';
    var said = [];
    if(jHas(t, ['proteina','proteine','calorii','macro','cate grame','cata proteina','tinta mea']) || (jHas(t, ['grame', 'cat trebuie', 'cat mananc']) && jHas(t, ['pranz', 'dimineata', 'seara', 'cina', 'mic dejun']))) return nuAnswer(t);
    // --- actions: tick habits (can be several in one sentence) ---
    var ticks = [
      ['water', ['am baut apa','baut apa','apa am baut','bifeaza apa','doar apa']],
      ['training', ['am fost la sala','am facut sala','antrenament','am alergat','am facut sport','bifeaza sala','bifeaza sport']],
      ['nosmoke', ['n am fumat','nu am fumat','fara tigari','fara tigara','bifeaza tigari']],
      ['nosugar', ['fara zahar','n am mancat dulce','nu am mancat dulce','bifeaza zahar']],
      ['food', ['am mancat curat','am mancat sanatos','mancare curata','bifeaza mancare']]
    ];
    var done = [], already = [];
    if(!jHas(t, ['cate','cat','cum','ce '])) ticks.forEach(function(tk){ if(jHas(t, tk[1])){ var r = jTick(tk[0]); var lbl = HABITS.filter(function(x){ return x.key === tk[0]; })[0].label.toLowerCase(); if(r === 'already') already.push(lbl); else if(r) done.push(lbl); } });
    if(done.length || already.length){
      var left = jLeft().filter(function(x){ return done.indexOf(x.label.toLowerCase()) < 0; });
      var msg = 'ZyP, ' + (done.length ? 'am bifat ' + done.join(' și ') + '. ' : '') + (already.length ? (already.join(' și ') + ' era deja bifat. ') : '');
      msg += left.length ? 'Mai ai ' + left.length + ': ' + left.map(function(x){ return x.label.toLowerCase(); }).join(', ') + '.' : 'Ai bifat tot azi. Zi perfectă, bravo! 🔥';
      return msg;
    }
    // --- open views ---
    if(jHas(t, ['terminal','mod trader','ecran de trader'])){ setTimeout(openTerminal, 400); return 'ZyP, deschid terminalul de trader.'; }
    if(jHas(t, ['seif','lingou','lingouri','vault'])){ setTimeout(openVault, 400); var w0 = jWorth(); return 'ZyP, deschid seiful. ' + (w0 ? 'Ai ' + Math.floor(w0.now / 100) + ' lingouri, adică ' + jNum(w0.now) + ' euro.' : ''); }
    if(jHas(t, ['tradingview','trading view','tradingviu'])){ setTimeout(function(){ window.open('https://www.tradingview.com/chart/?symbol=OANDA%3AXAUUSD', '_blank'); }, 500); return 'ZyP, deschid TradingView pe aur. Acolo ai contul tău și desenele tale.'; }
    if(jHas(t, ['linie de trend','linia de trend','linii de trend','trendline','trend line'])){
      var T5 = gold && gold.trend; if(!T5 || (!T5.sup && !T5.res)) return 'ZyP, acum nu e nicio linie de trend clară pe aur. Piața e în interval.';
      var pT = liveSpot != null ? liveSpot : gold.price, outT = [];
      [['sup', 'suport'], ['res', 'rezistență']].forEach(function(a){ var q = T5[a[0]]; if(!q) return; outT.push('linia de trend ' + (q.dir === 'asc' ? 'ascendentă' : 'descendentă') + ' de ' + a[1] + ' e acum la ' + jNum(q.now, 2) + ', la ' + jNum(Math.abs(pT - q.now), 1) + ' dolari de preț' + (q.status === 'broken' ? ', dar a fost spartă' : '') + ', atinsă de ' + q.touches + ' ori'); });
      return 'ZyP, ' + outT.join('; ') + '.';
    }
    if(jHas(t, ['analizeaza poza','analiza poza','analiza din poza','analizeaza captura','screenshot','captura de ecran','am o poza','poza cu grafic'])){ setTimeout(function(){ window.__openPhoto && window.__openPhoto(); }, 500); return 'ZyP, deschid analiza din poză. Alege captura din galerie și o analizez.'; }
    // --- support / resistance ---
    if(jHas(t, ['suport','rezistenta','niveluri','nivelul','nivel '])){
      if(!gold || !gold.watch || !gold.watch.levels.length) return 'ZyP, nu am încă nivelurile calculate. Mai așteaptă un minut.';
      var pS = liveSpot != null ? liveSpot : gold.price, lv5 = gold.watch.levels;
      var dn = lv5.filter(function(x){ return x.v < pS; }).sort(function(a, b){ return b.v - a.v; })[0], up5 = lv5.filter(function(x){ return x.v > pS; }).sort(function(a, b){ return a.v - b.v; })[0];
      var ph = lv5.filter(function(x){ return x.phase === 'near' || x.phase === 'touched'; });
      return 'ZyP, aurul e la ' + jNum(pS, 2) + '. ' + (dn ? 'Cel mai apropiat suport e ' + jNum(dn.v, 2) + ', la ' + jNum(pS - dn.v, 1) + ' dolari sub preț. ' : '') + (up5 ? 'Cea mai apropiată rezistență e ' + jNum(up5.v, 2) + ', la ' + jNum(up5.v - pS, 1) + ' dolari deasupra. ' : '') +
        (ph.length ? 'Atenție, prețul e acum în zona nivelului ' + jNum(ph[0].v, 2) + ': ' + (ph[0].phase === 'touched' ? 'l-a atins, urmărește dacă e respins sau spart.' : 'se apropie, verifică graficul.') : 'Te anunț când se apropie de unul.');
    }
    // --- gold: open entries ---
    if(jHas(t, ['intrari','intrare','tranzactii deschise','sunt deschise','pozitii','ce e deschis','tranzactii de test'])){
      var act = (gold && gold.ptrades || []).filter(function(x){ return !x.closed; });
      if(!act.length) return 'ZyP, acum nu e nicio intrare deschisă pe aur. Te anunț când intră o strategie.';
      var op = act.filter(function(x){ return x.status !== 'în așteptare'; }), p = jGold().p;
      var list = op.slice(-4).map(function(x){ var mv = x.side === 'BUY' ? p - x.entry : x.entry - p; return x.strat.split(' (')[0] + ' pe ' + (x.side === 'BUY' ? 'cumpărare' : 'vânzare') + ' de la ' + jNum(x.entry) + ', acum ' + (mv >= 0 ? 'pe plus ' : 'pe minus ') + jNum(Math.abs(mv), 1) + ' dolari'; });
      return 'ZyP, ai ' + op.length + ' intrări deschise' + (act.length > op.length ? ' și ' + (act.length - op.length) + ' ordine în așteptare' : '') + '. ' + (list.length ? 'Ultimele: ' + list.join('; ') + '.' : '');
    }
    if(!window.SHOW_GOLD && jHas(t, ['clasament','cea mai buna strategie','care strategie','strategia castiga','aur','aurul','gold','xau','strategii','strategiile','verdict'])) return 'ZyP, fila de aur e ascunsă pentru moment. O pornim când vrei.';
    if(jHas(t, ['clasament','cea mai buna strategie','care strategie','strategia castiga'])){
      var ps = gold && gold.pstats ? Object.keys(gold.pstats).map(function(k){ return gold.pstats[k]; }).filter(function(v){ return v.n; }).sort(function(a,b){ return b.r - a.r; }) : [];
      if(!ps.length) return 'ZyP, încă nu sunt tranzacții închise ca să fac un clasament. Mai așteaptă câteva zile.';
      return 'ZyP, pe primul loc e ' + ps[0].name + ', cu ' + ps[0].rate + '% câștigate și ' + (ps[0].r >= 0 ? 'plus ' : 'minus ') + jNum(Math.abs(ps[0].r), 1) + ' R.' + (ps[1] ? ' Pe locul doi, ' + ps[1].name + '.' : '');
    }
    if(jHas(t, ['aur','aurul','gold','xau','strategii','strategiile','verdict'])){
      var g = jGold(); if(!g) return 'ZyP, analiza aurului se încarcă încă. Încearcă peste câteva secunde.';
      var vt = g.v === 'BUY' ? 'mai multe strategii spun cumpărare' : g.v === 'SELL' ? 'mai multe strategii spun vânzare' : 'strategiile nu sunt de acord, așa că e mai bine să aștepți';
      var nact = (gold.ptrades || []).filter(function(x){ return !x.closed && x.status !== 'în așteptare'; }).length;
      return 'ZyP, aurul e la ' + jNum(g.p, 2) + ' dolari, ' + (g.ch >= 0 ? 'în creștere cu ' : 'în scădere cu ') + jNum(Math.abs(g.pct), 2) + ' la sută azi. Din cele ' + (gold.strategies || []).length + ' de strategii, ' + (g.c.buyN || 0) + ' spun cumpărare și ' + (g.c.sellN || 0) + ' vânzare: ' + vt + '. Ai ' + nact + ' intrări de test deschise.';
    }
    // --- news ---
    if(jHas(t, ['stire','stiri','stirea','calendar','news'])){
      if(!newsTarget) return 'ZyP, nu urmează nicio știre importantă acum. Calendarul săptămânii noi apare duminică seara.';
      var mins = Math.round((newsTarget.t.getTime() - Date.now()) / 60000);
      return 'ZyP, următoarea știre ' + (newsTarget.i === 'High' ? 'roșie' : 'importantă') + ' e ' + newsTarget.c + ', ' + newsTarget.title + ', la ora ' + hhmm(newsTarget.t) + (mins > 0 ? ', peste ' + (mins >= 60 ? Math.floor(mins / 60) + ' ore și ' + (mins % 60) + ' minute' : mins + ' minute') : '') + '.' + (newsTarget.i === 'High' ? ' Atenție la aur în jurul ei.' : '');
    }
    if(/\beth(ereum|erium)?\b/.test(t)){
      if(eth.live == null) return 'ZyP, încă nu am prețul Ethereum. Deschide Bani, Avere, și mai încearcă peste câteva secunde.';
      var ps = eth.pos, tx = 'ZyP, Ethereum e la ' + jNum(eth.live, 2) + ' euro' + (eth.ch24 != null && !isNaN(eth.ch24) ? ', ' + (eth.ch24 >= 0 ? 'în creștere cu ' : 'în scădere cu ') + jNum(Math.abs(eth.ch24), 2) + ' la sută în 24 de ore' : '') + '. ';
      if(ps){ var vv = ps.qty * eth.live, dd = vv - ps.invested; tx += 'Ai pus ' + jNum(ps.invested, 0) + ' euro, acum valorează ' + jNum(vv, 2) + ' euro, adică ' + (dd >= 0 ? 'ești pe plus cu ' : 'ești pe minus cu ') + jNum(Math.abs(dd), 2) + ' euro, ' + jNum(Math.abs(dd / ps.invested * 100), 2) + ' la sută.'; }
      else tx += 'Nu ai pus încă nicio sumă la Ethereum. O poți adăuga la Bani, Avere.';
      return tx;
    }
    // --- MT5 account ---
    if(jHas(t, ['mt5','metatrader','contul meu','cont real','pozitiile mele','equity','balanta','contul de trading'])){
      var S5 = mt5State; if(!S5 || !S5.info) return 'ZyP, contul MT5 nu e conectat încă. După ce punem cheile MetaApi, îți spun tot despre el.';
      var ps5 = S5.positions || [], fl5 = ps5.map(mt5Live).reduce(function(a, x){ return a + (x.profit || 0); }, 0);
      var c5 = S5.info.currency === 'USD' ? ' dolari' : ' ' + (S5.info.currency || '');
      return 'ZyP, în contul MT5 ai o balanță de ' + jNum(S5.info.balance, 2) + c5 + ' și equity ' + jNum(S5.info.balance + fl5, 2) + '. ' +
        (ps5.length ? 'Ai ' + ps5.length + (ps5.length === 1 ? ' poziție deschisă' : ' poziții deschise') + ': ' + ps5.slice(0, 3).map(function(p){ var L = mt5Live(p); return p.symbol + ' ' + (p.side === 'BUY' ? 'cumpărare' : 'vânzare') + ' ' + p.volume + ' de la ' + p.open + ', acum ' + (L.profit >= 0 ? 'pe plus ' : 'pe minus ') + jNum(Math.abs(L.profit), 2); }).join('; ') + '.' + (ps5.some(function(p){ return !p.sl; }) ? ' Atenție: ai o poziție fără stop loss!' : '') : 'Nu ai nicio poziție deschisă acum.');
    }
    // --- money ---
    if(jHas(t, ['avere','bani','cati bani','sold','conturi','cat am'])){
      var w = jWorth(); if(!w) return 'ZyP, încă n-ai salvat soldurile. Intră la Bani, Avere, și le trecem.';
      return 'ZyP, averea ta totală e ' + jNum(w.now) + ' euro.' + (w.prev != null ? ' Față de ultima salvare ' + (w.now >= w.prev ? 'ai crescut cu ' : 'ai scăzut cu ') + jNum(Math.abs(w.now - w.prev)) + ' euro.' : '') + (worthGoal ? ' Ești la ' + Math.round(w.now / worthGoal * 100) + ' la sută din obiectivul de ' + jNum(worthGoal) + ' euro.' : '');
    }
    if(jHas(t, ['trading','profit','pierdere','jurnal'])){
      var ym = todayKey.slice(0, 7), tm = trades.filter(function(x){ return x.date && x.date.slice(0, 7) === ym; });
      var pl = tm.reduce(function(a, x){ return a + (x.result || 0); }, 0), wn = tm.filter(function(x){ return x.result > 0; }).length;
      return tm.length ? 'ZyP, luna asta ai ' + tm.length + (tm.length === 1 ? ' tranzacție, ' : ' tranzacții, ') + wn + ' pe plus, rezultat ' + (pl >= 0 ? 'plus ' : 'minus ') + jNum(Math.abs(pl), 2) + ' euro.' : 'ZyP, luna asta n-ai notat încă nicio tranzacție.';
    }
    if(jHas(t, ['investit','investitii','etf','bitcoin'])){
      var tot = investments.reduce(function(a, x){ return a + (+x.amount || 0); }, 0);
      return 'ZyP, ai investit în total ' + jNum(tot) + ' euro, în ' + investments.length + ' luni. Continuă cu 500 pe lună și banii lucrează pentru tine.';
    }
    // --- habits / streaks ---
    if(jHas(t, ['motiveaza','pofta','greu','nu mai pot','ajuta','ajutor'])){
      return 'ZyP, ascultă-mă: pofta trece în trei până la cinci minute. Respiră adânc de patru ori, bea un pahar de apă și mergi zece pași. Ai ajuns la ziua ' + jDayNum() + '. Nu da totul înapoi pentru cinci minute.';
    }
    if(jHas(t, ['tigari','fumat','fumez','tigara'])){
      var sf = jSmokeFree(); return 'ZyP, ai ' + sf + (sf === 1 ? ' zi' : ' zile') + ' la rând fără țigări. ' + (sf >= 7 ? 'Plămânii tăi deja respiră mai bine. Nu da totul înapoi pentru una singură.' : 'Fiecare zi contează. Dacă vine pofta, trece în câteva minute: bea un pahar de apă.');
    }
    if(jHas(t, ['ce mai am','ce am de bifat','obiceiuri','bifat','ce am facut','cum stau azi'])){
      var lf = jLeft(), dnN = HABITS.length - lf.length;
      return 'ZyP, azi ai bifat ' + dnN + ' din ' + HABITS.length + '. ' + (lf.length ? 'Mai ai: ' + lf.map(function(x){ return x.label.toLowerCase(); }).join(', ') + '.' : 'Ai terminat tot. Zi perfectă! 🔥');
    }
    if(jHas(t, ['ziua','cate zile','viata noua','de cand'])){ return 'ZyP, azi e ziua ' + jDayNum() + ' din viața ta nouă. Ai ' + jSmokeFree() + ' zile la rând fără țigări.'; }
    if(jHas(t, ['greutate','kg','kilograme','cantaresc'])){
      var ws = Object.keys(data).sort().filter(function(k){ return data[k] && data[k].weight != null; });
      if(!ws.length) return 'ZyP, n-ai notat încă greutatea. O poți scrie pe fila Azi, la jurnalul zilei.';
      var wl = +data[ws[ws.length - 1]].weight, wf = +data[ws[0]].weight;
      return 'ZyP, ultima greutate notată e ' + jNum(wl, Math.round(wl * 100) % 10 === 0 ? 1 : 2) + ' kilograme.' + (ws.length > 1 ? ' De la început ' + (wl <= wf ? 'ai slăbit ' : 'ai pus ') + jNum(Math.abs(wl - wf), 2) + ' kilograme.' : '');
    }
    // --- day plan ---
    if(jHas(t, ['sala','sport','antrenament azi','ce am azi','planul','azi ce'])){
      var code = woOfDay(wIdx), md = document.querySelectorAll('.mm-day')[wIdx], lunch = '';
      if(md){ var fs = md.querySelectorAll('.mm-food'); lunch = fs[1] ? fs[1].textContent : ''; }
      return 'ZyP, ' + (/odihn/i.test(woLabel(code)) ? 'azi e zi de odihnă, fără sală.' : 'azi la sport ai ' + woLabel(code) + '.') + (lunch ? ' La prânz: ' + lunch + '.' : '') + (newsTarget ? ' Următoarea știre importantă e la ' + hhmm(newsTarget.t) + '.' : '') + ' Mai ai ' + jLeft().length + ' obiceiuri de bifat.';
    }
    if(jHas(t, ['mananc','mancare','pranz','cina','meniu'])){
      var md2 = document.querySelectorAll('.mm-day')[wIdx]; var f2 = md2 ? Array.from(md2.querySelectorAll('.mm-food')).map(function(x){ return x.textContent; }) : [];
      return f2.length ? 'ZyP, azi în meniu: dimineața ' + f2[0] + ', la prânz ' + (f2[1] || '') + ', seara ' + (f2[3] || f2[2] || '') + '.' : 'ZyP, deschide fila Mâncare ca să vezi meniul zilei.';
    }
    if(jHas(t, ['raport','saptamana','cum a fost'])){
      var W = (typeof weekStats === 'function') ? weekStats(0) : null;
      return W ? 'ZyP, săptămâna asta ai bifat ' + W.pct + ' la sută din obiceiuri, cu ' + W.perfect + ' zile perfecte.' + (W.tw ? ' La trading: ' + W.tw + ' tranzacții, ' + (W.pnl >= 0 ? 'plus ' : 'minus ') + jNum(Math.abs(W.pnl), 2) + ' euro.' : '') : 'ZyP, raportul se află la Profil.';
    }
    if(jHas(t, ['salut','buna','hey','hei','servus','ce faci'])){ return hi + ', ZyP! Sunt aici. Întreabă-mă de aur, intrări, știri, bani, sală sau obiceiuri.'; }
    if(jHas(t, ['ce poti','ajutor comenzi','ce stii','comenzi'])){ return 'ZyP, mă poți întreba: cum stă aurul, ce intrări sunt deschise, care e cea mai bună strategie, când e următoarea știre, câți bani am, cum merge tradingul, câte zile fără țigări, ce mai am de bifat, ce am azi la sală, ce mănânc azi, cum a fost săptămâna. Sau spune: am băut apă, am fost la sală, deschide terminalul, deschide seiful.'; }
    return 'ZyP, n-am înțeles exact. Poți să mă întrebi de aur, intrări, știri, bani, trading, țigări, obiceiuri, sală sau mâncare.';
  }

  var jRec = null, jListening = false;
  function jSpeak(text){
    try{
      if(!window.speechSynthesis) return;
      speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(text.replace(/[🔥💪🏆]/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&'));
      u.lang = 'ro-RO'; u.rate = 1.02; u.pitch = 1;
      var vs = speechSynthesis.getVoices().filter(function(v){ return /^ro/i.test(v.lang); }); if(vs[0]) u.voice = vs[0];
      speechSynthesis.speak(u);
    }catch(e){}
  }
  function jShow(q, a){
    var box = document.getElementById('jvLog'); if(!box) return;
    box.innerHTML = (q ? '<div class="jv-q">„' + String(q).replace(/</g, '&lt;') + '”</div>' : '') + '<div class="jv-a">' + a + '</div>' + box.innerHTML;
  }
  function jHandle(q){ var a = jAnswer(q); jShow(q, a); jSpeak(a); }
  function openJarvis(){
    var ov = document.getElementById('jvOverlay');
    if(!ov){
      ov = document.createElement('div'); ov.id = 'jvOverlay'; ov.className = 'jv-ov';
      ov.innerHTML = '<div class="jv-card"><button class="td-x jv-close" aria-label="Închide">✕</button>' +
        '<div class="jv-orb" id="jvOrb"><span></span><span></span><span></span></div>' +
        '<div class="jv-status" id="jvStatus">Atinge sfera și vorbește</div>' +
        '<div class="jv-sugg">' + ['Cum stă aurul?','Ce intrări sunt deschise?','Câți bani am?','Ce am azi?','Am băut apă','Câte zile fără țigări?'].map(function(s){ return '<button>' + s + '</button>'; }).join('') + '</div>' +
        '<div class="jv-type"><input id="jvInput" placeholder="…sau scrie aici" autocomplete="off"><button id="jvSend">➤</button></div>' +
        '<div class="jv-log" id="jvLog"></div></div>';
      document.body.appendChild(ov);
      ov.addEventListener('click', function(e){ if(e.target === ov || e.target.closest('.jv-close')){ ov.classList.remove('open'); try{ speechSynthesis.cancel(); if(jRec) jRec.abort(); }catch(er){} } });
      document.getElementById('jvOrb').addEventListener('click', jListen);
      ov.querySelectorAll('.jv-sugg button').forEach(function(b){ b.addEventListener('click', function(){ jHandle(b.textContent); }); });
      var inp = document.getElementById('jvInput');
      document.getElementById('jvSend').addEventListener('click', function(){ if(inp.value.trim()){ jHandle(inp.value); inp.value = ''; } });
      inp.addEventListener('keydown', function(e){ if(e.key === 'Enter' && inp.value.trim()){ jHandle(inp.value); inp.value = ''; } });
    }
    ov.classList.add('open');
    try{ speechSynthesis.getVoices(); }catch(e){}
    if(!document.getElementById('jvLog').innerHTML){ var h = new Date().getHours(); jShow(null, (h < 12 ? 'Bună dimineața' : h < 18 ? 'Bună ziua' : 'Bună seara') + ', ZyP. Ziua ' + jDayNum() + '. Cu ce te ajut?'); }
    setTimeout(jListen, 250);
  }
  function jListen(){
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition, st = document.getElementById('jvStatus'), orb = document.getElementById('jvOrb');
    if(!SR){ st.textContent = 'Microfonul nu e disponibil aici. Scrie întrebarea mai jos.'; return; }
    if(jListening){ try{ jRec.stop(); }catch(e){} return; }
    try{ speechSynthesis.cancel(); }catch(e){}
    jRec = new SR(); jRec.lang = 'ro-RO'; jRec.interimResults = true; jRec.maxAlternatives = 1;
    var finalT = '';
    jRec.onstart = function(){ jListening = true; orb.classList.add('on'); st.textContent = 'Te ascult…'; };
    jRec.onresult = function(ev){ var txt = ''; for(var i = 0; i < ev.results.length; i++){ txt += ev.results[i][0].transcript; if(ev.results[i].isFinal) finalT = txt; } st.textContent = '„' + txt + '”'; };
    jRec.onerror = function(ev){ st.textContent = ev.error === 'not-allowed' ? 'Permite microfonul pentru By ZyP (Setări → Safari → Microfon), sau scrie mai jos.' : 'Nu te-am auzit bine. Atinge sfera și încearcă din nou.'; };
    jRec.onend = function(){ jListening = false; orb.classList.remove('on'); if(finalT){ st.textContent = 'Atinge sfera și vorbește'; jHandle(finalT); } };
    try{ jRec.start(); }catch(e){ st.textContent = 'Atinge sfera și vorbește'; }
  }

  /* =====================================================================
     TERMINAL · full-screen black & gold trading desk
     ===================================================================== */
  var termTimer = null;
  function openTerminal(){
    var tv = document.getElementById('termView');
    if(!tv){
      tv = document.createElement('div'); tv.id = 'termView'; tv.className = 'term';
      tv.innerHTML = '<button class="td-x term-x" aria-label="Închide">✕</button>' +
        '<div class="term-head"><span class="term-sym">XAUUSD <span class="live-tag">● LIVE</span></span><span class="term-price" id="tmPrice">–</span><span class="term-chg" id="tmChg"></span></div>' +
        '<div class="term-grid"><div class="term-main"><div class="ch-wrap" id="termChart"></div></div>' +
        '<div class="term-side"><div class="term-box term-radar"><svg id="tmRadar" viewBox="0 0 200 200"></svg><div><div class="term-l">38 strategii</div><div class="term-v" id="tmVerdict"></div></div></div>' +
        '<div class="term-box"><div class="term-l">Următoarea știre</div><div class="term-news" id="tmNews">–</div></div>' +
        '<div class="term-box"><div class="term-l">Intrări active · live</div><div id="tmActive"></div></div></div></div>';
      document.body.appendChild(tv);
      tv.querySelector('.term-x').addEventListener('click', closeTerminal);
    }
    tv.classList.add('open'); document.body.style.overflow = 'hidden';
    fetchIntraday(); termPaint(); termStatic();
    clearInterval(termTimer); termTimer = setInterval(termPaint, 1000);
  }
  function closeTerminal(){ var tv = document.getElementById('termView'); if(tv) tv.classList.remove('open'); document.body.style.overflow = ''; clearInterval(termTimer); }
  function termStatic(){
    if(!gold) return;
    var v = (gold.confluence || {}).verdict, sc = (v === 'BUY' || v === 'SELL') ? gold.scenarios.filter(function(x){ return x.side === v; })[0] : gold.scenarios[0];
    var mk = (gold.ptrades || []).filter(function(t){ return !t.closed && t.status !== 'în așteptare'; }).slice(-8).map(function(t){ return { t:t.side, p:t.entry, col:t.side === 'BUY' ? '#5FBF8F' : '#E0685C', ts:Math.floor(new Date(t.opened || (t.date + 'T00:00:00')).getTime() / 1000), d:t.date }; });
    drawGoldChart('termChart', sc, { tf: goldTf.termChart || '15m', plan:true, marks: mk });
    var S = gold.strategies || [], n = S.length, svg = '';
    [30, 55, 80].forEach(function(r){ svg += '<circle cx="100" cy="100" r="' + r + '" fill="none" stroke="rgba(163,255,18,.18)" stroke-width="0.6"/>'; });
    S.forEach(function(x, i){ var a = -Math.PI / 2 + i / n * Math.PI * 2, r = x.verdict === 'BUY' || x.verdict === 'SELL' ? 36 + x.strength * 15 : 30;
      var col = x.verdict === 'BUY' ? '#5FBF8F' : x.verdict === 'SELL' ? '#E0685C' : x.verdict === 'AȘTEAPTĂ' ? '#A3FF12' : '#6F695F';
      var px = 100 + Math.cos(a) * r, py = 100 + Math.sin(a) * r;
      svg += '<line x1="100" y1="100" x2="' + px.toFixed(1) + '" y2="' + py.toFixed(1) + '" stroke="' + col + '" stroke-opacity=".35" stroke-width="0.8"/><circle cx="' + px.toFixed(1) + '" cy="' + py.toFixed(1) + '" r="3.2" fill="' + col + '"/>'; });
    var c = gold.confluence || {};
    svg += '<circle cx="100" cy="100" r="20" fill="#050505" stroke="rgba(163,255,18,.5)"/><text x="100" y="104" text-anchor="middle" font-size="11" font-weight="800" fill="' + (c.verdict === 'BUY' ? '#5FBF8F' : c.verdict === 'SELL' ? '#E0685C' : '#A3FF12') + '" font-family="sans-serif">' + (c.verdict === 'AȘTEAPTĂ' ? 'WAIT' : c.verdict || '') + '</text>';
    document.getElementById('tmRadar').innerHTML = svg;
    document.getElementById('tmVerdict').innerHTML = '<span style="color:#5FBF8F">BUY ' + (c.buyN || 0) + '</span><span style="color:#AAA397">neutre ' + (c.waitN || 0) + '</span><span style="color:#E0685C">SELL ' + (c.sellN || 0) + '</span>';
    document.getElementById('tmActive').innerHTML = activeEntriesHtml(4);
  }
  var termLastP = null, termTick = 0;
  function termPaint(){
    if(!gold) return;
    var g = jGold(), pe = document.getElementById('tmPrice'); if(!pe) return;
    if(termLastP != null && g.p !== termLastP){ pe.classList.remove('up', 'dn'); void pe.offsetWidth; pe.classList.add(g.p > termLastP ? 'up' : 'dn'); }
    termLastP = g.p;
    pe.textContent = jNum(g.p, 2);
    var ce = document.getElementById('tmChg'); ce.className = 'term-chg ' + (g.ch >= 0 ? 'hs-win' : 'hs-loss'); ce.textContent = (g.ch >= 0 ? '▲ ' : '▼ ') + (g.ch >= 0 ? '+' : '') + g.pct.toFixed(2) + '%';
    var ne = document.getElementById('tmNews');
    if(newsTarget){ var ms = newsTarget.t.getTime() - Date.now(), s2 = Math.max(0, Math.floor(ms / 1000));
      var hh = Math.floor(s2 / 3600), mm = Math.floor(s2 % 3600 / 60), ss = s2 % 60, pad = function(x){ return String(x).padStart(2, '0'); };
      ne.innerHTML = '<b class="' + (newsTarget.i === 'High' ? 'hs-loss' : '') + '">' + (newsTarget.i === 'High' ? '🔴 ' : '🟠 ') + zEsc(newsTarget.c) + '</b> ' + zEsc(newsTarget.title) + '<span class="term-cd">' + pad(hh) + ':' + pad(mm) + ':' + pad(ss) + '</span>';
    } else ne.textContent = 'Nicio știre importantă programată.';
    if(++termTick % 30 === 0) termStatic();
    if(typeof paintLive === 'function' && termTick % 5 === 0) paintLive();
  }
  window.addEventListener('orientationchange', function(){ setTimeout(function(){
    var gv = document.getElementById('view-gold'); if(Math.abs(window.orientation || 0) === 90 && gv && gv.classList.contains('active')) openTerminal();
  }, 300); });

  /* =====================================================================
     VAULT · net worth as 3D gold bars (three.js r128, loaded on demand)
     ===================================================================== */
  var vaultState = null;
  function loadThree(cb){
    if(window.THREE) return cb();
    var sc = document.createElement('script'); sc.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
    sc.onload = cb; sc.onerror = function(){ var m = document.getElementById('vaultMsg'); if(m) m.textContent = 'Nu s-a putut încărca seiful 3D (verifică internetul).'; };
    document.head.appendChild(sc);
  }
  function openVault(){
    var vv = document.getElementById('vaultView');
    if(!vv){
      vv = document.createElement('div'); vv.id = 'vaultView'; vv.className = 'vault';
      vv.innerHTML = '<button class="td-x term-x" aria-label="Închide">✕</button><div class="vault-hud"><div class="vault-l">Seiful tău</div><div class="vault-v" id="vaultVal">–</div><div class="vault-s" id="vaultSub"></div></div>' +
        '<div id="vaultCanvas" class="vault-canvas"></div><div class="vault-hint" id="vaultMsg">Trage cu degetul ca să rotești seiful · 1 lingou = 100 €</div>';
      document.body.appendChild(vv);
      vv.querySelector('.term-x').addEventListener('click', closeVault);
    }
    vv.classList.add('open'); document.body.style.overflow = 'hidden';
    var w = jWorth(), now = w ? w.now : 0, bars = Math.min(400, Math.floor(now / 100)), goalBars = worthGoal ? Math.min(400, Math.ceil(worthGoal / 100)) : 0;
    document.getElementById('vaultVal').textContent = '€' + jNum(now);
    document.getElementById('vaultSub').textContent = bars + (bars === 1 ? ' lingou' : ' lingouri') + (worthGoal ? ' · obiectiv €' + jNum(worthGoal) + ' (' + Math.min(100, Math.round(now / worthGoal * 100)) + '%)' : ' · pune un obiectiv la Bani → Avere');
    loadThree(function(){ buildVault(bars, goalBars); });
  }
  function closeVault(){ var vv = document.getElementById('vaultView'); if(vv) vv.classList.remove('open'); document.body.style.overflow = ''; if(vaultState){ cancelAnimationFrame(vaultState.raf); vaultState.renderer.dispose(); vaultState = null; var c = document.getElementById('vaultCanvas'); if(c) c.innerHTML = ''; } }
  function buildVault(bars, goalBars){
    var host = document.getElementById('vaultCanvas'); if(!host || !window.THREE) return;
    host.innerHTML = '';
    var T = THREE, W = host.clientWidth || window.innerWidth, H = host.clientHeight || window.innerHeight * 0.7;
    var renderer = new T.WebGLRenderer({ antialias:true, alpha:true }); renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); renderer.setSize(W, H);
    renderer.outputEncoding = T.sRGBEncoding; host.appendChild(renderer.domElement);
    var scene = new T.Scene(), cam = new T.PerspectiveCamera(38, W / H, 0.1, 200);
    scene.add(new T.AmbientLight(0xfff1d6, 0.35));
    var key = new T.DirectionalLight(0xffe2a8, 1.25); key.position.set(6, 12, 8); scene.add(key);
    var rim = new T.PointLight(0xd6b26e, 1.1, 40); rim.position.set(-8, 6, -6); scene.add(rim);
    var fill = new T.DirectionalLight(0xfff4de, 0.7); fill.position.set(-4, 5, 10); scene.add(fill);
    var top = new T.PointLight(0xffe7b0, 1.4, 30); top.position.set(0, 9, 2); scene.add(top);
    // floor + vault walls
    var floor = new T.Mesh(new T.CircleGeometry(14, 64), new T.MeshBasicMaterial({ color:0x010101 })); floor.rotation.x = -Math.PI / 2; scene.add(floor);
    var ring = new T.Mesh(new T.RingGeometry(9.6, 9.75, 96), new T.MeshBasicMaterial({ color:0xd6b26e, transparent:true, opacity:0.55 })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.01; scene.add(ring);
    // bullion shape (trapezoid prism)
    var shape = new T.Shape(); shape.moveTo(-0.62, 0); shape.lineTo(0.62, 0); shape.lineTo(0.5, 0.34); shape.lineTo(-0.5, 0.34); shape.lineTo(-0.62, 0);
    var geo = new T.ExtrudeGeometry(shape, { depth:0.34, bevelEnabled:true, bevelThickness:0.03, bevelSize:0.03, bevelSegments:2 }); geo.translate(0, 0, -0.17);
    var mat = new T.MeshStandardMaterial({ color:0xe0b24f, metalness:0.9, roughness:0.24, emissive:0x3a2400, emissiveIntensity:0.45 });
    var ghostMat = new T.MeshBasicMaterial({ color:0xd6b26e, wireframe:true, transparent:true, opacity:0.12 });
    // layout: pyramid-ish stacks on a grid
    var totalN = Math.max(bars, goalBars), cols = totalN <= 48 ? 4 : totalN <= 160 ? 5 : 6, rowsN = totalN <= 48 ? 3 : totalN <= 160 ? 5 : 6, perLayer = cols * rowsN;
    function slot(i){ var layer = Math.floor(i / perLayer), k = i % perLayer, row = Math.floor(k / cols), col = k % cols;
      return { x:(col - (cols - 1) / 2) * 1.32 + (layer % 2 ? 0.08 : 0), y:0.03 + layer * 0.41, z:(row - (rowsN - 1) / 2) * 0.44 }; }
    var total = Math.max(bars, goalBars), inst = bars ? new T.InstancedMesh(geo, mat, bars) : null, dummy = new T.Object3D(), drops = [];
    if(inst){ scene.add(inst); for(var i = 0; i < bars; i++){ var s = slot(i); drops.push({ s:s, y0:s.y + 7 + Math.random() * 3, t0:performance.now() + i * Math.max(12, 900 / bars) }); } }
    if(goalBars > bars){ var gm = new T.InstancedMesh(geo, ghostMat, goalBars - bars); for(var j = bars; j < goalBars; j++){ var sg = slot(j); dummy.position.set(sg.x, sg.y, sg.z); dummy.rotation.set(0, 0, 0); dummy.updateMatrix(); gm.setMatrixAt(j - bars, dummy.matrix); } scene.add(gm); }
    var st = { renderer:renderer, raf:0, rotY:0.6, rotX:0.42, drag:null, auto:true };
    var hfov = 2 * Math.atan(Math.tan(T.MathUtils.degToRad(cam.fov) / 2) * cam.aspect);
    var layers = Math.ceil(total / perLayer), halfW = cols * 0.66 + 0.8;
    var dist = Math.max(7, halfW / Math.tan(hfov / 2)) + Math.min(10, layers * 0.35);
    function frame(now){
      if(inst){ for(var i = 0; i < drops.length; i++){ var d = drops[i], p = Math.max(0, Math.min(1, (now - d.t0) / 700)), e = 1 - Math.pow(1 - p, 3);
        var y = d.y0 + (d.s.y - d.y0) * e + (p >= 1 ? 0 : 0); dummy.position.set(d.s.x, y, d.s.z); dummy.rotation.set(0, (1 - e) * 1.5, 0); dummy.updateMatrix(); inst.setMatrixAt(i, dummy.matrix); }
        inst.instanceMatrix.needsUpdate = true; }
      if(st.auto) st.rotY += 0.0025;
      cam.position.set(Math.sin(st.rotY) * dist * Math.cos(st.rotX), 1.2 + Math.sin(st.rotX) * dist, Math.cos(st.rotY) * dist * Math.cos(st.rotX)); cam.lookAt(0, 0.3 + layers * 0.2, 0);
      renderer.render(scene, cam); st.raf = requestAnimationFrame(frame);
    }
    var el = renderer.domElement;
    el.addEventListener('pointerdown', function(e){ st.drag = { x:e.clientX, y:e.clientY }; st.auto = false; });
    window.addEventListener('pointerup', function(){ st.drag = null; });
    el.addEventListener('pointermove', function(e){ if(!st.drag) return; st.rotY -= (e.clientX - st.drag.x) * 0.008; st.rotX = Math.max(0.12, Math.min(1.25, st.rotX + (e.clientY - st.drag.y) * 0.006)); st.drag = { x:e.clientX, y:e.clientY }; });
    el.style.touchAction = 'none';
    vaultState = st; st.raf = requestAnimationFrame(frame);
    if(!bars){ var m = document.getElementById('vaultMsg'); if(m) m.textContent = 'Seiful e gol deocamdată: salvează soldurile la Bani → Avere și lingourile apar aici.'; }
  }

  /* entry points */
  window.__openTerminal = openTerminal; window.__openVault = openVault; window.__openJarvis = openJarvis; window.__jAnswer = jAnswer;
  (function(){
    var fab = document.createElement('button'); fab.id = 'jvFab'; fab.className = 'jv-fab'; fab.setAttribute('aria-label', 'Jarvis');
    fab.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>';
    fab.addEventListener('click', openJarvis); document.body.appendChild(fab);
  })();


  /* ===== full reset: wipe every record, start again at day 1, trading from €100 ===== */
  (function(){
    var btn = document.getElementById('resetAllBtn'); if(!btn) return;
    btn.addEventListener('click', function(){
      if(!confirm('Ștergi TOT din aplicație?\n\nObiceiuri, jurnal, greutate, poze, avere, trading, investiții, obiective, profil, sport.\n\nNu se mai poate recupera. Descarcă întâi backup-ul dacă vrei să-l păstrezi.')) return;
      var w = prompt('Scrie RESET ca să confirmi. Contul de trading pornește de la (€):', '100');
      if(w === null) return;
      var start = parseFloat(String(w).replace(',', '.'));
      var typed = prompt('Ultima confirmare: scrie RESET (cu majuscule)');
      if(typed !== 'RESET'){ alert('N-am șters nimic.'); return; }
      if(!(start >= 0)) start = 100;
      btn.disabled = true; btn.textContent = 'Se șterge…';
      try{ Object.keys(localStorage).forEach(function(k){ if(k !== THEME_KEY && k.indexOf('sb-') !== 0) localStorage.removeItem(k); }); }catch(e){}
      var done = function(){ try{ localStorage.setItem('reset_eq_start_v1', String(start)); }catch(e){} alert('Gata, ZyP. Totul e de la zero: ziua 1, trading de la €' + start + '. Succes! 💪'); location.hash = ''; location.reload(); };
      if(window.__wipeAll){
        window.__wipeAll().then(function(){ return window.__putDoc('settings', 'trading', { startBalance:start }); }).then(done)
          .catch(function(e){ alert('Nu s-a putut șterge din cloud: ' + (e.message || e) + '. Încearcă din nou.'); btn.disabled = false; btn.textContent = '🗑️ Resetează tot (de la zero)'; });
      } else done();
    });
  })();

  /* money segments */
  (function(){
    var btns = document.querySelectorAll('#moneySeg .seg-btn');
    function show(seg){
      btns.forEach(function(b){ b.classList.toggle('active', b.getAttribute('data-seg') === seg); });
      document.querySelectorAll('[data-seg-card]').forEach(function(c){
        c.classList.toggle('seg-show', c.getAttribute('data-seg-card') === seg);
      });
    }
    btns.forEach(function(b){ b.addEventListener('click', function(){ show(b.getAttribute('data-seg')); }); });
    show('worth');
  })();
  var calDaysOpen = false;
  document.getElementById('calDaysToggle').addEventListener('click', function(){
    calDaysOpen = !calDaysOpen;
    document.getElementById('calDayList').style.display = calDaysOpen ? 'block' : 'none';
    this.textContent = calDaysOpen ? 'Ascunde lista pe zile' : 'Vezi pe zile';
  });
  function renderTodayPl(){
    var el = document.getElementById('todayPl');
    if(!el) return;
    var tt = trades.filter(function(t){ return t.date === todayKey; });
    var sum = tt.reduce(function(s,t){ return s + t.result; }, 0);
    var d = new Date();
    var label = 'Azi · ' + d.getDate() + ' ' + monthShort[d.getMonth()];
    var sub = tt.length ? (tt.length + (tt.length===1 ? ' tranzacție' : ' tranzacții')) : 'nicio tranzacție încă';
    el.className = 'today-pl' + (tt.length ? (sum >= 0 ? ' pos' : ' neg') : '');
    el.innerHTML = '<div><div class="today-pl-l">' + label + '</div><div class="today-pl-sub">' + sub + '</div></div>' +
      '<div class="today-pl-v">' + (tt.length ? fmtSigned(sum) : '€0.00') + '</div>';
  }

  /* trading calendar */
  var calMonthOffset = 0; // 0 = current month, -1 = prev, etc.
  var dayShort = ['D','L','Ma','Mi','J','V','S'];
  function renderCalendar(){
    renderTodayPl();
    renderEquity();
    var base = new Date();
    var calDate = new Date(base.getFullYear(), base.getMonth() + calMonthOffset, 1);
    var y = calDate.getFullYear(), m = calDate.getMonth();
    document.getElementById('calLabel').textContent = monthFull[m] + ' ' + y;

    var byDay = {};
    trades.forEach(function(t){
      var d = new Date(t.date + 'T00:00:00');
      if(d.getFullYear() === y && d.getMonth() === m){
        var day = d.getDate();
        byDay[day] = (byDay[day] || 0) + t.result;
      }
    });

    var firstWeekday = new Date(y, m, 1).getDay();
    var daysInMonth = new Date(y, m+1, 0).getDate();
    var grid = document.getElementById('calGrid');
    var html = '';
    dayShort.forEach(function(d){ html += '<div class="cal-cell empty" style="color:var(--text-faint);font-size:9px;">' + d + '</div>'; });
    for(var i=0; i<firstWeekday; i++) html += '<div class="cal-cell empty"></div>';
    var isCurMonth = (base.getFullYear()===y && base.getMonth()===m);
    for(var day=1; day<=daysInMonth; day++){
      var cls = 'cal-cell';
      if(byDay[day] != null){ cls += byDay[day] >= 0 ? ' win' : ' loss'; }
      if(isCurMonth && day === base.getDate()) cls += ' today-mark';
      html += '<div class="' + cls + '">' + day + '</div>';
    }
    grid.innerHTML = html;

    var values = Object.keys(byDay).map(function(k){ return byDay[k]; });
    var tradesThisMonth = trades.filter(function(t){
      var d = new Date(t.date + 'T00:00:00');
      return d.getFullYear()===y && d.getMonth()===m;
    });
    var wins = tradesThisMonth.filter(function(t){ return t.result >= 0; }).length;
    var winRate = tradesThisMonth.length ? Math.round(wins/tradesThisMonth.length*100) : 0;
    var best = values.length ? Math.max.apply(null, values) : 0;
    var worst = values.length ? Math.min.apply(null, values) : 0;

    document.getElementById('calStats').innerHTML =
      '<div class="cal-stat"><div class="cal-stat-num">' + tradesThisMonth.length + '</div><div class="cal-stat-label">tranzacții</div></div>' +
      '<div class="cal-stat"><div class="cal-stat-num">' + winRate + '%</div><div class="cal-stat-label">rată câștig</div></div>' +
      '<div class="cal-stat"><div class="cal-stat-num" style="color:var(--accent)">' + fmtSigned(best) + '</div><div class="cal-stat-label">cea mai bună zi</div></div>' +
      '<div class="cal-stat"><div class="cal-stat-num" style="color:var(--danger)">' + fmtSigned(worst) + '</div><div class="cal-stat-label">cea mai slabă zi</div></div>';

    var countByDay = {};
    tradesThisMonth.forEach(function(t){
      var day = new Date(t.date + 'T00:00:00').getDate();
      countByDay[day] = (countByDay[day] || 0) + 1;
    });
    var dayList = document.getElementById('calDayList');
    var dayKeys = Object.keys(byDay).map(Number).sort(function(a,b){ return b-a; });
    if(!dayKeys.length){
      dayList.innerHTML = '<div class="hint" style="margin-top:0;">Nicio tranzacție în luna afișată.</div>';
    } else {
      dayList.innerHTML = dayKeys.map(function(day){
        var sum = byDay[day];
        var n = countByDay[day] || 0;
        return '<div class="trade-item"><span class="trade-item-date">' + day + ' ' + monthShort[m] + ' · ' + n + (n===1?' tranzacție':' tranzacții') + '</span><span class="trade-item-pl ' + (sum>=0?'pos':'neg') + '">' + fmtSigned(sum) + '</span></div>';
      }).join('');
    }
  }
  document.getElementById('calPrev').addEventListener('click', function(){ calMonthOffset--; renderCalendar(); });
  document.getElementById('calNext').addEventListener('click', function(){ if(calMonthOffset < 0){ calMonthOffset++; renderCalendar(); } });

  /* monthly investments log */
  var investments = []; // {month:'YYYY-MM', amount, note}
  var investAmt = document.getElementById('investAmt');
  var investNote = document.getElementById('investNote');
  function monthKey(d){ return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0'); }
  var thisMonthKey = monthKey(new Date());

  function renderInvestments(){
    var totalEl = document.getElementById('investTotal');
    var streakEl = document.getElementById('investStreak');
    var barsEl = document.getElementById('investBars');
    var histEl = document.getElementById('investHistory');

    var total = investments.reduce(function(s,i){ return s + (i.amount||0); }, 0);
    totalEl.textContent = '€' + total.toFixed(0);

    var sorted = investments.slice().sort(function(a,b){ return a.month.localeCompare(b.month); });
    var streak = 0;
    if(sorted.length){
      var cursor = new Date(thisMonthKey + '-01T00:00:00');
      var monthSet = {}; sorted.forEach(function(i){ monthSet[i.month] = true; });
      while(true){
        var mk = monthKey(cursor);
        if(monthSet[mk]){ streak++; cursor.setMonth(cursor.getMonth()-1); } else break;
      }
    }
    streakEl.textContent = streak > 0 ? streak + ' luni consecutive investite' : '';

    var current = investments.find(function(i){ return i.month === thisMonthKey; });
    if(current){ investAmt.value = current.amount; investNote.value = current.note || ''; }

    var recent = sorted.slice(-6);
    var maxAmt = Math.max.apply(null, recent.map(function(i){ return i.amount||0; }).concat([1]));
    barsEl.innerHTML = recent.map(function(i){
      var h = Math.max(4, (i.amount||0)/maxAmt*56);
      var mm = i.month.slice(5,7);
      return '<div class="invest-bar-wrap"><div class="invest-bar" style="height:' + h + 'px;"></div><div class="invest-bar-label">' + monthShort[parseInt(mm)-1] + '</div></div>';
    }).join('');

    histEl.innerHTML = sorted.slice().reverse().slice(0,12).map(function(i){
      var mm = parseInt(i.month.slice(5,7))-1, yy = i.month.slice(0,4);
      return '<div class="trade-item"><span class="trade-item-date">' + monthFull[mm] + ' ' + yy + (i.note? ' · ' + i.note : '') + '</span><span>€' + (i.amount||0).toFixed(0) + '</span></div>';
    }).join('');
  }

  document.getElementById('investSaveBtn').addEventListener('click', function(){
    var amt = parseFloat(investAmt.value) || 0;
    var note = investNote.value || '';
    var entry = { month: thisMonthKey, amount: amt, note: note };
    if(useLocal){
      investments = investments.filter(function(i){ return i.month !== thisMonthKey; });
      investments.push(entry);
      safeSet('reset_investments_local_v1', JSON.stringify(investments));
      renderInvestments();
    } else {
      chainWrite('investments/'+thisMonthKey, function(){ return db.doc('investments/'+thisMonthKey).set(entry); });
    }
  });

  /* ---------- init: try db, fall back to localStorage ---------- */
  function renderDashboard(){
    var weights = Object.keys(data).filter(function(k){ return data[k] && data[k].weight != null; }).sort();
    var wEl = document.getElementById('dashWeight');
    var wDeltaEl = document.getElementById('dashWeightDelta');
    if(weights.length){
      var lastW = data[weights[weights.length-1]].weight;
      wEl.textContent = fmtKg(lastW) + ' kg';
      if(weights.length > 1){
        var diff = lastW - data[weights[0]].weight;
        wDeltaEl.textContent = (diff>=0?'+':'') + fmtKg(diff) + ' kg total';
      } else { wDeltaEl.textContent = 'greutate'; }
    } else { wEl.textContent = '–'; wDeltaEl.textContent = 'greutate'; }

    var worthEl = document.getElementById('dashWorth');
    if(accounts.length){
      var sa = sortedAccounts(); var lastA = sa[sa.length-1];
      var total = accTotal(lastA);
      worthEl.textContent = '€' + total.toFixed(0);
    } else { worthEl.textContent = '–'; }

    var tradingEl = document.getElementById('dashTrading');
    var thisMonth = monthKey(new Date());
    var monthSum = trades.filter(function(t){ return t.date.slice(0,7) === thisMonth; })
      .reduce(function(s,t){ return s + t.result; }, 0);
    if(trades.length){
      tradingEl.textContent = (monthSum>=0?'+':'') + '€' + Math.abs(monthSum).toFixed(2);
      tradingEl.style.color = monthSum >= 0 ? 'var(--accent)' : 'var(--danger)';
    } else { tradingEl.textContent = '–'; tradingEl.style.color = ''; }
    renderGrowth();
    if(typeof renderWeekReport === 'function') renderWeekReport();
  }

  /* ===== growth chart (Azi) ===== */
  var gMode = 'habits';
  try{ gMode = localStorage.getItem('byzyp_gmode') || 'habits'; }catch(e){}
  function gSeries(){
    if(gMode === 'habits'){
      var pts = [];
      for(var i=29;i>=0;i--){ var d = new Date(today); d.setDate(d.getDate()-i); pts.push({ d:dateKey(d), y:doneCount(data[dateKey(d)]) }); }
      return { pts:pts, bars:true };
    }
    if(gMode === 'weight'){
      return { pts: Object.keys(data).filter(function(k){ return data[k] && data[k].weight != null; }).sort().map(function(k){ return { d:k, y:data[k].weight }; }) };
    }
    if(gMode === 'worth'){
      return { pts: sortedAccounts().map(function(a){
        return { d:a.date, y:accTotal(a) }; }) };
    }
    // trading: cumulative balance
    var st = (typeof eqStart === 'number') ? eqStart : 0;
    var sorted = trades.slice().sort(function(a,b){ return a.date.localeCompare(b.date); });
    var run = st, pts2 = [];
    if(sorted.length) pts2.push({ d:sorted[0].date, y:st });
    sorted.forEach(function(t){ run += t.result; pts2.push({ d:t.date, y:run }); });
    return { pts:pts2 };
  }
  function gFmt(v){
    if(gMode === 'weight') return fmtKg(v) + ' kg';
    if(gMode === 'worth') return '€' + Math.round(v).toLocaleString('ro-RO');
    if(gMode === 'trading') return (v<0?'-':'') + '€' + Math.abs(v).toFixed(2);
    return v + '/5';
  }
  function dLabel(k){ var d = new Date(k + 'T00:00:00'); return d.getDate() + ' ' + monthShort[d.getMonth()]; }
  function renderGrowth(){
    var chart = document.getElementById('gChart'); if(!chart) return;
    document.querySelectorAll('#gPills .day-pill').forEach(function(b){ b.classList.toggle('active', b.getAttribute('data-g') === gMode); });
    document.querySelectorAll('.dash-card[data-g]').forEach(function(c){ c.classList.toggle('gsel', c.getAttribute('data-g') === gMode); });
    var S = gSeries(), pts = S.pts;
    var valEl = document.getElementById('gVal'), subEl = document.getElementById('gSub'), dEl = document.getElementById('gDelta');
    var fromEl = document.getElementById('gFrom'), toEl = document.getElementById('gTo');
    var W = 320, H = 150, pad = 8;
    if(S.bars){
      var perfect = pts.filter(function(p){ return p.y === 5; }).length;
      var avg = pts.reduce(function(a,p){ return a+p.y; },0) / pts.length;
      var last7 = pts.slice(-7).reduce(function(a,p){ return a+p.y; },0)/7, prev7 = pts.slice(-14,-7).reduce(function(a,p){ return a+p.y; },0)/7;
      valEl.textContent = Math.round(avg/5*100) + '%';
      subEl.textContent = 'din obiceiuri bifate · ' + perfect + ' zile perfecte în 30 de zile';
      var dd = (last7 - prev7)/5*100;
      dEl.textContent = (dd>=0?'↑ ':'↓ ') + Math.abs(Math.round(dd)) + '% vs săpt. trecută';
      dEl.className = 'g-delta' + (dd>0?' pos':dd<0?' neg':'');
      var bw = (W - pad*2) / pts.length;
      var bars = pts.map(function(p,i){
        var h = p.y === 0 ? 3 : (H - pad*2) * p.y/5;
        var col = p.y === 5 ? 'var(--accent)' : p.y >= 3 ? 'color-mix(in srgb, var(--accent) 60%, var(--bg-card-2))' : p.y >= 1 ? 'color-mix(in srgb, var(--accent) 30%, var(--bg-card-2))' : 'var(--line)';
        var isT = p.d === todayKey;
        return '<rect x="' + (pad + i*bw + 1).toFixed(1) + '" y="' + (H - pad - h).toFixed(1) + '" width="' + Math.max(2, bw-2).toFixed(1) + '" height="' + h.toFixed(1) + '" rx="2" fill="' + col + '"' + (isT ? ' stroke="var(--gold)" stroke-width="1.5"' : '') + '/>';
      }).join('');
      chart.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none">' +
        '<line x1="' + pad + '" x2="' + (W-pad) + '" y1="' + pad + '" y2="' + pad + '" stroke="var(--line)" stroke-dasharray="3 4" vector-effect="non-scaling-stroke"/>' + bars + '</svg>';
      fromEl.textContent = dLabel(pts[0].d); toEl.textContent = 'azi';
      return;
    }
    if(pts.length < 2){
      var msg = { weight:'Notează-ți greutatea în Jurnalul zilei de mai jos. Graficul apare de la a doua cântărire.',
        worth:'Salvează valorile conturilor în Bani → Avere de cel puțin 2 ori și aici vezi cum crește averea.',
        trading:'Adaugă tranzacții în Bani → Trading și aici apare evoluția contului.' }[gMode];
      valEl.textContent = pts.length ? gFmt(pts[0].y) : '–';
      subEl.textContent = ''; dEl.textContent = ''; dEl.className = 'g-delta';
      chart.innerHTML = '<div class="eq-empty">' + msg + '</div>';
      fromEl.textContent = ''; toEl.textContent = '';
      return;
    }
    var first = pts[0].y, last = pts[pts.length-1].y, diff = last - first;
    valEl.textContent = gFmt(last);
    subEl.textContent = { weight:'greutatea de acum', worth:'averea totală de acum', trading:'soldul contului de trading' }[gMode];
    var pct = first ? (diff/Math.abs(first)*100) : 0;
    var good = gMode === 'weight' ? null : diff >= 0;
    var sign = diff > 0 ? '+' : diff < 0 ? '-' : '';
    var abs = gMode === 'weight' ? fmtKg(Math.abs(diff)) + ' kg' : gMode === 'worth' ? '€' + Math.round(Math.abs(diff)) : '€' + Math.abs(diff).toFixed(2);
    dEl.textContent = sign + abs + (gMode !== 'weight' && first ? ' (' + (pct>=0?'+':'') + pct.toFixed(1) + '%)' : '');
    dEl.className = 'g-delta' + (good === null ? '' : good ? ' pos' : ' neg');
    var ys = pts.map(function(p){ return p.y; });
    var min = Math.min.apply(null, ys), max = Math.max.apply(null, ys);
    if(max === min){ max += 1; min -= 1; }
    var x = function(i){ return pad + i*(W-pad*2)/(pts.length-1); };
    var y = function(v){ return pad + (H-pad*2)*(1-(v-min)/(max-min)); };
    var line = pts.map(function(p,i){ return (i?'L':'M') + x(i).toFixed(1) + ' ' + y(p.y).toFixed(1); }).join(' ');
    var area = line + ' L' + x(pts.length-1).toFixed(1) + ' ' + (H-pad) + ' L' + x(0).toFixed(1) + ' ' + (H-pad) + ' Z';
    var color = gMode === 'weight' ? 'var(--gold)' : (diff >= 0 ? 'var(--accent)' : 'var(--danger)');
    var by = y(first).toFixed(1);
    chart.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none">' +
      '<defs><linearGradient id="gGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="' + color + '" stop-opacity="0.35"/><stop offset="100%" stop-color="' + color + '" stop-opacity="0"/></linearGradient></defs>' +
      '<line x1="' + pad + '" x2="' + (W-pad) + '" y1="' + by + '" y2="' + by + '" stroke="var(--text-faint)" stroke-dasharray="3 4" vector-effect="non-scaling-stroke"/>' +
      '<path d="' + area + '" fill="url(#gGrad)"/>' +
      '<path d="' + line + '" fill="none" stroke="' + color + '" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>' +
      '<circle cx="' + x(pts.length-1).toFixed(1) + '" cy="' + y(last).toFixed(1) + '" r="4" fill="' + color + '" stroke="var(--bg-card)" stroke-width="2" vector-effect="non-scaling-stroke"/>' +
      '</svg>';
    fromEl.textContent = dLabel(pts[0].d); toEl.textContent = dLabel(pts[pts.length-1].d);
  }
  function setGMode(m){ gMode = m; try{ localStorage.setItem('byzyp_gmode', m); }catch(e){} renderGrowth(); }
  document.querySelectorAll('#gPills .day-pill').forEach(function(b){ b.addEventListener('click', function(){ setGMode(b.getAttribute('data-g')); }); });
  document.querySelectorAll('.dash-card[data-g]').forEach(function(c){ c.addEventListener('click', function(){ setGMode(c.getAttribute('data-g')); var gc = document.querySelector('.gr-card'); if(gc && gc.scrollIntoView){ try{ gc.scrollIntoView({behavior:'smooth', block:'center'}); }catch(e){} } }); });

  function renderAllFromData(){
    setTimeout(renderProfile, 0);
    renderProtein();
    renderToday(); renderStreaks(); renderPastDays(); renderWeightPanel(); renderGallery(); renderDashboard();
  }

  function startLocalFallback(){
    useLocal = true;
    document.getElementById('syncBanner').style.display = 'block';
    try{ var raw = safeGet('reset_days_local_v1'); data = raw ? JSON.parse(raw) : {}; }catch(e){ data = {}; }
    try{ var rawP = safeGet('reset_profile_v1'); profile = rawP ? JSON.parse(rawP) : {}; }catch(e){ profile = {}; }
    try{ var rawA = safeGet('reset_accounts_local_v1'); accounts = rawA ? JSON.parse(rawA) : []; }catch(e){ accounts = []; }
    try{ var rawL = safeGet('reset_acc_list_v1'); var cl = rawL ? accClean(JSON.parse(rawL)) : null; if(cl) ACC = cl; }catch(e){}
    try{ var rawT = safeGet('reset_trades_local_v1'); trades = rawT ? JSON.parse(rawT) : []; }catch(e){ trades = []; }
    renderNews();
    eqStart = parseFloat(safeGet('reset_eq_start_v1')) || 0; eqStartInput.value = eqStart || '';
    try{ var rawI = safeGet('reset_investments_local_v1'); investments = rawI ? JSON.parse(rawI) : []; }catch(e){ investments = []; }
    applyProfileToUI();
    renderAllFromData(); renderWorth(); renderTrades(); renderCalendar(); renderInvestments();
  }

  async function init(){
    try{
      db = await window.claude.use('db');
    }catch(e){ db = null; }

    if(!db){ startLocalFallback(); return; }

    db.collection('days').onSnapshot(function(snap){
      var next = {};
      snap.docs.forEach(function(d){ next[d.id] = d.data(); });
      data = next;
      renderAllFromData();
    }, function(err){ console.error('days sub error', err); startLocalFallback(); });

    db.doc('profile/main').onSnapshot(function(snap){
      profile = snap.exists ? snap.data() : {};
      applyProfileToUI();
    }, function(err){ console.error('profile sub error', err); });

    db.collection('accounts').orderBy('date','asc').onSnapshot(function(snap){
      accounts = snap.docs.map(function(d){ var x = d.data(); x._id = d.id; return x; });
      renderWorth();
    }, function(err){ console.error('accounts sub error', err); });

    db.collection('shots').onSnapshot(function(snap){
      shotHist = snap.docs.map(function(d){ var x = d.data(); x.id = d.id; return x; }).sort(function(a, b){ return (b.ts || 0) - (a.ts || 0); });
      if(typeof renderPhotoPane === 'function' && goldSeg === 'photo' && !photoSt.busy && !photoSt.res) renderPhotoPane();
    }, function(err){ console.error('shots sub error', err); });

    db.collection('mt5').onSnapshot(function(snap){
      mt5State = null; snap.docs.forEach(function(d){ if(d.id === 'state') mt5State = d.data(); });
      if(typeof renderMt5 === 'function') renderMt5();
    }, function(err){ console.error('mt5 sub error', err); });

    db.collection('health').onSnapshot(function(snap){
      healthData = {}; snap.docs.forEach(function(d){ healthData[d.id] = d.data(); });
      if(typeof renderFitness === 'function') renderFitness();
      if(typeof renderWeekReport === 'function') renderWeekReport();
    }, function(err){ console.error('health sub error', err); });

    db.collection('trades').orderBy('date','asc').onSnapshot(function(snap){
      trades = snap.docs.map(function(d){ var t = d.data(); t._id = d.id; return t; });
      renderTrades(); renderCalendar();
    }, function(err){ console.error('trades sub error', err); });

    db.doc('news/current').onSnapshot(function(snap){
      newsData = snap.exists ? snap.data() : { events: [] };
      renderNews();
      if(typeof renderGold === 'function') renderGold();
    }, function(err){ console.error('news sub error', err); });

    db.doc('settings/worth').onSnapshot(function(snap){
      var w = snap.exists ? snap.data() : {};
      if(w.goal != null){ worthGoal = parseFloat(w.goal) || 0; try{ localStorage.setItem('byzyp_goal', String(worthGoal)); }catch(e){} renderWorth(); }
    }, function(err){ console.error('worth settings sub error', err); });

    db.doc('settings/nutri').onSnapshot(function(snap){ if(snap.exists){ var d = snap.data() || {}; nu.sex = d.sex === 'f' ? 'f' : 'm'; if([1.375, 1.55, 1.725].indexOf(+d.act) >= 0) nu.act = +d.act; if(['lose', 'maintain', 'gain'].indexOf(d.goal) >= 0) nu.goal = d.goal; nu.v = Object.assign({ b:0, l:0, d:0 }, d.v || {}); } nuRender(); }, function(err){ console.error('nutri sub error', err); });
    db.doc('settings/meals').onSnapshot(function(snap){ nu.log = snap.exists ? ((snap.data() || {}).log || {}) : {}; nuRender(); }, function(err){ console.error('meals sub error', err); });

    db.doc('settings/accounts').onSnapshot(function(snap){ var l = snap.exists ? accClean((snap.data() || {}).list) : null; ACC = l || ACC_DEFAULT.slice(); renderWorth(); }, function(err){ console.error('accounts list sub error', err); });

    db.doc('settings/eth').onSnapshot(function(snap){ eth.pos = snap.exists ? (snap.data() || null) : null; if(eth.pos && !(eth.pos.qty > 0)) eth.pos = null; renderEth(); }, function(err){ console.error('eth sub error', err); });

    db.doc('settings/trading').onSnapshot(function(snap){
      var st = snap.exists ? snap.data() : {};
      eqStart = parseFloat(st.startBalance) || 0;
      if(document.activeElement !== eqStartInput){ eqStartInput.value = eqStart || ''; }
      renderEquity();
    }, function(err){ console.error('trading settings sub error', err); });

    db.collection('investments').orderBy('month','asc').onSnapshot(function(snap){
      investments = snap.docs.map(function(d){ return d.data(); });
      renderInvestments();
    }, function(err){ console.error('investments sub error', err); });
  }

  updateGreeting();
  setInterval(updateGreeting, 1000);

  /* splash */
  (function(){
    var sp = document.getElementById('splash');
    var sub = document.getElementById('spSub');
    if(!sp) return;
    var now = new Date(), h = now.getHours();
    var g = h<5 ? 'Noapte bună' : h<12 ? 'Bună dimineața' : h<18 ? 'Bună ziua' : 'Bună seara';
    var zile = ['Duminică','Luni','Marți','Miercuri','Joi','Vineri','Sâmbătă'], luni = ['ianuarie','februarie','martie','aprilie','mai','iunie','iulie','august','septembrie','octombrie','noiembrie','decembrie'];
    sub.textContent = g + ', ZyP';
    var dEl = document.getElementById('spDate'); if(dEl) dEl.textContent = zile[now.getDay()] + ' · ' + now.getDate() + ' ' + luni[now.getMonth()];
    setTimeout(function(){ sp.classList.add('hide'); }, 2150);
    setTimeout(function(){ if(sp.parentNode) sp.parentNode.removeChild(sp); }, 2900);
  })();

  function boot(){
    if(window.claude && typeof window.claude.use === 'function') init(); else startLocalFallback();
  }
  if(window.__byzypAuthed) boot(); else window.addEventListener('byzyp-auth', boot, { once:true });
})();
