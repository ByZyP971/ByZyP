/* By ZyP · player de muzică de sală (melodii originale, în folderul music/) */
(function(){
  'use strict';
  var TR = {
    heavy:{ f:'muzica-forta.mp3?v=1', n:'Forță', bpm:140 },
    pump: { f:'muzica-pump.mp3?v=1',  n:'Pump', bpm:128 },
    legs: { f:'muzica-ritm.mp3?v=1',  n:'Ritm constant', bpm:150 },
    core: { f:'muzica-focus.mp3?v=1', n:'Concentrare', bpm:118 }
  };
  var ORDER = ['heavy','pump','legs','core'];
  var au = null, cur = null, bar = null;

  function ui(){
    if(bar) return bar;
    bar = document.createElement('div'); bar.id = 'zMus'; bar.className = 'z-mus'; bar.hidden = true;
    bar.innerHTML = '<span class="z-mus-ic">🎵</span><span class="z-mus-t" id="zMusT"></span>' +
      '<button class="z-mus-b" data-m="prev" aria-label="Înapoi">⏮</button><button class="z-mus-b" data-m="pp" id="zMusPP" aria-label="Pauză">⏸</button>' +
      '<button class="z-mus-b" data-m="next" aria-label="Următoarea">⏭</button><button class="z-mus-b" data-m="x" aria-label="Oprește">✕</button>';
    document.body.appendChild(bar);
    bar.addEventListener('click', function(e){
      var b = e.target.closest('[data-m]'); if(!b) return; var a = b.getAttribute('data-m');
      if(a === 'pp') toggle(); else if(a === 'x') stop();
      else { var i = ORDER.indexOf(cur); i = (i + (a === 'next' ? 1 : ORDER.length - 1)) % ORDER.length; play(ORDER[i], true); }
    });
    return bar;
  }
  function label(){ var t = TR[cur]; var el = document.getElementById('zMusT'); if(el && t) el.textContent = t.n + ' · ' + t.bpm + ' BPM'; var pp = document.getElementById('zMusPP'); if(pp) pp.textContent = (au && !au.paused) ? '⏸' : '▶️'; }
  function meta(){
    try{ if(!('mediaSession' in navigator) || !cur) return; var t = TR[cur];
      navigator.mediaSession.metadata = new MediaMetadata({ title: t.n + ' · ' + t.bpm + ' BPM', artist: 'By ZyP · Muzică de sală', album: 'By ZyP' });
      navigator.mediaSession.setActionHandler('play', function(){ toggle(true); });
      navigator.mediaSession.setActionHandler('pause', function(){ toggle(false); });
      navigator.mediaSession.setActionHandler('nexttrack', function(){ var i = (ORDER.indexOf(cur) + 1) % ORDER.length; play(ORDER[i], true); });
      navigator.mediaSession.setActionHandler('previoustrack', function(){ var i = (ORDER.indexOf(cur) + ORDER.length - 1) % ORDER.length; play(ORDER[i], true); });
    }catch(e){}
  }
  function play(style, force){
    var t = TR[style]; if(!t) return;
    if(!au){ au = new Audio(); au.loop = true; au.preload = 'auto'; au.addEventListener('play', label); au.addEventListener('pause', label);
      au.addEventListener('error', function(){ if(!cur) return;   /* fișierul lipsește sau nu e internet: mesaj scurt și playerul se închide curat */
        stop(); if(window.zToast) window.zToast('Muzica nu e disponibilă acum. Încearcă mai târziu.'); }); }
    if(cur === style && !force){ toggle(); return; }
    cur = style; au.src = t.f; ui().hidden = false; label(); meta();
    var p; try{ p = au.play(); }catch(e){ p = null; }
    if(p && p.catch) p.catch(function(e){ if(e && e.name === 'NotAllowedError' && cur === style){ if(window.zToast) window.zToast('Apasă pe ▶️ ca să pornească muzica.'); } label(); });   /* fișier lipsă: se ocupă evenimentul „error”; schimbare rapidă de piesă: nimic de spus */
  }
  function toggle(on){ if(!au || !cur) return; var want = (typeof on === 'boolean') ? on : au.paused; if(want){ var p = au.play(); if(p && p.catch) p.catch(function(){}); } else au.pause(); label(); }
  function stop(){ cur = null; if(au){ try{ au.pause(); au.removeAttribute('src'); au.load(); }catch(e){} } if(bar) bar.hidden = true;
    try{ if('mediaSession' in navigator){ navigator.mediaSession.metadata = null; navigator.mediaSession.playbackState = 'none'; } }catch(e){} }
  document.addEventListener('click', function(e){ var b = e.target.closest('[data-mus]'); if(b){ e.preventDefault(); play(b.getAttribute('data-mus')); } });

  // ---------- piese cu voce: listă pe stil, se deschid într-o pagină cu videoclipuri ----------
  var SONGS = {
    heavy:[['Eminem','Till I Collapse'],['Kanye West','Power'],['Survivor','Eye of the Tiger'],['AC/DC','Thunderstruck'],['Metallica','Enter Sandman']],
    pump:[['Eminem','Lose Yourself'],['Kendrick Lamar','HUMBLE.'],['50 Cent','In Da Club'],['Travis Scott','SICKO MODE'],['Drake','Started From the Bottom']],
    legs:[['Avicii','Levels'],['Daft Punk','Harder, Better, Faster, Stronger'],['The Prodigy','Firestarter'],['Swedish House Mafia','Don\'t You Worry Child'],['Calvin Harris','Feel So Close']],
    core:[['The Weeknd','Blinding Lights'],['Imagine Dragons','Believer'],['Linkin Park','Numb'],['Coldplay','Viva La Vida'],['Dua Lipa','Physical']]
  };
  var MIX = { heavy:'gym motivation rock rap songs with lyrics', pump:'gym hip hop workout songs with lyrics', legs:'leg day edm workout songs with vocals', core:'workout pop rock songs with lyrics' };
  function yt(q){ return 'https://www.youtube.com/results?search_query=' + encodeURIComponent(q); }
  function eh(t){ return String(t).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
  var sheet = null;
  function closeSongs(){ if(sheet){ sheet.remove(); sheet = null; } }
  function openSongs(style){
    var t = TR[style]; if(!t || !SONGS[style]) return; closeSongs();
    sheet = document.createElement('div'); sheet.className = 'z-yt'; sheet.id = 'zSongs';
    sheet.innerHTML = '<div class="z-yt-box"><button class="z-yt-x" data-y="x" aria-label="Închide">✕</button><div class="z-yt-h">🎤 ' + eh(t.n) + ' · ' + t.bpm + ' BPM</div>' +
      '<p class="z-yt-p">Piese cu voce care se potrivesc la acest exercițiu. Apeși pe una și se deschide într-o pagină cu videoclipuri.</p>' +
      SONGS[style].map(function(x){ return '<a class="z-song" target="_blank" rel="noopener" href="' + yt(x[0] + ' ' + x[1] + ' official') + '"><span>▶️</span><b>' + eh(x[1]) + '</b><small>' + eh(x[0]) + '</small></a>'; }).join('') +
      '<a class="z-song z-song-mix" target="_blank" rel="noopener" href="' + yt(MIX[style]) + '"><span>🔀</span><b>Mai multe piese ca astea</b><small>căutare de videoclipuri</small></a></div>';
    document.body.appendChild(sheet);
    sheet.addEventListener('click', function(e){ if(e.target === sheet || e.target.closest('[data-y="x"]')) closeSongs(); });
  }
  document.addEventListener('click', function(e){ var b = e.target.closest('[data-songs]'); if(b){ e.preventDefault(); openSongs(b.getAttribute('data-songs')); } });
  window.zMusic =  { play: play, stop: stop };
})();
