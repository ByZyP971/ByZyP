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
  var DAYS=[{n:2,ph:5,t:'2 zile',d:'Puțin timp: 2 antrenamente complete'},{n:3,ph:3,t:'3 zile',d:'Tot corpul, simplu și eficient (ideal la început)'},{n:4,ph:4,t:'4 zile',d:'Upper / Lower: sus și jos, de două ori pe săptămână'},{n:5,ph:1,t:'5 zile',d:'Push / Pull / Legs + Upper / Lower'},{n:6,ph:2,t:'6 zile',d:'Push / Pull / Legs de două ori'},{n:4,ph:6,t:'Acasă · 4 zile',d:'Doar cu gantere, fără sală. Exercițiile cresc treptat'}];
  var SPK='byzyp_sport_v1';
  function curPhase(){ try{ var s=JSON.parse(localStorage.getItem(SPK)||'{}')||{}; return [1,2,3,4,5,6].indexOf(s.phase)>=0?s.phase:1; }catch(e){ return 1; } }
  function setPhase(ph){ try{ var s=JSON.parse(localStorage.getItem(SPK)||'{}')||{}; s.phase=ph; localStorage.setItem(SPK,JSON.stringify(s)); }catch(e){} }
  var LVLS=[{k:'easy',ic:'🟢',t:'Ușor',d:'Mai puține serii, exerciții simple la mașini'},{k:'mid',ic:'🟡',t:'Mediu',d:'3 serii, exerciții simple și eficiente'},{k:'hard',ic:'🔴',t:'Greu',d:'Mai multe serii, exerciții avansate cu haltera și gantere'}];
  function curLevel(){ try{ var s=JSON.parse(localStorage.getItem(SPK)||'{}')||{}; return (s.level==='easy'||s.level==='hard')?s.level:'mid'; }catch(e){ return 'mid'; } }
  function setSp(ph,lv,fresh){ try{ var s=JSON.parse(localStorage.getItem(SPK)||'{}')||{}; s.phase=ph; s.level=lv; if(fresh){ s.placed=1; delete s.legacy; } localStorage.setItem(SPK,JSON.stringify(s)); }catch(e){} }
  function lbox(m,on){ return '<label class="onb-opt"><span class="ic">'+m.ic+'</span><div><b>'+m.t+'</b><span>'+m.d+'</span></div><input type="radio" name="onblvl" data-lv="'+m.k+'"'+(on?' checked':'')+'></label>'; }
  var PHL={5:0,3:0,6:0,4:1,1:2,2:2}, LR={easy:0,mid:1,hard:2};
  function lockd(ph,lv){ return LR[lv]<PHL[ph]; }
  function dbox(m,on,lk){ return '<label class="onb-opt"'+(lk?' style="opacity:.4"':'')+'><span class="ic">'+(lk?'🔒':(m.ph===6?'🏠':'📅'))+'</span><div><b>'+m.t+(m.ph===6?'':' pe săptămână')+'</b><span>'+(lk?'Se deblochează la un nivel mai mare':m.d)+'</span></div><input type="radio" name="onbdays" data-ph="'+m.ph+'"'+(on?' checked':'')+(lk?' disabled':'')+'></label>'; }
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
    if(!document.getElementById('onb-css2')){ var st=document.createElement('style'); st.id='onb-css2'; st.textContent='.onb-sex{display:flex;gap:10px;margin:6px 0 10px}.onb-sex button{flex:1;padding:14px 8px;border-radius:16px;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.05);color:#fff;font:700 16px/1.2 inherit}.onb-sex button.on{background:#A3FF12;color:#000;border-color:transparent}.onb-ha{display:flex;gap:10px;margin-bottom:14px}.onb-ha input{flex:1;min-width:0;padding:14px;border-radius:14px;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.05);color:#fff;font-size:16px}'; document.head.appendChild(st); }
    var o=document.createElement('div'); o.className='onb'; o.id='onb'; document.body.appendChild(o); var step=0, sel={sport:1,food:1,supp:1,money:1}, hsel=HKEYS.slice(), gsel=[], phsel=curPhase(), ph0=phsel, lvsel=curLevel(), lv0=lvsel, first=!load(), bas={sex:'',age:'',cm:''};
    var hadSp=false; try{ var s0=JSON.parse(localStorage.getItem(SPK)||'{}')||{}; hadSp=[1,2,3,4,5,6].indexOf(s0.phase)>=0 && (!!s0.placed || (s0.sets&&Object.keys(s0.sets).length>0) || (s0.klog&&Object.keys(s0.klog).length>0)); }catch(e){}
    if(first && !hadSp){ phsel=3; lvsel='easy'; ph0=-1; }   /* începător: 3 zile, nivel Ușor, dacă nu alege altceva (cine are deja un program îl păstrează) */
    var p0=load(); if(p0){ sel=Object.assign({sport:1,food:1,supp:1,money:1},p0.mods); if(Array.isArray(p0.habits)&&p0.habits.length) hsel=p0.habits.slice(); if(Array.isArray(p0.goals)) gsel=p0.goals.slice(); }
    var g0=gsel.slice().sort().join(',');   /* obiectivele de la deschiderea ghidului: modulele și obiceiurile se re-potrivesc doar dacă le schimbi */
    var gOpen=g0;
    function dots(){ return '<div class="onb-dots">'+[0,1,2,3,4,5].map(function(i){ return '<i class="'+(i<=step?'on':'')+'"></i>'; }).join('')+'</div>'; }
    function draw(){
      if(step===0){ o.innerHTML='<img class="onb-logo" src="icon.png" alt="">'+dots()+'<h1>Bine ai venit la By ZyP</h1><p>Planul tău zilnic pentru sală, suplimente și mâncare, simplu și pe ore. Îți alegi tu ce vezi în aplicație și poți schimba oricând.</p><button class="onb-btn" id="onbN">Începem</button>'; }
      else if(step===1){ o.innerHTML=dots()+'<h1>Ce contează cel mai mult pentru tine?</h1><p>Alege câte vrei. Îți pregătim aplicația după ce alegi, iar la pașii următori poți modifica.</p>'+GOALS.map(function(g){ return gbox(g,gsel.indexOf(g.k)>=0); }).join('')+'<h1 style="font-size:20px;margin-top:18px">Despre tine</h1><p>Ca să socotim corect mâncarea. Rămâne doar în contul tău.</p><div class="onb-sex"><button type="button" data-sx="f" class="'+(bas.sex==='f'?'on':'')+'">👩 Femeie</button><button type="button" data-sx="m" class="'+(bas.sex==='m'?'on':'')+'">👨 Bărbat</button></div><div class="onb-ha"><input id="onbAge" inputmode="numeric" maxlength="2" placeholder="Vârsta (ani)" value="'+bas.age+'"><input id="onbCm" inputmode="numeric" maxlength="3" placeholder="Înălțimea (cm)" value="'+bas.cm+'"></div><button class="onb-btn" id="onbN">Continuă</button>'; o.querySelectorAll('input[data-g]').forEach(function(i){ i.addEventListener('change',function(){ var k=i.getAttribute('data-g'); gsel=gsel.filter(function(x){ return x!==k; }); if(i.checked) gsel.push(k); }); }); o.querySelectorAll('[data-sx]').forEach(function(b){ b.addEventListener('click',function(){ bas.sex=b.getAttribute('data-sx'); o.querySelectorAll('[data-sx]').forEach(function(x){ x.classList.toggle('on',x===b); }); }); }); var ia=document.getElementById('onbAge'), ic=document.getElementById('onbCm'); ia.addEventListener('input',function(){ bas.age=ia.value.replace(/\D/g,''); }); ic.addEventListener('input',function(){ bas.cm=ic.value.replace(/\D/g,''); }); }
      else if(step===2){ o.innerHTML=dots()+'<h1>Ce vrei în aplicație?</h1><p>Bifează ce te interesează. Restul rămâne ascuns.</p>'+MODS.map(function(m){ return box(m,sel[m.k]); }).join('')+'<button class="onb-btn" id="onbN">Continuă</button>'; o.querySelectorAll('input').forEach(function(i){ i.addEventListener('change',function(){ sel[i.getAttribute('data-k')]=i.checked?1:0; }); }); }
      else if(step===3){ o.innerHTML=dots()+'<h1>Câte zile pe săptămână poți merge la sală?</h1><p>Îți punem programul potrivit. Săptămânile vin una după alta, singure. Poți schimba oricând din fila Sală.</p>'+DAYS.map(function(m){ return dbox(m,m.ph===phsel,lockd(m.ph,lvsel)); }).join('')+'<h1 style="font-size:20px;margin-top:18px">Cât de greu vrei să fie?</h1>'+LVLS.map(function(m){ return lbox(m,m.k===lvsel); }).join('')+'<button class="onb-btn" id="onbPl" style="background:transparent;color:#A3FF12;border:1px solid #A3FF12;margin-bottom:10px">🎯 Alege-mi tu de unde încep (4 întrebări)</button><button class="onb-btn" id="onbN">Continuă</button>'; var pl=document.getElementById('onbPl'); if(pl) pl.addEventListener('click',function(){ if(window.zPlace) window.zPlace(function(r){ phsel=r.phase; lvsel=r.level; draw(); },{apply:false}); }); o.querySelectorAll('input').forEach(function(i){ i.addEventListener('change',function(){ if(i.hasAttribute('data-ph')) phsel=+i.getAttribute('data-ph'); else { lvsel=i.getAttribute('data-lv'); if(lockd(phsel,lvsel)) phsel=3; draw(); } }); }); }
      else if(step===4){ o.innerHTML=dots()+'<h1>Ce obiceiuri vrei să urmărești?</h1><p>Alegi doar ce ți se potrivește. Poți schimba oricând din Profil.</p>'+HABS.map(function(m){ return hbox(m,hsel.indexOf(m.k)>=0); }).join('')+'<button class="onb-btn" id="onbN">Continuă</button>'; o.querySelectorAll('input').forEach(function(i){ i.addEventListener('change',function(){ var k=i.getAttribute('data-h'); hsel=hsel.filter(function(x){ return x!==k; }); if(i.checked) hsel.push(k); }); }); }
      else { o.innerHTML=dots()+'<h1>Gata, poți începe</h1><p>Pe fila Azi îți bifezi ziua. Sala, mâncarea și suplimentele apar la fila lor. Aplicația nu oferă sfaturi medicale sau financiare: sunt informații orientative.</p><button class="onb-btn" id="onbN">Deschide aplicația</button>'; }
      document.getElementById('onbN').addEventListener('click',function(){ if(step===1 && gsel.length && (first || gsel.slice().sort().join(',')!==g0)){ var pr=goalPreset(gsel); sel=pr.mods; hsel=pr.habits; g0=gsel.slice().sort().join(','); }
 if(step===4 && !hsel.length){ hsel=HKEYS.slice(); }
 if(step<5){ step++; if(step===3 && !sel.sport) step++; draw(); } else { var q={done:1,mods:sel,habits:hsel,goals:gsel}; save(q); apply(q); renderPref(); o.remove(); try{ if(window.__zBasics) window.__zBasics({ sex:bas.sex, age:+bas.age||0, height:+bas.cm||0, goal:((first || gsel.slice().sort().join(',')!==gOpen)?(gsel.indexOf('lose')>=0?'lose':(gsel.indexOf('muscle')>=0?'gain':(first?'maintain':undefined))):undefined) }); }catch(e){} try{ window.scrollTo(0,0); }catch(e){} var phChanged=(phsel!==ph0 || lvsel!==lv0); if(phChanged) setSp(phsel,lvsel,first); if(phChanged || JSON.stringify(hsel.slice().sort())!==JSON.stringify(CURH.slice().sort())) location.reload(); } });
    }
    draw();
  }
  document.addEventListener('DOMContentLoaded',function(){ renderPref(); renderHabPref(); var pg=document.getElementById('prefGuide'); if(pg) pg.addEventListener('click',guide); });
  window.addEventListener('load',function(){
    if(load() || /type=recovery|access_token/.test(location.hash)) return;
    /* ghidul apare după ce ai intrat în cont, oricât ar dura crearea contului (confirmarea emailului poate lua minute) */
    var n=0, iv=setInterval(function(){ n++;
      var g=document.getElementById('authGate'), open=g && g.style.display!=='none';
      if(load()){ clearInterval(iv); return; }
      if(!open && window.__byzypAuthed && n>5){ clearInterval(iv); guide(); }
    },1000);
  });
})();

/* ---------- ajutor la instalare: browserul din TikTok/Instagram și „Adaugă pe ecranul principal” ---------- */
(function(){
  var ua = navigator.userAgent || '', inApp = /TikTok|musical_ly|Bytedance|Instagram|FBAN|FBAV|FB_IAB/i.test(ua), iOS = /iPhone|iPad|iPod/i.test(ua);
  var standalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;
  function card(id, html){
    try{ if(localStorage.getItem(id) === '1') return; }catch(e){}
    var d = document.createElement('div'); d.id = id;
    d.style.cssText = 'position:fixed;left:10px;right:10px;bottom:calc(env(safe-area-inset-bottom,0px) + 96px);z-index:9500;background:#12170f;color:#fff;border:1px solid #A3FF12;border-radius:16px;padding:12px 40px 12px 14px;font:500 13.5px/1.4 system-ui,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.6)';
    d.innerHTML = html + '<button aria-label="Închide" style="position:absolute;right:6px;top:4px;width:36px;height:36px;background:none;border:none;color:#fff;font-size:18px">✕</button>';
    d.querySelector('button').addEventListener('click', function(){ try{ localStorage.setItem(id, '1'); }catch(e){} d.remove(); });
    document.body.appendChild(d);
  }
  window.addEventListener('load', function(){ setTimeout(function(){
    if(standalone) return;
    if(inApp) card('zyp_tip_inapp', '<b>Ai deschis By ZyP din altă aplicație.</b><br>Apasă pe ⋯ (sus în dreapta) și alege „Deschide în browser”. Doar de acolo poți pune aplicația pe telefon și primi notificări.');
    else if(iOS) card('zyp_tip_install', '<b>📲 Pune By ZyP pe ecranul telefonului</b><br>Apasă pe butonul de trimitere ⬆️ de jos, apoi „Adaugă pe ecranul principal”. Așa se deschide ca o aplicație și poți primi notificări.');
  }, 4000); });
})();
