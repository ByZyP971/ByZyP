/* ===== By ZyP · notifications (service worker + web push) ===== */
(function(){
  var VAPID_PUBLIC = 'BEbAlapGPODbyKuDao4BL5sEJyF3m3ax0rr2BTNTqD2pzMEivOj-3BqgZL2Y2FjYd0uha2TgsUW1EIteOKnH9ns';
  var st = document.getElementById('ntStatus'), en = document.getElementById('ntEnable'), te = document.getElementById('ntTest');
  var wrap = document.getElementById('ntSubWrap'), ta = document.getElementById('ntSub'), hint = document.getElementById('ntHint');
  if(!st) return;
  var standalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;
  var iOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
  function b64ToU8(b){ var pad = '='.repeat((4 - b.length % 4) % 4); var raw = atob((b + pad).replace(/-/g,'+').replace(/_/g,'/')); var a = new Uint8Array(raw.length); for(var i=0;i<raw.length;i++) a[i] = raw.charCodeAt(i); return a; }
  var reg = null;
  var cloudNote = document.createElement('div'); cloudNote.className = 'hint'; cloudNote.style.cssText = 'margin:8px 0 0;'; hint.parentNode.insertBefore(cloudNote, hint);
  var lastSaved = '';
  function saveSub(sub){      // the robot reads it from the account: after a reinstall you only tap "Activează" — no copy/paste into GitHub
    if(!sub || !window.__byzypDb) return;
    var tz = ''; try{ tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; }catch(e){}
    var mods = null; try{ var pf = JSON.parse(localStorage.getItem('zyp_prefs_v1')||'null'); if(pf && pf.mods) mods = pf.mods; }catch(e){}
    var obj = JSON.parse(JSON.stringify(sub)), ep = window.__ethPos;
    if(ep && ep.qty > 0 && ep.invested > 0) obj.eth = { invested: ep.invested, qty: ep.qty, entry: ep.entry, date: ep.date };
    var txt = JSON.stringify(obj) + '|' + tz + '|' + JSON.stringify(mods); if(txt === lastSaved) return;
    try{ var pr = window.__byzypDb.doc('settings/push').set({ sub: obj, tz: tz, mods: mods, at: new Date().toISOString() });
      Promise.resolve(pr).then(function(){ lastSaved = txt; cloudNote.innerHTML = '☁️ Codul telefonului e salvat <b>automat</b> în contul tău. Robotul îl ia singur de acolo.'; }).catch(function(){}); }catch(e){}
  }
  window.__syncPush = function(){ if(!('serviceWorker' in navigator) || !('Notification' in window) || Notification.permission !== 'granted') return;
    navigator.serviceWorker.ready.then(function(r){ return r.pushManager.getSubscription(); }).then(saveSub).catch(function(){}); };
  setTimeout(function(){ try{ window.__syncPush(); }catch(e){} }, 15000); setInterval(function(){ try{ window.__syncPush(); }catch(e){} }, 90000);
  function showSub(sub){
    if(!sub) return;
    ta.value = JSON.stringify(sub);
    wrap.style.display = 'block';
    saveSub(sub);
  }
  function refresh(){
    if(!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)){
      st.innerHTML = iOS && !standalone
        ? 'Pe iPhone, notificările merg doar din aplicația de pe <b>ecranul principal</b>. În Safari: Share ⬆️ → „Adaugă pe ecranul principal”, apoi deschide By ZyP de acolo.'
        : 'Browserul acesta nu suportă notificări. Pe iPhone ai nevoie de iOS 16.4+ și aplicația adăugată pe ecranul principal.';
      return;
    }
    if(Notification.permission === 'denied'){ st.innerHTML = 'Notificările sunt blocate. Setări iPhone → Notificări → By ZyP → Permite.'; return; }
    navigator.serviceWorker.ready.then(function(r){ reg = r; return r.pushManager.getSubscription(); }).then(function(sub){
      if(sub && Notification.permission === 'granted'){
        st.innerHTML = '<b>✅ Notificările sunt active</b> pe acest telefon.';
        en.style.display = 'none'; te.style.display = 'block'; showSub(sub);
        hint.textContent = 'Primești motivare la 08:30, 14:30 și 21:30 și un avertisment cu ~10 minute înainte de fiecare știre roșie (după ce pui codul în GitHub).';
      } else {
        st.textContent = 'Notificările nu sunt pornite încă.';
        en.style.display = 'block'; te.style.display = 'none';
      }
    });
  }
  if('serviceWorker' in navigator){
    navigator.serviceWorker.register('sw.js').then(refresh).catch(function(e){ st.textContent = 'Nu s-a putut porni serviciul de notificări: ' + e.message; });
  } else refresh();
  en.addEventListener('click', function(){
    Notification.requestPermission().then(function(p){
      if(p !== 'granted'){ refresh(); return; }
      return navigator.serviceWorker.ready.then(function(r){ return r.pushManager.subscribe({ userVisibleOnly:true, applicationServerKey:b64ToU8(VAPID_PUBLIC) }); })
        .then(function(sub){ showSub(sub); refresh(); if(reg) reg.showNotification('By ZyP 🔔', { body:'Notificările sunt pornite!', icon:'icon.png' }); });
    }).catch(function(e){ st.textContent = 'Eroare: ' + e.message; });
  });
  te.addEventListener('click', function(){ if(reg) reg.showNotification('By ZyP ✅', { body:'Așa arată o notificare de la aplicația ta.', icon:'icon.png' }); });
  // delivery log written by the push robot (sent.json, same site)
  var logEl = document.createElement('div'); logEl.className = 'nt-log'; hint.parentNode.insertBefore(logEl, hint.nextSibling);
  function loadPushLog(){
    fetch('sent.json?t=' + Date.now(), { cache:'no-store' }).then(function(r){ if(!r.ok) throw 0; return r.json(); }).then(function(j){
      var st = (j._status || []).slice(-8).reverse();
      if(!st.length){ logEl.innerHTML = '<div class="hint" style="margin-top:0;">Robotul n-a trimis încă notificări.</div>'; return; }
      var bad = st.filter(function(x){ return !x.ok && (x.code === 404 || x.code === 410); }).length, cfg = st.filter(function(x){ return !x.ok && x.code === 'config'; })[0];
      logEl.innerHTML = '<div style="margin-top:14px;"></div>' + (window.hxHtml || function(k,l,x){ return x; })('notifLog', 'ultimele notificări trimise', st.map(function(x){ var d = new Date(x.t);
        return '<div class="nt-row"><span>' + (x.ok ? '✅' : '❌') + ' ' + hh(d) + '</span><span class="nt-t">' + String(x.title).replace(/</g,'&lt;') + (x.ok ? '' : (x.code === 'config' ? ' <em>(configurare)</em>' : ' <em>(eroare ' + x.code + ')</em>')) + '</span></div>'; }).join('')) +
        (cfg && st[0] && st[0].code === 'config' ? '<div class="hint" style="color:var(--gold)">⚠️ ' + String(cfg.err || 'Secretele din GitHub nu sunt valide.').replace(/</g, '&lt;') + '</div>' : '') + (bad ? '<div class="hint" style="color:var(--gold)">⚠️ Codul telefonului a expirat. Apasă din nou pe „Activează notificările”, copiază codul nou și pune-l în GitHub la secretul PUSH_SUB.</div>' : '');
    }).catch(function(){});
  }
  function hh(d){ return String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0'); }
  loadPushLog(); setInterval(loadPushLog, 120000);
  document.getElementById('ntCopy').addEventListener('click', function(){
    var done = function(){ document.getElementById('ntCopy').textContent = '✓ Copiat'; };
    var txt = ta.value;
    try{ var jj = JSON.parse(txt), ep = window.__ethPos; if(jj && typeof jj === 'object' && !Array.isArray(jj) && ep && ep.qty > 0){ jj.eth = { invested: ep.invested, qty: ep.qty, entry: ep.entry, date: ep.date }; txt = JSON.stringify(jj); } }catch(e){}
    if(navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(done, function(){ ta.select(); document.execCommand('copy'); done(); });
    else { ta.select(); document.execCommand('copy'); done(); }
  });
})();
