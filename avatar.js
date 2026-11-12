/* By ZyP · creator de avatar (desenat de noi, SVG). Rezultatul se salvează ca poză de profil. */
(function(){
  'use strict';
  var KEY = 'zyp_avatar_cfg_v1';
  var SKIN = ['#FFE0C7','#F7CDA6','#EBB68B','#D69A6B','#B9774A','#8D5A36','#5E3A22'];
  var HAIRC = ['#1B1B1B','#3B2417','#6B4226','#A5672B','#D9A441','#F1D27A','#B83A2E','#8E8E93','#4C6FFF','#E85AA8'];
  var EYEC = ['#3B2417','#2E6FD8','#2F9E5F','#7C8A3A','#6B6B72'];
  var TOPC = ['#A3FF12','#111111','#FFFFFF','#E5483C','#2E6FD8','#F5B800','#8E44D8','#12B5A6','#E85AA8','#6B7280'];
  var BGC = [['#2f5d12','#0e1f08'],['#2a5db0','#0c1a36'],['#c2406a','#3a1224'],['#e0a526','#4a3208'],['#7a47d6','#1c0f40'],['#1fb5a6','#0a2e2b'],['#4a4a52','#151518'],['#ffd84d','#ff8a3d'],['#ff7eb3','#7a5cff'],['#6dd5ed','#2193b0']];
  var PANTC = ['#2B4C8C','#111111','#6B7280','#3B2F2F','#A3FF12','#E5483C','#F2F2F2','#556B2F'];
  var SHOEC = ['#FFFFFF','#111111','#E5483C','#A3FF12','#2E6FD8','#F5B800'];
  var OPT = {
    hair: [['bald','Fără'],['fade','Tuns pierdut'],['afro','Afro'],['pony','Coadă'],['side','Cu cărare'],['buzz','Tuns scurt'],['short','Scurt'],['quiff','Moț'],['long','Lung'],['bun','Coc'],['curly','Creț'],['mohawk','Creastă'],['hpony','Coadă înaltă'],['wavy','Lung ondulat'],['bob','Bob']],
    eyes: [['round','Rotunzi'],['narrow','Mici'],['happy','Veseli'],['wink','Clipește']],
    brows: [['normal','Normale'],['thick','Groase'],['angry','Încruntate'],['raised','Ridicate'],['none','Fără']],
    mouth: [['smile','Zâmbet'],['grin','Rânjet'],['neutral','Serios'],['smirk','Șmecher'],['open','Uimit']],
    beard: [['none','Fără'],['stubble','Barbă rară'],['mustache','Mustață'],['goatee','Barbișon'],['boxed','Barbă scurtă'],['beard','Barbă']],
    glasses: [['none','Fără'],['round','Rotunzi'],['square','Pătrați'],['sun','De soare']],
    top: [['tee','Tricou'],['hoodie','Hanorac'],['tank','Maiou'],['shirt','Cămașă'],['jacket','Geacă'],['turtle','Helancă'],['crop','Bustieră sport']],
    pants: [['jeans','Blugi'],['jogger','Jogger'],['shorts','Șort'],['skirt','Fustă'],['leggings','Colanți']],
    scene: [['none','Culoare'],['gymneon','Sală cu neon'],['forest','Pădure'],['city','Oraș noaptea'],['gym','Sala'],['beach','Plajă'],['mountain','Munți'],['neon','Neon'],['photo','Poza mea']],
    face: [['none','Fără'],['freckles','Pistrui'],['blush','Obraji roz'],['mole','Aluniță']],
    acc: [['none','Nimic'],['cap','Șapcă'],['beanie','Căciulă'],['phones','Căști'],['band','Bentiță'],['chain','Lanț'],['ear','Cercel'],['watch','Ceas']],
    pose: [['down','Normal'],['cross','Brațe încrucișate']],
    body: [['f','Feminin'],['m','Masculin']]
  };
  var DEF = { skin: 2, hair: 'short', hairc: 1, eyes: 'round', eyec: 0, brows: 'normal', mouth: 'smile', beard: 'none', glasses: 'none', top: 'hoodie', topc: 0, acc: 'none', accc: 3, bg: 0, pants: 'jeans', pantc: 0, shoec: 0, face: 'none', scene: 'none', pose: 'down', body: 'm' };

  function clamp(v, a){ v = +v; return v >= 0 && v < a ? Math.floor(v) : 0; }
  function inList(k, v){ return OPT[k].some(function(o){ return o[0] === v; }) ? v : OPT[k][0][0]; }
  function norm(c){ c = c || {}; return { skin: clamp(c.skin, SKIN.length), hair: inList('hair', c.hair), hairc: clamp(c.hairc, HAIRC.length), eyes: inList('eyes', c.eyes), eyec: clamp(c.eyec, EYEC.length), brows: inList('brows', c.brows),
    mouth: inList('mouth', c.mouth), beard: inList('beard', c.beard), glasses: inList('glasses', c.glasses), top: inList('top', c.top), topc: clamp(c.topc, TOPC.length), acc: inList('acc', c.acc), accc: clamp(c.accc, TOPC.length), bg: clamp(c.bg, BGC.length), pants: inList('pants', c.pants), pantc: clamp(c.pantc, PANTC.length), shoec: clamp(c.shoec, SHOEC.length), face: inList('face', c.face), scene: inList('scene', c.scene), pose: inList('pose', c.pose), body: c.body === 'f' ? 'f' : 'm' }; }
  function mix(h, a){ var n = parseInt(h.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255, t = a < 0 ? 0 : 255, p = Math.abs(a);
    r = Math.round(r + (t - r) * p); g = Math.round(g + (t - g) * p); b = Math.round(b + (t - b) * p); return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1); }


  var PKEY = 'zyp_avatar_bg_v1';
  function photo(){ try{ var p = localStorage.getItem(PKEY); return p && /^data:image\/jpeg;base64,[A-Za-z0-9+\/=]+$/.test(p) ? p : ''; }catch(e){ return ''; } }
  function sceneSvg(k, gid){
    var o = [];
    if(k === 'photo'){ var p = photo(); if(p) o.push('<image href="' + p + '" x="0" y="0" width="200" height="330" preserveAspectRatio="xMidYMid slice"/><rect width="200" height="330" fill="#000" opacity=".12"/>'); return o.join(''); }
    if(k === 'forest'){
      o.push('<rect width="200" height="330" fill="url(#' + gid + 'f)"/>');
      o.push('<g fill="#9fb4ff" opacity=".12"><path d="M70 0L110 0L150 330L40 330Z"/><path d="M120 0L140 0L200 240L150 270Z"/></g>');
      [[8,16,.5],[34,10,.4],[168,14,.5],[190,9,.4],[58,7,.18],[142,7,.18],[104,6,.12]].forEach(function(t){ o.push('<rect x="' + t[0] + '" y="0" width="' + t[1] + '" height="330" fill="#070a24" opacity="' + (t[2] + .3) + '"/>'); });
      o.push('<ellipse cx="100" cy="250" rx="130" ry="46" fill="#a9b8ff" opacity=".16"/><ellipse cx="100" cy="290" rx="150" ry="40" fill="#c9d2ff" opacity=".14"/>');
      for(var i = 0; i < 14; i++){ o.push('<circle cx="' + ((i * 53) % 200) + '" cy="' + ((i * 37) % 260 + 20) + '" r="' + (1 + (i % 3)) + '" fill="#cfe0ff" opacity=".35"/>'); }
    }
    if(k === 'city'){
      o.push('<rect width="200" height="330" fill="url(#' + gid + 'c)"/><circle cx="150" cy="60" r="18" fill="#fff6d6" opacity=".9"/><circle cx="144" cy="56" r="18" fill="#2a1c5a" opacity=".0"/>');
      for(var j = 0; j < 30; j++) o.push('<circle cx="' + ((j * 67) % 200) + '" cy="' + ((j * 29) % 110 + 6) + '" r="' + (j % 3 ? .8 : 1.3) + '" fill="#fff" opacity=".7"/>');
      var bl = [[0,40,200],[26,34,170],[56,44,215],[96,30,180],[122,48,205],[166,40,190]];
      bl.forEach(function(b){ o.push('<rect x="' + b[0] + '" y="' + b[2] + '" width="' + b[1] + '" height="' + (330 - b[2]) + '" fill="#0d0b25"/>'); for(var w = 0; w < 14; w++){ var wx = b[0] + 5 + (w % 4) * 8, wy = b[2] + 8 + Math.floor(w / 4) * 14; if(wx < b[0] + b[1] - 5 && (w * 7 + b[0]) % 3) o.push('<rect x="' + wx + '" y="' + wy + '" width="4" height="6" fill="#ffd36a" opacity=".85"/>'); } });
    }
    if(k === 'gym'){
      o.push('<rect width="200" height="330" fill="#161618"/><rect y="262" width="200" height="68" fill="#232327"/><path d="M0 262H200" stroke="#A3FF12" stroke-width="2" opacity=".7"/>');
      o.push('<rect x="0" y="40" width="200" height="4" fill="#A3FF12" opacity=".8"/><rect x="0" y="44" width="200" height="30" fill="#A3FF12" opacity=".06"/>');
      [[22,150,34],[178,150,34]].forEach(function(p){ o.push('<circle cx="' + p[0] + '" cy="' + p[1] + '" r="' + p[2] + '" fill="#26262b" stroke="#3a3a42" stroke-width="3"/><circle cx="' + p[0] + '" cy="' + p[1] + '" r="22" fill="none" stroke="#3a3a42" stroke-width="2"/><circle cx="' + p[0] + '" cy="' + p[1] + '" r="6" fill="#111"/>'); });
      o.push('<g stroke="#3a3a42" stroke-width="3"><path d="M8 215H62M138 215H192"/></g><g fill="#2c2c32"><rect x="6" y="206" width="10" height="18" rx="3"/><rect x="54" y="206" width="10" height="18" rx="3"/><rect x="136" y="206" width="10" height="18" rx="3"/><rect x="184" y="206" width="10" height="18" rx="3"/></g>');
    }
    if(k === 'beach'){
      o.push('<rect width="200" height="330" fill="url(#' + gid + 'b)"/><circle cx="100" cy="205" r="40" fill="#ffe29a" opacity=".95"/><rect y="205" width="200" height="125" fill="#1d3b73"/>');
      for(var q = 0; q < 9; q++) o.push('<rect x="' + (40 + q * 4) + '" y="' + (210 + q * 9) + '" width="' + (120 - q * 8) + '" height="2" fill="#ffd27a" opacity="' + (.6 - q * .05) + '"/>');
      o.push('<path d="M0 290C40 276 80 296 120 286C160 276 190 290 200 288V330H0Z" fill="#e9c78a"/><path d="M176 330C178 270 172 220 182 170" stroke="#1a1020" stroke-width="5" fill="none"/><g fill="#1a1020"><path d="M182 172C162 160 150 170 144 182C160 174 172 174 182 172Z"/><path d="M182 172C196 158 208 162 214 176C200 170 190 170 182 172Z"/><path d="M182 172C172 150 160 146 150 150C164 156 174 160 182 172Z"/></g>');
    }
    if(k === 'mountain'){
      o.push('<rect width="200" height="330" fill="url(#' + gid + 'm)"/>');
      for(var z = 0; z < 22; z++) o.push('<circle cx="' + ((z * 71) % 200) + '" cy="' + ((z * 31) % 120 + 6) + '" r="' + (z % 3 ? .8 : 1.4) + '" fill="#fff" opacity=".7"/>');
      o.push('<path d="M-10 250L40 140L72 190L110 110L160 200L210 150V330H-10Z" fill="#2a3a78"/><path d="M110 110L96 138L108 132L118 146L128 134Z" fill="#eef3ff"/><path d="M40 140L28 164L38 158L48 170Z" fill="#eef3ff"/><path d="M-10 290L50 220L100 270L150 215L210 280V330H-10Z" fill="#141c44"/><ellipse cx="100" cy="280" rx="140" ry="30" fill="#aab9ff" opacity=".18"/>');
    }
    if(k === 'gymneon'){
      o.push('<rect width="200" height="330" fill="#0c0c10"/><rect y="250" width="200" height="80" fill="#15151a"/>');
      for(var gx = 0; gx <= 200; gx += 25) o.push('<path d="M' + gx + ' 250L' + (gx * 1.6 - 60) + ' 330" stroke="#22222a" stroke-width="1"/>');
      o.push('<path d="M0 270H200M0 296H200" stroke="#22222a" stroke-width="1"/><path d="M0 250H200" stroke="#7fa8ff" stroke-width="1.5" opacity=".5"/>');
      o.push('<g fill="none" stroke="#1d1d24" stroke-width="5"><path d="M10 0V250M30 0V250M10 60H30M10 120H30M10 180H30"/></g><rect x="0" y="206" width="52" height="8" rx="3" fill="#1d1d24"/><path d="M10 214V250M44 214V250" stroke="#1d1d24" stroke-width="5"/>');
      o.push('<g transform="translate(74 -8) scale(.62)" fill="none" stroke="#dfe9ff" stroke-width="3.4" stroke-linejoin="round" filter="url(#' + gid + 'gl)"><rect x="118" y="52" width="9" height="34" rx="3"/><rect x="109" y="59" width="8" height="20" rx="3"/><rect x="173" y="52" width="9" height="34" rx="3"/><rect x="183" y="59" width="8" height="20" rx="3"/><path d="M127 66H173M127 72H173"/></g>');
      o.push('<g transform="translate(74 -8) scale(.62)" fill="none" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"><rect x="118" y="52" width="9" height="34" rx="3"/><rect x="109" y="59" width="8" height="20" rx="3"/><rect x="173" y="52" width="9" height="34" rx="3"/><rect x="183" y="59" width="8" height="20" rx="3"/><path d="M127 66H173M127 72H173"/></g>');
      o.push('<path d="M0 12H200" stroke="#dfe9ff" stroke-width="1.6" opacity=".7" filter="url(#' + gid + 'gl)"/>');
      o.push('<g transform="translate(2 -22) scale(.62) rotate(-7 60 96)" fill="#a5a5b0" opacity=".85" font-family="Impact,Arial Black,sans-serif" font-weight="900" font-style="italic"><text x="34" y="92" font-size="19">FĂRĂ</text><text x="30" y="112" font-size="19">SCUZE</text><path d="M30 118L96 112" stroke="#8d8d96" stroke-width="3" stroke-linecap="round"/><path d="M52 66l4 -9 5 6 5 -8 5 8 5 -6 3 9z" fill="none" stroke="#8d8d96" stroke-width="1.6"/></g>');
      o.push('<rect x="120" y="196" width="80" height="5" fill="#1d1d24"/><rect x="120" y="232" width="80" height="5" fill="#1d1d24"/>');
      [[130,186],[152,186],[174,186],[196,186],[134,222],[156,222],[178,222],[200,222]].forEach(function(p){ o.push('<path d="M' + (p[0]-8) + ' ' + p[1] + 'l4 -7h8l4 7l-4 7h-8z" fill="#1a1a20" stroke="#2c2c36" stroke-width="1"/>'); });
      o.push('<ellipse cx="100" cy="300" rx="120" ry="24" fill="#7fa8ff" opacity=".07"/>');
    }
    if(k === 'neon'){
      o.push('<rect width="200" height="330" fill="url(#' + gid + 'n)"/><circle cx="100" cy="120" r="56" fill="url(#' + gid + 'ns)"/>');
      for(var y = 0; y < 6; y++) o.push('<rect x="40" y="' + (118 + y * 9) + '" width="120" height="' + (1 + y * .8) + '" fill="#10052a" opacity=".85"/>');
      o.push('<g stroke="#ff4fd8" stroke-width="1.2" opacity=".75" fill="none"><path d="M0 230H200M0 250H200M0 275H200M0 305H200"/><path d="M100 215L-20 330M100 215L20 330M100 215L60 330M100 215L100 330M100 215L140 330M100 215L180 330M100 215L220 330"/></g>');
    }
    return o.join('');
  }
  function sceneDefs(k, gid){
    if(k === 'forest') return '<linearGradient id="' + gid + 'f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3b4bc0"/><stop offset=".55" stop-color="#241f78"/><stop offset="1" stop-color="#0c0a2e"/></linearGradient>';
    if(k === 'city') return '<linearGradient id="' + gid + 'c" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0c0a2e"/><stop offset=".55" stop-color="#4a2a7a"/><stop offset="1" stop-color="#d0587a"/></linearGradient>';
    if(k === 'beach') return '<linearGradient id="' + gid + 'b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a2a8a"/><stop offset=".5" stop-color="#e0527a"/><stop offset="1" stop-color="#ffb347"/></linearGradient>';
    if(k === 'mountain') return '<linearGradient id="' + gid + 'm" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#070a2a"/><stop offset=".6" stop-color="#2d3d9a"/><stop offset="1" stop-color="#7f8de0"/></linearGradient>';
    if(k === 'gymneon') return '<filter id="' + gid + 'gl" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="2.6"/></filter>';
    if(k === 'neon') return '<linearGradient id="' + gid + 'n" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#10052a"/><stop offset="1" stop-color="#3a0b5e"/></linearGradient><linearGradient id="' + gid + 'ns" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe14d"/><stop offset="1" stop-color="#ff2f9e"/></linearGradient>';
    return '';
  }
  var UID = 0;
  function svg(cfg, px, mode){
    var cut = mode === 'cut', full = mode === 'full' || mode === 'hero' || cut, hero = mode === 'hero', H = full ? 330 : 200, gid = 'avg' + (++UID);
    var c = norm(cfg), skin = SKIN[c.skin], sd = mix(skin, -.18), hc = HAIRC[c.hairc], hd = mix(hc, -.25), tc = TOPC[c.topc], td = mix(tc, -.25), ac = TOPC[c.accc], bg = BGC[c.bg], pc = PANTC[c.pantc], pd = mix(pc, -.22);
    var ink = '#241a14', o = [], F = c.body === 'f', bare = c.top === 'tank' || c.top === 'crop';
    o.push('<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + (hero ? '0 0 200 330' : '0 0 200 ' + H) + '" width="' + px + '" height="' + (hero ? Math.round(px * 1.9) : Math.round(px * H / 200)) + '"' + (hero ? ' preserveAspectRatio="xMidYMin slice"' : '') + '><defs><linearGradient id="' + gid + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + bg[0] + '"/><stop offset="1" stop-color="' + bg[1] + '"/></linearGradient>' +
      '<radialGradient id="' + gid + 's" cx=".42" cy=".38" r=".75"><stop offset="0" stop-color="' + mix(skin, .22) + '"/><stop offset=".6" stop-color="' + skin + '"/><stop offset="1" stop-color="' + mix(skin, -.16) + '"/></radialGradient>' +
      '<linearGradient id="' + gid + 'h" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + mix(hc, .28) + '"/><stop offset=".5" stop-color="' + hc + '"/><stop offset="1" stop-color="' + mix(hc, -.3) + '"/></linearGradient>' +
      sceneDefs(c.scene, gid) +
      '<filter id="' + gid + 'b" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="3.2"/></filter><filter id="' + gid + 'b2" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="1.3"/></filter>' +
      '<clipPath id="' + gid + 'fc"><path d="M57 86C57 56 78 41 100 41C122 41 143 56 143 86C143 112 127 137 100 141C73 137 57 112 57 86Z"/></clipPath>' +
      '<pattern id="' + gid + 'hp" width="5" height="34" patternUnits="userSpaceOnUse" patternTransform="rotate(14)"><path d="M1 0Q2.4 17 1 34" stroke="#fff" stroke-opacity=".13" stroke-width=".8" fill="none"/><path d="M3.5 0Q2.2 17 3.5 34" stroke="#000" stroke-opacity=".2" stroke-width=".9" fill="none"/></pattern>' +
      '<linearGradient id="' + gid + 't" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="' + mix(tc, .18) + '"/><stop offset=".5" stop-color="' + tc + '"/><stop offset="1" stop-color="' + mix(tc, -.28) + '"/></linearGradient></defs>' + (cut ? '' : '<rect width="200" height="' + H + '" fill="url(#' + gid + ')"/>'));
    var scn = (c.scene === 'photo' && !photo()) ? 'none' : c.scene; if(scn !== 'none' && !cut) o.push(sceneSvg(scn, gid));
    if(full && !cut && scn === 'none') o.push('<circle cx="100" cy="120" r="96" fill="#fff" opacity=".07"/>');
    if(full) o.push('<ellipse cx="100" cy="320" rx="86" ry="12" fill="#fff" opacity="' + (cut ? '0' : '.1') + '"/><ellipse cx="100" cy="318" rx="60" ry="7" fill="#000" opacity=".28"/>');
    if(full) o.push('<g transform="translate(100 320) scale(1.17) translate(-100 -320)">');
    if(full) o.push('<g transform="translate(100 148) scale(.66) translate(-100 -148)">');
    // păr din spate
    if(c.hair === 'long') o.push('<path d="M52 96C46 40 78 30 100 30C124 30 156 40 148 96C152 130 146 160 132 176L68 176C54 160 48 130 52 96Z" fill="url(#' + gid + 'h)"/>');
    if(c.hair === 'afro') o.push('<ellipse cx="100" cy="66" rx="60" ry="54" fill="url(#' + gid + 'h)"/>');
    if(c.hair === 'pony') o.push('<path d="M138 56C180 52 190 104 166 138C172 104 160 86 136 82Z" fill="url(#' + gid + 'h)"/>');
    if(c.hair === 'bun') o.push('<circle cx="100" cy="30" r="16" fill="url(#' + gid + 'h)"/>');
    if(c.hair === 'hpony') o.push('<path d="M92 36C98 6 146 2 162 38C174 68 168 102 152 124C158 96 152 70 138 54C126 44 108 40 92 36Z" fill="url(#' + gid + 'h)"/><path d="M104 30C110 24 122 26 126 34" stroke="' + hd + '" stroke-width="5" fill="none" stroke-linecap="round"/>');
    if(c.hair === 'wavy') o.push('<path d="M52 96C44 40 78 28 100 28C124 28 158 40 148 96C158 112 146 126 154 142C160 158 148 168 152 186L48 186C52 168 40 158 46 142C54 126 42 112 52 96Z" fill="url(#' + gid + 'h)"/>');
    if(c.hair === 'bob') o.push('<path d="M50 92C44 42 76 28 100 28C124 28 156 42 150 92C153 112 152 126 146 136Q143 141 136 141L64 141Q57 141 54 136C48 126 47 112 50 92Z" fill="url(#' + gid + 'h)"/>');
    if(full) o.push('</g><g transform="translate(31 0) scale(.69 1)">');
    if(c.top === 'hoodie' && !full) o.push('<path d="M60 152C52 118 74 110 100 110C126 110 148 118 140 152Z" fill="' + td + '"/>');
    // gât + umeri
    if(full){
      var wy = F ? 232 : 238, cy = F ? 258 : 264, wa = F ? 54 : 50, pH = F ? 'M54 232H146C148 236 149.5 240 150 246' : 'M50 238H150', pT = F ? 'L50 246C50.5 240 52 236 54 232Z' : 'Z';
      if(c.pants === 'jeans' || c.pants === 'jogger') o.push('<path d="' + pH + 'L149 304H104L100 ' + cy + 'L96 304H51' + pT + '" fill="' + pc + '"/><path d="M100 ' + (wy + 2) + 'V' + (cy - 2) + '" stroke="' + pd + '" stroke-width="3"/>' + (c.pants === 'jogger' ? '<rect x="49" y="292" width="49" height="12" rx="6" fill="' + pd + '"/><rect x="102" y="292" width="49" height="12" rx="6" fill="' + pd + '"/>' : '<path d="M60 252L61 296M140 252L139 296" stroke="' + pd + '" stroke-width="2" opacity=".6"/>'));
      if(c.pants === 'leggings') o.push('<path d="' + pH + 'L' + (F ? 144 : 146) + ' 304H' + (F ? 107 : 106) + 'L100 ' + cy + 'L' + (F ? 93 : 94) + ' 304H' + (F ? 56 : 54) + pT + '" fill="' + pc + '"/><path d="M100 ' + (wy + 2) + 'V' + (cy - 2) + '" stroke="' + pd + '" stroke-width="2.5"/><path d="M' + (wa + 6) + ' ' + (wy + 16) + 'L' + (F ? 61 : 59) + ' 300M' + (194 - wa) + ' ' + (wy + 16) + 'L' + (F ? 139 : 141) + ' 300" stroke="#fff" stroke-width="2.6" opacity=".3" fill="none"/><path d="M' + (F ? 58 : 56) + ' 296H' + (F ? 92 : 93) + 'M' + (F ? 108 : 107) + ' 296H' + (F ? 142 : 144) + '" stroke="' + pd + '" stroke-width="2" opacity=".6"/>');
      if(c.pants === 'shorts') o.push('<rect x="' + (F ? 58 : 56) + '" y="' + (wy + 30) + '" width="' + (F ? 35 : 38) + '" height="' + (276 - wy) + '" rx="14" fill="' + skin + '"/><rect x="' + (F ? 107 : 106) + '" y="' + (wy + 30) + '" width="' + (F ? 35 : 38) + '" height="' + (276 - wy) + '" rx="14" fill="' + skin + '"/><path d="' + pH + 'L149 ' + (wy + 38) + 'H104L100 ' + (wy + 22) + 'L96 ' + (wy + 38) + 'H51' + pT + '" fill="' + pc + '"/><path d="M100 ' + (wy + 2) + 'V' + (wy + 20) + '" stroke="' + pd + '" stroke-width="3"/>');
      if(c.pants === 'skirt') o.push('<rect x="62" y="' + (wy + 42) + '" width="32" height="' + (266 - wy) + '" rx="12" fill="' + skin + '"/><rect x="106" y="' + (wy + 42) + '" width="32" height="' + (266 - wy) + '" rx="12" fill="' + skin + '"/><path d="M' + wa + ' ' + wy + 'H' + (200 - wa) + 'L' + (216 - wa) + ' ' + (wy + 54) + 'H' + (wa - 16) + 'Z" fill="' + pc + '"/><path d="M' + wa + ' ' + wy + 'H' + (200 - wa) + '" stroke="' + pd + '" stroke-width="6"/>');
      var sc = SHOEC[c.shoec];
      o.push('<path d="M38 304C38 294 94 294 100 304V316C100 324 38 324 38 316Z" fill="' + sc + '"/><path d="M100 304C106 294 162 294 162 304V316C162 324 100 324 100 316Z" fill="' + sc + '"/><path d="M38 315H100M100 315H162" stroke="#000" stroke-opacity=".28" stroke-width="3.5"/><path d="M52 303L64 303M136 303L148 303" stroke="#000" stroke-opacity=".25" stroke-width="2.5"/>' +
        '<path d="M38 316C38 324 100 324 100 316V320C100 326 38 326 38 320Z" fill="#f4f4f4"/><path d="M100 316C100 324 162 324 162 316V320C162 326 100 326 100 320Z" fill="#f4f4f4"/>' +
        '<path d="M40 306C46 300 62 300 66 310L40 314Z" fill="' + (sc === '#111111' ? '#f4f4f4' : '#111') + '" opacity=".85"/><path d="M160 306C154 300 138 300 134 310L160 314Z" fill="' + (sc === '#111111' ? '#f4f4f4' : '#111') + '" opacity=".85"/>');
      var torso = F ? 'M46 190H154C154 204 144 212 140 220C139 228 147 234 149 242H51C53 234 61 228 60 220C56 212 46 204 46 190Z' : 'M34 190H166C166 214 156 232 151 248H49C44 232 34 214 34 190Z';
      var tankP = F ? 'M51 196H149C149 206 144 212 140 220C139 228 147 234 149 242H51C53 234 61 228 60 220C56 212 51 206 51 196Z' : 'M48 196H152C152 216 150 234 149 248H51C50 234 48 216 48 196Z';
      o.push('<path d="' + torso + '" fill="' + (bare ? skin : 'url(#' + gid + 't)') + '"/>');
      if(c.top === 'tank') o.push('<path d="' + tankP + '" fill="url(#' + gid + 't)"/>');
      if(c.top === 'crop'){ var ch = F ? 217 : 224;
        o.push('<clipPath id="' + gid + 'tk"><path d="' + tankP + '"/></clipPath><g clip-path="url(#' + gid + 'tk)"><rect x="30" y="190" width="140" height="' + (ch - 190) + '" fill="url(#' + gid + 't)"/><rect x="30" y="' + (ch - 5) + '" width="140" height="5" fill="' + td + '" opacity=".7"/></g>');
        o.push('<path d="M97.5 ' + (wy - 6) + 'q2.5 2.5 5 0" stroke="' + sd + '" stroke-width="1.6" fill="none" stroke-linecap="round" opacity=".8"/>');
        o.push('<path d="' + (F ? 'M54 232H146C148 236 149.5 240 150 244H50C50.5 240 52 236 54 232Z' : 'M50 238H150V250H50Z') + '" fill="' + pc + '"/><path d="M' + (wa + 1) + ' ' + (wy + 3) + 'H' + (199 - wa) + '" stroke="' + pd + '" stroke-width="2.5" opacity=".7"/>'); }
      if(c.top === 'hoodie') o.push('<rect x="' + (F ? 52 : 48) + '" y="' + wy + '" width="' + (F ? 96 : 104) + '" height="11" rx="5" fill="' + td + '"/><rect x="78" y="' + (wy - 26) + '" width="44" height="22" rx="9" fill="' + td + '" opacity=".55"/>');
      if(c.top === 'turtle' || c.top === 'tee' || c.top === 'shirt') o.push('<rect x="' + (F ? 53 : 49) + '" y="' + (wy + 4) + '" width="' + (F ? 94 : 102) + '" height="6" fill="' + td + '" opacity=".35"/>');
    }
    o.push('<rect x="' + (F ? 88 : 85) + '" y="120" width="' + (F ? 24 : 30) + '" height="40" rx="8" fill="' + sd + '"/>');
    o.push('<path d="' + (F ? 'M41 200C38 181 52 167 73 161C84 158 91 152 100 152C109 152 116 158 127 161C148 167 162 181 159 200Z' : 'M26 200C22 178 40 162 68 158C82 156 90 152 100 152C110 152 118 156 132 158C160 162 178 178 174 200Z') + '" fill="' + (bare ? skin : 'url(#' + gid + 't)') + '"/>');
    if(F) o.push('<ellipse cx="86" cy="182" rx="13" ry="7" fill="#fff" opacity=".08" filter="url(#' + gid + 'b2)"/>' + (full ? '<path d="M72 205Q85 212 99 207M101 207Q115 212 128 205" stroke="' + td + '" stroke-width="2.4" fill="none" opacity=".3" stroke-linecap="round" filter="url(#' + gid + 'b2)"/><ellipse cx="85" cy="201" rx="10" ry="5" fill="#fff" opacity=".08" filter="url(#' + gid + 'b2)"/><ellipse cx="115" cy="201" rx="10" ry="5" fill="#fff" opacity=".05" filter="url(#' + gid + 'b2)"/>' : ''));
    else o.push('<path d="M66 184Q84 200 100 188Q116 200 134 184" stroke="' + (bare ? sd : td) + '" stroke-width="2.2" fill="none" opacity=".4" stroke-linecap="round"/><ellipse cx="82" cy="180" rx="15" ry="7" fill="#fff" opacity=".1" filter="url(#' + gid + 'b2)"/><ellipse cx="118" cy="180" rx="15" ry="7" fill="#fff" opacity=".07" filter="url(#' + gid + 'b2)"/><ellipse cx="100" cy="196" rx="30" ry="4" fill="#000" opacity=".14" filter="url(#' + gid + 'b2)"/>');
    if(full && !F) o.push('<path d="M100 200V236M86 212H114M87 224H113" stroke="' + (c.top === 'tank' ? td : td) + '" stroke-width="1.6" fill="none" opacity="' + (c.top === 'tank' ? '.22' : '0') + '" stroke-linecap="round"/>');
    if(bare) o.push('<path d="' + (F ? 'M51 200C55 180 73 163 83 153C90 166 110 166 117 153C127 163 145 180 149 200Z' : 'M48 200C52 178 72 160 82 152C90 166 110 166 118 152C128 160 148 178 152 200Z') + '" fill="url(#' + gid + 't)"/><path d="M82 152C90 168 110 168 118 152Z" fill="' + sd + '"/>' + (c.top === 'crop' ? '<path d="M83 154C90 168 110 168 117 154" stroke="' + td + '" stroke-width="3" fill="none" stroke-linecap="round"/>' : ''));
    if(c.top === 'tee') o.push('<path d="M78 152C84 168 116 168 122 152Z" fill="' + sd + '"/>');
    if(c.top === 'hoodie') o.push('<path d="M80 152C88 172 112 172 120 152Z" fill="' + sd + '"/><path d="M90 168L88 188M110 168L112 188" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".85"/><path d="' + (F ? 'M68 162C65 174 63 187 62 200M132 162C135 174 137 187 138 200' : 'M62 158C60 172 58 186 57 200M138 158C140 172 142 186 143 200') + '" stroke="' + td + '" stroke-width="2" fill="none"/>');
    if(c.top === 'shirt') o.push('<path d="M82 152L100 180L118 152Z" fill="' + sd + '"/><path d="M78 150L100 182L122 150L112 148L100 166L88 148Z" fill="#fff"/><path d="M100 182L100 200" stroke="' + td + '" stroke-width="2"/><circle cx="100" cy="190" r="1.8" fill="' + td + '"/>');
    if(c.top === 'jacket') o.push('<path d="M82 152L100 200L118 152Z" fill="' + (tc === '#FFFFFF' ? '#d8d8d8' : '#f2f2f2') + '"/><path d="M82 152L100 200M118 152L100 200" stroke="' + td + '" stroke-width="3" fill="none"/><path d="M84 150L100 172L116 150" stroke="' + td + '" stroke-width="4" fill="none" stroke-linejoin="round"/>');
    if(c.top === 'turtle') o.push('<rect x="' + (F ? 83 : 80) + '" y="126" width="' + (F ? 34 : 40) + '" height="32" rx="12" fill="' + td + '"/><path d="' + (F ? 'M85 140H115M85 148H115' : 'M82 140H118M82 148H118') + '" stroke="' + tc + '" stroke-width="2" opacity=".5"/>');
    if(full){
      var longS = c.top === 'hoodie' || c.top === 'shirt' || c.top === 'jacket' || c.top === 'turtle';
      var armS = F ? '' : '<path d="M12 198C4 214 6 232 13 244C11 256 13 268 16 276L34 276C37 266 38 254 35 244C41 230 40 212 36 198C32 186 16 186 12 198Z" fill="' + skin + '"/><path d="M14 222Q22 232 34 224" stroke="' + sd + '" stroke-width="1.6" fill="none" opacity=".5"/><ellipse cx="20" cy="212" rx="5" ry="10" fill="#fff" opacity=".14" filter="url(#' + gid + 'b2)"/>' +
        '<path d="M14 274C10 286 14 298 25 299C35 299 39 288 36 274Z" fill="' + skin + '"/><path d="M34 279C39 281 40 289 36 292" stroke="' + sd + '" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M20 291V297M25 292V298M30 291V297" stroke="' + sd + '" stroke-width="1.2" opacity=".7"/>' +
        (!bare ? '<path d="' + (longS ? 'M10 198C2 214 4 232 11 244C9 256 11 268 14 277L36 277C39 266 40 254 37 244C43 230 42 212 38 198C33 184 15 184 10 198Z' : 'M10 198C4 208 4 218 7 226L40 226C42 216 41 206 38 198C33 184 15 184 10 198Z') + '" fill="url(#' + gid + 't)"/><ellipse cx="19" cy="210" rx="5" ry="9" fill="#fff" opacity=".12" filter="url(#' + gid + 'b2)"/>' : '') +
        (longS ? '<path d="M13 267H37V277C37 281 13 281 13 277Z" fill="' + td + '"/><path d="M12 240Q24 248 37 240" stroke="' + td + '" stroke-width="1.6" fill="none" opacity=".45"/>' : '') +
        '<ellipse cx="34" cy="236" rx="3" ry="30" fill="#000" opacity=".1" filter="url(#' + gid + 'b2)"/>';
      if(F){
        var fS = '<path d="' + (longS ? 'M26 198C22 212 23 228 26 240C25 250 26 259 28 267L46 267C48 258 49 249 48 240C50 228 50 212 48 198C44 185 30 185 26 198Z' : 'M26 198C23 205 23 212 24 220L50 220C51 212 50 205 48 198C44 185 30 185 26 198Z') + '" fill="url(#' + gid + 't)"/>';
        if(c.pose === 'cross'){
          var fu = '<g transform="translate(6.4 0) scale(.88 1)"><path d="M28 198C24 212 25 224 29 232L45 232C48 224 48 212 46 198C43 187 31 187 28 198Z" fill="' + skin + '"/>' + (bare ? '' : (longS ? '<path d="M26 198C22 212 23 224 27 234L47 234C50 224 50 212 48 198C44 185 30 185 26 198Z" fill="url(#' + gid + 't)"/>' : fS)) + '</g>';
          var gc = longS ? tc : skin, go = longS ? td : sd;
          o.push(fu + '<g transform="translate(200 0) scale(-1 1)">' + fu + '</g>');
          o.push('<path d="M161 228L84 216" stroke="' + go + '" stroke-width="20" stroke-linecap="round"/><path d="M161 228L84 216" stroke="' + gc + '" stroke-width="16.5" stroke-linecap="round"/><ellipse cx="77" cy="214.5" rx="10" ry="8.5" fill="' + skin + '"/><path d="M71 210q-4 4 0 9" stroke="' + sd + '" stroke-width="1.3" fill="none"/>');
          o.push('<path d="M39 228L116 211" stroke="' + go + '" stroke-width="20" stroke-linecap="round"/><path d="M39 228L116 211" stroke="' + gc + '" stroke-width="16.5" stroke-linecap="round"/><ellipse cx="123" cy="209.5" rx="10" ry="8.5" fill="' + skin + '"/><path d="M118 204l8 2.5M117 208.5l9 1.5M118 213l7 1" stroke="' + sd + '" stroke-width="1.1" fill="none"/>');
          o.push('<path d="M48 224Q74 216 104 211" stroke="#fff" stroke-width="2.4" opacity=".12" fill="none" stroke-linecap="round"/>');
          if(c.acc === 'watch') o.push('<g transform="rotate(-12 103 214)"><rect x="98.5" y="204" width="9" height="20" rx="2.5" fill="#111"/><circle cx="103" cy="214" r="6.2" fill="#1b1b1b" stroke="#888" stroke-width="1.3"/><path d="M103 214V210M103 214l2.4 1.6" stroke="#fff" stroke-width="1"/></g>');
        } else {
          var fa = '<g transform="translate(6.4 0) scale(.88 1)"><path d="M28 198C24 212 25 228 28 240C27 250 28 259 30 266L44 266C46 258 47 249 46 240C48 228 48 212 46 198C43 187 31 187 28 198Z" fill="' + skin + '"/><ellipse cx="33" cy="212" rx="4" ry="10" fill="#fff" opacity=".13" filter="url(#' + gid + 'b2)"/>' +
            '<path d="M29 264C26 275 29 286 37 287C45 287 47 277 45 264Z" fill="' + skin + '"/><path d="M44 269C48 271 48 278 45 281" stroke="' + sd + '" stroke-width="1.7" fill="none" stroke-linecap="round"/><path d="M33 280V285M37 281V286M41 280V285" stroke="' + sd + '" stroke-width="1.1" opacity=".7"/>' +
            (bare ? '' : fS + '<ellipse cx="32" cy="208" rx="4" ry="9" fill="#fff" opacity=".12" filter="url(#' + gid + 'b2)"/>') +
            (longS ? '<path d="M27 258H47V267C47 271 27 271 27 267Z" fill="' + td + '"/><path d="M27 236Q37 243 47 236" stroke="' + td + '" stroke-width="1.5" fill="none" opacity=".45"/>' : '') +
            '<ellipse cx="46" cy="230" rx="2.5" ry="26" fill="#000" opacity=".1" filter="url(#' + gid + 'b2)"/></g>';
          o.push(fa + '<g transform="translate(200 0) scale(-1 1)">' + fa + '</g>');
          if(c.acc === 'watch') o.push('<rect x="30" y="250" width="18" height="8" rx="3" fill="#111"/><circle cx="39" cy="254" r="6" fill="#1b1b1b" stroke="#888" stroke-width="1.4"/><path d="M39 254V250.5M39 254l2.4 1.5" stroke="#fff" stroke-width="1"/>');
        }
      } else if(c.pose === 'cross'){
        var up = '<path d="M12 198C4 214 6 232 14 246L36 246C41 230 40 212 36 198C32 186 16 186 12 198Z" fill="' + skin + '"/>' + (!bare ? '<path d="M10 198C2 214 ' + (longS ? '4 232 12 248L38 248C43 230 42 212 38 198' : '4 218 7 226L40 226C42 216 41 206 38 198') + 'C33 184 15 184 10 198Z" fill="url(#' + gid + 't)"/>' : '');
        var fc = longS ? tc : skin, fo = longS ? td : sd;
        o.push(up + '<g transform="translate(200 0) scale(-1 1)">' + up + '</g>');
        o.push('<path d="M176 238L74 224" stroke="' + fo + '" stroke-width="27" stroke-linecap="round"/><path d="M176 238L74 224" stroke="' + fc + '" stroke-width="23" stroke-linecap="round"/><ellipse cx="66" cy="222" rx="13" ry="11" fill="' + skin + '"/><path d="M58 216q-5 5 0 11" stroke="' + sd + '" stroke-width="1.5" fill="none"/>');
        o.push('<path d="M24 238L126 216" stroke="' + fo + '" stroke-width="27" stroke-linecap="round"/><path d="M24 238L126 216" stroke="' + fc + '" stroke-width="23" stroke-linecap="round"/><ellipse cx="134" cy="214" rx="13" ry="11" fill="' + skin + '"/><path d="M128 207l10 3M127 212l11 2M128 218l9 1" stroke="' + sd + '" stroke-width="1.3" fill="none"/>');
        o.push('<path d="M40 232Q70 222 110 216" stroke="#fff" stroke-width="3" opacity=".12" fill="none" stroke-linecap="round"/>');
        if(c.acc === 'watch') o.push('<g transform="rotate(-12 110 220)"><rect x="103" y="207" width="12" height="26" rx="3" fill="#111"/><circle cx="109" cy="220" r="8" fill="#1b1b1b" stroke="#888" stroke-width="1.5"/><path d="M109 220V215M109 220l3 2" stroke="#fff" stroke-width="1.2"/></g>');
      } else {
        o.push(armS + '<g transform="translate(200 0) scale(-1 1)">' + armS + '</g>');
        if(c.acc === 'watch') o.push('<rect x="11" y="258" width="26" height="9" rx="3" fill="#111"/><circle cx="24" cy="262.5" r="7" fill="#1b1b1b" stroke="#888" stroke-width="1.5"/><path d="M24 262.5V258.5M24 262.5l3 1.6" stroke="#fff" stroke-width="1.1"/>');
      }
      if(F) o.push('<ellipse cx="63" cy="218" rx="3" ry="16" fill="#000" opacity=".1" filter="url(#' + gid + 'b)"/><ellipse cx="137" cy="218" rx="3" ry="16" fill="#000" opacity=".14" filter="url(#' + gid + 'b)"/><ellipse cx="90" cy="196" rx="22" ry="8" fill="#fff" opacity=".06" filter="url(#' + gid + 'b)"/>' + (c.top === 'crop' ? '' : '<rect x="55" y="240" width="90" height="6" fill="#000" opacity=".25" filter="url(#' + gid + 'b2)"/>'));
      else if(c.top === 'crop') o.push('<ellipse cx="88" cy="204" rx="26" ry="12" fill="#fff" opacity=".07" filter="url(#' + gid + 'b)"/>');
      else o.push('<ellipse cx="50" cy="226" rx="4" ry="20" fill="#000" opacity=".1" filter="url(#' + gid + 'b)"/><ellipse cx="150" cy="226" rx="4" ry="20" fill="#000" opacity=".14" filter="url(#' + gid + 'b)"/><ellipse cx="88" cy="204" rx="26" ry="12" fill="#fff" opacity=".07" filter="url(#' + gid + 'b)"/><rect x="52" y="246" width="96" height="6" fill="#000" opacity=".25" filter="url(#' + gid + 'b2)"/>');
    }
    o.push('<ellipse cx="100" cy="157" rx="26" ry="6" fill="#000" opacity=".1"/>');
    if(F){ if(!bare) o.push('<path d="M54 183Q61 174 72 169M146 183Q139 174 128 169" stroke="' + td + '" stroke-width="2" fill="none" opacity=".3"/>'); }
    else o.push('<path d="M44 180Q54 168 66 163M156 180Q146 168 134 163" stroke="' + td + '" stroke-width="2" fill="none" opacity=".35"/><path d="M62 190Q66 200 60 200M138 190Q134 200 140 200" stroke="' + td + '" stroke-width="2" fill="none" opacity=".3"/>');
    if(full) o.push('</g><g transform="translate(100 148) scale(.66) translate(-100 -148)">');
    // cap + urechi
    o.push('<circle cx="58" cy="96" r="8" fill="' + skin + '"/><circle cx="142" cy="96" r="8" fill="' + skin + '"/><ellipse cx="59" cy="97" rx="3" ry="5" fill="' + sd + '" opacity=".55"/><ellipse cx="141" cy="97" rx="3" ry="5" fill="' + sd + '" opacity=".55"/>');
    o.push('<ellipse cx="100" cy="140" rx="24" ry="7" fill="#000" opacity=".13"/>');
    o.push('<path d="M57 86C57 56 78 41 100 41C122 41 143 56 143 86C143 112 127 137 100 141C73 137 57 112 57 86Z" fill="url(#' + gid + 's)"/>');
    o.push('<g clip-path="url(#' + gid + 'fc)">' +
      '<ellipse cx="56" cy="96" rx="11" ry="44" fill="' + mix(skin, -.42) + '" opacity=".42" filter="url(#' + gid + 'b)"/><ellipse cx="146" cy="96" rx="13" ry="46" fill="' + mix(skin, -.45) + '" opacity=".5" filter="url(#' + gid + 'b)"/>' +
      '<ellipse cx="100" cy="142" rx="34" ry="10" fill="' + mix(skin, -.45) + '" opacity=".45" filter="url(#' + gid + 'b)"/>' +
      '<ellipse cx="82" cy="85" rx="13" ry="6" fill="' + mix(skin, -.4) + '" opacity=".3" filter="url(#' + gid + 'b2)"/><ellipse cx="118" cy="85" rx="13" ry="6" fill="' + mix(skin, -.4) + '" opacity=".3" filter="url(#' + gid + 'b2)"/>' +
      '<ellipse cx="92" cy="62" rx="24" ry="10" fill="#fff" opacity=".2" filter="url(#' + gid + 'b)"/>' +
      '<ellipse cx="76" cy="106" rx="9" ry="5" fill="#fff" opacity=".13" filter="url(#' + gid + 'b2)"/><ellipse cx="124" cy="106" rx="8" ry="5" fill="#fff" opacity=".1" filter="url(#' + gid + 'b2)"/>' +
      '<ellipse cx="73" cy="112" rx="10" ry="6" fill="#ff5a5a" opacity=".13" filter="url(#' + gid + 'b2)"/><ellipse cx="127" cy="112" rx="10" ry="6" fill="#ff5a5a" opacity=".13" filter="url(#' + gid + 'b2)"/>' +
      '<ellipse cx="100" cy="134" rx="9" ry="3.5" fill="#fff" opacity=".12" filter="url(#' + gid + 'b2)"/><ellipse cx="100" cy="128.5" rx="9" ry="2.6" fill="' + mix(skin, -.5) + '" opacity=".3" filter="url(#' + gid + 'b2)"/></g>');
    if(c.face === 'freckles') o.push('<g fill="' + sd + '" opacity=".7"><circle cx="70" cy="106" r="1.6"/><circle cx="76" cy="110" r="1.6"/><circle cx="82" cy="106" r="1.6"/><circle cx="118" cy="106" r="1.6"/><circle cx="124" cy="110" r="1.6"/><circle cx="130" cy="106" r="1.6"/></g>');
    if(c.face === 'blush') o.push('<ellipse cx="70" cy="110" rx="11" ry="7" fill="#ff5c7a" opacity=".38"/><ellipse cx="130" cy="110" rx="11" ry="7" fill="#ff5c7a" opacity=".38"/>');
    if(c.face === 'mole') o.push('<circle cx="116" cy="112" r="2.4" fill="#3a2418"/>');
    // barbă
    if(c.beard === 'stubble') o.push('<path d="M60 100C60 142 140 142 140 100C132 128 68 128 60 100Z" fill="' + hd + '" opacity=".35"/>');
    if(c.beard === 'boxed') o.push('<path d="M58 100C58 146 142 146 142 100C140 110 136 118 128 123C120 127 110 126 100 126C90 126 80 127 72 123C64 118 60 110 58 100Z" fill="url(#' + gid + 'h)"/><path d="M90 127C92 137 108 137 110 127C104 130 96 130 90 127Z" fill="url(#' + gid + 'h)"/>');
    if(c.beard === 'beard') o.push('<path d="M57 98C52 152 148 152 143 98C136 128 120 134 100 134C80 134 64 128 57 98Z" fill="url(#' + gid + 'h)"/>');
    if(c.beard === 'goatee') o.push('<path d="M88 126C90 144 110 144 112 126C106 131 94 131 88 126Z" fill="url(#' + gid + 'h)"/>');
    if(c.beard === 'mustache' || c.beard === 'beard' || c.beard === 'goatee' || c.beard === 'boxed') o.push('<path d="M80 114C90 106 100 111 100 111C100 111 110 106 120 114C110 119 100 116 100 116C100 116 90 119 80 114Z" fill="url(#' + gid + 'h)"/>');
    // nas
    var nd = mix(skin, -.38);
    o.push('<path d="M96 86C94 96 92 102 91 106" stroke="' + nd + '" stroke-width="3.4" fill="none" stroke-linecap="round" opacity=".28" filter="url(#' + gid + 'b2)"/>' +
      '<ellipse cx="100.5" cy="98" rx="2.6" ry="8" fill="#fff" opacity=".2" filter="url(#' + gid + 'b2)"/><ellipse cx="100" cy="106" rx="4.4" ry="3.4" fill="#fff" opacity=".16" filter="url(#' + gid + 'b2)"/>' +
      '<path d="M91.5 108.5C89.5 105 91.5 102 94.5 103.5M108.5 108.5C110.5 105 108.5 102 105.5 103.5" stroke="' + nd + '" stroke-width="1.5" fill="none" stroke-linecap="round" opacity=".75"/>' +
      '<path d="M92 109C95 112.6 105 112.6 108 109C105 110.4 95 110.4 92 109Z" fill="' + mix(skin, -.5) + '" opacity=".8"/><ellipse cx="96" cy="109.6" rx="1.7" ry="1" fill="#2a1410" opacity=".7"/><ellipse cx="104" cy="109.6" rx="1.7" ry="1" fill="#2a1410" opacity=".7"/>' +
      '<ellipse cx="100" cy="114.5" rx="7" ry="2.4" fill="' + nd + '" opacity=".3" filter="url(#' + gid + 'b2)"/>');
    // gură
    var m = c.mouth, lip = mix('#c0504d', c.skin > 4 ? -.35 : 0), lipd = mix(lip, -.3);
    if(m === 'smile') o.push('<path d="M85 118.5Q93 115.5 100 118Q107 115.5 115 118.5Q100 127 85 118.5Z" fill="' + lipd + '"/><path d="M88 121.5Q100 133.5 112 121.5Q100 127.5 88 121.5Z" fill="' + lip + '"/><path d="M84.5 118.2Q100 127 115.5 118.2" stroke="#3a1614" stroke-width="1.5" fill="none" stroke-linecap="round"/><ellipse cx="100" cy="127.6" rx="5" ry="1.5" fill="#fff" opacity=".35" filter="url(#' + gid + 'b2)"/><path d="M83.5 117.5q-1.5 .5 -2 2M116.5 117.5q1.5 .5 2 2" stroke="' + nd + '" stroke-width="1.2" fill="none" opacity=".6"/>');
    if(m === 'grin') o.push('<path d="M82 115Q100 141 118 115Z" fill="#fff" stroke="' + lipd + '" stroke-width="3.4" stroke-linejoin="round"/><path d="M85 121H115" stroke="#ddd" stroke-width="1.2"/><path d="M88 129Q100 137 112 129Q100 133 88 129Z" fill="#c8605e" opacity=".55"/>');
    if(m === 'neutral') o.push('<path d="M88 121.5Q94 117.5 100 120Q106 117.5 112 121.5Q100 124 88 121.5Z" fill="' + lipd + '"/><path d="M89.5 122.2Q100 131 110.5 122.2Q100 125 89.5 122.2Z" fill="' + lip + '"/><path d="M88 121.8Q100 124 112 121.8" stroke="#3a1614" stroke-width="1.4" fill="none" stroke-linecap="round"/><ellipse cx="100" cy="126" rx="4.5" ry="1.4" fill="#fff" opacity=".35" filter="url(#' + gid + 'b2)"/>');
    if(m === 'smirk') o.push('<path d="M86 122Q104 128 116 114" stroke="' + lipd + '" stroke-width="2.8" fill="none" stroke-linecap="round"/><path d="M86 122Q104 128 116 114" stroke="' + ink + '" stroke-width="1.2" fill="none" stroke-linecap="round"/>');
    if(m === 'open') o.push('<ellipse cx="100" cy="123" rx="9" ry="10" fill="#4a1414" stroke="' + lipd + '" stroke-width="3.4"/><ellipse cx="100" cy="130" rx="5" ry="3.4" fill="#d9605c"/><path d="M93 117H107" stroke="#fff" stroke-width="2.6" stroke-linecap="round" opacity=".9"/>');
    // ochi
    var ec = EYEC[c.eyec];
    function eye(x, kind){
      if(kind === 'happy') return '<path d="M' + (x - 9) + ' 95Q' + x + ' 82 ' + (x + 9) + ' 95" stroke="' + ink + '" stroke-width="3.4" fill="none" stroke-linecap="round"/><path d="M' + (x - 8) + ' 98Q' + x + ' 104 ' + (x + 8) + ' 98" stroke="' + sd + '" stroke-width="1.6" fill="none" opacity=".5"/>';
      var up = kind === 'narrow' ? 87.6 : 84.6, lo = kind === 'narrow' ? 96.4 : 99, ir = kind === 'narrow' ? 4.4 : 5.4, cid = gid + 'e' + x;
      var shape = 'M' + (x - 10) + ' 92.6Q' + x + ' ' + up + ' ' + (x + 10) + ' 92.6Q' + x + ' ' + lo + ' ' + (x - 10) + ' 92.6Z';
      return '<clipPath id="' + cid + '"><path d="' + shape + '"/></clipPath>' +
        '<path d="' + shape + '" fill="#f6f3ee"/>' +
        '<g clip-path="url(#' + cid + ')"><circle cx="' + x + '" cy="91.8" r="' + ir + '" fill="' + ec + '"/><circle cx="' + x + '" cy="91.8" r="' + ir + '" fill="none" stroke="' + mix(ec, -.5) + '" stroke-width="1.4"/>' +
        '<path d="M' + (x - ir + 1.2) + ' 93Q' + x + ' ' + (91.8 + ir - .4) + ' ' + (x + ir - 1.2) + ' 93" stroke="' + mix(ec, .5) + '" stroke-width="1.5" fill="none" opacity=".75"/>' +
        '<circle cx="' + x + '" cy="91.8" r="2.3" fill="#0b0b0b"/><circle cx="' + (x + 1.9) + '" cy="89.9" r="1.5" fill="#fff"/><circle cx="' + (x - 1.8) + '" cy="93.6" r=".8" fill="#fff" opacity=".65"/>' +
        '<ellipse cx="' + x + '" cy="' + (up + 1.5) + '" rx="11" ry="3.6" fill="#000" opacity=".3" filter="url(#' + gid + 'b2)"/><circle cx="' + (x < 100 ? x + 9 : x - 9) + '" cy="93" r="1.6" fill="#e9a3a0" opacity=".7"/></g>' +
        '<path d="M' + (x - 10.5) + ' 93Q' + x + ' ' + (up - 1) + ' ' + (x + 10.5) + ' 93" stroke="' + ink + '" stroke-width="2.3" fill="none" stroke-linecap="round"/>' +
        '<path d="M' + (x < 100 ? (x - 10.5) + ' 93l-2.6 -1.6' : (x + 10.5) + ' 93l2.6 -1.6') + '" stroke="' + ink + '" stroke-width="1.6" stroke-linecap="round"/>' +
        '<path d="M' + (x - 8.5) + ' ' + (up - 1.4) + 'Q' + x + ' ' + (up - 6) + ' ' + (x + 8.5) + ' ' + (up - 1.4) + '" stroke="' + nd + '" stroke-width="1.1" fill="none" opacity=".55"/>' +
        '<path d="M' + (x - 8) + ' ' + (lo - 2.6) + 'Q' + x + ' ' + (lo + .8) + ' ' + (x + 8) + ' ' + (lo - 2.6) + '" stroke="' + nd + '" stroke-width="1" fill="none" opacity=".5"/>';
    }
    o.push(eye(82, c.eyes === 'wink' ? 'round' : c.eyes));
    o.push(eye(118, c.eyes === 'wink' ? 'happy' : c.eyes));
    // sprâncene
    var bc = c.hair === 'bald' ? sd : hd, B = c.brows;
    function brow(x1, x2, y, lift, w, tilt){ var m = (x1 + x2) / 2; return '<path d="M' + x1 + ' ' + (y + tilt) + 'Q' + m + ' ' + (y - lift) + ' ' + x2 + ' ' + (y - tilt) + 'Q' + m + ' ' + (y - lift + w) + ' ' + x1 + ' ' + (y + tilt + w * .7) + 'Z" fill="' + bc + '"/>'; }
    if(B === 'normal') o.push(brow(70, 94, 78, 6, 3.2, 1) + brow(130, 106, 78, 6, 3.2, 1));
    if(B === 'thick') o.push(brow(69, 94, 78, 7, 6, 1) + brow(131, 106, 78, 7, 6, 1));
    if(B === 'angry') o.push(brow(70, 94, 74, 1, 4.4, -3) + brow(130, 106, 74, 1, 4.4, -3));
    if(B === 'raised') o.push(brow(71, 93, 70, 7, 3.2, 1) + brow(129, 107, 70, 7, 3.2, 1));
    // ochelari
    if(c.glasses === 'round') o.push('<g fill="rgba(180,220,255,.15)" stroke="#222" stroke-width="3"><circle cx="82" cy="92" r="14"/><circle cx="118" cy="92" r="14"/></g><path d="M96 92H104M68 90L58 86M132 90L142 86" stroke="#222" stroke-width="3" fill="none"/>');
    if(c.glasses === 'square') o.push('<g fill="rgba(180,220,255,.15)" stroke="#222" stroke-width="3"><rect x="66" y="80" width="30" height="24" rx="5"/><rect x="104" y="80" width="30" height="24" rx="5"/></g><path d="M96 90H104M66 88L58 86M134 88L142 86" stroke="#222" stroke-width="3" fill="none"/>');
    if(c.glasses === 'sun') o.push('<g fill="#111" stroke="#111" stroke-width="3" stroke-linejoin="round"><path d="M64 82H98V96C98 104 90 106 82 106C72 106 64 102 64 94Z"/><path d="M102 82H136V94C136 102 128 106 118 106C110 106 102 104 102 96Z"/></g><path d="M98 86H102M64 86L58 84M136 86L142 84" stroke="#111" stroke-width="3" fill="none"/><path d="M70 86L78 86M108 86L116 86" stroke="#fff" stroke-width="2" opacity=".35"/>');
    // păr față
    var h = c.hair;
    if(h === 'afro') o.push('<path d="M58 88C54 54 80 40 100 40C122 40 146 54 142 88C134 68 120 60 100 62C80 64 66 70 58 88Z" fill="url(#' + gid + 'h)"/>');
    if(h === 'pony' || h === 'hpony') o.push('<path d="M57 90C52 48 80 33 100 33C124 33 150 48 143 90C138 70 124 60 100 61C76 61 62 70 57 90Z" fill="url(#' + gid + 'h)"/>');
    if(h === 'side') o.push('<path d="M57 92C50 50 82 32 108 34C136 36 150 58 143 92C142 72 134 58 112 56C94 56 78 62 70 80C68 84 64 90 57 92Z" fill="url(#' + gid + 'h)"/><path d="M66 78C84 60 106 54 124 56" stroke="' + hd + '" stroke-width="2.5" fill="none" opacity=".5"/>');
    if(h === 'fade') o.push('<path d="M59 86C58 62 64 50 72 46L128 46C136 50 142 62 141 86C138 72 134 64 128 60L72 60C66 64 62 72 59 86Z" fill="' + hc + '" opacity=".38"/><path d="M66 60C62 40 82 30 100 30C120 30 138 40 134 60C126 52 114 56 106 52C98 58 88 52 80 58C74 56 70 58 66 60Z" fill="url(#' + gid + 'h)"/><path d="M70 44q6 -8 12 -2q5 -9 12 -2q6 -8 12 0q6 -7 11 1q5 -4 8 3" stroke="' + hd + '" stroke-width="2" fill="none" opacity=".6"/>');
    if(h === 'buzz') o.push('<path d="M60 82C60 52 80 42 100 42C120 42 140 52 140 82C132 64 118 58 100 58C82 58 68 64 60 82Z" fill="url(#' + gid + 'h)"/>');
    if(h === 'short' || h === 'bun') o.push('<path d="M57 90C52 48 80 33 100 33C124 33 150 48 143 90C138 70 124 60 100 61C76 61 62 70 57 90Z" fill="url(#' + gid + 'h)"/>');
    if(h === 'quiff') o.push('<path d="M56 90C50 48 76 32 104 33C132 33 150 52 144 90C140 66 126 56 108 56C94 52 78 58 72 70C68 76 62 84 56 90Z" fill="url(#' + gid + 'h)"/><path d="M80 46C86 20 122 22 130 40C116 34 98 36 80 46Z" fill="url(#' + gid + 'h)"/>');
    if(h === 'long') o.push('<path d="M56 96C50 52 78 36 100 36C124 36 150 52 144 96C140 70 124 58 100 62C80 66 66 74 56 96Z" fill="url(#' + gid + 'h)"/>');
    if(h === 'wavy') o.push('<path d="M55 98C48 52 78 34 100 34C124 34 152 52 145 98C143 76 128 58 101 50C74 58 58 76 55 98Z" fill="url(#' + gid + 'h)"/><path d="M101 36V50" stroke="' + hd + '" stroke-width="1.6" opacity=".55"/>');
    if(h === 'bob') o.push('<path d="M55 96C49 52 78 34 100 34C124 34 151 52 145 96C142 78 134 66 118 60C100 70 72 72 55 96Z" fill="url(#' + gid + 'h)"/><path d="M52 94C49 110 51 126 58 138C63 124 62 108 58 92Z" fill="url(#' + gid + 'h)"/><path d="M148 94C151 110 149 126 142 138C137 124 138 108 142 92Z" fill="url(#' + gid + 'h)"/>');
    if(h === 'curly') o.push('<g fill="url(#' + gid + 'h)"><circle cx="62" cy="72" r="14"/><circle cx="72" cy="52" r="15"/><circle cx="92" cy="42" r="15"/><circle cx="112" cy="42" r="15"/><circle cx="130" cy="52" r="15"/><circle cx="140" cy="72" r="14"/><path d="M60 82C60 56 80 50 100 50C120 50 140 56 140 82C132 66 118 62 100 62C82 62 68 66 60 82Z"/></g>');
    if(h === 'mohawk') o.push('<path d="M90 60C86 34 92 12 100 12C108 12 114 34 110 60C104 56 96 56 90 60Z" fill="url(#' + gid + 'h)"/><path d="M60 82C62 62 76 56 90 58L110 58C124 56 138 62 140 82C130 68 118 62 100 62C82 62 70 68 60 82Z" fill="' + hc + '" opacity=".45"/>');
    if(h !== 'bald' && h !== 'mohawk') o.push('<path d="M74 52Q100 38 128 52" stroke="#fff" stroke-opacity=".2" stroke-width="3.2" fill="none" stroke-linecap="round"/>');
    if(h !== 'bald') o.push('<path d="M62 78C74 66 126 66 138 78C126 72 74 72 62 78Z" fill="#000" opacity=".07"/>');
    // accesorii
    var A = c.acc;
    if(A === 'cap') o.push('<path d="M55 80C55 38 145 38 145 80Z" fill="' + ac + '"/><path d="M118 74C150 72 172 80 174 88C152 90 132 88 116 84Z" fill="' + mix(ac, -.2) + '"/><path d="M100 40V80" stroke="' + mix(ac, -.2) + '" stroke-width="2" opacity=".5"/>');
    if(A === 'beanie') o.push('<path d="M53 80C53 28 147 28 147 80Z" fill="' + ac + '"/><rect x="50" y="66" width="100" height="18" rx="9" fill="' + mix(ac, -.2) + '"/><circle cx="100" cy="28" r="8" fill="' + mix(ac, .25) + '"/>');
    if(A === 'phones') o.push('<path d="M54 92C48 30 152 30 146 92" stroke="#1b1b1b" stroke-width="7" fill="none" stroke-linecap="round"/><rect x="46" y="84" width="14" height="28" rx="7" fill="' + ac + '" stroke="#1b1b1b" stroke-width="2"/><rect x="140" y="84" width="14" height="28" rx="7" fill="' + ac + '" stroke="#1b1b1b" stroke-width="2"/>');
    if(A === 'band') o.push('<path d="M57 68C80 56 120 56 143 68L143 77C120 66 80 66 57 77Z" fill="' + ac + '"/>');
    if(A === 'chain') o.push('<path d="M78 156C88 182 112 182 122 156" stroke="#f5c542" stroke-width="3.5" fill="none" stroke-linecap="round"/><circle cx="100" cy="177" r="5" fill="#f5c542"/>');
    if(A === 'ear') o.push('<circle cx="58" cy="108" r="3.6" fill="#f5c542"/><circle cx="142" cy="108" r="3.6" fill="#f5c542"/>');
    if(full) o.push('</g></g>');
    o.push('</svg>');
    var out = o.join(''), re = new RegExp('<(path|ellipse|circle)([^>]*?) fill="url\\(#' + gid + 'h\\)"/>', 'g');
    return out.replace(re, function(m, tag, rest){ return m + '<' + tag + rest + ' fill="url(#' + gid + 'hp)"/>'; });
  }

  function load(){ try{ return norm(JSON.parse(localStorage.getItem(KEY) || 'null') || DEF); }catch(e){ return norm(DEF); } }
  function save(c){ try{ localStorage.setItem(KEY, JSON.stringify(c)); }catch(e){} try{ if(window.__byzypDb) window.__byzypDb.doc('settings/avatar').set({ cfg: c }); }catch(e){} }
  function toJpeg(c){ return new Promise(function(res, rej){
    var im = new Image(); im.onload = function(){ var cv = document.createElement('canvas'); cv.width = cv.height = 256; cv.getContext('2d').drawImage(im, 0, 0, 256, 256); try{ var q = .88, d = cv.toDataURL('image/jpeg', q); while(d.length > 38000 && q > .3){ q -= .1; d = cv.toDataURL('image/jpeg', q); } res(d); }catch(e){ rej(e); } };
    im.onerror = rej; im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg(c, 256)); }); }

  var TABS = [['body','🧍 Corp'],['skin','🧑 Piele'],['hair','💇 Păr'],['hairc','🎨 Culoare păr'],['eyes','👀 Ochi'],['eyec','🔵 Culoare ochi'],['brows','🤨 Sprâncene'],['mouth','👄 Gură'],['beard','🧔 Barbă'],['glasses','🕶️ Ochelari'],['face','✨ Față'],['top','👕 Bluză'],['topc','🎨 Culoare bluză'],['pants','👖 Pantaloni'],['pantc','🎨 Culoare pantaloni'],['shoec','👟 Pantofi'],['pose','🧍 Poziție'],['acc','🧢 Accesorii'],['accc','🎨 Culoare accesoriu'],['bg','🖼️ Culoare fundal'],['scene','🌄 Decor / poza ta']];
  var PAL = { skin: SKIN, hairc: HAIRC, eyec: EYEC, topc: TOPC, accc: TOPC, bg: BGC, pantc: PANTC, shoec: SHOEC };

  function ensureCss(){ if(document.getElementById('av-css')) return; var st = document.createElement('style'); st.id = 'av-css'; st.textContent = "  .av-ov{ position:fixed; inset:0; z-index:5000; background:rgba(0,0,0,.82); display:flex; align-items:flex-end; justify-content:center; }   .av-box{ width:100%; max-width:520px; max-height:94vh; overflow-y:auto; background:var(--bg-card,#101410); border:1px solid var(--line); border-radius:24px 24px 0 0; padding:14px 14px calc(18px + env(safe-area-inset-bottom)); }   .av-top{ display:flex; justify-content:space-between; align-items:center; font-size:17px; } .av-x{ background:none; border:none; color:var(--text); font-size:20px; padding:6px 10px; }   .av-prev{ width:150px; height:248px; border-radius:26px; overflow:hidden; margin:8px auto 10px; border:3px solid var(--gold,#A3FF12); } .av-prev svg{ display:block; }   .av-tabs{ display:flex; gap:6px; overflow-x:auto; padding:4px 0 8px; } .av-tab{ flex:none; background:var(--bg-card-2); color:var(--text); border:1px solid var(--line); border-radius:999px; padding:7px 12px; font:inherit; font-size:12.5px; font-weight:700; white-space:nowrap; } .av-tab.on{ background:var(--gold,#A3FF12); color:#000; border-color:transparent; }   .av-opts{ display:flex; flex-wrap:wrap; gap:8px; justify-content:center; min-height:84px; padding:4px 0; }   .av-op{ display:flex; flex-direction:column; align-items:center; gap:3px; background:var(--bg-card-2); border:2px solid transparent; border-radius:14px; padding:6px; color:var(--text); font:inherit; font-size:11px; width:78px; } .av-op svg{ border-radius:50%; } .av-op.fl svg{ border-radius:12px; } .av-op.on{ border-color:var(--gold,#A3FF12); }   .av-sw{ width:42px; height:42px; border-radius:50%; border:3px solid transparent; box-shadow:0 0 0 1px var(--line); } .av-sw.on{ border-color:#fff; box-shadow:0 0 0 3px var(--gold,#A3FF12); }   .av-act{ display:flex; gap:10px; margin-top:12px; } .av-act button{ flex:1; border-radius:14px; padding:13px; font:inherit; font-weight:800; border:1px solid var(--line); background:var(--bg-card-2); color:var(--text); } .av-act .av-ok{ background:var(--gold,#A3FF12); color:#000; border:none; }   .av-photo{ width:100%; text-align:center; margin-top:6px; } .av-photo button{ background:var(--bg-card-2); color:var(--text); border:1px solid var(--line); border-radius:999px; padding:9px 16px; margin:4px; font:inherit; font-weight:700; font-size:13px; } .av-hint{ margin-top:10px; font-size:12px; color:var(--text-faint); text-align:center; } "; document.head.appendChild(st); }
  function open(done){
    ensureCss();
    var oldOv = document.querySelector('.av-ov'); if(oldOv) oldOv.remove();   // niciodată două ferestre una peste alta
    var cfg = load(), tab = 'top', isNew = !window.zAvatar.has();
    if(isNew){ tab = 'body'; try{ var nu = JSON.parse(localStorage.getItem('reset_nutri_v1') || 'null'); if(nu && nu.sex === 'f') cfg.body = 'f'; }catch(e){} }
    var ov = document.createElement('div'); ov.className = 'av-ov';
    ov.innerHTML = '<div class="av-box"><div class="av-top"><b>🧑‍🎨 Avatarul tău</b><button class="av-x" aria-label="Închide">✕</button></div><div class="av-prev"></div><div class="av-tabs"></div><div class="av-opts"></div><div class="av-act"><button class="av-rnd">🎲 Aleator</button><button class="av-ok">✅ Gata</button></div><div class="av-hint">Avatarul devine poza ta de profil și apare în clasament, chat și pe hartă.</div></div>';
    document.body.appendChild(ov);
    var $ = function(s){ return ov.querySelector(s); };
    function prev(){ $('.av-prev').innerHTML = svg(cfg, 150, 'full'); }
    function tabs(){ var h = ''; TABS.forEach(function(t){ h += '<button class="av-tab' + (t[0] === tab ? ' on' : '') + '" data-t="' + t[0] + '">' + t[1] + '</button>'; }); $('.av-tabs').innerHTML = h; }
    function opts(){ var h = '';
      if(PAL[tab]) PAL[tab].forEach(function(col, i){ h += '<button class="av-sw' + (cfg[tab] === i ? ' on' : '') + '" data-i="' + i + '" style="background:' + (Array.isArray(col) ? 'linear-gradient(' + col[0] + ',' + col[1] + ')' : col) + '" aria-label="Culoare ' + (i + 1) + '"></button>'; });
      else OPT[tab].forEach(function(p){ var t = JSON.parse(JSON.stringify(cfg)); t[tab] = p[0]; var fl = (tab === 'pants' || tab === 'top' || tab === 'body' || tab === 'pose'); h += '<button class="av-op' + (cfg[tab] === p[0] ? ' on' : '') + (fl ? ' fl' : '') + '" data-v="' + p[0] + '">' + svg(t, fl ? 54 : 62, fl ? 'full' : '') + '<span>' + p[1] + '</span></button>'; });
      if(tab === 'scene') h += '<div class="av-photo"><button class="av-pick">📷 Alege poza ta ca fundal</button>' + (photo() ? '<button class="av-pdel">🗑 Șterge poza</button>' : '') + '<input type="file" accept="image/*" class="av-file" style="display:none"><div class="av-hint" style="margin-top:6px">Poza rămâne doar la tine în telefon și se vede în spatele avatarului.</div></div>';
      $('.av-opts').innerHTML = h; }
    function all(){ prev(); tabs(); opts(); }
    all();
    ov.addEventListener('change', function(e){
      var f = e.target.closest('.av-file') && e.target.files && e.target.files[0]; if(!f) return;
      var fr = new FileReader(); fr.onload = function(){ var im = new Image(); im.onload = function(){
        var cv = document.createElement('canvas'); cv.width = 400; cv.height = 660; var g = cv.getContext('2d'), k = Math.max(400 / im.width, 660 / im.height), w = im.width * k, h = im.height * k;
        g.drawImage(im, (400 - w) / 2, (660 - h) / 2, w, h);
        var q = .74, d = cv.toDataURL('image/jpeg', q); while(d.length > 180000 && q > .3){ q -= .12; d = cv.toDataURL('image/jpeg', q); }
        try{ localStorage.setItem(PKEY, d); cfg.scene = 'photo'; all(); }catch(x){ alert('Poza e prea mare pentru telefon. Alege alta.'); }
      }; im.onerror = function(){ alert('Nu am putut citi poza. Alege altă poză.'); }; im.src = fr.result; }; fr.onerror = function(){ alert('Nu am putut citi poza. Alege altă poză.'); }; fr.readAsDataURL(f); });
    ov.addEventListener('click', function(e){
      var t = e.target.closest('[data-t]'); if(t){ tab = t.getAttribute('data-t'); tabs(); opts(); return; }
      var s = e.target.closest('.av-sw'); if(s){ cfg[tab] = +s.getAttribute('data-i'); cfg = norm(cfg); prev(); opts(); return; }
      var p = e.target.closest('.av-op'); if(p){ cfg[tab] = p.getAttribute('data-v'); if(tab === 'scene' && cfg.scene === 'photo' && !photo()){ cfg.scene = 'none'; opts(); $('.av-file').click(); return; } cfg = norm(cfg); prev(); opts(); return; }
      if(e.target.closest('.av-x')){ ov.remove(); return; }
      if(e.target.closest('.av-pick')){ $('.av-file').click(); return; }
      if(e.target.closest('.av-pdel')){ try{ localStorage.removeItem(PKEY); }catch(x){} if(cfg.scene === 'photo') cfg.scene = 'none'; all(); return; }
      if(e.target.closest('.av-rnd')){ var r = function(n){ return Math.floor(Math.random() * n); }, fem = cfg.body === 'f';
        var pick = function(k, pref, no){ var l = OPT[k].map(function(x){ return x[0]; }); if(fem){ if(Math.random() < .75) l = pref; } else l = l.filter(function(x){ return no.indexOf(x) < 0; }); return l[r(l.length)]; };
        cfg = norm({ body: cfg.body, skin: r(SKIN.length), hair: pick('hair', ['pony','long','bun','curly','hpony','wavy','bob'], ['hpony','wavy','bob']), hairc: r(HAIRC.length), eyes: OPT.eyes[r(OPT.eyes.length)][0], eyec: r(EYEC.length), brows: OPT.brows[r(OPT.brows.length)][0], mouth: OPT.mouth[r(OPT.mouth.length)][0], beard: !fem && Math.random() < .35 ? OPT.beard[r(OPT.beard.length)][0] : 'none', glasses: Math.random() < .3 ? OPT.glasses[r(OPT.glasses.length)][0] : 'none', top: pick('top', ['crop','crop','tank','tee','hoodie'], ['crop']), topc: r(TOPC.length), acc: Math.random() < .4 ? OPT.acc[r(OPT.acc.length)][0] : 'none', accc: r(TOPC.length), bg: r(BGC.length), pants: pick('pants', ['leggings','leggings','shorts','skirt','jogger'], ['leggings','skirt']), pantc: r(PANTC.length), shoec: r(SHOEC.length), pose: cfg.pose, scene: Math.random() < .6 ? OPT.scene.filter(function(x){ return x[0] !== 'photo'; })[r(OPT.scene.length - 1)][0] : 'none', face: Math.random() < .3 ? OPT.face[r(OPT.face.length)][0] : 'none' }); all(); return; }
      var okb = e.target.closest('.av-ok'); if(okb){ if(okb.disabled) return; okb.disabled = true; cfg = norm(cfg); save(cfg); toJpeg(cfg).then(function(d){ ov.remove(); if(done) done(d, cfg); }).catch(function(){ okb.disabled = false; alert('Nu am putut crea poza. Încearcă din nou.'); }); }
    });
  }
  window.zAvatar = { photo: photo, svg: svg, open: open, load: load, norm: norm, has: function(){ try{ return !!localStorage.getItem(KEY); }catch(e){ return false; } } };
})();
