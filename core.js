/* ===== collapsible history blocks ===== */
window.__hxOpen = {};
window.hxHtml = function(key, label, inner){
  var open = !!window.__hxOpen[key];
  return '<button class="past-toggle hx-btn' + (open ? ' on' : '') + '" data-hx="' + key + '" data-label="' + label + '">' + (open ? 'Ascunde ' : 'Arată ') + label + (open ? ' ▴' : ' ▾') + '</button>' +
    '<div class="hx-body" data-hxb="' + key + '" style="display:' + (open ? 'block' : 'none') + ';margin-top:10px;">' + inner + '</div>';
};
document.addEventListener('click', function(e){
  var b = e.target.closest ? e.target.closest('.hx-btn') : null; if(!b) return;
  var k = b.getAttribute('data-hx'), body = document.querySelector('[data-hxb="' + k + '"]'); if(!body) return;
  var open = body.style.display === 'none';
  body.style.display = open ? 'block' : 'none'; window.__hxOpen[k] = open; b.classList.toggle('on', open);
  var l = b.getAttribute('data-label'); b.textContent = (open ? 'Ascunde ' : 'Arată ') + l + (open ? ' ▴' : ' ▾');
});
