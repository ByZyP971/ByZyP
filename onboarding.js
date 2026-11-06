(function(){
  var KEY='zyp_prefs_v1', MODS=[
    {k:'sport',ic:'🏋️',n:'Sală și antrenamente',d:'Program pe zile, exerciții explicate'},
    {k:'food',ic:'🥗',n:'Mâncare',d:'Meniu, listă de cumpărături, calorii'},
    {k:'supp',ic:'💊',n:'Suplimente',d:'Ce iei și la ce oră'},
    {k:'money',ic:'💶',n:'Bani și Ethereum',d:'Preț, știri, portofel (doar citire)'}];
  var HABS=[{k:'nosmoke',ic:'🚭',n:'Fără țigări',d:'Nicio țigară azi'},{k:'nosugar',ic:'🍬',n:'Fără zahăr',d:'Fără dulciuri și sucuri'},{k:'water',ic:'💧',n:'Doar apă',d:'Apă în loc de sucuri'},{k:'training',ic:'💪',n:'Antrenament',d:'Sală sau odihnă planificată'},{k:'food',ic:'🥗',n:'Mâncare curată',d:'Proteină și legume'}];
  var HKEYS=HABS.map(function(m){ return m.k; });
  var CURH=(function(){ try{ var p=JSON.parse(localStorage.getItem(KEY)||'null'); if(p&&Array.isArray(p.habits)&&p.habits.length) return p.habits.slice(); }catch(e){} return HKEYS.slice(); })();
  var GOALS=[{k:'muscle',ic:'💪',n:'Masă musculară',d:'Sală, proteină, suplimente'},{k:'lose',ic:'🔥',n:'Slăbit și formă',d:'Mișcare, mâncare curată, fără dulce'},{k:'smoke',ic:'🚭',n:'Să las țigările',d:'Zile la rând fără fum'},{k:'sugar',ic:'🍬',n:'Mai puțin zahăr',d:'Fără dulciuri și sucuri'},{k:'energy',ic:'⚡',n:'Mai multă energie și somn',d:'Apă, mâncare curată, suplimente'},{k:'money',ic:'💶',n:'Bani și economii',d:'Preț, știri, portofel (doar citire)'}];
  function goalPreset(g){ var m={sport:0,food:0,supp:0,money:0}, h=[];
    function add(k){ if(h.indexOf(k)<0) h.push(k); }
    if(g.indexOf('muscle')>=0){ m.sport=1; m.food=1; m.supp=1; add('training'); add('food'); }
    if(g.indexOf('lose')>=0){ m.sport=1; m.food=1; add('training'); add('nosugar'); add('water'); add('food'); }
    if(g.indexOf('smoke')>=0){ add('nosmoke'); }
    if(g.indexOf('sugar')>=0){ m.food=1; add('nosugar'); }
    if(g.indexOf('energy')>=0){ m.food=1; m.supp=1; add('water'); add('food'); }
    if(g.indexOf('money')>=0){ m.money=1; }
    if(!(m.sport||m.food||m.supp||m.money)) m={sport:1,food:1,supp:1,money:1};
    if(!h.length) h=HKEYS.slice();
    return { mods:m, habits:h }; }
  function gbox(m,on){ return '<label class="onb-opt"><span class="ic">'+m.ic+'</span><div><b>'+m.n+'</b><span>'+m.d+'</span></div><input type="checkbox" data-g="'+m.k+'"'+(on?' checked':'')+'></label>'; }
  function hbox(m,on){ return '<label class="onb-opt"><span class="ic">'+m.ic+'</span><div><b>'+m.n+'</b><span>'+m.d+'</span></div><input type="checkbox" data-h="'+m.k+'"'+(on?' checked':'')+'></label>'; }
  function load(){ try{ var p=JSON.parse(localStorage.getItem(KEY)||'null'); if(p&&p.mods) return p; }catch(e){} return null; }
  function save(p){ try{ localStorage.setItem(KEY,JSON.stringify(p)); }catch(e){} }
  function apply(p){ var r=document.documentElement; MODS.forEach(function(m){ r.classList.toggle('pf-no'+m.k, !(p&&p.mods[m.k])); });
    var act=document.querySelector('.tab.active'); if(act&&act.offsetParent===null){ var t=document.querySelector('.tab[data-view="today"]'); if(t) t.click(); } }
  var cur=load(); if(cur) apply(cur);
  function box(m,on){ return '<label class="onb-opt"><span class="ic">'+m.ic+'</span><div><b>'+m.n+'</b><span>'+m.d+'</span></div><input type="checkbox" data-k="'+m.k+'"'+(on?' checked':'')+'></label>'; }
  function renderHabPref(){ var el=document.getElementById('prefHabits'); if(!el) return; var p=load(), cur=(p&&Array.isArray(p.habits)&&p.habits.length)?p.habits:HKEYS;
    el.innerHTML=HABS.map(function(m){ return hbox(m,cur.indexOf(m.k)>=0); }).join('');
    el.querySelectorAll('input').forEach(function(i){ i.addEventListener('change',function(){
      var q=load()||{done:1,mods:{sport:1,food:1,supp:1,money:1}}, list=Array.isArray(q.habits)&&q.habits.length?q.habits.slice():HKEYS.slice(), k=i.getAttribute('data-h');
      list=list.filter(function(x){ return x!==k; }); if(i.checked) list.push(k);
      if(!list.length){ i.checked=true; list=[k]; }
      q.habits=list; q.done=1; save(q); clearTimeout(window.__hrl); window.__hrl=setTimeout(function(){ location.reload(); },900); }); });
  }
  function renderPref(){ var el=document.getElementById('prefList'); if(!el) return; var p=load()||{mods:{sport:1,food:1,supp:1,money:1}};
    el.innerHTML=MODS.map(function(m){ return box(m,p.mods[m.k]); }).join('');
    el.querySelectorAll('input').forEach(function(i){ i.addEventListener('change',function(){ var q=load()||{done:1,mods:{sport:1,food:1,supp:1,money:1}}; q.mods[i.getAttribute('data-k')]=i.checked?1:0; q.done=1; save(q); apply(q); }); });
  }
  function guide(){
    if(document.getElementById('onb')) return;
    var o=document.createElement('div'); o.className='onb'; o.id='onb'; document.body.appendChild(o); var step=0, sel={sport:1,food:1,supp:1,money:1}, hsel=HKEYS.slice(), gsel=[];
    var p0=load(); if(p0){ sel=Object.assign({},p0.mods); if(Array.isArray(p0.habits)&&p0.habits.length) hsel=p0.habits.slice(); if(Array.isArray(p0.goals)) gsel=p0.goals.slice(); }
    function dots(){ return '<div class="onb-dots">'+[0,1,2,3,4].map(function(i){ return '<i class="'+(i<=step?'on':'')+'"></i>'; }).join('')+'</div>'; }
    function draw(){
      if(step===0){ o.innerHTML='<img class="onb-logo" src="icon.png" alt="">'+dots()+'<h1>Bine ai venit la By ZyP</h1><p>Planul tău zilnic pentru sală, suplimente și mâncare, simplu și pe ore. Îți alegi tu ce vezi în aplicație și poți schimba oricând.</p><button class="onb-btn" id="onbN">Începem</button>'; }
      else if(step===1){ o.innerHTML=dots()+'<h1>Ce contează cel mai mult pentru tine?</h1><p>Alege câte vrei. Îți pregătim aplicația după ce alegi, iar la pașii următori poți modifica.</p>'+GOALS.map(function(g){ return gbox(g,gsel.indexOf(g.k)>=0); }).join('')+'<button class="onb-btn" id="onbN">Continuă</button>'; o.querySelectorAll('input').forEach(function(i){ i.addEventListener('change',function(){ var k=i.getAttribute('data-g'); gsel=gsel.filter(function(x){ return x!==k; }); if(i.checked) gsel.push(k); }); }); }
      else if(step===2){ o.innerHTML=dots()+'<h1>Ce vrei în aplicație?</h1><p>Bifează ce te interesează. Restul rămâne ascuns.</p>'+MODS.map(function(m){ return box(m,sel[m.k]); }).join('')+'<button class="onb-btn" id="onbN">Continuă</button>'; o.querySelectorAll('input').forEach(function(i){ i.addEventListener('change',function(){ sel[i.getAttribute('data-k')]=i.checked?1:0; }); }); }
      else if(step===3){ o.innerHTML=dots()+'<h1>Ce obiceiuri vrei să urmărești?</h1><p>Alegi doar ce ți se potrivește. Poți schimba oricând din Profil.</p>'+HABS.map(function(m){ return hbox(m,hsel.indexOf(m.k)>=0); }).join('')+'<button class="onb-btn" id="onbN">Continuă</button>'; o.querySelectorAll('input').forEach(function(i){ i.addEventListener('change',function(){ var k=i.getAttribute('data-h'); hsel=hsel.filter(function(x){ return x!==k; }); if(i.checked) hsel.push(k); }); }); }
      else { o.innerHTML=dots()+'<h1>Gata, ești pregătit</h1><p>Pe fila Azi îți bifezi ziua. Sala, mâncarea și suplimentele apar la fila lor. Aplicația nu oferă sfaturi medicale sau financiare: sunt informații orientative.</p><button class="onb-btn" id="onbN">Deschide aplicația</button>'; }
      document.getElementById('onbN').addEventListener('click',function(){ if(step===1 && gsel.length){ var pr=goalPreset(gsel); sel=pr.mods; hsel=pr.habits; }
 if(step===3 && !hsel.length){ hsel=HKEYS.slice(); }
 if(step<4){ step++; draw(); } else { var q={done:1,mods:sel,habits:hsel,goals:gsel}; save(q); apply(q); renderPref(); o.remove(); try{ window.scrollTo(0,0); }catch(e){} if(JSON.stringify(hsel.slice().sort())!==JSON.stringify(CURH.slice().sort())) location.reload(); } });
    }
    draw();
  }
  document.addEventListener('DOMContentLoaded',function(){ renderPref(); renderHabPref(); var pg=document.getElementById('prefGuide'); if(pg) pg.addEventListener('click',guide); });
  window.addEventListener('load',function(){
    if(load() || /type=recovery|access_token/.test(location.hash)) return;
    var n=0, iv=setInterval(function(){ n++;
      var g=document.getElementById('authGate'), open=g && g.style.display!=='none';
      if(n>120){ clearInterval(iv); return; }
      if(!open && n>5){ clearInterval(iv); if(!load()) guide(); }
    },1000);
  });
})();
