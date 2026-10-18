/* YOUNGEST FASHION service worker: lets phones install the shop like an app.
   It never stores pages, so customers always get your newest version. */
self.addEventListener("install",e=>self.skipWaiting());
self.addEventListener("activate",e=>e.waitUntil(self.clients.claim()));
self.addEventListener("fetch",()=>{});
