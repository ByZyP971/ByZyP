/* By ZyP · Prieteni + locație live. Datele trec prin funcții Supabase (vezi community-friends.sql).
   Locația se trimite doar cât timp tu ai pornit partajarea și aplicația e deschisă. Doar prietenii acceptați o văd. */
(function(){
  'use strict';
  var esc = window.zEsc || function(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); };
  function toast(m){ if(window.zToast) window.zToast(m); }
  function errMsg(e){ var m = (e && e.message) || 'Eroare'; return String(m).replace(/^.*?:\s*/, ''); }
  function rpc(name, args){ var sb = window.__sb; if(!sb) return Promise.reject(new Error('Nu ești conectat')); return sb.rpc(name, args||{}).then(function(r){ if(r.error) throw r.error; return r.data; }); }
  var KEY = 'zyp_locshare_v1';
  var box = null, timer = null, watchId = null, mine = null, lastSent = 0, friends = [], locs = [], busy = false;
  function sharing(){ try{ return localStorage.getItem(KEY) === '1'; }catch(e){ return false; } }
  function setSharing(v){ try{ if(v) localStorage.setItem(KEY, '1'); else localStorage.removeItem(KEY); }catch(e){} }

  // ---------- geometrie ----------
  function dist(a, b){ var R = 6371000, r = Math.PI/180, dLa = (b.lat-a.lat)*r, dLo = (b.lng-a.lng)*r;
    var x = Math.sin(dLa/2)*Math.sin(dLa/2) + Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin(dLo/2)*Math.sin(dLo/2); return 2*R*Math.asin(Math.sqrt(x)); }
  function bearing(a, b){ var r = Math.PI/180, y = Math.sin((b.lng-a.lng)*r)*Math.cos(b.lat*r), x = Math.cos(a.lat*r)*Math.sin(b.lat*r) - Math.sin(a.lat*r)*Math.cos(b.lat*r)*Math.cos((b.lng-a.lng)*r); return (Math.atan2(y, x)/r + 360) % 360; }
  var DIRS = ['N','NE','E','SE','S','SV','V','NV'];
  function dirTxt(deg){ return DIRS[Math.round(deg/45) % 8]; }
  function kmTxt(m){ return m < 950 ? Math.max(10, Math.round(m/10)*10) + ' m' : (m/1000).toFixed(m < 10000 ? 1 : 0).replace('.', ',') + ' km'; }
  function agoTxt(s){ if(s < 90) return 'acum'; var m = Math.round(s/60); return 'acum ' + m + ' min'; }

  // ---------- trimitere locație ----------
  function send(pos){
    mine = { lat: pos.coords.latitude, lng: pos.coords.longitude };
    var now = Date.now(); if(now - lastSent < 15000) return; lastSent = now;
    rpc('loc_set', { p_lat: mine.lat, p_lng: mine.lng, p_acc: Math.round(pos.coords.accuracy || 0) }).catch(function(){});
  }
  function startWatch(){
    if(watchId !== null || !navigator.geolocation) return;
    try{ watchId = navigator.geolocation.watchPosition(send, function(err){ if(err && err.code === 1){ stopWatch(); setSharing(false); if(box) draw(); } }, { enableHighAccuracy: true, maximumAge: 10000, timeout: 30000 }); }catch(e){}
  }
  function stopWatch(){ if(watchId !== null){ try{ navigator.geolocation.clearWatch(watchId); }catch(e){} watchId = null; } }
  function startShare(){ setSharing(true); startWatch(); }
  function stopShare(){ setSharing(false); stopWatch(); lastSent = 0; return rpc('loc_stop').catch(function(){}); }

  // ---------- date ----------
  function pull(){
    if(busy) return Promise.resolve(); busy = true;
    return Promise.all([ rpc('friend_list'), rpc('loc_friends') ]).then(function(r){ friends = r[0] || []; locs = r[1] || []; busy = false; if(box) draw(); })
      .catch(function(e){ busy = false; if(box) box.innerHTML = '<div class="card"><div class="top-load">' + esc(errMsg(e)) + '</div></div>'; });
  }

  // ---------- radar ----------
  function radar(){
    var near = locs.map(function(l){ var d = mine ? dist(mine, l) : 0, b = mine ? bearing(mine, l) : 0; return { n: l.nick, d: d, b: b }; });
    var max = 1000; near.forEach(function(x){ if(x.d > max) max = x.d; });
    var rings = max <= 1000 ? 1000 : (max <= 5000 ? 5000 : (max <= 20000 ? 20000 : (max <= 100000 ? 100000 : 1000000)));
    var s = '<svg viewBox="-110 -110 220 220" class="fr-radar" aria-label="Radar prieteni"><circle r="100" class="fr-r"/><circle r="66" class="fr-r"/><circle r="33" class="fr-r"/>' +
      '<text y="-102" text-anchor="middle" class="fr-t">N</text><circle r="5" class="fr-me"/>';
    near.forEach(function(x){ var rr = Math.min(96, 96*Math.sqrt(x.d/rings)), a = x.b*Math.PI/180, px = rr*Math.sin(a), py = -rr*Math.cos(a);
      s += '<g transform="translate(' + px.toFixed(1) + ' ' + py.toFixed(1) + ')"><circle r="6" class="fr-dot"/><text y="-9" text-anchor="middle" class="fr-t">' + esc(x.n.slice(0, 8)) + '</text></g>'; });
    return s + '</svg><div class="fr-scale">Cercul mare = ' + kmTxt(rings) + '</div>';
  }

  // ---------- ecran ----------
  function draw(){
    if(!box) return;
    var on = sharing(), fr = friends.filter(function(f){ return f.st === 'friend'; }), inc = friends.filter(function(f){ return f.st === 'in'; }), out = friends.filter(function(f){ return f.st === 'out'; });
    var h = '<div class="card fr-card"><div class="card-title">📍 Locația mea</div>';
    if(on) h += '<div class="hint" style="margin:0 0 10px;">🟢 Îți arăți locația prietenilor acceptați cât timp aplicația e deschisă. O poți opri oricând.</div><button class="onb-skip fr-btn" id="frStop" style="color:#ff7a7a">⏹ Oprește partajarea</button>';
    else h += '<div class="hint" style="margin:0 0 10px;">Acum nu îți arăți locația nimănui. Dacă o pornești, o văd doar prietenii pe care i-ai acceptat tu, cât timp ai aplicația deschisă. Se poate opri oricând, iar locația se șterge.</div>' +
      '<label class="fr-age"><input type="checkbox" id="frAge"> Am cel puțin 16 ani și înțeleg că prietenii mei acceptați îmi văd locația.</label><button class="onb-btn" id="frStart" style="width:100%;margin-top:10px;opacity:.5" disabled>📍 Pornește partajarea</button>';
    h += '</div>';
    if(fr.length || on){ h += '<div class="card fr-card"><div class="card-title">🧭 Unde sunt prietenii</div>';
      if(!mine && locs.length) h += '<div class="hint">Pornește-ți și tu locația ca să vezi distanța până la ei.</div>';
      if(locs.length) h += radar() + locs.map(function(l){ var d = mine ? dist(mine, l) : null, b = mine ? bearing(mine, l) : null;
        return '<div class="fr-row"><b>' + esc(l.nick) + '</b><span>' + (d !== null ? kmTxt(d) + ' spre ' + dirTxt(b) + ' · ' : '') + agoTxt(l.ago) + '</span><a class="fr-map" target="_blank" rel="noopener noreferrer" href="https://maps.apple.com/?ll=' + (+l.lat) + ',' + (+l.lng) + '&q=' + encodeURIComponent(l.nick) + '">🗺️ Hartă</a></div>'; }).join('');
      else h += '<div class="hint">Niciun prieten nu își arată locația acum.</div>';
      h += '</div>'; }
    h += '<div class="card fr-card"><div class="card-title">👥 Prietenii mei</div>';
    if(inc.length) h += '<div class="fr-sub">Cereri primite</div>' + inc.map(function(f){ return '<div class="fr-row"><b>' + esc(f.nick) + '</b><span>vrea să fie prieten cu tine</span><button class="fr-ok" data-yes="' + esc(f.nick) + '">Accept</button><button class="fr-no" data-no="' + esc(f.nick) + '">Refuz</button></div>'; }).join('');
    if(fr.length) h += '<div class="fr-sub">Prieteni</div>' + fr.map(function(f){ return '<div class="fr-row"><b>' + esc(f.nick) + '</b><span>' + (f.i_share ? 'vede locația ta' : 'nu vede locația ta') + '</span><button class="fr-no" data-hide="' + esc(f.nick) + '" data-on="' + (f.i_share ? 0 : 1) + '">' + (f.i_share ? 'Ascunde-mă' : 'Arată-mă') + '</button><button class="fr-no" data-rm="' + esc(f.nick) + '">✕</button></div>'; }).join('');
    if(out.length) h += '<div class="fr-sub">Cereri trimise</div>' + out.map(function(f){ return '<div class="fr-row"><b>' + esc(f.nick) + '</b><span>în așteptare</span><button class="fr-no" data-rm="' + esc(f.nick) + '">Anulează</button></div>'; }).join('');
    if(!friends.length) h += '<div class="hint">Încă nu ai prieteni în aplicație. Adaugă pe cineva după numele din clasament.</div>';
    h += '<div class="fr-add"><input id="frNick" maxlength="20" placeholder="Numele prietenului" autocomplete="off" autocapitalize="off"><button class="onb-btn" id="frAdd">Adaugă</button></div><div class="err" id="frErr" style="color:#ff7a7a;font-size:13px;margin-top:6px"></div></div>';
    box.innerHTML = h;
    var q = function(i){ return document.getElementById(i); };
    var age = q('frAge'), st = q('frStart');
    if(age) age.addEventListener('change', function(){ st.disabled = !age.checked; st.style.opacity = age.checked ? '1' : '.5'; });
    if(st) st.addEventListener('click', function(){
      if(!navigator.geolocation){ toast('Telefonul nu permite locația'); return; }
      navigator.geolocation.getCurrentPosition(function(p){ startShare(); send(p); draw(); pull(); }, function(){ toast('Ai nevoie să permiți locația pentru By ZyP în setările telefonului'); }, { enableHighAccuracy: true, timeout: 20000 }); });
    var sp = q('frStop'); if(sp) sp.addEventListener('click', function(){ stopShare().then(function(){ draw(); toast('Locația ta nu mai e partajată'); }); });
    var ad = q('frAdd'); if(ad) ad.addEventListener('click', function(){ var v = q('frNick').value.trim(); if(!v) return; ad.disabled = true; q('frErr').textContent = '';
      rpc('friend_request', { p_nick: v }).then(function(r){ toast(r && r.status === 'accepted' ? 'Acum sunteți prieteni!' : 'Cerere trimisă'); ad.disabled = false; pull(); }).catch(function(e){ ad.disabled = false; q('frErr').textContent = errMsg(e); }); });
    box.querySelectorAll('[data-yes]').forEach(function(b){ b.addEventListener('click', function(){ rpc('friend_respond', { p_nick: b.getAttribute('data-yes'), p_accept: true }).then(pull).catch(function(e){ toast(errMsg(e)); }); }); });
    box.querySelectorAll('[data-no]').forEach(function(b){ b.addEventListener('click', function(){ rpc('friend_respond', { p_nick: b.getAttribute('data-no'), p_accept: false }).then(pull).catch(function(e){ toast(errMsg(e)); }); }); });
    box.querySelectorAll('[data-hide]').forEach(function(b){ b.addEventListener('click', function(){ rpc('friend_share', { p_nick: b.getAttribute('data-hide'), p_on: b.getAttribute('data-on') === '1' }).then(pull).catch(function(e){ toast(errMsg(e)); }); }); });
    box.querySelectorAll('[data-rm]').forEach(function(b){ b.addEventListener('click', function(){ if(confirm('Ștergi pe ' + b.getAttribute('data-rm') + ' din prieteni?')) rpc('friend_remove', { p_nick: b.getAttribute('data-rm') }).then(pull).catch(function(e){ toast(errMsg(e)); }); }); });
  }

  window.zFriends = {
    render: function(el){ box = el; box.innerHTML = '<div class="top-load">Se încarcă…</div>'; pull(); clearInterval(timer); timer = setInterval(function(){ if(box && document.getElementById('frNick') !== document.activeElement) pull(); }, 20000); },
    leave: function(){ clearInterval(timer); timer = null; box = null; }
  };
  // dacă ai pornit partajarea, continuă după ce redeschizi aplicația
  if(sharing()){ setTimeout(function(){ if(window.__sb) startWatch(); else setTimeout(startWatch, 4000); }, 2500); }
})();
