/* By ZyP · Comunitate: clasament + chat global. Toate datele trec prin funcții Supabase (vezi community.sql). */
(function(){
  'use strict';
  var esc = window.zEsc || function(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); };
  var root = document.getElementById('topRoot'); if(!root) return;
  var TIERS = [[1,'Începător','#9aa3a0'],[4,'Bronz','#cd7f32'],[7,'Argint','#c9d3dc'],[11,'Aur','#ffd24a'],[16,'Platină','#5ee0e8'],[23,'Diamant','#6aa8ff'],[35,'Legendă','#ff5d8f']];
  function tier(lv){ lv = +lv || 1; var t = TIERS[0]; for(var i=0;i<TIERS.length;i++) if(lv >= TIERS[i][0]) t = TIERS[i]; return t; }
  function lvOf(score){ return Math.floor(Math.sqrt(Math.max(score,0)/25)) + 1; }
  function emblem(lv, px){
    var c = tier(lv)[2];
    return '<svg viewBox="0 0 48 56" width="'+px+'" height="'+Math.round(px*56/48)+'" aria-hidden="true">' +
      '<path d="M24 2 L44 10 V28 C44 42 34 51 24 54 C14 51 4 42 4 28 V10 Z" fill="#0b121b" stroke="'+c+'" stroke-width="3"/>' +
      '<path d="M24 9 L38 15 V28 C38 38 31 45 24 48 C17 45 10 38 10 28 V15 Z" fill="'+c+'" opacity=".2"/>' +
      '<text x="24" y="34" text-anchor="middle" font-size="'+(lv>99?14:18)+'" font-weight="800" fill="'+c+'" font-family="Inter,sans-serif">'+lv+'</text></svg>';
  }
  function toast(m){ if(window.zToast) window.zToast(m); }
  // mesaj pe înțeles: serverul vechi (funcție lipsă), fără internet, sesiune expirată; altfel textul trimis de server
  function errMsg(e){
    var m = String((e && e.message) || ''), c = String((e && e.code) || '');
    if(c === 'PGRST202' || c === '42883' || c === '42501' || c === '42P01' || c === '42703' || /could not find the function|does not exist|schema cache|permission denied/i.test(m)) return 'Partea asta nu e încă pornită pe server. Încearcă mai târziu.';
    if(/failed to fetch|networkerror|load failed|network request failed|timeout|timed out/i.test(m)) return 'Nu există conexiune la internet. Încearcă din nou.';
    if(c === 'PGRST301' || /jwt/i.test(m)) return 'Sesiunea a expirat. Ieși din cont și intră din nou.';
    if(!m || (typeof Error !== 'undefined' && (e instanceof TypeError || e instanceof ReferenceError || e instanceof RangeError || e instanceof SyntaxError))) return 'Ceva nu a mers. Încearcă din nou.';
    m = m.replace(/^.*?:\s*/, ''); return m.charAt(0).toUpperCase() + m.slice(1); }
  function num(v){ v = +v; return isFinite(v) ? Math.round(v) : 0; }
  function rpc(name, args){ var sb = window.__sb; if(!sb) return Promise.reject(new Error('Intră mai întâi în cont')); return sb.rpc(name, args||{}).then(function(r){ if(r.error) throw r.error; return r.data; }); }
  // dacă serverul are încă funcția veche (fără parametrul nou), mai încearcă o dată fără el
  function rpcOpt(name, args, key){
    return rpc(name, args).catch(function(e){
      if(!(key in args) || !e || !(e.code === 'PGRST202' || /could not find the function/i.test(e.message || ''))) throw e;
      var a = {}, k; for(k in args) if(k !== key) a[k] = args[k];
      return rpc(name, a); }); }
  function stats(){ try{ return window.__zStats ? window.__zStats() : {score:0,streak:0}; }catch(e){ return {score:0,streak:0}; } }

  var me = null, board = null, seg = 'rank', lastId = 0, chatGen = 0, chatTimer = null, scoreTimer = null, isAdmin = false, loaded = false, busy = false, period = 'week', thumbTried = false;
  var blocked = []; try{ blocked = JSON.parse(localStorage.getItem('zyp_blocked')||'[]')||[]; }catch(e){}
  function saveBlocked(){ try{ localStorage.setItem('zyp_blocked', JSON.stringify(blocked.slice(-200))); }catch(e){} }
  function active(){ var v = document.getElementById('view-top'); return !!(v && v.classList.contains('active')); }


  // ---------- avatare ----------
  var AV_RE = /^data:image\/jpeg;base64,[A-Za-z0-9+\/=]+$/;
  var AVC = Object.create(null), AVQ = Object.create(null), avObs = null;
  function avFetch(nick){
    var k = nick.toLowerCase(); if(AVC[k] !== undefined) return Promise.resolve(AVC[k]); if(AVQ[k]) return AVQ[k];
    AVQ[k] = rpc('get_public_profile', { p_nick: nick }).then(function(p){ AVC[k] = (p && p.avatar && AV_RE.test(p.avatar)) ? p.avatar : ''; delete AVQ[k]; return AVC[k]; }).catch(function(){ AVC[k] = ''; delete AVQ[k]; return ''; });
    return AVQ[k]; }
  function avPaint(el){ var n = el.getAttribute('data-av'); if(!n || el.getAttribute('data-done')) return; el.setAttribute('data-done', '1');
    avFetch(n).then(function(a){ if(a && el.isConnected){ var im = document.createElement('img'); im.alt = ''; im.src = a; el.textContent = ''; el.appendChild(im); } }); }
  function avHydrate(scope){
    var els = (scope || root).querySelectorAll('.sn-av[data-av]:not([data-done])');
    if(!('IntersectionObserver' in window)){ for(var i = 0; i < Math.min(els.length, 30); i++) avPaint(els[i]); return; }
    if(!avObs) avObs = new IntersectionObserver(function(es){ es.forEach(function(e){ if(e.isIntersecting){ avObs.unobserve(e.target); avPaint(e.target); } }); }, { rootMargin: '120px' });
    els.forEach(function(e){ avObs.observe(e); }); }
  // poza mică (64 px) pentru clasament și chat, făcută din poza mare
  function mkThumb(d){
    return new Promise(function(res){
      if(!d || !AV_RE.test(d)){ res(null); return; }
      var im = new Image();
      im.onload = function(){ try{
        var s = Math.min(im.width, im.height), c = document.createElement('canvas'); c.width = c.height = 64;
        c.getContext('2d').drawImage(im, (im.width-s)/2, (im.height-s)/2, s, s, 0, 0, 64, 64);
        var q = .7, t = c.toDataURL('image/jpeg', q); while(t.length > 6000 && q > .3){ q -= .1; t = c.toDataURL('image/jpeg', q); }
        res(t.length <= 6000 && AV_RE.test(t) ? t : null); }catch(e){ res(null); } };
      im.onerror = function(){ res(null); }; im.src = d; }); }
  // pozele venite odată cu lista: le punem direct în memorie, fără altă cerere
  function avSeed(nick, a, hasAv, mine){
    var k = String(nick || '').toLowerCase(); if(!k) return;
    if(a && typeof a === 'string' && a.length <= 6000 && AV_RE.test(a)){ if(!(mine && AVC[k])) AVC[k] = a; }
    else if(hasAv === false && !mine) AVC[k] = ''; }
  // conturile vechi, care au poză dar nu și poză mică: o fac o singură dată, automat
  function fixThumb(){
    if(thumbTried || !me || !me.has_avatar || me.has_thumb) return; thumbTried = true;
    avFetch(me.nick).then(mkThumb).then(function(t){ if(t) return rpc('set_my_thumb', { p_avatar_s: t }).then(function(){ if(me) me.has_thumb = true; }); }).catch(function(){}); }
  function avEl(nick, lv, px, cls){
    var t = tier(lv || 1), k = String(nick || '?'), c = AVC[k.toLowerCase()];
    return '<span class="sn-av ' + (cls || '') + '" data-av="' + esc(k) + '"' + (c ? ' data-done="1"' : '') + ' style="--px:' + px + 'px;--c:' + t[2] + '">' + (c ? '<img alt="" src="' + c + '">' : esc(k.charAt(0).toUpperCase())) + '</span>'; }

  // ---------- ecran de intrare ----------
  function renderJoin(){
    stopTimers();
    root.innerHTML =
      '<div class="card top-join"><div class="top-join-ic">🏆</div><h3>Intră în clasament</h3>' +
      '<p>Vezi unde ești față de ceilalți și vorbește în chatul global. Alege un nume de utilizator.</p>' +
      '<input id="topNick" class="top-in" maxlength="20" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="ex: Cristi_Fit">' +
      '<div class="top-hint">3–20 caractere: litere, cifre, _ sau . · <b>Numele se vede public, tuturor.</b> Nu folosi numele real, emailul sau telefonul.</div>' +
      '<div class="top-rules">Reguli: vorbește frumos, fără link-uri și spam. Mesajele pot fi raportate și ascunse, iar conturile care încalcă regulile sunt blocate.</div>' +
      '<button class="top-btn" id="topJoin">Intră</button><div class="top-err" id="topErr"></div></div>';
    document.getElementById('topJoin').addEventListener('click', function(){
      var n = document.getElementById('topNick').value.trim(), er = document.getElementById('topErr'); er.textContent = '';
      if(!/^[A-Za-z0-9_.]{3,20}$/.test(n)){ er.textContent = 'Nume invalid. Folosește 3–20 litere, cifre, _ sau .'; return; }
      var s = stats(); this.disabled = true; var btn = this;
      rpc('set_my_profile', {p_nick:n, p_score:s.score, p_streak:s.streak}).then(function(p){ me = p; toast('Bine ai venit, ' + p.nick + '!'); renderMain(); }).catch(function(e){ btn.disabled = false; er.textContent = errMsg(e); });
    });
  }

  // ---------- ecran principal ----------
  function progress(score, lv){ var a = 25*(lv-1)*(lv-1), b = 25*lv*lv; return Math.max(0, Math.min(100, Math.round((score-a)/(b-a)*100))); }
  function renderMain(){
    if(!me || !me.nick){ root.innerHTML = '<div class="top-load">Se încarcă…</div>'; loaded = false; return; }
    me.score = num(me.score); me.rank = num(me.rank); me.streak = num(me.streak); me.level = num(me.level);
    var lv = me.level || lvOf(me.score), t = tier(lv), heroOn = !!(window.zAvatar && window.zAvatar.has());
    root.innerHTML =
      '<div class="sn-me">' + (heroOn ?
        '<div class="sn-hero" data-prof="' + esc(me.nick) + '">' + window.zAvatar.svg(window.zAvatar.load(), 390, 'hero') + '<div class="sn-hero-ov"><div class="sn-me-n">' + esc(me.nick) + '</div><div class="sn-me-t" style="color:' + t[2] + '">' + esc(t[1]) + ' · Nivel ' + lv + '</div></div><span class="sn-lv" style="--c:' + t[2] + '">' + lv + '</span></div>' :
        '<div class="sn-me-av" data-prof="' + esc(me.nick) + '">' + avEl(me.nick, lv, 92, 'ring') + '<span class="sn-lv" style="--c:' + t[2] + '">' + lv + '</span></div>' +
        '<div class="sn-me-n">' + esc(me.nick) + '</div><div class="sn-me-t" style="color:' + t[2] + '">' + esc(t[1]) + ' · Nivel ' + lv + '</div>') +
      '<div class="sn-bar"><i style="width:' + progress(me.score, lv) + '%;background:' + t[2] + '"></i></div>' +
      '<div class="sn-stats"><div><b>#' + me.rank + '</b><span>Locul tău</span></div><div><b>' + me.score + '</b><span>Puncte</span></div><div><b>' + (me.streak || 0) + '🔥</b><span>Zile la rând</span></div></div>' +
      '<div class="sn-acts"><button class="sn-b" data-prof="' + esc(me.nick) + '">✏️ Profil</button><button class="sn-b alt" id="snAvt">🧑‍🎨 Avatar</button></div></div>' +
      '<div class="sn-nav" id="topSeg"><button class="' + (seg==='rank'?'on':'') + '" data-tseg="rank"><i>🏆</i>Clasament</button><button class="' + (seg==='chat'?'on':'') + '" data-tseg="chat"><i>💬</i>Chat</button><button class="' + (seg==='fr'?'on':'') + '" data-tseg="fr"><i>📍</i>Prieteni</button></div>' +
      '<div id="topBody"></div>' +
      '<div class="top-foot">Puncte: obiceiuri bifate, antrenamente făcute, zile perfecte. Poți câștiga cel mult 600 pe zi.</div>';
    root.querySelectorAll('[data-tseg]').forEach(function(b){ b.addEventListener('click', function(){ seg = b.getAttribute('data-tseg'); root.querySelectorAll('[data-tseg]').forEach(function(x){ x.classList.toggle('on', x===b); }); showSeg(); }); });
    var ab = document.getElementById('snAvt'); if(ab) ab.addEventListener('click', function(){
      if(!window.zAvatar){ toast('Avatarul nu e disponibil'); return; }
      rpc('get_public_profile', { p_nick: me.nick }).then(function(p){ window.zAvatar.open(function(d){
        mkThumb(d).then(function(th){ return rpcOpt('set_my_extra', { p_bio: (p && p.bio) || '', p_avatar: d, p_clear_avatar: false, p_avatar_s: th }, 'p_avatar_s'); }).then(function(){ AVC[me.nick.toLowerCase()] = d; toast('Avatar salvat!'); renderMain(); }).catch(function(e){ toast(errMsg(e)); }); }); }).catch(function(e){ toast(errMsg(e)); }); });
    avHydrate(root);
    fixThumb();
    showSeg();
    startScoreTimer();
  }
  function showSeg(){ stopChat(); if(window.zFriends) window.zFriends.leave(); if(seg === 'chat') renderChat(); else if(seg === 'fr' && window.zFriends){ var fb = document.getElementById('topBody'); if(fb) window.zFriends.render(fb); } else renderBoard(); }

  // ---------- clasament ----------
  function row(r){
    r = { nick: String(r.nick == null ? '?' : r.nick), rank: num(r.rank), level: num(r.level) || 1, streak: num(r.streak), score: num(r.score), me: !!r.me };
    var t = tier(r.level);
    return '<div class="sn-row' + (r.me ? ' me' : '') + '" data-prof="' + esc(r.nick) + '"><span class="sn-rk">' + r.rank + '</span>' + avEl(r.nick, r.level, 48) +
      '<span class="sn-rn"><b>' + esc(r.nick) + (r.me ? ' <em>tu</em>' : '') + '</b><small><span style="color:' + t[2] + '">● ' + esc(t[1]) + '</span> · Nivel ' + r.level + (r.streak ? ' · 🔥 ' + r.streak : '') + '</small></span><span class="sn-sc">' + r.score + '<small>pct</small></span></div>';
  }
  function podium(r, place){
    if(!r) return '<div class="sn-pod p' + place + '"></div>';
    r = { nick: String(r.nick == null ? '?' : r.nick), level: num(r.level) || 1, score: num(r.score) };
    return '<div class="sn-pod p' + place + '" data-prof="' + esc(r.nick) + '">' + (place === 1 ? '<span class="sn-crown">👑</span>' : '') + avEl(r.nick, r.level, place === 1 ? 84 : 66, 'ring m' + place) +
      '<div class="sn-pn">' + esc(r.nick) + '</div><div class="sn-ps">' + r.score + ' pct</div><div class="sn-pb"><span>' + place + '</span></div></div>';
  }
  function perSwitch(){
    return '<div class="sn-acts" id="topPer" style="margin:0 0 4px">' +
      '<button class="sn-b' + (period === 'week' ? ' alt' : '') + '" data-per="week" style="flex:1;padding:10px 8px;font-size:13.5px">Săptămâna asta</button>' +
      '<button class="sn-b' + (period === 'all' ? ' alt' : '') + '" data-per="all" style="flex:1;padding:10px 8px;font-size:13.5px">Din totdeauna</button></div>';
  }
  function renderBoard(){
    var b = document.getElementById('topBody'); if(!b) return;
    var per = period;
    b.innerHTML = perSwitch() + '<div class="top-load">Se încarcă clasamentul…</div>';
    rpcOpt('get_leaderboard', {p_limit:100, p_period:per}, 'p_period').then(function(d){
      d = d || {}; board = d; me = d.me || me; if(!document.getElementById('topBody') || seg !== 'rank' || period !== per) return;
      var old = !d.period; if(old) period = 'all';   // server vechi: există doar clasamentul din totdeauna
      var wk = period === 'week', top = (Array.isArray(d.top) ? d.top : []).filter(function(r){ return r && r.nick != null; }), html = old ? '' : perSwitch();
      top.forEach(function(r){ avSeed(r.nick, r.avatar_s, r.has_av, r.me); });
      if(!top.length) html += '<div class="top-load">' + (wk ? 'Nimeni nu a strâns puncte săptămâna asta. Fii primul! 🏆' : 'Nimeni încă. Fii primul! 🏆') + '</div>';
      else {
        html += '<div class="sn-podium">' + podium(top[1],2) + podium(top[0],1) + podium(top[2],3) + '</div>';
        if(top.length > 3) html += '<div class="sn-list">' + top.slice(3).map(row).join('') + '</div>';
        html += '<div class="sn-invite">' + (top.length < 4 ? '👋 Ești printre primii aici. ' : '') + 'Cheamă un prieten și vedeți care strânge mai multe puncte.<br><button class="sn-b alt" data-invite="1" style="margin-top:10px">📨 Invită un prieten</button></div>';
      }
      var inTop = top.some(function(r){ return r.me; });
      if(me && !inTop) html += '<div class="sn-pin">' + row({rank:d.my_rank != null ? d.my_rank : me.rank, nick:me.nick, score:d.my_score != null ? d.my_score : me.score, streak:me.streak, level:me.level||lvOf(me.score), me:true}) + '</div>';
      var tn = d.total != null ? num(d.total) : top.length;
      html += '<div class="top-foot">' + (tn === 1 ? 'Un cont' : tn + (tn >= 20 ? ' de' : '') + ' conturi') + (wk ? ' cu puncte săptămâna asta. Clasamentul săptămânii se resetează luni.' : ' în clasament') + '</div>';
      var bb = document.getElementById('topBody'); bb.innerHTML = html;
      // rândurile fără poză mică: cerem profilul doar pentru primele 12
      var pend = bb.querySelectorAll('.sn-av[data-av]:not([data-done])'), n = 0;
      for(var i = 0; i < pend.length; i++){ if(AVC[pend[i].getAttribute('data-av').toLowerCase()] !== undefined) continue; if(++n > 12) pend[i].setAttribute('data-done', '1'); }
      avHydrate(bb);
    }).catch(function(e){ var bb = document.getElementById('topBody'); if(bb && seg === 'rank' && period === per) bb.innerHTML = perSwitch() + '<div class="top-load">' + esc(errMsg(e)) + '</div>'; });
  }
  root.addEventListener('click', function(ev){ var el = ev.target.closest('[data-per]'); if(!el || seg !== 'rank') return; var p = el.getAttribute('data-per') === 'all' ? 'all' : 'week'; if(p === period) return; period = p; renderBoard(); });

  // ---------- chat ----------
  function fmtT(at){ try{ return new Date(at).toLocaleTimeString('ro-RO',{hour:'2-digit',minute:'2-digit'}); }catch(e){ return ''; } }
  function msgHtml(m){
    if(!m || m.nick == null) return '';
    m = { id: num(m.id), nick: String(m.nick), lvl: num(m.lvl) || 1, body: m.body, at: m.at, mine: !!m.mine };
    if(!m.mine && blocked.indexOf(m.nick.toLowerCase()) >= 0) return '';
    var t = tier(m.lvl);
    var acts = m.mine ? '<button class="top-ma" style="min-width:36px;min-height:36px;font-size:15px" data-del="' + m.id + '" title="Șterge">🗑</button>' :
      '<button class="top-ma" style="min-width:36px;min-height:36px;font-size:15px" data-rep="' + m.id + '" title="Raportează">🚩</button><button class="top-ma" style="min-width:36px;min-height:36px;font-size:15px" data-blk="' + esc(m.nick) + '" title="Blochează">🚫</button>' + (isAdmin ? '<button class="top-ma" style="min-width:36px;min-height:36px;font-size:15px" data-del="' + m.id + '" title="Șterge (admin)">🗑</button><button class="top-ma" style="min-width:36px;min-height:36px;font-size:15px" data-ban="' + esc(m.nick) + '" title="Blochează cont">⛔</button>' : '');
    return '<div class="sn-msg' + (m.mine ? ' mine' : '') + '" data-id="' + m.id + '">' + (m.mine ? '' : '<span data-prof="' + esc(m.nick) + '">' + avEl(m.nick, m.lvl, 34) + '</span>') +
      '<div class="sn-mc">' + (m.mine ? '' : '<div class="sn-mh" style="color:' + t[2] + '">' + esc(m.nick) + '</div>') + '<div class="sn-bub">' + esc(m.body) + '</div>' +
      '<div class="sn-mf"><small>' + esc(fmtT(m.at)) + '</small><span class="sn-ma">' + acts + '</span></div></div></div>';
  }
  function renderChat(){
    var b = document.getElementById('topBody'); if(!b) return;
    lastId = 0; chatGen++;
    b.innerHTML = '<div class="sn-chat"><div class="sn-msgs top-msgs" id="topMsgs"><div class="top-load">Se încarcă mesajele…</div></div>' +
      '<div class="sn-send"><input id="topMsgIn" maxlength="300" autocomplete="off" placeholder="Trimite un mesaj…"><button id="topSend" aria-label="Trimite">➤</button></div>' +
      '<div class="top-err" id="topCErr"></div><div class="top-hint">Fără link-uri. Vorbește frumos. 🚩 raportează, 🚫 blochează un utilizator.</div></div>';
    var box = document.getElementById('topMsgs');
    box.addEventListener('click', function(ev){
      var el = ev.target.closest('button'); if(!el) return;
      var id = el.getAttribute('data-rep') || el.getAttribute('data-del'), nk = el.getAttribute('data-blk') || el.getAttribute('data-ban');
      if(el.hasAttribute('data-rep')){ if(confirm('Raportezi acest mesaj?')) rpc('report_chat', {p_id:+id}).then(function(){ toast('Mesaj raportat. Mulțumim!'); }).catch(function(e){ toast(errMsg(e)); }); }
      else if(el.hasAttribute('data-blk')){ if(confirm('Blochezi pe ' + nk + '? Nu îi mai vezi mesajele, iar el nu te mai poate adăuga și nu îți mai vede profilul.')){ blocked.push(nk.toLowerCase()); saveBlocked(); rpc('block_user', { p_nick: nk }).catch(function(){}); box.querySelectorAll('.sn-msg').forEach(function(x){ var h = x.querySelector('.sn-mh'); if(h && h.textContent.toLowerCase() === nk.toLowerCase()) x.remove(); }); toast('Utilizator blocat'); } }
      else if(el.hasAttribute('data-del')){ if(confirm('Ștergi mesajul?')) rpc('delete_chat', {p_id:+id}).then(function(){ var x = box.querySelector('[data-id="' + id + '"]'); if(x) x.remove(); }).catch(function(e){ toast(errMsg(e)); }); }
      else if(el.hasAttribute('data-ban')){ if(confirm('Blochezi contul ' + nk + '?')) rpc('admin_ban', {p_nick:nk, p_on:true}).then(function(){ toast('Cont blocat'); }).catch(function(e){ toast(errMsg(e)); }); }
    });
    function send(){
      var inp = document.getElementById('topMsgIn'), v = inp.value.trim(), er = document.getElementById('topCErr'); if(!v) return; er.textContent = '';
      var btn = document.getElementById('topSend'); btn.disabled = true;
      rpc('send_chat', {p_body:v}).then(function(){ inp.value = ''; btn.disabled = false; pull(true); }).catch(function(e){ btn.disabled = false; er.textContent = errMsg(e); });
    }
    document.getElementById('topSend').addEventListener('click', send);
    document.getElementById('topMsgIn').addEventListener('keydown', function(e){ if(e.key === 'Enter'){ e.preventDefault(); send(); } });
    pull(true);
    startChat();
  }
  function startChat(){ stopChat(); chatTimer = setInterval(function(){ if(active() && seg === 'chat' && !document.hidden) pull(false); }, 10000); }
  function pull(scroll){
    var box = document.getElementById('topMsgs'); if(!box) return;
    var gen = chatGen, after = lastId;
    rpc('get_chat', {p_after:after, p_limit:80}).then(function(d){
      if(gen !== chatGen || !box.isConnected) return;            // între timp ai ieșit din chat
      if(after !== lastId){ pull(scroll); return; }                // altă cerere a adus deja mesajele: nu le pune de două ori
      d = d || {}; isAdmin = !!d.admin; var msgs = (Array.isArray(d.msgs) ? d.msgs : []).filter(function(m){ return m && +m.id > lastId; }), avs = d.avs || {}, ak;
      for(ak in avs) if(Object.prototype.hasOwnProperty.call(avs, ak)) avSeed(ak, avs[ak]);
      if(lastId === 0) box.innerHTML = '';
      if(!msgs.length){ if(lastId === 0) box.innerHTML = '<div class="top-load">Niciun mesaj încă. Scrie primul! 👋</div>'; return; }
      var near = box.scrollHeight - box.scrollTop - box.clientHeight < 80;
      var html = msgs.map(msgHtml).join(''); lastId = num(msgs[msgs.length-1].id);
      box.insertAdjacentHTML('beforeend', html);
      if(scroll || near) box.scrollTop = box.scrollHeight; avHydrate(box);
    }).catch(function(e){ if(gen === chatGen && lastId === 0 && box.isConnected) box.innerHTML = '<div class="top-load">' + esc(errMsg(e)) + '</div>'; });
  }
  function stopChat(){ if(chatTimer){ clearInterval(chatTimer); chatTimer = null; } }

  // ---------- profil public ----------
  function avatarHtml(p, px){
    var t = tier(p.level);
    if(p.avatar && AV_RE.test(p.avatar)) return '<img class="top-pf-img" style="width:'+px+'px;height:'+px+'px" alt="" src="' + p.avatar + '">';
    return '<div class="top-pf-img top-pf-ph" style="width:'+px+'px;height:'+px+'px;color:'+t[2]+';border-color:'+t[2]+';font-size:'+Math.round(px*0.42)+'px">' + esc((p.nick||'?').charAt(0).toUpperCase()) + '</div>';
  }
  function toJpeg(file){
    return new Promise(function(res, rej){
      var fr = new FileReader();
      fr.onload = function(){ var im = new Image(); im.onload = function(){
        var s = Math.min(im.width, im.height), c = document.createElement('canvas'); c.width = c.height = 192;
        c.getContext('2d').drawImage(im, (im.width-s)/2, (im.height-s)/2, s, s, 0, 0, 192, 192);
        var q = .82, d = c.toDataURL('image/jpeg', q); while(d.length > 38000 && q > .4){ q -= .1; d = c.toDataURL('image/jpeg', q); }
        res(d); }; im.onerror = rej; im.src = fr.result; };
      fr.onerror = rej; fr.readAsDataURL(file);
    });
  }
  function closeProf(){ var m = document.getElementById('topModal'); if(m) m.remove(); }
  function sinceTxt(at){ try{ return new Date(at).toLocaleDateString('ro-RO',{month:'long',year:'numeric'}); }catch(e){ return ''; } }
  function openProfile(nick){
    closeProf();
    var m = document.createElement('div'); m.id = 'topModal'; m.className = 'top-modal';
    m.innerHTML = '<div class="top-modal-box"><button class="top-x" id="topX" aria-label="Închide">✕</button><div id="topPf"><div class="top-load">Se încarcă…</div></div></div>';
    document.body.appendChild(m);
    m.addEventListener('click', function(e){ if(e.target === m) closeProf(); });
    document.getElementById('topX').addEventListener('click', closeProf);
    rpc('get_public_profile', {p_nick:nick}).then(function(p){
      if(!p){ document.getElementById('topPf').innerHTML = '<div class="top-load">Profilul nu mai există.</div>'; return; }
      renderProfile(p);
    }).catch(function(e){ var b = document.getElementById('topPf'); if(b) b.innerHTML = '<div class="top-load">' + esc(errMsg(e)) + '</div>'; });
  }
  function renderProfile(p){
    var box = document.getElementById('topPf'); if(!box) return;
    p.nick = String(p.nick == null ? '?' : p.nick); p.level = num(p.level) || 1; p.rank = num(p.rank); p.score = num(p.score); p.streak = num(p.streak); p.bio = p.bio == null ? '' : String(p.bio);
    var t = tier(p.level);
    box.innerHTML =
      '<div class="top-pf">' + avatarHtml(p, 112) +
      '<div class="top-pf-nick">' + esc(p.nick) + '</div>' +
      '<div class="top-pf-tier" style="color:' + t[2] + ';border-color:' + t[2] + '">' + emblem(p.level, 16) + ' Nivel ' + p.level + ' · ' + esc(t[1]) + '</div>' +
      (p.bio ? '<div class="top-pf-bio">' + esc(p.bio) + '</div>' : (p.me ? '<div class="top-pf-bio dim">Adaugă un bio ca să te cunoască ceilalți.</div>' : '')) +
      (p.hidden ? '<div class="top-hint" style="text-align:center">Poza și bio sunt ascunse după raportări.</div>' : '') +
      '<div class="top-pf-stats"><div><b>#' + p.rank + '</b><span>Loc</span></div><div><b>' + p.score + '</b><span>Puncte</span></div><div><b>' + (p.streak || 0) + ' 🔥</b><span>Serie</span></div></div>' +
      '<div class="top-pf-since">Membru din ' + esc(sinceTxt(p.since)) + '</div>' +
      (p.me ? '<button class="top-btn top-pf-btn" id="pfEdit">✏️ Editează profilul</button>'
            : '<button class="top-pf-rep" id="pfRep">🚩 Raportează profilul</button>' + (isAdmin ? ' <button class="top-pf-rep" id="pfClr">🧹 Șterge poza și bio</button>' : '')) +
      '</div>';
    var e1 = document.getElementById('pfEdit'); if(e1) e1.addEventListener('click', function(){ renderEdit(p); });
    var r1 = document.getElementById('pfRep'); if(r1) r1.addEventListener('click', function(){ if(confirm('Raportezi acest profil?')) rpc('report_profile', {p_nick:p.nick}).then(function(){ toast('Profil raportat. Mulțumim!'); closeProf(); }).catch(function(e){ toast(errMsg(e)); }); });
    var c1 = document.getElementById('pfClr'); if(c1) c1.addEventListener('click', function(){ if(confirm('Ștergi poza și bio?')) rpc('admin_clear_profile', {p_nick:p.nick}).then(function(){ toast('Șters'); openProfile(p.nick); }).catch(function(e){ toast(errMsg(e)); }); });
  }
  function renderEdit(p){
    var box = document.getElementById('topPf'); if(!box) return; var newAv = null, clear = false;
    box.innerHTML =
      '<div class="top-pf"><div id="pfAv">' + avatarHtml(p, 112) + '</div>' +
      '<div class="top-pf-acts"><button class="top-pf-rep" id="pfPick">📷 Alege poză</button><button class="top-pf-rep" id="pfDel">Șterge poza</button></div>' +
      (window.zAvatar ? '<button class="top-btn top-pf-btn" id="pfAvt" style="margin-top:10px">🧑‍🎨 Creează-ți avatarul</button>' : '') +
      '<input type="file" id="pfFile" accept="image/*" style="display:none">' +
      '<textarea id="pfBio" class="top-in top-pf-ta" maxlength="150" rows="3" placeholder="Bio (max 150 caractere, fără link-uri)">' + esc(p.bio || '') + '</textarea>' +
      '<div class="top-hint" id="pfCnt" style="text-align:right">' + (p.bio||'').length + '/150</div>' +
      '<div class="top-hint">Poza și bio se văd public. Nu pune date personale.</div>' +
      '<button class="top-btn top-pf-btn" id="pfSave">Salvează</button><button class="top-pf-rep" id="pfCancel">Anulează</button><div class="top-err" id="pfErr"></div></div>';
    var bio = document.getElementById('pfBio');
    bio.addEventListener('input', function(){ document.getElementById('pfCnt').textContent = bio.value.length + '/150'; });
    document.getElementById('pfPick').addEventListener('click', function(){ document.getElementById('pfFile').click(); });
    document.getElementById('pfFile').addEventListener('change', function(){
      var f = this.files && this.files[0]; if(!f) return;
      toJpeg(f).then(function(d){ newAv = d; clear = false; document.getElementById('pfAv').innerHTML = avatarHtml({avatar:d, nick:p.nick, level:p.level}, 112); }).catch(function(){ document.getElementById('pfErr').textContent = 'Nu am putut citi poza.'; });
    });
    var avb = document.getElementById('pfAvt'); if(avb) avb.addEventListener('click', function(){ window.zAvatar.open(function(d){ newAv = d; clear = false; document.getElementById('pfAv').innerHTML = avatarHtml({avatar:d, nick:p.nick, level:p.level}, 112); toast('Avatar creat. Apasă Salvează.'); }); });
    document.getElementById('pfDel').addEventListener('click', function(){ newAv = null; clear = true; document.getElementById('pfAv').innerHTML = avatarHtml({avatar:null, nick:p.nick, level:p.level}, 112); });
    document.getElementById('pfCancel').addEventListener('click', function(){ renderProfile(p); });
    document.getElementById('pfSave').addEventListener('click', function(){
      var btn = this, er = document.getElementById('pfErr'); er.textContent = ''; btn.disabled = true;
      mkThumb(newAv).then(function(th){ return rpcOpt('set_my_extra', {p_bio:bio.value, p_avatar:newAv, p_clear_avatar:clear, p_avatar_s:th}, 'p_avatar_s'); }).then(function(np){ if(newAv || clear) AVC[String(p.nick).toLowerCase()] = newAv || ''; toast('Profil salvat'); if(np && np.nick) renderProfile(np); else openProfile(p.nick); }).catch(function(e){ btn.disabled = false; er.textContent = errMsg(e); });
    });
  }
  root.addEventListener('click', function(ev){ var el = ev.target.closest('[data-prof]'); if(el && !ev.target.closest('.top-ma')) openProfile(el.getAttribute('data-prof')); });

  // ---------- invitație ----------
  function invite(){
    var url = location.origin + location.pathname, txt = 'Hai în By ZyP, aplicația mea de sală: plan de antrenament, mâncare și clasament.' + (me && me.nick ? ' Adaugă-mă la prieteni: ' + me.nick + '.' : '');
    if(navigator.share){ navigator.share({ title: 'By ZyP', text: txt, url: url }).catch(function(){}); return; }
    var all = txt + ' ' + url;
    if(navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(all).then(function(){ toast('Invitația e copiată. Lipește-o unde vrei.'); }).catch(function(){ prompt('Copiază invitația:', all); });
    else prompt('Copiază invitația:', all);
  }
  window.zInvite = invite;
  root.addEventListener('click', function(ev){ if(ev.target.closest('[data-invite]')) invite(); });

  // ---------- scor ----------
  function sync(){
    if(!me) return Promise.resolve(); var s = stats();
    return rpc('set_my_profile', {p_nick:null, p_score:s.score, p_streak:s.streak}).then(function(p){ if(p && p.nick) me = p; }).catch(function(){});
  }
  function startScoreTimer(){ if(scoreTimer) return; scoreTimer = setInterval(function(){ if(active()) sync(); }, 120000); }
  function stopTimers(){ stopChat(); if(scoreTimer){ clearInterval(scoreTimer); scoreTimer = null; } }
  // când pleci din Top: oprește tot ce merge în fundal (chat, hartă, sincronizare); la întoarcere se reface ecranul
  function leaveTop(){ stopTimers(); chatGen++; if(window.zFriends){ try{ window.zFriends.leave(); }catch(e){} } }

  // ---------- pornire ----------
  function open(){
    if(busy) return; busy = true;
    var sb = window.__sb; if(!sb){ root.innerHTML = '<div class="top-load">Conectează-te ca să vezi clasamentul.</div>'; busy = false; return; }
    if(loaded && me){ sync().then(function(){ renderMain(); }); busy = false; return; }
    root.innerHTML = '<div class="top-load">Se încarcă…</div>';
    rpc('get_my_profile').then(function(p){
      loaded = true;
      if(!p){ me = null; renderJoin(); return; }
      if(p.banned){ root.innerHTML = '<div class="card"><h3>Cont blocat</h3><p class="top-hint">Contul tău a fost blocat din comunitate pentru încălcarea regulilor.</p></div>'; return; }
      me = p; return sync().then(function(){ renderMain(); });
    }).catch(function(e){ root.innerHTML = '<div class="card top-join"><h3>Clasamentul nu e disponibil acum</h3><p class="top-hint">' + esc(errMsg(e)) + '</p><button class="top-btn" id="topRetry">Încearcă din nou</button></div>'; var rb = document.getElementById('topRetry'); if(rb) rb.addEventListener('click', function(){ setTimeout(open, 0); }); }).then(function(){ busy = false; });
  }
  var tab = document.querySelector('.tab[data-view="top"]');
  if(tab) tab.addEventListener('click', function(){ setTimeout(open, 60); });
  document.querySelectorAll('.tab[data-view]').forEach(function(t){ if(t !== tab) t.addEventListener('click', leaveTop); });
  document.addEventListener('visibilitychange', function(){
    if(document.hidden){ stopChat(); return; }
    if(active() && seg === 'chat' && document.getElementById('topMsgs')){ pull(false); startChat(); } });
})();
