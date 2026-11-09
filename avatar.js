/* By ZyP · creator de avatar (desenat de noi, SVG). Rezultatul se salvează ca poză de profil. */
(function(){
  'use strict';
  var KEY = 'zyp_avatar_cfg_v1';
  var SKIN = ['#FFE0C7','#F7CDA6','#EBB68B','#D69A6B','#B9774A','#8D5A36','#5E3A22'];
  var HAIRC = ['#1B1B1B','#3B2417','#6B4226','#A5672B','#D9A441','#F1D27A','#B83A2E','#8E8E93','#4C6FFF','#E85AA8'];
  var EYEC = ['#3B2417','#2E6FD8','#2F9E5F','#7C8A3A','#6B6B72'];
  var TOPC = ['#A3FF12','#111111','#FFFFFF','#E5483C','#2E6FD8','#F5B800','#8E44D8','#12B5A6','#E85AA8','#6B7280'];
  var BGC = ['#1F3A12','#10223F','#3A1424','#3A2F10','#24124A','#0F3A38','#2B2B2B','#FFD84D'];
  var OPT = {
    hair: [['bald','Fără'],['buzz','Tuns scurt'],['short','Scurt'],['quiff','Moț'],['long','Lung'],['bun','Coc'],['curly','Creț'],['mohawk','Creastă']],
    eyes: [['round','Rotunzi'],['narrow','Mici'],['happy','Veseli'],['wink','Clipește']],
    brows: [['normal','Normale'],['thick','Groase'],['angry','Încruntate'],['raised','Ridicate'],['none','Fără']],
    mouth: [['smile','Zâmbet'],['grin','Rânjet'],['neutral','Serios'],['smirk','Șmecher'],['open','Uimit']],
    beard: [['none','Fără'],['stubble','Barbă rară'],['mustache','Mustață'],['goatee','Barbișon'],['beard','Barbă']],
    glasses: [['none','Fără'],['round','Rotunzi'],['square','Pătrați'],['sun','De soare']],
    top: [['tee','Tricou'],['hoodie','Hanorac'],['tank','Maiou'],['shirt','Cămașă'],['jacket','Geacă'],['turtle','Helancă']],
    acc: [['none','Nimic'],['cap','Șapcă'],['beanie','Căciulă'],['phones','Căști'],['band','Bentiță'],['chain','Lanț'],['ear','Cercel']]
  };
  var DEF = { skin: 2, hair: 'short', hairc: 1, eyes: 'round', eyec: 0, brows: 'normal', mouth: 'smile', beard: 'none', glasses: 'none', top: 'hoodie', topc: 0, acc: 'none', accc: 3, bg: 0 };

  function clamp(v, a){ v = +v; return v >= 0 && v < a ? Math.floor(v) : 0; }
  function inList(k, v){ return OPT[k].some(function(o){ return o[0] === v; }) ? v : OPT[k][0][0]; }
  function norm(c){ c = c || {}; return { skin: clamp(c.skin, SKIN.length), hair: inList('hair', c.hair), hairc: clamp(c.hairc, HAIRC.length), eyes: inList('eyes', c.eyes), eyec: clamp(c.eyec, EYEC.length), brows: inList('brows', c.brows),
    mouth: inList('mouth', c.mouth), beard: inList('beard', c.beard), glasses: inList('glasses', c.glasses), top: inList('top', c.top), topc: clamp(c.topc, TOPC.length), acc: inList('acc', c.acc), accc: clamp(c.accc, TOPC.length), bg: clamp(c.bg, BGC.length) }; }
  function mix(h, a){ var n = parseInt(h.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255, t = a < 0 ? 0 : 255, p = Math.abs(a);
    r = Math.round(r + (t - r) * p); g = Math.round(g + (t - g) * p); b = Math.round(b + (t - b) * p); return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1); }

  function svg(cfg, px){
    var c = norm(cfg), skin = SKIN[c.skin], sd = mix(skin, -.18), hc = HAIRC[c.hairc], hd = mix(hc, -.25), tc = TOPC[c.topc], td = mix(tc, -.25), ac = TOPC[c.accc], bg = BGC[c.bg];
    var ink = '#241a14', o = [];
    o.push('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="' + px + '" height="' + px + '"><rect width="200" height="200" fill="' + bg + '"/>');
    // păr din spate
    if(c.hair === 'long') o.push('<path d="M52 96C46 40 78 30 100 30C124 30 156 40 148 96C152 130 146 160 132 176L68 176C54 160 48 130 52 96Z" fill="' + hc + '"/>');
    if(c.hair === 'bun') o.push('<circle cx="100" cy="30" r="16" fill="' + hc + '"/>');
    if(c.top === 'hoodie') o.push('<path d="M60 152C52 118 74 110 100 110C126 110 148 118 140 152Z" fill="' + td + '"/>');
    // gât + umeri
    o.push('<rect x="85" y="120" width="30" height="40" rx="8" fill="' + sd + '"/>');
    o.push('<path d="M18 200C18 168 56 152 100 152C144 152 182 168 182 200Z" fill="' + (c.top === 'tank' ? skin : tc) + '"/>');
    if(c.top === 'tank') o.push('<path d="M44 200C50 176 72 158 82 152C90 166 110 166 118 152C128 158 150 176 156 200Z" fill="' + tc + '"/><path d="M82 152C90 168 110 168 118 152Z" fill="' + sd + '"/>');
    if(c.top === 'tee') o.push('<path d="M78 152C84 168 116 168 122 152Z" fill="' + sd + '"/>');
    if(c.top === 'hoodie') o.push('<path d="M80 152C88 172 112 172 120 152Z" fill="' + sd + '"/><path d="M90 168L88 188M110 168L112 188" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".85"/><path d="M60 152C58 168 56 184 54 200M140 152C142 168 144 184 146 200" stroke="' + td + '" stroke-width="2" fill="none"/>');
    if(c.top === 'shirt') o.push('<path d="M82 152L100 180L118 152Z" fill="' + sd + '"/><path d="M78 150L100 182L122 150L112 148L100 166L88 148Z" fill="#fff"/><path d="M100 182L100 200" stroke="' + td + '" stroke-width="2"/><circle cx="100" cy="190" r="1.8" fill="' + td + '"/>');
    if(c.top === 'jacket') o.push('<path d="M82 152L100 200L118 152Z" fill="' + (tc === '#FFFFFF' ? '#d8d8d8' : '#f2f2f2') + '"/><path d="M82 152L100 200M118 152L100 200" stroke="' + td + '" stroke-width="3" fill="none"/><path d="M84 150L100 172L116 150" stroke="' + td + '" stroke-width="4" fill="none" stroke-linejoin="round"/>');
    if(c.top === 'turtle') o.push('<rect x="80" y="126" width="40" height="32" rx="12" fill="' + td + '"/><path d="M82 140H118M82 148H118" stroke="' + tc + '" stroke-width="2" opacity=".5"/>');
    // cap + urechi
    o.push('<circle cx="58" cy="96" r="8" fill="' + skin + '"/><circle cx="142" cy="96" r="8" fill="' + skin + '"/><circle cx="58" cy="96" r="4" fill="' + sd + '" opacity=".5"/><circle cx="142" cy="96" r="4" fill="' + sd + '" opacity=".5"/>');
    o.push('<ellipse cx="100" cy="90" rx="42" ry="48" fill="' + skin + '"/>');
    o.push('<ellipse cx="72" cy="110" rx="8" ry="5" fill="#ff6b6b" opacity=".18"/><ellipse cx="128" cy="110" rx="8" ry="5" fill="#ff6b6b" opacity=".18"/>');
    // barbă
    if(c.beard === 'stubble') o.push('<path d="M60 100C60 142 140 142 140 100C132 128 68 128 60 100Z" fill="' + hd + '" opacity=".35"/>');
    if(c.beard === 'beard') o.push('<path d="M57 98C52 152 148 152 143 98C136 128 120 134 100 134C80 134 64 128 57 98Z" fill="' + hc + '"/>');
    if(c.beard === 'goatee') o.push('<path d="M88 126C90 144 110 144 112 126C106 131 94 131 88 126Z" fill="' + hc + '"/>');
    if(c.beard === 'mustache' || c.beard === 'beard' || c.beard === 'goatee') o.push('<path d="M80 114C90 106 100 111 100 111C100 111 110 106 120 114C110 119 100 116 100 116C100 116 90 119 80 114Z" fill="' + hc + '"/>');
    // nas
    o.push('<path d="M95 106Q100 112 105 106" stroke="' + sd + '" stroke-width="2.6" fill="none" stroke-linecap="round"/>');
    // gură
    var m = c.mouth;
    if(m === 'smile') o.push('<path d="M84 117Q100 132 116 117" stroke="' + ink + '" stroke-width="3.2" fill="none" stroke-linecap="round"/>');
    if(m === 'grin') o.push('<path d="M82 115Q100 140 118 115Z" fill="#fff" stroke="' + ink + '" stroke-width="3" stroke-linejoin="round"/>');
    if(m === 'neutral') o.push('<path d="M88 123H112" stroke="' + ink + '" stroke-width="3.2" stroke-linecap="round"/>');
    if(m === 'smirk') o.push('<path d="M86 122Q104 128 116 114" stroke="' + ink + '" stroke-width="3.2" fill="none" stroke-linecap="round"/>');
    if(m === 'open') o.push('<ellipse cx="100" cy="123" rx="8" ry="9" fill="#5a1d1d" stroke="' + ink + '" stroke-width="2.5"/>');
    // ochi
    var ec = EYEC[c.eyec];
    function eye(x, kind){
      if(kind === 'happy') return '<path d="M' + (x - 9) + ' 95Q' + x + ' 82 ' + (x + 9) + ' 95" stroke="' + ink + '" stroke-width="3.4" fill="none" stroke-linecap="round"/>';
      var ry = kind === 'narrow' ? 5.2 : 9.5;
      return '<ellipse cx="' + x + '" cy="92" rx="8.5" ry="' + ry + '" fill="#fff"/><circle cx="' + x + '" cy="92" r="' + (kind === 'narrow' ? 4.2 : 5.6) + '" fill="' + ec + '"/><circle cx="' + x + '" cy="92" r="2.6" fill="#111"/><circle cx="' + (x + 2) + '" cy="90" r="1.3" fill="#fff"/><path d="M' + (x - 9) + ' ' + (92 - ry + 1) + 'Q' + x + ' ' + (92 - ry - 3) + ' ' + (x + 9) + ' ' + (92 - ry + 1) + '" stroke="' + ink + '" stroke-width="1.8" fill="none"/>';
    }
    o.push(eye(82, c.eyes === 'wink' ? 'round' : c.eyes));
    o.push(eye(118, c.eyes === 'wink' ? 'happy' : c.eyes));
    // sprâncene
    var bc = c.hair === 'bald' ? sd : hd, B = c.brows;
    if(B === 'normal') o.push('<path d="M71 77Q82 71 93 76M107 76Q118 71 129 77" stroke="' + bc + '" stroke-width="3.6" fill="none" stroke-linecap="round"/>');
    if(B === 'thick') o.push('<path d="M70 78Q82 70 94 76M106 76Q118 70 130 78" stroke="' + bc + '" stroke-width="6.5" fill="none" stroke-linecap="round"/>');
    if(B === 'angry') o.push('<path d="M71 72L93 79M129 72L107 79" stroke="' + bc + '" stroke-width="4.4" fill="none" stroke-linecap="round"/>');
    if(B === 'raised') o.push('<path d="M72 72Q82 64 92 70M108 70Q118 64 128 72" stroke="' + bc + '" stroke-width="3.6" fill="none" stroke-linecap="round"/>');
    // ochelari
    if(c.glasses === 'round') o.push('<g fill="rgba(180,220,255,.15)" stroke="#222" stroke-width="3"><circle cx="82" cy="92" r="14"/><circle cx="118" cy="92" r="14"/></g><path d="M96 92H104M68 90L58 86M132 90L142 86" stroke="#222" stroke-width="3" fill="none"/>');
    if(c.glasses === 'square') o.push('<g fill="rgba(180,220,255,.15)" stroke="#222" stroke-width="3"><rect x="66" y="80" width="30" height="24" rx="5"/><rect x="104" y="80" width="30" height="24" rx="5"/></g><path d="M96 90H104M66 88L58 86M134 88L142 86" stroke="#222" stroke-width="3" fill="none"/>');
    if(c.glasses === 'sun') o.push('<g fill="#111" stroke="#111" stroke-width="3" stroke-linejoin="round"><path d="M64 82H98V96C98 104 90 106 82 106C72 106 64 102 64 94Z"/><path d="M102 82H136V94C136 102 128 106 118 106C110 106 102 104 102 96Z"/></g><path d="M98 86H102M64 86L58 84M136 86L142 84" stroke="#111" stroke-width="3" fill="none"/><path d="M70 86L78 86M108 86L116 86" stroke="#fff" stroke-width="2" opacity=".35"/>');
    // păr față
    var h = c.hair;
    if(h === 'buzz') o.push('<path d="M60 82C60 52 80 42 100 42C120 42 140 52 140 82C132 64 118 58 100 58C82 58 68 64 60 82Z" fill="' + hc + '"/>');
    if(h === 'short' || h === 'bun') o.push('<path d="M57 90C52 48 80 33 100 33C124 33 150 48 143 90C138 70 124 60 100 61C76 61 62 70 57 90Z" fill="' + hc + '"/>');
    if(h === 'quiff') o.push('<path d="M56 90C50 48 76 32 104 33C132 33 150 52 144 90C140 66 126 56 108 56C94 52 78 58 72 70C68 76 62 84 56 90Z" fill="' + hc + '"/><path d="M80 46C86 20 122 22 130 40C116 34 98 36 80 46Z" fill="' + hc + '"/>');
    if(h === 'long') o.push('<path d="M56 96C50 52 78 36 100 36C124 36 150 52 144 96C140 70 124 58 100 62C80 66 66 74 56 96Z" fill="' + hc + '"/>');
    if(h === 'curly') o.push('<g fill="' + hc + '"><circle cx="62" cy="72" r="14"/><circle cx="72" cy="52" r="15"/><circle cx="92" cy="42" r="15"/><circle cx="112" cy="42" r="15"/><circle cx="130" cy="52" r="15"/><circle cx="140" cy="72" r="14"/><path d="M60 82C60 56 80 50 100 50C120 50 140 56 140 82C132 66 118 62 100 62C82 62 68 66 60 82Z"/></g>');
    if(h === 'mohawk') o.push('<path d="M90 60C86 34 92 12 100 12C108 12 114 34 110 60C104 56 96 56 90 60Z" fill="' + hc + '"/><path d="M60 82C62 62 76 56 90 58L110 58C124 56 138 62 140 82C130 68 118 62 100 62C82 62 70 68 60 82Z" fill="' + hc + '" opacity=".45"/>');
    // accesorii
    var A = c.acc;
    if(A === 'cap') o.push('<path d="M55 80C55 38 145 38 145 80Z" fill="' + ac + '"/><path d="M118 74C150 72 172 80 174 88C152 90 132 88 116 84Z" fill="' + mix(ac, -.2) + '"/><path d="M100 40V80" stroke="' + mix(ac, -.2) + '" stroke-width="2" opacity=".5"/>');
    if(A === 'beanie') o.push('<path d="M53 80C53 28 147 28 147 80Z" fill="' + ac + '"/><rect x="50" y="66" width="100" height="18" rx="9" fill="' + mix(ac, -.2) + '"/><circle cx="100" cy="28" r="8" fill="' + mix(ac, .25) + '"/>');
    if(A === 'phones') o.push('<path d="M54 92C48 30 152 30 146 92" stroke="#1b1b1b" stroke-width="7" fill="none" stroke-linecap="round"/><rect x="46" y="84" width="14" height="28" rx="7" fill="' + ac + '" stroke="#1b1b1b" stroke-width="2"/><rect x="140" y="84" width="14" height="28" rx="7" fill="' + ac + '" stroke="#1b1b1b" stroke-width="2"/>');
    if(A === 'band') o.push('<path d="M57 68C80 56 120 56 143 68L143 77C120 66 80 66 57 77Z" fill="' + ac + '"/>');
    if(A === 'chain') o.push('<path d="M78 156C88 182 112 182 122 156" stroke="#f5c542" stroke-width="3.5" fill="none" stroke-linecap="round"/><circle cx="100" cy="177" r="5" fill="#f5c542"/>');
    if(A === 'ear') o.push('<circle cx="58" cy="108" r="3.6" fill="#f5c542"/><circle cx="142" cy="108" r="3.6" fill="#f5c542"/>');
    o.push('</svg>');
    return o.join('');
  }

  function load(){ try{ return norm(JSON.parse(localStorage.getItem(KEY) || 'null') || DEF); }catch(e){ return norm(DEF); } }
  function save(c){ try{ localStorage.setItem(KEY, JSON.stringify(c)); }catch(e){} try{ if(window.__byzypDb) window.__byzypDb.doc('settings/avatar').set({ cfg: c }); }catch(e){} }
  function toJpeg(c){ return new Promise(function(res, rej){
    var im = new Image(); im.onload = function(){ var cv = document.createElement('canvas'); cv.width = cv.height = 256; cv.getContext('2d').drawImage(im, 0, 0, 256, 256); try{ res(cv.toDataURL('image/jpeg', 0.88)); }catch(e){ rej(e); } };
    im.onerror = rej; im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg(c, 256)); }); }

  var TABS = [['skin','🧑 Piele'],['hair','💇 Păr'],['hairc','🎨 Culoare păr'],['eyes','👀 Ochi'],['eyec','🔵 Culoare ochi'],['brows','🤨 Sprâncene'],['mouth','👄 Gură'],['beard','🧔 Barbă'],['glasses','🕶️ Ochelari'],['top','👕 Haine'],['topc','🎨 Culoare haine'],['acc','🧢 Accesorii'],['accc','🎨 Culoare accesoriu'],['bg','🖼️ Fundal']];
  var PAL = { skin: SKIN, hairc: HAIRC, eyec: EYEC, topc: TOPC, accc: TOPC, bg: BGC };

  function ensureCss(){ if(document.getElementById('av-css')) return; var st = document.createElement('style'); st.id = 'av-css'; st.textContent = "  .av-ov{ position:fixed; inset:0; z-index:5000; background:rgba(0,0,0,.82); display:flex; align-items:flex-end; justify-content:center; }   .av-box{ width:100%; max-width:520px; max-height:94vh; overflow-y:auto; background:var(--bg-card,#101410); border:1px solid var(--line); border-radius:24px 24px 0 0; padding:14px 14px calc(18px + env(safe-area-inset-bottom)); }   .av-top{ display:flex; justify-content:space-between; align-items:center; font-size:17px; } .av-x{ background:none; border:none; color:var(--text); font-size:20px; padding:6px 10px; }   .av-prev{ width:190px; height:190px; border-radius:50%; overflow:hidden; margin:8px auto 10px; border:3px solid var(--gold,#A3FF12); } .av-prev svg{ display:block; }   .av-tabs{ display:flex; gap:6px; overflow-x:auto; padding:4px 0 8px; } .av-tab{ flex:none; background:var(--bg-card-2); color:var(--text); border:1px solid var(--line); border-radius:999px; padding:7px 12px; font:inherit; font-size:12.5px; font-weight:700; white-space:nowrap; } .av-tab.on{ background:var(--gold,#A3FF12); color:#000; border-color:transparent; }   .av-opts{ display:flex; flex-wrap:wrap; gap:8px; justify-content:center; min-height:84px; padding:4px 0; }   .av-op{ display:flex; flex-direction:column; align-items:center; gap:3px; background:var(--bg-card-2); border:2px solid transparent; border-radius:14px; padding:6px; color:var(--text); font:inherit; font-size:11px; width:78px; } .av-op svg{ border-radius:50%; } .av-op.on{ border-color:var(--gold,#A3FF12); }   .av-sw{ width:42px; height:42px; border-radius:50%; border:3px solid transparent; box-shadow:0 0 0 1px var(--line); } .av-sw.on{ border-color:#fff; box-shadow:0 0 0 3px var(--gold,#A3FF12); }   .av-act{ display:flex; gap:10px; margin-top:12px; } .av-act button{ flex:1; border-radius:14px; padding:13px; font:inherit; font-weight:800; border:1px solid var(--line); background:var(--bg-card-2); color:var(--text); } .av-act .av-ok{ background:var(--gold,#A3FF12); color:#000; border:none; }   .av-hint{ margin-top:10px; font-size:12px; color:var(--text-faint); text-align:center; } "; document.head.appendChild(st); }
  function open(done){
    ensureCss();
    var cfg = load(), tab = 'top', ov = document.createElement('div'); ov.className = 'av-ov';
    ov.innerHTML = '<div class="av-box"><div class="av-top"><b>🧑‍🎨 Avatarul tău</b><button class="av-x" aria-label="Închide">✕</button></div><div class="av-prev"></div><div class="av-tabs"></div><div class="av-opts"></div><div class="av-act"><button class="av-rnd">🎲 Aleator</button><button class="av-ok">✅ Gata</button></div><div class="av-hint">Avatarul devine poza ta de profil și apare în clasament, chat și pe hartă.</div></div>';
    document.body.appendChild(ov);
    var $ = function(s){ return ov.querySelector(s); };
    function prev(){ $('.av-prev').innerHTML = svg(cfg, 190); }
    function tabs(){ var h = ''; TABS.forEach(function(t){ h += '<button class="av-tab' + (t[0] === tab ? ' on' : '') + '" data-t="' + t[0] + '">' + t[1] + '</button>'; }); $('.av-tabs').innerHTML = h; }
    function opts(){ var h = '';
      if(PAL[tab]) PAL[tab].forEach(function(col, i){ h += '<button class="av-sw' + (cfg[tab] === i ? ' on' : '') + '" data-i="' + i + '" style="background:' + col + '" aria-label="Culoare ' + (i + 1) + '"></button>'; });
      else OPT[tab].forEach(function(p){ var t = JSON.parse(JSON.stringify(cfg)); t[tab] = p[0]; h += '<button class="av-op' + (cfg[tab] === p[0] ? ' on' : '') + '" data-v="' + p[0] + '">' + svg(t, 62) + '<span>' + p[1] + '</span></button>'; });
      $('.av-opts').innerHTML = h; }
    function all(){ prev(); tabs(); opts(); }
    all();
    ov.addEventListener('click', function(e){
      var t = e.target.closest('[data-t]'); if(t){ tab = t.getAttribute('data-t'); tabs(); opts(); return; }
      var s = e.target.closest('.av-sw'); if(s){ cfg[tab] = +s.getAttribute('data-i'); cfg = norm(cfg); prev(); opts(); return; }
      var p = e.target.closest('.av-op'); if(p){ cfg[tab] = p.getAttribute('data-v'); cfg = norm(cfg); prev(); opts(); return; }
      if(e.target.closest('.av-x')){ ov.remove(); return; }
      if(e.target.closest('.av-rnd')){ var r = function(n){ return Math.floor(Math.random() * n); }; cfg = norm({ skin: r(SKIN.length), hair: OPT.hair[r(OPT.hair.length)][0], hairc: r(HAIRC.length), eyes: OPT.eyes[r(OPT.eyes.length)][0], eyec: r(EYEC.length), brows: OPT.brows[r(OPT.brows.length)][0], mouth: OPT.mouth[r(OPT.mouth.length)][0], beard: Math.random() < .35 ? OPT.beard[r(OPT.beard.length)][0] : 'none', glasses: Math.random() < .3 ? OPT.glasses[r(OPT.glasses.length)][0] : 'none', top: OPT.top[r(OPT.top.length)][0], topc: r(TOPC.length), acc: Math.random() < .4 ? OPT.acc[r(OPT.acc.length)][0] : 'none', accc: r(TOPC.length), bg: r(BGC.length) }); all(); return; }
      if(e.target.closest('.av-ok')){ save(cfg); toJpeg(cfg).then(function(d){ ov.remove(); if(done) done(d, cfg); }).catch(function(){ alert('Nu am putut crea poza. Încearcă din nou.'); }); }
    });
  }
  window.zAvatar = { svg: svg, open: open, load: load, norm: norm };
})();
