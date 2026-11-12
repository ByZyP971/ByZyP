(function(){ var b = document.getElementById('authEye'), i = document.getElementById('authPass'); if(!b || !i) return;
  b.addEventListener('click', function(){ var show = i.type === 'password'; i.type = show ? 'text' : 'password'; b.classList.toggle('on', show); b.textContent = show ? '🙈' : '👁'; b.setAttribute('aria-label', show ? 'Ascunde parola' : 'Arată parola'); });
  /* tasta „Enter / Mergi” de pe tastatură = butonul „Intră” */
  var em = document.getElementById('authEmail'), go = document.getElementById('authLogin');
  [em, i].forEach(function(x){ if(x) x.addEventListener('keydown', function(e){ if(e.key === 'Enter' && go){ e.preventDefault(); if(x === em && !i.value){ i.focus(); return; } go.click(); } }); }); })();
