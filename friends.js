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
      .catch(function(e){ busy = false; if(dyn) dyn.innerHTML = '<div class="card"><div class="top-load">' + esc(errMsg(e)) + '</div></div>'; });
  }

  // ---------- ecran ----------
  // ---------- hartă cu prieteni ----------
  var map = null, mapWrap = null, dyn = null, markers = {}, meMarker = null, avatars = {}, fitted = false, tile = null;
  function lettersOf(n){ return String(n||'?').slice(0,1).toUpperCase(); }
  function pinEl(nick, cls){
    var w = document.createElement('div'); w.className = 'fr-pin ' + (cls||'');
    var c = document.createElement('div'); c.className = 'fr-pc'; var av = avatars[nick];
    if(av && /^data:image\/jpeg;base64,[A-Za-z0-9+\/=]+$/.test(av)){ var im = document.createElement('img'); im.src = av; im.alt = ''; c.appendChild(im); } else c.textContent = lettersOf(nick);
    var l = document.createElement('div'); l.className = 'fr-pl'; l.textContent = nick;
    w.appendChild(c); w.appendChild(l); return w;
  }
  function ensureAvatar(nick){
    if(avatars[nick] !== undefined) return; avatars[nick] = '';
    rpc('get_public_profile', { p_nick: nick }).then(function(p){ if(p && p.avatar){ avatars[nick] = p.avatar; if(markers[nick]){ markers[nick].setIcon(L.divIcon({ className: 'fr-ic', html: pinEl(nick), iconSize: [64, 74], iconAnchor: [32, 37] })); } renderChips(); } }).catch(function(){});
  }
  function initMap(){
    if(map || !window.L || !mapWrap) return;
    var el = document.createElement('div'); el.className = 'fr-map-el'; mapWrap.appendChild(el);
    map = L.map(el, { zoomControl: false, attributionControl: true, worldCopyJump: true }).setView(mine ? [mine.lat, mine.lng] : [28.1, -15.4], mine ? 14 : 5);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 19, subdomains: 'abcd', attribution: '© OpenStreetMap · © CARTO' }).addTo(map);
    var bar = document.createElement('div'); bar.className = 'fr-fab';
    var b1 = document.createElement('button'); b1.textContent = '🎯'; b1.setAttribute('aria-label', 'Centrează'); b1.addEventListener('click', function(){ if(mine) map.flyTo([mine.lat, mine.lng], 15); else if(markers && Object.keys(markers).length) fitAll(); else toast('Pornește-ți locația ca să te găsesc'); });
    var b2 = document.createElement('button'); b2.id = 'frGhost'; b2.addEventListener('click', function(){ if(sharing()) stopShare().then(function(){ draw(); updateMap(); toast('🙈 Ești invizibil: nimeni nu te mai vede'); }); else startFlow(); });
    bar.appendChild(b1); bar.appendChild(b2); mapWrap.appendChild(bar);
    setTimeout(function(){ if(map) map.invalidateSize(); }, 200);
  }
  function fitAll(){ var pts = []; Object.keys(markers).forEach(function(k){ pts.push(markers[k].getLatLng()); }); if(mine) pts.push(L.latLng(mine.lat, mine.lng)); if(pts.length > 1) map.fitBounds(L.latLngBounds(pts), { padding: [60, 60], maxZoom: 16 }); else if(pts.length) map.setView(pts[0], 14); }
  function updateMap(){
    if(!map) return;
    var g = document.getElementById('frGhost'); if(g) g.textContent = sharing() ? '🙈 Fă-mă invizibil' : '📍 Arată-mă';
    var seen = {};
    locs.forEach(function(l){ seen[l.nick] = 1; ensureAvatar(l.nick); var ll = [+l.lat, +l.lng];
      if(markers[l.nick]) markers[l.nick].setLatLng(ll);
      else markers[l.nick] = L.marker(ll, { icon: L.divIcon({ className: 'fr-ic', html: pinEl(l.nick), iconSize: [64, 74], iconAnchor: [32, 37] }) }).addTo(map).on('click', function(){ map.flyTo(ll, 16); }); });
    Object.keys(markers).forEach(function(k){ if(!seen[k]){ map.removeLayer(markers[k]); delete markers[k]; } });
    if(mine){ var mp = [mine.lat, mine.lng]; if(meMarker) meMarker.setLatLng(mp); else meMarker = L.marker(mp, { icon: L.divIcon({ className: 'fr-ic', html: pinEl('Eu', 'me'), iconSize: [64, 74], iconAnchor: [32, 37] }), zIndexOffset: 500 }).addTo(map); }
    else if(meMarker){ map.removeLayer(meMarker); meMarker = null; }
    if(!fitted && (mine || locs.length)){ fitted = true; fitAll(); }
  }
  function renderChips(){
    var el = document.getElementById('frChips'); if(!el) return; el.textContent = '';
    if(!locs.length){ var e = document.createElement('div'); e.className = 'fr-empty'; e.textContent = 'Niciun prieten nu își arată locația acum.'; el.appendChild(e); return; }
    locs.forEach(function(l){ var d = mine ? dist(mine, l) : null, b = document.createElement('button'); b.className = 'fr-chip';
      var pin = pinEl(l.nick, 'chip'); pin.removeChild(pin.lastChild); b.appendChild(pin);
      var t = document.createElement('div'); t.className = 'fr-ct'; var n = document.createElement('b'); n.textContent = l.nick; var s = document.createElement('span'); s.textContent = (d !== null ? kmTxt(d) + ' · ' : '') + agoTxt(l.ago); t.appendChild(n); t.appendChild(s); b.appendChild(t);
      b.addEventListener('click', function(){ if(map) map.flyTo([+l.lat, +l.lng], 16); }); el.appendChild(b); });
  }
  function startFlow(){
    var ok = confirm('Prietenii pe care i-ai acceptat tu îți vor vedea locația pe hartă cât timp aplicația e deschisă. O poți opri oricând cu „Fă-mă invizibil”.\n\nConfirmi că ai cel puțin 16 ani?'); if(!ok) return;
    if(!navigator.geolocation){ toast('Telefonul nu permite locația'); return; }
    navigator.geolocation.getCurrentPosition(function(p){ startShare(); send(p); draw(); updateMap(); if(map && mine) map.flyTo([mine.lat, mine.lng], 15); pull(); }, function(){ toast('Permite locația pentru By ZyP în setările telefonului'); }, { enableHighAccuracy: true, timeout: 20000 });
  }
  function draw(){
    if(!box || !dyn) return;
    var fr = friends.filter(function(f){ return f.st === 'friend'; }), inc = friends.filter(function(f){ return f.st === 'in'; }), out = friends.filter(function(f){ return f.st === 'out'; });
    var h = '<div class="fr-chips" id="frChips"></div>';
    h += '<div class="card fr-card"><div class="card-title">👥 Prietenii mei</div>';
    if(inc.length) h += '<div class="fr-sub">Cereri primite</div>' + inc.map(function(f){ return '<div class="fr-row"><b>' + esc(f.nick) + '</b><span>vrea să fie prieten cu tine</span><button class="fr-ok" data-yes="' + esc(f.nick) + '">Accept</button><button class="fr-no" data-no="' + esc(f.nick) + '">Refuz</button></div>'; }).join('');
    if(fr.length) h += '<div class="fr-sub">Prieteni</div>' + fr.map(function(f){ return '<div class="fr-row"><b>' + esc(f.nick) + '</b><span>' + (f.i_share ? 'vede locația ta' : 'nu vede locația ta') + '</span><button class="fr-no" data-hide="' + esc(f.nick) + '" data-on="' + (f.i_share ? 0 : 1) + '">' + (f.i_share ? 'Ascunde-mă' : 'Arată-mă') + '</button><button class="fr-no" data-rm="' + esc(f.nick) + '">✕</button></div>'; }).join('');
    if(out.length) h += '<div class="fr-sub">Cereri trimise</div>' + out.map(function(f){ return '<div class="fr-row"><b>' + esc(f.nick) + '</b><span>în așteptare</span><button class="fr-no" data-rm="' + esc(f.nick) + '">Anulează</button></div>'; }).join('');
    if(!friends.length) h += '<div class="hint">Încă nu ai prieteni în aplicație. Adaugă pe cineva după numele din clasament.</div>';
    h += '<div class="fr-add"><input id="frNick" maxlength="20" placeholder="Numele prietenului" autocomplete="off" autocapitalize="off"><button class="onb-btn" id="frAdd">Adaugă</button></div><div class="err" id="frErr" style="color:#ff7a7a;font-size:13px;margin-top:6px"></div></div>';
    dyn.innerHTML = h; renderChips(); updateMap();
    var q = function(i){ return document.getElementById(i); };
    var ad = q('frAdd'); if(ad) ad.addEventListener('click', function(){ var v = q('frNick').value.trim(); if(!v) return; ad.disabled = true; q('frErr').textContent = '';
      rpc('friend_request', { p_nick: v }).then(function(r){ toast(r && r.status === 'accepted' ? 'Acum sunteți prieteni!' : 'Cerere trimisă'); ad.disabled = false; pull(); }).catch(function(e){ ad.disabled = false; q('frErr').textContent = errMsg(e); }); });
    dyn.querySelectorAll('[data-yes]').forEach(function(b){ b.addEventListener('click', function(){ rpc('friend_respond', { p_nick: b.getAttribute('data-yes'), p_accept: true }).then(pull).catch(function(e){ toast(errMsg(e)); }); }); });
    dyn.querySelectorAll('[data-no]').forEach(function(b){ b.addEventListener('click', function(){ rpc('friend_respond', { p_nick: b.getAttribute('data-no'), p_accept: false }).then(pull).catch(function(e){ toast(errMsg(e)); }); }); });
    dyn.querySelectorAll('[data-hide]').forEach(function(b){ b.addEventListener('click', function(){ rpc('friend_share', { p_nick: b.getAttribute('data-hide'), p_on: b.getAttribute('data-on') === '1' }).then(pull).catch(function(e){ toast(errMsg(e)); }); }); });
    dyn.querySelectorAll('[data-rm]').forEach(function(b){ b.addEventListener('click', function(){ if(confirm('Ștergi pe ' + b.getAttribute('data-rm') + ' din prieteni?')) rpc('friend_remove', { p_nick: b.getAttribute('data-rm') }).then(pull).catch(function(e){ toast(errMsg(e)); }); }); });
  }

  window.zFriends = {
    render: function(el){ box = el; box.textContent = ''; map = null; markers = {}; meMarker = null; fitted = false;
      mapWrap = document.createElement('div'); mapWrap.className = 'fr-mapwrap'; dyn = document.createElement('div'); box.appendChild(mapWrap); box.appendChild(dyn);
      initMap(); var g = document.getElementById('frGhost'); if(g) g.textContent = sharing() ? '🙈 Fă-mă invizibil' : '📍 Arată-mă'; dyn.innerHTML = '<div class="top-load">Se încarcă…</div>'; pull(); clearInterval(timer); timer = setInterval(function(){ if(box && document.getElementById('frNick') !== document.activeElement) pull(); }, 20000); },
    leave: function(){ clearInterval(timer); timer = null; if(map){ try{ map.remove(); }catch(e){} } map = null; markers = {}; meMarker = null; box = null; dyn = null; mapWrap = null; }
  };
  // dacă ai pornit partajarea, continuă după ce redeschizi aplicația
  if(sharing()){ setTimeout(function(){ if(window.__sb) startWatch(); else setTimeout(startWatch, 4000); }, 2500); }
})();
