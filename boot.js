window.zEsc=function(t){return String(t==null?'':t).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});};window.zToast=function(m){try{var o=document.getElementById('zToast');if(!o){o=document.createElement('div');o.id='zToast';o.style.cssText='position:fixed;left:50%;transform:translateX(-50%);bottom:calc(env(safe-area-inset-bottom,0px) + 150px);max-width:86vw;z-index:9999;padding:11px 16px;border-radius:16px;background:rgba(20,18,12,.96);border:1px solid rgba(163,255,18,.5);color:#F5F8F2;font-size:13.5px;font-weight:600;text-align:center;box-shadow:0 8px 30px rgba(0,0,0,.5);transition:opacity .25s;pointer-events:none;';document.body.appendChild(o);}o.textContent=m;o.style.opacity='1';clearTimeout(o._t);o._t=setTimeout(function(){o.style.opacity='0';},2800);}catch(e){}};
window.zJoke=function(a){return a[Math.floor(Math.random()*a.length)];};
/* The Gold tab is hidden: do not waste data/battery on its price feeds */
(function(){ var GOLD=/xaus\.com|gold-api\.com|PAXGUSDT|xauusd\.json|paxgusdt/i, F=window.fetch;
  if(F){ window.fetch=function(u,o){ try{ if(GOLD.test(String(u&&u.url||u))) return Promise.reject(new Error('gold off')); }catch(e){} return F.apply(this,arguments); }; }
  var W=window.WebSocket; if(W){ window.WebSocket=function(u,pr){ if(GOLD.test(String(u))){ return { close:function(){}, send:function(){}, addEventListener:function(){}, removeEventListener:function(){}, readyState:3 }; } return pr===undefined?new W(u):new W(u,pr); }; window.WebSocket.prototype=W.prototype; ['CONNECTING','OPEN','CLOSING','CLOSED'].forEach(function(k){ window.WebSocket[k]=W[k]; }); }
})();

/* click delegation (replaces inline onclick, so the CSP can forbid inline scripts) */
document.addEventListener('click',function(e){var t=e.target&&e.target.closest?e.target.closest('[data-act]'):null;if(!t)return;var a=t.getAttribute('data-act');var f=a==='vault'?window.__openVault:a==='terminal'?window.__openTerminal:null;if(f)f();});
document.addEventListener('error',function(e){var t=e.target;if(t&&t.tagName==='IMG'&&t.classList&&t.classList.contains('onb-logo'))t.style.visibility='hidden';},true);
/* anti-clickjacking: the app must not run inside someone else's frame */
try{if(window.top!==window.self){try{window.top.location=window.self.location;}catch(e){document.documentElement.style.display='none';}}}catch(e){document.documentElement.style.display='none';}
