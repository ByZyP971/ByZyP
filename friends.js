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
  function setSharing(v){ try{ if(v){ localStorage.setItem(KEY, '1'); localStorage.setItem(KEY + '_at', String(Date.now())); } else { localStorage.removeItem(KEY); localStorage.removeItem(KEY + '_at'); } }catch(e){} }
  function shareAge(){ try{ return Date.now() - (+localStorage.getItem(KEY + '_at') || 0); }catch(e){ return 1e15; } }

  // ---------- geometrie ----------
  function dist(a, b){ var R = 6371000, r = Math.PI/180, dLa = (b.lat-a.lat)*r, dLo = (b.lng-a.lng)*r;
    var x = Math.sin(dLa/2)*Math.sin(dLa/2) + Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin(dLo/2)*Math.sin(dLo/2); return 2*R*Math.asin(Math.sqrt(x)); }
  function bearing(a, b){ var r = Math.PI/180, y = Math.sin((b.lng-a.lng)*r)*Math.cos(b.lat*r), x = Math.cos(a.lat*r)*Math.sin(b.lat*r) - Math.sin(a.lat*r)*Math.cos(b.lat*r)*Math.cos((b.lng-a.lng)*r); return (Math.atan2(y, x)/r + 360) % 360; }
  var DIRS = ['N','NE','E','SE','S','SV','V','NV'];
  function dirTxt(deg){ return DIRS[Math.round(deg/45) % 8]; }
  function kmTxt(m){ return m < 950 ? Math.max(10, Math.round(m/10)*10) + ' m' : (m/1000).toFixed(m < 10000 ? 1 : 0).replace('.', ',') + ' km'; }
  function agoTxt(s){ if(s < 90) return 'acum'; var m = Math.round(s/60); return 'acum ' + m + ' min'; }

  // ---------- trimitere locație ----------
  var noCfg = false;
  function myCfg(){ try{ if(window.zAvatar && window.zAvatar.has()){ var c = window.zAvatar.load(); if(c.scene === 'photo') c.scene = 'none'; return c; } }catch(e){} return null; }
  function send(pos){
    mine = { lat: pos.coords.latitude, lng: pos.coords.longitude };
    if(box){ try{ updateMap(); }catch(e){} }
    var now = Date.now(); if(now - lastSent < 15000) return; lastSent = now;
    var args = { p_lat: mine.lat, p_lng: mine.lng, p_acc: Math.round(pos.coords.accuracy || 0) }, cf = myCfg();
    if(cf && !noCfg){ var a2 = { p_lat: args.p_lat, p_lng: args.p_lng, p_acc: args.p_acc, p_cfg: cf }; rpc('loc_set', a2).catch(function(){ noCfg = true; rpc('loc_set', args).catch(function(){}); }); }
    else rpc('loc_set', args).catch(function(){});
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


  // ---------- Leaflet: se încarcă singur (fișier local, apoi rezervă) și își aduce stilurile ----------
  var LCSS = ".leaflet-pane, .leaflet-tile, .leaflet-marker-icon, .leaflet-marker-shadow, .leaflet-tile-container, .leaflet-pane > svg, .leaflet-pane > canvas, .leaflet-zoom-box, .leaflet-image-layer, .leaflet-layer { position: absolute; left: 0; top: 0; } .leaflet-container { overflow: hidden; } .leaflet-tile, .leaflet-marker-icon, .leaflet-marker-shadow { -webkit-user-select: none; -moz-user-select: none; user-select: none; -webkit-user-drag: none; } .leaflet-tile::selection { background: transparent; } .leaflet-safari .leaflet-tile { image-rendering: -webkit-optimize-contrast; } .leaflet-safari .leaflet-tile-container { width: 1600px; height: 1600px; -webkit-transform-origin: 0 0; } .leaflet-marker-icon, .leaflet-marker-shadow { display: block; } .leaflet-container .leaflet-overlay-pane svg { max-width: none !important; max-height: none !important; } .leaflet-container .leaflet-marker-pane img, .leaflet-container .leaflet-shadow-pane img, .leaflet-container .leaflet-tile-pane img, .leaflet-container img.leaflet-image-layer, .leaflet-container .leaflet-tile { max-width: none !important; max-height: none !important; width: auto; padding: 0; } .leaflet-container img.leaflet-tile { mix-blend-mode: plus-lighter; } .leaflet-container.leaflet-touch-zoom { -ms-touch-action: pan-x pan-y; touch-action: pan-x pan-y; } .leaflet-container.leaflet-touch-drag { -ms-touch-action: pinch-zoom; touch-action: none; touch-action: pinch-zoom; } .leaflet-container.leaflet-touch-drag.leaflet-touch-zoom { -ms-touch-action: none; touch-action: none; } .leaflet-container { -webkit-tap-highlight-color: transparent; } .leaflet-container a { -webkit-tap-highlight-color: rgba(51, 181, 229, 0.4); } .leaflet-tile { filter: inherit; visibility: hidden; } .leaflet-tile-loaded { visibility: inherit; } .leaflet-zoom-box { width: 0; height: 0; -moz-box-sizing: border-box; box-sizing: border-box; z-index: 800; } .leaflet-overlay-pane svg { -moz-user-select: none; } .leaflet-pane { z-index: 400; } .leaflet-tile-pane { z-index: 200; } .leaflet-overlay-pane { z-index: 400; } .leaflet-shadow-pane { z-index: 500; } .leaflet-marker-pane { z-index: 600; } .leaflet-tooltip-pane { z-index: 650; } .leaflet-popup-pane { z-index: 700; } .leaflet-map-pane canvas { z-index: 100; } .leaflet-map-pane svg { z-index: 200; } .leaflet-vml-shape { width: 1px; height: 1px; } .leaflet-control { position: relative; z-index: 800; pointer-events: visiblePainted; pointer-events: auto; } .leaflet-top, .leaflet-bottom { position: absolute; z-index: 1000; pointer-events: none; } .leaflet-top { top: 0; } .leaflet-right { right: 0; } .leaflet-bottom { bottom: 0; } .leaflet-left { left: 0; } .leaflet-control { float: left; clear: both; } .leaflet-right .leaflet-control { float: right; } .leaflet-top .leaflet-control { margin-top: 10px; } .leaflet-bottom .leaflet-control { margin-bottom: 10px; } .leaflet-left .leaflet-control { margin-left: 10px; } .leaflet-right .leaflet-control { margin-right: 10px; } .leaflet-fade-anim .leaflet-popup { opacity: 0; -webkit-transition: opacity 0.2s linear; -moz-transition: opacity 0.2s linear; transition: opacity 0.2s linear; } .leaflet-fade-anim .leaflet-map-pane .leaflet-popup { opacity: 1; } .leaflet-zoom-animated { -webkit-transform-origin: 0 0; -ms-transform-origin: 0 0; transform-origin: 0 0; } svg.leaflet-zoom-animated { will-change: transform; } .leaflet-zoom-anim .leaflet-zoom-animated { -webkit-transition: -webkit-transform 0.25s cubic-bezier(0,0,0.25,1); -moz-transition: -moz-transform 0.25s cubic-bezier(0,0,0.25,1); transition: transform 0.25s cubic-bezier(0,0,0.25,1); } .leaflet-zoom-anim .leaflet-tile, .leaflet-pan-anim .leaflet-tile { -webkit-transition: none; -moz-transition: none; transition: none; } .leaflet-zoom-anim .leaflet-zoom-hide { visibility: hidden; } .leaflet-interactive { cursor: pointer; } .leaflet-grab { cursor: -webkit-grab; cursor: -moz-grab; cursor: grab; } .leaflet-crosshair, .leaflet-crosshair .leaflet-interactive { cursor: crosshair; } .leaflet-popup-pane, .leaflet-control { cursor: auto; } .leaflet-dragging .leaflet-grab, .leaflet-dragging .leaflet-grab .leaflet-interactive, .leaflet-dragging .leaflet-marker-draggable { cursor: move; cursor: -webkit-grabbing; cursor: -moz-grabbing; cursor: grabbing; } .leaflet-marker-icon, .leaflet-marker-shadow, .leaflet-image-layer, .leaflet-pane > svg path, .leaflet-tile-container { pointer-events: none; } .leaflet-marker-icon.leaflet-interactive, .leaflet-image-layer.leaflet-interactive, .leaflet-pane > svg path.leaflet-interactive, svg.leaflet-image-layer.leaflet-interactive path { pointer-events: visiblePainted; pointer-events: auto; } .leaflet-container { background: #ddd; outline-offset: 1px; } .leaflet-container a { color: #0078A8; } .leaflet-zoom-box { border: 2px dotted #38f; background: rgba(255,255,255,0.5); } .leaflet-container { font-family: \"Helvetica Neue\", Arial, Helvetica, sans-serif; font-size: 12px; font-size: 0.75rem; line-height: 1.5; } .leaflet-bar { box-shadow: 0 1px 5px rgba(0,0,0,0.65); border-radius: 4px; } .leaflet-bar a { background-color: #fff; border-bottom: 1px solid #ccc; width: 26px; height: 26px; line-height: 26px; display: block; text-align: center; text-decoration: none; color: black; } .leaflet-bar a, .leaflet-control-layers-toggle { background-position: 50% 50%; background-repeat: no-repeat; display: block; } .leaflet-bar a:hover, .leaflet-bar a:focus { background-color: #f4f4f4; } .leaflet-bar a:first-child { border-top-left-radius: 4px; border-top-right-radius: 4px; } .leaflet-bar a:last-child { border-bottom-left-radius: 4px; border-bottom-right-radius: 4px; border-bottom: none; } .leaflet-bar a.leaflet-disabled { cursor: default; background-color: #f4f4f4; color: #bbb; } .leaflet-touch .leaflet-bar a { width: 30px; height: 30px; line-height: 30px; } .leaflet-touch .leaflet-bar a:first-child { border-top-left-radius: 2px; border-top-right-radius: 2px; } .leaflet-touch .leaflet-bar a:last-child { border-bottom-left-radius: 2px; border-bottom-right-radius: 2px; } .leaflet-control-zoom-in, .leaflet-control-zoom-out { font: bold 18px 'Lucida Console', Monaco, monospace; text-indent: 1px; } .leaflet-touch .leaflet-control-zoom-in, .leaflet-touch .leaflet-control-zoom-out { font-size: 22px; } .leaflet-control-layers { box-shadow: 0 1px 5px rgba(0,0,0,0.4); background: #fff; border-radius: 5px; } .leaflet-touch .leaflet-control-layers-toggle { width: 44px; height: 44px; } .leaflet-control-layers .leaflet-control-layers-list, .leaflet-control-layers-expanded .leaflet-control-layers-toggle { display: none; } .leaflet-control-layers-expanded .leaflet-control-layers-list { display: block; position: relative; } .leaflet-control-layers-expanded { padding: 6px 10px 6px 6px; color: #333; background: #fff; } .leaflet-control-layers-scrollbar { overflow-y: scroll; overflow-x: hidden; padding-right: 5px; } .leaflet-control-layers-selector { margin-top: 2px; position: relative; top: 1px; } .leaflet-control-layers label { display: block; font-size: 13px; font-size: 1.08333em; } .leaflet-control-layers-separator { height: 0; border-top: 1px solid #ddd; margin: 5px -10px 5px -6px; } .leaflet-container .leaflet-control-attribution { background: #fff; background: rgba(255, 255, 255, 0.8); margin: 0; } .leaflet-control-attribution, .leaflet-control-scale-line { padding: 0 5px; color: #333; line-height: 1.4; } .leaflet-control-attribution a { text-decoration: none; } .leaflet-control-attribution a:hover, .leaflet-control-attribution a:focus { text-decoration: underline; } .leaflet-attribution-flag { display: inline !important; vertical-align: baseline !important; width: 1em; height: 0.6669em; } .leaflet-left .leaflet-control-scale { margin-left: 5px; } .leaflet-bottom .leaflet-control-scale { margin-bottom: 5px; } .leaflet-control-scale-line { border: 2px solid #777; border-top: none; line-height: 1.1; padding: 2px 5px 1px; white-space: nowrap; -moz-box-sizing: border-box; box-sizing: border-box; background: rgba(255, 255, 255, 0.8); text-shadow: 1px 1px #fff; } .leaflet-control-scale-line:not(:first-child) { border-top: 2px solid #777; border-bottom: none; margin-top: -2px; } .leaflet-control-scale-line:not(:first-child):not(:last-child) { border-bottom: 2px solid #777; } .leaflet-touch .leaflet-control-attribution, .leaflet-touch .leaflet-control-layers, .leaflet-touch .leaflet-bar { box-shadow: none; } .leaflet-touch .leaflet-control-layers, .leaflet-touch .leaflet-bar { border: 2px solid rgba(0,0,0,0.2); background-clip: padding-box; } .leaflet-popup { position: absolute; text-align: center; margin-bottom: 20px; } .leaflet-popup-content-wrapper { padding: 1px; text-align: left; border-radius: 12px; } .leaflet-popup-content { margin: 13px 24px 13px 20px; line-height: 1.3; font-size: 13px; font-size: 1.08333em; min-height: 1px; } .leaflet-popup-content p { margin: 17px 0; margin: 1.3em 0; } .leaflet-popup-tip-container { width: 40px; height: 20px; position: absolute; left: 50%; margin-top: -1px; margin-left: -20px; overflow: hidden; pointer-events: none; } .leaflet-popup-tip { width: 17px; height: 17px; padding: 1px; margin: -10px auto 0; pointer-events: auto; -webkit-transform: rotate(45deg); -moz-transform: rotate(45deg); -ms-transform: rotate(45deg); transform: rotate(45deg); } .leaflet-popup-content-wrapper, .leaflet-popup-tip { background: white; color: #333; box-shadow: 0 3px 14px rgba(0,0,0,0.4); } .leaflet-container a.leaflet-popup-close-button { position: absolute; top: 0; right: 0; border: none; text-align: center; width: 24px; height: 24px; font: 16px/24px Tahoma, Verdana, sans-serif; color: #757575; text-decoration: none; background: transparent; } .leaflet-container a.leaflet-popup-close-button:hover, .leaflet-container a.leaflet-popup-close-button:focus { color: #585858; } .leaflet-popup-scrolled { overflow: auto; } .leaflet-oldie .leaflet-popup-content-wrapper { -ms-zoom: 1; } .leaflet-oldie .leaflet-popup-tip { width: 24px; margin: 0 auto; -ms-filter: \"progid:DXImageTransform.Microsoft.Matrix(M11=0.70710678, M12=0.70710678, M21=-0.70710678, M22=0.70710678)\"; filter: progid:DXImageTransform.Microsoft.Matrix(M11=0.70710678, M12=0.70710678, M21=-0.70710678, M22=0.70710678); } .leaflet-oldie .leaflet-control-zoom, .leaflet-oldie .leaflet-control-layers, .leaflet-oldie .leaflet-popup-content-wrapper, .leaflet-oldie .leaflet-popup-tip { border: 1px solid #999; } .leaflet-div-icon { background: #fff; border: 1px solid #666; } .leaflet-tooltip { position: absolute; padding: 6px; background-color: #fff; border: 1px solid #fff; border-radius: 3px; color: #222; white-space: nowrap; -webkit-user-select: none; -moz-user-select: none; -ms-user-select: none; user-select: none; pointer-events: none; box-shadow: 0 1px 3px rgba(0,0,0,0.4); } .leaflet-tooltip.leaflet-interactive { cursor: pointer; pointer-events: auto; } .leaflet-tooltip-top:before, .leaflet-tooltip-bottom:before, .leaflet-tooltip-left:before, .leaflet-tooltip-right:before { position: absolute; pointer-events: none; border: 6px solid transparent; background: transparent; content: \"\"; } .leaflet-tooltip-bottom { margin-top: 6px; } .leaflet-tooltip-top { margin-top: -6px; } .leaflet-tooltip-bottom:before, .leaflet-tooltip-top:before { left: 50%; margin-left: -6px; } .leaflet-tooltip-top:before { bottom: 0; margin-bottom: -12px; border-top-color: #fff; } .leaflet-tooltip-bottom:before { top: 0; margin-top: -12px; margin-left: -6px; border-bottom-color: #fff; } .leaflet-tooltip-left { margin-left: -6px; } .leaflet-tooltip-right { margin-left: 6px; } .leaflet-tooltip-left:before, .leaflet-tooltip-right:before { top: 50%; margin-top: -6px; } .leaflet-tooltip-left:before { right: 0; margin-right: -12px; border-left-color: #fff; } .leaflet-tooltip-right:before { left: 0; margin-left: -12px; border-right-color: #fff; } @media print { .leaflet-control { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }";
  var lfState = 0, lfWait = [];
  function ensureLeaflet(cb){
    if(!document.getElementById('lf-css')){ var st = document.createElement('style'); st.id = 'lf-css'; st.textContent = LCSS; document.head.appendChild(st); }
    if(window.L && window.L.map){ cb(true); return; }
    lfWait.push(cb); if(lfState === 1) return; lfState = 1;
    var srcs = ['leaflet.js?v=1', 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js'], i = 0;
    (function next(){ if(window.L && window.L.map || i >= srcs.length){ var ok = !!(window.L && window.L.map); lfState = 0; var w = lfWait; lfWait = []; w.forEach(function(f){ f(ok); }); return; }
      var sc = document.createElement('script'); sc.src = srcs[i++]; sc.onload = next; sc.onerror = next; document.head.appendChild(sc); })();
  }

  // ---------- ecran ----------
  // ---------- hartă cu prieteni ----------
  var map = null, mapWrap = null, dyn = null, markers = Object.create(null), meMarker = null, avatars = Object.create(null), fitted = false, tile = null;
  function lettersOf(n){ return String(n||'?').slice(0,1).toUpperCase(); }
  var dark = false, tileL = null;
  try{ dark = localStorage.getItem('zyp_map_dark') === '1'; }catch(e){}
  function bustEl(nick, cls){
    var c = document.createElement('div'); c.className = 'fr-pc ' + (cls || ''); var av = avatars[nick];
    if(av && /^data:image\/jpeg;base64,[A-Za-z0-9+\/=]+$/.test(av)){ var im = document.createElement('img'); im.src = av; im.alt = ''; c.appendChild(im); } else c.textContent = lettersOf(nick);
    return c;
  }
  // personajul întreg pe hartă (dacă știm avatarul desenat), altfel cerc cu poză
  function pinEl(nick, cfg, sub, me){
    var w = document.createElement('div'); w.className = 'fr-pin' + (me ? ' me' : '');
    var fig = null;
    if(cfg && typeof cfg === 'object' && window.zAvatar){ try{ fig = document.createElement('div'); fig.className = 'fr-fig'; fig.innerHTML = window.zAvatar.svg(window.zAvatar.norm(cfg), 54, 'cut'); }catch(e){ fig = null; } }
    w.appendChild(fig || bustEl(nick));
    var l = document.createElement('div'); l.className = 'fr-pl'; var n = document.createElement('b'); n.textContent = me ? 'Eu' : nick; l.appendChild(n);
    if(sub){ var t = document.createElement('span'); t.textContent = ' ' + sub; l.appendChild(t); }
    w.appendChild(l); return w;
  }
  function iconFor(nick, cfg, sub, me){ var fig = !!(cfg && window.zAvatar); return L.divIcon({ className: 'fr-ic', html: pinEl(nick, cfg, sub, me), iconSize: [110, fig ? 122 : 84], iconAnchor: [55, fig ? 92 : 30] }); }
  function ensureAvatar(nick){
    if(avatars[nick] !== undefined) return; avatars[nick] = '';
    rpc('get_public_profile', { p_nick: nick }).then(function(p){ if(p && p.avatar){ avatars[nick] = p.avatar; updateMap(); renderStrip(); } }).catch(function(){});
  }
  function setTiles(){
    if(!map) return; if(tileL) map.removeLayer(tileL);
    tileL = L.tileLayer('https://{s}.basemaps.cartocdn.com/' + (dark ? 'dark_all' : 'rastertiles/voyager') + '/{z}/{x}/{y}{r}.png', { maxZoom: 19, subdomains: 'abcd', attribution: '© OpenStreetMap · © CARTO' }).addTo(map);
    if(mapWrap) mapWrap.classList.toggle('dark', dark);
  }
  function roundBtn(txt, label, fn){ var b = document.createElement('button'); b.className = 'fr-rb'; b.textContent = txt; b.setAttribute('aria-label', label); b.addEventListener('click', fn); return b; }
  function initMap(){
    if(map || !window.L || !mapWrap) return;
    var el = document.createElement('div'); el.className = 'fr-map-el'; mapWrap.appendChild(el);
    map = L.map(el, { zoomControl: false, attributionControl: true, worldCopyJump: true }).setView(mine ? [mine.lat, mine.lng] : [28.1, -15.4], mine ? 14 : 5);
    setTiles();
    var top = document.createElement('div'); top.className = 'fr-top'; top.id = 'frTop'; mapWrap.appendChild(top);
    var bar = document.createElement('div'); bar.className = 'fr-fab';
    var b0 = roundBtn('', 'Arată-mă sau ascunde-mă', function(){ if(sharing()) stopShare().then(function(){ draw(); toast('🙈 Ești invizibil: nimeni nu te mai vede'); }); else startFlow(); }); b0.id = 'frGhost';
    bar.appendChild(b0);
    bar.appendChild(roundBtn('🗺️', 'Hartă luminoasă sau întunecată', function(){ dark = !dark; try{ localStorage.setItem('zyp_map_dark', dark ? '1' : '0'); }catch(e){} setTiles(); }));
    bar.appendChild(roundBtn('➤', 'Centrează pe mine', function(){ if(mine) map.flyTo([mine.lat, mine.lng], 15); else if(Object.keys(markers).length) fitAll(); else toast('Pornește-ți locația ca să te găsesc'); }));
    mapWrap.appendChild(bar);
    var st = document.createElement('div'); st.className = 'fr-status'; st.id = 'frStatus'; mapWrap.appendChild(st);
    var strip = document.createElement('div'); strip.className = 'fr-strip'; strip.id = 'frStrip'; mapWrap.appendChild(strip);
    setTimeout(function(){ if(map) map.invalidateSize(); }, 200);
  }
  function fitAll(){ var pts = []; Object.keys(markers).forEach(function(k){ pts.push(markers[k].getLatLng()); }); if(mine) pts.push(L.latLng(mine.lat, mine.lng)); if(pts.length > 1) map.fitBounds(L.latLngBounds(pts), { padding: [70, 70], maxZoom: 16 }); else if(pts.length) map.setView(pts[0], 14); }
  function updateMap(){
    if(!map) return;
    var on = sharing(), g = document.getElementById('frGhost'); if(g){ g.textContent = on ? '🙈' : '📍'; g.classList.toggle('on', on); }
    var st = document.getElementById('frStatus'); if(st){ var nf = friends.filter(function(f){ return f.st === 'friend' && f.i_share; }).length; st.textContent = on ? ('📍 Te ' + (nf === 1 ? 'vede 1 prieten' : 'văd ' + nf + ' prieteni')) : '🙈 Ești invizibil'; st.classList.toggle('off', !on); }
    var seen = Object.create(null);
    locs.forEach(function(l){ seen[l.nick] = 1; ensureAvatar(l.nick); var ll = [+l.lat, +l.lng], ic = iconFor(l.nick, l.cfg, agoTxt(l.ago), false);
      if(markers[l.nick]){ markers[l.nick].setLatLng(ll); markers[l.nick].setIcon(ic); }
      else markers[l.nick] = L.marker(ll, { icon: ic }).addTo(map).on('click', function(){ map.flyTo(markers[l.nick].getLatLng(), 16); }); });
    Object.keys(markers).forEach(function(k){ if(!seen[k]){ map.removeLayer(markers[k]); delete markers[k]; } });
    if(mine){ var mp = [mine.lat, mine.lng], mi = iconFor('Eu', myCfg(), on ? 'acum' : 'doar tu te vezi', true); if(meMarker){ meMarker.setLatLng(mp); meMarker.setIcon(mi); } else meMarker = L.marker(mp, { icon: mi, zIndexOffset: 500 }).addTo(map); }
    else if(meMarker){ map.removeLayer(meMarker); meMarker = null; }
    if(!fitted && (mine || locs.length)){ fitted = true; fitAll(); }
  }
  function renderStrip(){
    var el = document.getElementById('frStrip'); if(!el) return; el.textContent = '';
    var live = Object.create(null); locs.forEach(function(l){ live[l.nick] = l; });
    friends.filter(function(f){ return f.st === 'friend'; }).forEach(function(f){ ensureAvatar(f.nick);
      var b = document.createElement('button'); b.className = 'fr-sb' + (live[f.nick] ? ' live' : ''); b.setAttribute('aria-label', f.nick); b.appendChild(bustEl(f.nick));
      var n = document.createElement('span'); n.textContent = f.nick; b.appendChild(n);
      b.addEventListener('click', function(){ var l = live[f.nick]; if(l && map) map.flyTo([+l.lat, +l.lng], 16); else toast(f.nick + ' nu își arată locația acum'); }); el.appendChild(b); });
    var add = document.createElement('button'); add.className = 'fr-addp'; add.textContent = '＋ Adaugă prieteni';
    add.addEventListener('click', function(){ var i = document.getElementById('frNick'); if(i){ i.scrollIntoView({ block: 'center', behavior: 'smooth' }); setTimeout(function(){ i.focus(); }, 350); } });
    el.appendChild(add);
    var top = document.getElementById('frTop'); if(top){ top.textContent = ''; var n2 = locs.length; var t = document.createElement('div'); t.className = 'fr-count'; t.textContent = n2 ? (n2 === 1 ? '1 prieten pe hartă' : n2 + ' prieteni pe hartă') : 'Niciun prieten pe hartă acum'; top.appendChild(t); }
  }
  function renderChips(){ renderStrip(); }
  function startFlow(){
    var ok = confirm('Prietenii pe care i-ai acceptat tu îți vor vedea locația pe hartă cât timp aplicația e deschisă. O poți opri oricând din butonul 🙈 de pe hartă.\n\nConfirmi că ai cel puțin 16 ani?'); if(!ok) return;
    if(!navigator.geolocation){ toast('Telefonul nu permite locația'); return; }
    navigator.geolocation.getCurrentPosition(function(p){ startShare(); send(p); draw(); updateMap(); if(map && mine) map.flyTo([mine.lat, mine.lng], 15); pull(); }, function(){ toast('Permite locația pentru By ZyP în setările telefonului'); }, { enableHighAccuracy: true, timeout: 20000 });
  }
  function draw(){
    if(!box || !dyn) return;
    var fr = friends.filter(function(f){ return f.st === 'friend'; }), inc = friends.filter(function(f){ return f.st === 'in'; }), out = friends.filter(function(f){ return f.st === 'out'; });
    var h = '';
    h += '<div class="card fr-card"><div class="card-title">👥 Prietenii mei</div>';
    if(inc.length) h += '<div class="fr-sub">Cereri primite</div>' + inc.map(function(f){ return '<div class="fr-row"><b>' + esc(f.nick) + '</b><span>vrea să fie prieten cu tine</span><button class="fr-ok" data-yes="' + esc(f.nick) + '">Accept</button><button class="fr-no" data-no="' + esc(f.nick) + '">Refuz</button><button class="fr-no" data-blk="' + esc(f.nick) + '" aria-label="Blochează">🚫</button></div>'; }).join('');
    if(fr.length) h += '<div class="fr-sub">Prieteni</div>' + fr.map(function(f){ return '<div class="fr-row"><b>' + esc(f.nick) + '</b><span>' + (f.i_share ? 'vede locația ta' : 'nu vede locația ta') + '</span><button class="' + (f.i_share ? 'fr-no' : 'fr-ok') + '" data-hide="' + esc(f.nick) + '" data-on="' + (f.i_share ? 0 : 1) + '">' + (f.i_share ? '🙈 Ascunde-mă' : '📍 Arată-i locația mea') + '</button><button class="fr-no" data-rm="' + esc(f.nick) + '" aria-label="Șterge din prieteni">✕</button><button class="fr-no" data-blk="' + esc(f.nick) + '" aria-label="Blochează">🚫</button></div>'; }).join('');
    if(out.length) h += '<div class="fr-sub">Cereri trimise</div>' + out.map(function(f){ return '<div class="fr-row"><b>' + esc(f.nick) + '</b><span>în așteptare</span><button class="fr-no" data-rm="' + esc(f.nick) + '">Anulează</button></div>'; }).join('');
    if(!friends.length) h += '<div class="hint">Încă nu ai prieteni în aplicație. Adaugă pe cineva după numele din clasament sau trimite-i o invitație.</div>';
    else h += '<div class="hint" style="margin-top:10px">Un prieten nou nu îți vede locația până nu apeși tu „Arată-i locația mea”. Locația e aproximativă (cam 100 m).</div>';
    h += '<button class="onb-skip" id="frInvite" style="display:block;width:100%;margin-top:12px;font-weight:800">📨 Invită un prieten în aplicație</button><div class="fr-add"><input id="frNick" maxlength="20" placeholder="Numele prietenului" autocomplete="off" autocapitalize="off"><button class="onb-btn" id="frAdd">Adaugă</button></div><div class="err" id="frErr" style="color:#ff7a7a;font-size:13px;margin-top:6px"></div></div>';
    dyn.innerHTML = h; renderChips(); updateMap();
    var q = function(i){ return document.getElementById(i); };
    var iv = q('frInvite'); if(iv) iv.addEventListener('click', function(){ if(window.zInvite) window.zInvite(); });
    var ad = q('frAdd'); if(ad) ad.addEventListener('click', function(){ var v = q('frNick').value.trim(); if(!v) return; ad.disabled = true; q('frErr').textContent = '';
      rpc('friend_request', { p_nick: v }).then(function(r){ toast(r && r.status === 'accepted' ? 'Acum sunteți prieteni!' : 'Cerere trimisă'); ad.disabled = false; pull(); }).catch(function(e){ ad.disabled = false; q('frErr').textContent = errMsg(e); }); });
    dyn.querySelectorAll('[data-yes]').forEach(function(b){ b.addEventListener('click', function(){ rpc('friend_respond', { p_nick: b.getAttribute('data-yes'), p_accept: true }).then(pull).catch(function(e){ toast(errMsg(e)); }); }); });
    dyn.querySelectorAll('[data-no]').forEach(function(b){ b.addEventListener('click', function(){ rpc('friend_respond', { p_nick: b.getAttribute('data-no'), p_accept: false }).then(pull).catch(function(e){ toast(errMsg(e)); }); }); });
    dyn.querySelectorAll('[data-hide]').forEach(function(b){ b.addEventListener('click', function(){ rpc('friend_share', { p_nick: b.getAttribute('data-hide'), p_on: b.getAttribute('data-on') === '1' }).then(pull).catch(function(e){ toast(errMsg(e)); }); }); });
    dyn.querySelectorAll('[data-blk]').forEach(function(b){ b.addEventListener('click', function(){ var n = b.getAttribute('data-blk'); if(confirm('Blochezi pe ' + n + '? Nu te mai poate adăuga și nu îți mai vede profilul sau locația.')) rpc('block_user', { p_nick: n }).then(function(){ toast('Blocat'); pull(); }).catch(function(e){ toast(errMsg(e)); }); }); });
    dyn.querySelectorAll('[data-rm]').forEach(function(b){ b.addEventListener('click', function(){ if(confirm('Ștergi pe ' + b.getAttribute('data-rm') + ' din prieteni?')) rpc('friend_remove', { p_nick: b.getAttribute('data-rm') }).then(pull).catch(function(e){ toast(errMsg(e)); }); }); });
  }

  window.zFriends = {
    render: function(el){ box = el; box.textContent = ''; map = null; markers = Object.create(null); meMarker = null; fitted = false;
      mapWrap = document.createElement('div'); mapWrap.className = 'fr-mapwrap'; dyn = document.createElement('div'); box.appendChild(mapWrap); box.appendChild(dyn);
      var msg = document.createElement('div'); msg.className = 'fr-mapmsg'; msg.textContent = 'Se încarcă harta…'; msg.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;text-align:center;padding:24px;color:#333;font-weight:700;font-size:14px;'; mapWrap.appendChild(msg);
      var myBox = box; ensureLeaflet(function(ok){ if(box !== myBox || !mapWrap) return; if(!ok){ msg.textContent = 'Harta nu s-a putut încărca. Verifică internetul și încearcă din nou.'; return; } msg.remove(); try{ initMap(); updateMap(); renderStrip(); }catch(e){ msg.textContent = 'Harta are o problemă: ' + (e && e.message || ''); mapWrap.appendChild(msg); } });
      dyn.innerHTML = '<div class="top-load">Se încarcă…</div>'; pull(); clearInterval(timer); timer = setInterval(function(){ if(box && !document.hidden && document.getElementById('frNick') !== document.activeElement) pull(); }, 20000); },
    leave: function(){ clearInterval(timer); timer = null; if(map){ try{ map.remove(); }catch(e){} } map = null; markers = Object.create(null); meMarker = null; box = null; dyn = null; mapWrap = null; }
  };
  // dacă ai pornit partajarea, continuă după ce redeschizi aplicația
  if(sharing()){ setTimeout(function(){ if(shareAge() > 8 * 3600000){ setSharing(false); if(window.__sb) rpc('loc_stop').catch(function(){}); return; } if(window.__sb) startWatch(); else setTimeout(startWatch, 4000); }, 2500); }
})();
