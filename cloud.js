/* ===== By ZyP · Supabase bridge (same API the app already uses) ===== */
(function(){
  var SB_URL = 'https://bskujbfaynbeqjonqydb.supabase.co';
  var SB_KEY = 'sb_publishable_iFv52BsojpLXTxuBzqGU1Q_cCFVZUAX';
  var FF_URL = 'https://nfs.faireconomy.media/ff_calendar_thisweek.json';
  var gate = document.getElementById('authGate');
  function msg(t){ document.getElementById('authMsg').textContent = t || ''; }
  function done(){ window.__byzypAuthed = true; gate.style.display = 'none'; window.dispatchEvent(new Event('byzyp-auth')); }
  if(!window.supabase || SB_URL.indexOf('__') === 0){
    var had = false; try{ for(var li = 0; li < localStorage.length; li++){ var lk = localStorage.key(li) || ''; if(lk.indexOf('sb-') === 0 && lk.indexOf('auth-token') > 0) had = true; } }catch(e){}
    if(had && SB_URL.indexOf('__') !== 0){   // ai cont, dar nu am putut încărca legătura cu serverul: nu pornim cu date goale
      gate.style.display = 'flex'; gate.innerHTML = '<div style="max-width:320px;margin:auto;text-align:center;padding:24px;color:#fff;font:600 15px/1.4 system-ui,sans-serif">Nu pot ajunge la server.<br>Verifică internetul și apasă Reîncearcă.<br><button id="sbRetry" style="margin-top:16px;padding:12px 22px;border-radius:999px;border:none;background:#A3FF12;color:#000;font:800 15px system-ui,sans-serif">Reîncearcă</button></div>';
      var rb = document.getElementById('sbRetry'); if(rb) rb.addEventListener('click', function(){ location.reload(); });
      return;
    }
    window.claude = undefined; setTimeout(done, 0); return; }
  var sb = window.supabase.createClient(SB_URL, SB_KEY, { auth:{ persistSession:true, autoRefreshToken:true } });
  window.__sb = sb;

  function clone(o){ return o == null ? o : JSON.parse(JSON.stringify(o)); }
  function rid(){ return Math.random().toString(36).slice(2,12) + Date.now().toString(36); }
  function makeDb(uid){
    var cache = {}, docL = {}, colL = {}, loaded = false, waiting = [];
    window.__wipeAll = function(){ return sb.from('docs').delete().eq('user_id', uid).then(function(r){ if(r.error) throw r.error; }); };
    window.__putDoc = function(col, id, data){ if(!readOk) return Promise.reject(new Error('Fără conexiune la date. Încearcă din nou peste puțin.')); return sb.from('docs').upsert({ user_id:uid, col:col, id:id, data:data, updated_at:new Date().toISOString() }, { onConflict:'user_id,col,id' }).then(function(r){ if(r.error) throw r.error; }); };
    function snapDoc(col, id){ var d = cache[col] && cache[col][id]; return { id:id, exists: !!d, data:function(){ return clone(d); } }; }
    function snapCol(col, order){
      var m = cache[col] || {};
      var docs = Object.keys(m).map(function(id){ return { id:id, exists:true, data:function(){ return clone(m[id]); } }; });
      if(order){ docs.sort(function(a,b){ var x = m[a.id][order.f], y = m[b.id][order.f]; x = x == null ? '' : x; y = y == null ? '' : y; var r = x < y ? -1 : x > y ? 1 : 0; return order.d === 'desc' ? -r : r; }); }
      return { docs:docs, empty:!docs.length, size:docs.length };
    }
    function emit(col, id){
      (docL[col + '/' + id] || []).forEach(function(fn){ try{ fn(snapDoc(col, id)); }catch(e){ console.error(e); } });
      (colL[col] || []).forEach(function(l){ try{ l.fn(snapCol(col, l.order)); }catch(e){ console.error(e); } });
    }
    function put(col, id, data){ cache[col] = cache[col] || {}; if(data == null) delete cache[col][id]; else cache[col][id] = clone(data); emit(col, id); }
    function whenLoaded(fn){ if(loaded) fn(); else waiting.push(fn); }
    // Prima citire: dacă eșuează (net slab), NU pornim cu date goale și NU scriem nimic în cloud până nu reușește.
    var readOk = false, pend = {}, tries = 0, bann = null;
    function banner(on){
      if(!on){ if(bann){ bann.remove(); bann = null; } return; }
      if(bann || !document.body) return;
      bann = document.createElement('div'); bann.textContent = 'Fără conexiune. Datele tale sunt în siguranță, reîncerc…';
      bann.style.cssText = 'position:fixed;left:12px;right:12px;top:calc(env(safe-area-inset-top,0px) + 8px);z-index:9000;background:#2a2a2a;color:#fff;border:1px solid #A3FF12;border-radius:12px;padding:10px 14px;font:600 13px/1.3 system-ui,sans-serif;text-align:center;';
      document.body.appendChild(bann);
    }
    function firstRead(){
      tries++;
      var p; try{ p = sb.from('docs').select('col,id,data'); }catch(e){ p = Promise.resolve({ error: e }); }
      Promise.resolve(p).then(function(r){ return r; }, function(e){ return { error: e || true }; }).then(function(r){
        if(!r || r.error){ console.error(r && r.error); banner(true); setTimeout(firstRead, Math.min(30000, 2000 * tries)); return; }
        var srv = {};
        (r.data || []).forEach(function(row){ srv[row.col + '/' + row.id] = 1; cache[row.col] = cache[row.col] || {}; if(!pend[row.col + '/' + row.id] || !pend[row.col + '/' + row.id].patch) cache[row.col][row.id] = row.data; else cache[row.col][row.id] = Object.assign({}, row.data, pend[row.col + '/' + row.id].patch); });
        readOk = true; banner(false);
        // ce s-a scris cât nu aveam datele: completările (update) se păstrează peste datele din cloud; un document nou se trimite; restul rămâne ca în cloud
        Object.keys(pend).forEach(function(k){ var pp = k.split('/'), c = pp[0], i = pp[1], q = pend[k];
          if(q.patch || !srv[k]){ var d = cache[c] && cache[c][i]; if(d != null) sb.from('docs').upsert({ user_id:uid, col:c, id:i, data:d, updated_at:new Date().toISOString() }, { onConflict:'user_id,col,id' }).then(function(){}, function(){}); } });
        pend = {};
        var first = !loaded; loaded = true; waiting.splice(0).forEach(function(f){ f(); });
        if(!first) Object.keys(cache).forEach(function(c){ Object.keys(cache[c]).forEach(function(i){ emit(c, i); }); });
      });
    }
    firstRead();
    window.addEventListener('online', function(){ if(!readOk){ tries = 0; firstRead(); } });
    sb.channel('docs-' + uid).on('postgres_changes', { event:'*', schema:'public', table:'docs', filter:'user_id=eq.' + uid }, function(p){
      if(p.eventType === 'DELETE'){ if(p.old && p.old.col) put(p.old.col, p.old.id, null); }
      else if(p.new){ put(p.new.col, p.new.id, p.new.data); }
    }).subscribe();

    function mapFF(arr){
      return (arr || []).filter(function(e){ return e && e.impact && e.impact !== 'Holiday'; }).map(function(e){
        var q = function(v){ return String(v == null ? '' : v).replace(/[&<>"']/g, function(ch){ return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]; }); };   /* third-party feed: never reach innerHTML raw */
      return { title:q(e.title), c:q(e.country), t:e.date, i:e.impact, f:q(e.forecast), p:q(e.previous) }; });
    }
    function getJSON(url){ return fetch(url, { cache:'no-store' }).then(function(r){ if(!r.ok) throw new Error(url + ' ' + r.status); return r.json(); }); }
    function newsSnapshot(next){
      function deliver(arr, label){
        var ev = mapFF(arr); if(!ev.length) throw new Error('empty');
        next({ id:'current', exists:true, data:function(){ return { updated: label, source:'Forex Factory', events: clone(ev) }; } });
      }
      // 1) copy kept next to the site (refreshed by GitHub every 3h) → 2) Forex Factory directly → 3) saved copy
      getJSON('news.json?t=' + Date.now()).then(function(arr){ window.__newsCheckedAt = Date.now(); deliver(arr, 'automat'); })
        .catch(function(){ return getJSON(FF_URL).then(function(arr){ deliver(arr, 'direct de pe Forex Factory'); }); })
        .catch(function(e){ console.warn('news unavailable', e); whenLoaded(function(){ next(snapDoc('news','current')); }); });
    }

    function docRef(path){
      var parts = path.split('/'), col = parts[0], id = parts[1];
      return {
        id:id,
        set:function(data){ put(col, id, data);
          if(!readOk){ var k0 = col + '/' + id; if(!(pend[k0] && pend[k0].patch)) pend[k0] = { full: 1 }; return Promise.resolve({ id:id }); }
          return sb.from('docs').upsert({ user_id:uid, col:col, id:id, data:data, updated_at:new Date().toISOString() }, { onConflict:'user_id,col,id' })
            .then(function(r){ if(r.error) throw r.error; return { id:id }; }); },
        update:function(patch){ var cur = (cache[col] && cache[col][id]) || {};
          if(!readOk){ var k1 = col + '/' + id; pend[k1] = { patch: Object.assign({}, pend[k1] && pend[k1].patch, patch) }; put(col, id, Object.assign({}, cur, patch)); return Promise.resolve({ id:id }); }
          return this.set(Object.assign({}, cur, patch)); },
        delete:function(){ put(col, id, null);
          if(!readOk){ delete pend[col + '/' + id]; return Promise.resolve(); }
          return sb.from('docs').delete().match({ user_id:uid, col:col, id:id }).then(function(r){ if(r.error) throw r.error; }); },
        onSnapshot:function(next){
          if(path === 'news/current'){ newsSnapshot(next); var iv = setInterval(function(){ newsSnapshot(next); }, 60*1000); return function(){ clearInterval(iv); }; }
          (docL[path] = docL[path] || []).push(next);
          whenLoaded(function(){ next(snapDoc(col, id)); });
          return function(){ docL[path] = (docL[path] || []).filter(function(f){ return f !== next; }); };
        }
      };
    }
    function colRef(col, order){
      return {
        orderBy:function(f, d){ return colRef(col, { f:f, d:d || 'asc' }); },
        add:function(data){ var id = rid(); return docRef(col + '/' + id).set(data); },
        onSnapshot:function(next){
          var l = { fn:next, order:order }; (colL[col] = colL[col] || []).push(l);
          whenLoaded(function(){ next(snapCol(col, order)); });
          return function(){ colL[col] = (colL[col] || []).filter(function(x){ return x !== l; }); };
        }
      };
    }
    return { doc:docRef, collection:colRef, _cache:cache };
  }

  function start(session){
    var db = makeDb(session.user.id);
    window.__byzypDb = db;
    setTimeout(function(){ if(window.__syncPush) window.__syncPush(); }, 1200);
    window.claude = { use:function(name){ return Promise.resolve(name === 'db' ? db : null); } };
    done();
    wireTools(db);
  }

  function wireTools(db){
    function tmsg(t){ var el = document.getElementById('toolsMsg'); if(el) el.textContent = t; }
    var lo = document.getElementById('logoutBtn');
    if(lo) lo.addEventListener('click', function(){ sb.auth.signOut().then(function(){ location.reload(); }); });
    var da = document.getElementById('delAccBtn');
    if(da) da.addEventListener('click', function(){
      if(!confirm('Ștergi contul definitiv? Toate datele tale (obiective, greutate, poze, notificări) se șterg și nu se mai pot recupera.')) return;
      var w = prompt('Ca să confirmi, scrie cuvântul STERGE'); if(!w || w.trim().toUpperCase() !== 'STERGE'){ tmsg('Ștergerea a fost anulată.'); return; }
      tmsg('Se șterge contul…');
      sb.rpc('delete_my_account').then(function(r){
        if(r.error){ tmsg('Nu am putut șterge contul: ' + r.error.message); return; }
        try{ localStorage.clear(); }catch(e){}
        sb.auth.signOut().then(function(){ location.reload(); }, function(){ location.reload(); });
      });
    });
    var ex = document.getElementById('exportBtn');
    if(ex) ex.addEventListener('click', function(){
      var out = { app:'By ZyP', exported:new Date().toISOString().slice(0,10), collections: clone(db._cache) };
      delete out.collections.news;
      var blob = new Blob([JSON.stringify(out)], { type:'application/json' });
      var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'byzyp-backup-' + out.exported + '.json';
      document.body.appendChild(a); a.click(); setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); }, 1000);
      tmsg('Backup descărcat.');
    });
    var ib = document.getElementById('importBtn'), fi = document.getElementById('importFile');
    if(ib && fi){
      ib.addEventListener('click', function(){ fi.click(); });
      fi.addEventListener('change', function(){
        var f = fi.files && fi.files[0]; if(!f) return;
        var rd = new FileReader();
        rd.onload = function(){
          try{
            var j = JSON.parse(rd.result), cols = j.collections || {}, jobs = [];
            Object.keys(cols).forEach(function(col){ if(col === 'news') return;
              Object.keys(cols[col]).forEach(function(id){ jobs.push(db.doc(col + '/' + id).set(cols[col][id])); }); });
            tmsg('Import în curs… ' + jobs.length + ' înregistrări');
            Promise.all(jobs).then(function(){ tmsg('✅ Import gata: ' + jobs.length + ' înregistrări.'); })
              .catch(function(e){ tmsg('Eroare la import: ' + (e.message || e)); });
          }catch(e){ tmsg('Fișierul nu e un backup valid.'); }
        };
        rd.readAsText(f);
      });
    }
  }

  function showGate(){
    gate.style.display = 'flex';
    var em = document.getElementById('authEmail'), pw = document.getElementById('authPass');
    document.getElementById('authLogin').onclick = function(){
      msg('Se conectează…');
      sb.auth.signInWithPassword({ email:em.value.trim(), password:pw.value }).then(function(r){
        if(r.error){ msg(r.error.message === 'Invalid login credentials' ? 'Email sau parolă greșită.' : (r.error.message.indexOf('confirm') >= 0 ? 'Confirmă mai întâi emailul (verifică inboxul).' : r.error.message)); return; }
        start(r.data.session);
      });
    };
    document.getElementById('authForgot').onclick = function(){
      var e = em.value.trim(); if(!e){ msg('Scrie întâi emailul de mai sus, apoi apasă „Ai uitat parola?”.'); return; }
      msg('Se trimite emailul…');
      sb.auth.resetPasswordForEmail(e, { redirectTo: location.origin + location.pathname }).then(function(r){
        msg(r.error ? r.error.message : 'Ți-am trimis un email cu un link. Deschide-l din telefon și alege o parolă nouă (verifică și Spam).');
      });
    };
    document.getElementById('authSignup').onclick = function(){
      if(pw.value.length < 8){ msg('Parola trebuie să aibă minim 8 caractere.'); return; }
      msg('Se creează contul…');
      sb.auth.signUp({ email:em.value.trim(), password:pw.value }).then(function(r){
        if(r.error){ msg(r.error.message); return; }
        if(r.data.session) start(r.data.session);
        else msg('Cont creat! Verifică emailul, apasă linkul de confirmare, apoi revino și apasă „Intră”.');
      });
    };
  }

  function showRecovery(){
    gate.style.display = 'flex';
    var box = gate.querySelector('.auth-msg') || gate;
    var o = document.createElement('div'); o.style.cssText = 'position:absolute;inset:0;z-index:5;background:var(--bg);display:flex;flex-direction:column;justify-content:center;gap:12px;padding:28px;';
    o.innerHTML = '<h2 style="margin:0;font-size:26px;font-weight:800;">Alege o parolă nouă</h2><p style="color:var(--text-dim);margin:0;">Minim 8 caractere.</p><input type="password" id="newPw" placeholder="Parolă nouă" autocomplete="new-password" style="padding:14px;border-radius:14px;border:1px solid var(--line);background:var(--bg-card-2);color:var(--text);font-size:16px;"><button class="primary-btn" id="newPwGo">Salvează parola</button><div class="auth-msg" id="newPwMsg"></div>';
    gate.appendChild(o);
    document.getElementById('newPwGo').onclick = function(){
      var v = document.getElementById('newPw').value, m = document.getElementById('newPwMsg');
      if(v.length < 8){ m.textContent = 'Parola trebuie să aibă minim 8 caractere.'; return; }
      m.textContent = 'Se salvează…';
      sb.auth.updateUser({ password: v }).then(function(r){
        if(r.error){ m.textContent = r.error.message; return; }
        try{ history.replaceState(null, '', location.pathname); }catch(e){}
        sb.auth.getSession().then(function(x){ o.remove(); if(x.data && x.data.session) start(x.data.session); else showGate(); });
      });
    };
  }
  var isRecovery = /type=recovery/.test(location.hash);
  var hashErr = /error_code=|error=access_denied/.test(location.hash);
  var recShown = false;
  try{ sb.auth.onAuthStateChange(function(ev){ if(ev === 'PASSWORD_RECOVERY' && !recShown){ recShown = true; showRecovery(); } }); }catch(e){}
  sb.auth.getSession().then(function(r){
    var s = r.data && r.data.session;
    if(recShown) return;
    if(isRecovery && s){ recShown = true; showRecovery(); }
    else if(s) start(s);
    else { showGate(); if(hashErr){ try{ history.replaceState(null,'',location.pathname); }catch(e){} msg('Linkul a expirat sau a fost deja folosit. Scrie emailul și apasă din nou „Ai uitat parola?”, apoi deschide linkul imediat.'); } }
  });
})();
