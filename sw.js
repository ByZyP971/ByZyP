/* By ZyP — service worker: shows push notifications */
var CACHE = 'byzyp-v1';
self.addEventListener('install', function(e){ self.skipWaiting(); });
self.addEventListener('activate', function(e){
  e.waitUntil(caches.keys().then(function(ks){ return Promise.all(ks.filter(function(k){ return k.indexOf('byzyp-') === 0 && k !== CACHE; }).map(function(k){ return caches.delete(k); })); }).then(function(){ return self.clients.claim(); }));
});
/* Fără internet: pagina și fișierele aplicației se deschid din memoria telefonului. Datele (Supabase), harta și fișierele de stare merg mereu pe internet. */
function putCache(req, res){
  if(!res || res.status !== 200 || (res.type !== 'basic' && res.type !== 'cors')) return;
  var copy = res.clone();
  caches.open(CACHE).then(function(c){
    c.put(req, copy);
    var u = new URL(req.url); if(u.search){ c.keys().then(function(ks){ ks.forEach(function(k){ var ku = new URL(k.url); if(ku.origin === u.origin && ku.pathname === u.pathname && ku.search !== u.search) c.delete(k); }); }); }   // versiunea veche a aceluiași fișier
  }).catch(function(){});
}
self.addEventListener('fetch', function(e){
  var req = e.request; if(req.method !== 'GET') return;
  var u; try{ u = new URL(req.url); }catch(err){ return; }
  var same = u.origin === self.location.origin, lib = u.hostname === 'cdn.jsdelivr.net';
  if(!same && !lib) return;                                   // Supabase, hartă, alte site-uri: neatinse
  if(req.headers.get('range')) return;                        // audio
  if(/\.(json|mp3|mp4|webmanifest)$/i.test(u.pathname) || /sw\.js$/i.test(u.pathname)) return;   // stare, muzică: mereu de pe internet
  if(lib){ e.respondWith(caches.match(req).then(function(hit){ return hit || fetch(req).then(function(res){ putCache(req, res); return res; }); })); return; }
  var page = req.mode === 'navigate' || /\/(index\.html)?$/.test(u.pathname);
  if(page){   // pagina: întâi internetul (maxim 3 secunde), apoi copia salvată
    e.respondWith(new Promise(function(resolve){
      var doneF = false, t = setTimeout(function(){ caches.match(req, { ignoreSearch: true }).then(function(hit){ if(hit && !doneF){ doneF = true; resolve(hit); } }); }, 3000);
      fetch(req).then(function(res){ clearTimeout(t); putCache(req, res); if(!doneF){ doneF = true; resolve(res); } })
        .catch(function(){ clearTimeout(t); caches.match(req, { ignoreSearch: true }).then(function(hit){ if(!doneF){ doneF = true; resolve(hit || new Response('<meta charset="utf-8"><body style="background:#000;color:#fff;font:16px system-ui;padding:40px;text-align:center">Nu ai internet. Deschide aplicația o dată cu internet și apoi merge și fără.</body>', { headers: { 'Content-Type': 'text/html; charset=utf-8' } })); } }); });
    }));
    return;
  }
  // restul fișierelor: copia salvată imediat, iar în spate se aduce varianta nouă
  e.respondWith(caches.match(req).then(function(hit){
    var net = fetch(req).then(function(res){ putCache(req, res); return res; });
    if(hit){ net.catch(function(){}); return hit; }
    return net.catch(function(){ return caches.match(req, { ignoreSearch: true }).then(function(old){ return old || Response.error(); }); });
  }));
});
self.addEventListener('push', function(e){
  var d = {};
  try{ d = e.data ? e.data.json() : {}; }catch(err){ d = { title:'By ZyP', body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'By ZyP', {
    body: d.body || '', icon: 'icon.png', badge: 'icon.png', tag: d.tag || undefined, data: { url: d.url || './' }
  }));
});
self.addEventListener('notificationclick', function(e){
  e.notification.close();
  var url = (e.notification.data && e.notification.data.url) || './';
  e.waitUntil(self.clients.matchAll({ type:'window', includeUncontrolled:true }).then(function(list){
    for(var i=0;i<list.length;i++){ if('focus' in list[i]) return list[i].focus(); }
    if(self.clients.openWindow) return self.clients.openWindow(url);
  }));
});
