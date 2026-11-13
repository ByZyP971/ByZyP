/* By ZyP — service worker: shows push notifications */
var CACHE = 'byzyp-v3';
/* La instalare: pagina și fișierele ei (cu versiunea din pagină) se pun deoparte, ca aplicația să pornească fără internet chiar după o singură deschidere. */
function precache(){
  return fetch('./', { cache: 'no-cache' }).then(function(res){
    if(!res || res.status !== 200) return;
    var copy = res.clone();
    return res.text().then(function(html){
      var urls = [], re = /<(?:script|link)\b[^>]*?\b(?:src|href)="([^"]+)"/g, m;
      while((m = re.exec(html))){ try{ var u = new URL(m[1], self.registration.scope); if((u.origin === self.location.origin || u.hostname === 'cdn.jsdelivr.net') && /\.(js|css)$/i.test(u.pathname) && !/sw\.js$/i.test(u.pathname)) urls.push(u.href); }catch(err){} }
      return caches.open(CACHE).then(function(c){
        return c.put(new Request(self.registration.scope), copy).then(function(){
          return Promise.all(urls.map(function(h){ return c.match(h).then(function(hit){ if(hit) return; return fetch(h).then(function(r){ if(r && r.status === 200 && (r.type === 'basic' || r.type === 'cors')) return c.put(h, r); }).catch(function(){}); }); }));
        });
      });
    });
  }).catch(function(){});
}
self.addEventListener('install', function(e){ self.skipWaiting(); e.waitUntil(precache()); });
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
    if(hit){ try{ e.waitUntil(net.catch(function(){})); }catch(err){ net.catch(function(){}); } return hit; }
    return net.catch(function(){ return caches.match(req, { ignoreSearch: true }).then(function(old){ return old || Response.error(); }); });
  }));
});
self.addEventListener('push', function(e){
  var d = {};
  try{ d = e.data ? e.data.json() : {}; }catch(err){ d = { title:'By ZyP', body: e.data ? e.data.text() : '' }; }
  if(!d || typeof d !== 'object') d = { body: d == null ? '' : String(d) };
  var s = function(v, n){ return (typeof v === 'string' || typeof v === 'number') ? String(v).slice(0, n) : ''; };
  e.waitUntil(self.registration.showNotification(s(d.title, 120) || 'By ZyP', {
    body: s(d.body, 600), icon: 'icon.png', badge: 'icon.png', tag: s(d.tag, 60) || undefined, data: { url: s(d.url, 500) || './' }
  }));
});
self.addEventListener('notificationclick', function(e){
  e.notification.close();
  var scope = self.registration.scope, url = (e.notification.data && e.notification.data.url) || './', t;
  try{ t = new URL(url, scope); if(t.protocol !== 'https:' && t.protocol !== 'http:') t = new URL(scope); }catch(err){ t = new URL(scope); }   // adresa e relativă la folderul aplicației (merge și într-un sub-folder)
  var ours = t.origin === self.location.origin && t.href.indexOf(scope) === 0;
  e.waitUntil(self.clients.matchAll({ type:'window', includeUncontrolled:true }).then(function(list){
    if(!ours){ if(self.clients.openWindow) return self.clients.openWindow(t.href); return; }                  // o știre: se deschide separat
    for(var i=0;i<list.length;i++){ var c = list[i];
      if(c.url.indexOf(scope) !== 0 || !('focus' in c)) continue;                                              // doar ferestrele aplicației noastre
      return c.focus().then(function(w){ w = w || c; if(t.hash && w.url !== t.href && 'navigate' in w) return w.navigate(t.href).catch(function(){}); }, function(){ if(self.clients.openWindow) return self.clients.openWindow(t.href); });
    }
    if(self.clients.openWindow) return self.clients.openWindow(t.href);
  }));
});
