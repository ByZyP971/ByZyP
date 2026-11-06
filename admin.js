/* By ZyP — panou admin (apare doar pentru contul proprietar; serverul verifică accesul) */
(function(){
  'use strict';
  var esc = window.zEsc || function(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); };
  function fmt(t){ if(!t) return '—'; try{ return new Date(t).toLocaleString('ro-RO',{day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit'}); }catch(e){ return '—'; } }
  function render(list){
    var legal = document.getElementById('legalCard'); if(!legal || document.getElementById('adminCard')) return;
    var now = Date.now(), day = 864e5;
    var n7 = list.filter(function(u){ return u.created && now - new Date(u.created) < 7*day; }).length;
    var act = list.filter(function(u){ return u.last && now - new Date(u.last) < 7*day; }).length;
    var pu = list.filter(function(u){ return u.push; }).length;
    var rows = list.map(function(u){
      var m = u.mods ? Object.keys(u.mods).filter(function(k){return u.mods[k];}).join(', ') : '';
      return '<div style="padding:9px 0;border-top:1px solid rgba(255,255,255,.08);font-size:13px;line-height:1.45">'
        + '<b>'+esc(u.email||'(fără email)')+'</b><br>'
        + '<span style="opacity:.7">înscris '+esc(fmt(u.created))+' · ultima logare '+esc(fmt(u.last))+'</span><br>'
        + '<span style="opacity:.7">notificări: '+(u.push?'✅':'❌')+(u.tz?' · '+esc(u.tz):'')+(m?' · module: '+esc(m):'')+'</span></div>';
    }).join('');
    var c = document.createElement('div'); c.className = 'card'; c.id = 'adminCard';
    c.innerHTML = '<h3 style="margin:0 0 6px">👑 Admin</h3>'
      + '<div style="font-size:14px;margin-bottom:8px"><b>'+list.length+'</b> conturi · <b>'+n7+'</b> noi în 7 zile · <b>'+act+'</b> active în 7 zile · <b>'+pu+'</b> cu notificări</div>'
      + rows;
    legal.parentNode.insertBefore(c, legal);
  }
  function load(){
    var sb = window.__sb; if(!sb || !sb.rpc) return;
    sb.auth.getSession().then(function(r){
      if(!r || !r.data || !r.data.session) return;
      return sb.rpc('admin_overview').then(function(x){ if(x && !x.error && Array.isArray(x.data)) render(x.data); });
    }).catch(function(){});
  }
  setTimeout(load, 2500);
})();
