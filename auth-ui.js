(function(){ var b = document.getElementById('authEye'), i = document.getElementById('authPass'); if(!b || !i) return;
  b.addEventListener('click', function(){ var show = i.type === 'password'; i.type = show ? 'text' : 'password'; b.classList.toggle('on', show); b.textContent = show ? '🙈' : '👁'; b.setAttribute('aria-label', show ? 'Ascunde parola' : 'Arată parola'); }); })();
