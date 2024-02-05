const cacheName = 'cache_v1';
const includeToCache = [
  '/',
  '/static/favicon.png',
  '/static/icon.png',
  '/static/data.json',
  '/static/custom_content.json',
  '/static/jquery.js',
  '/static/script.js',
  '/static/bootstrap.js',
  '/static/materialize.min.js',
  '/static/zero-md.min.js',
  '/static/css/main.css',
  '/static/css/icon.css',
  '/static/css/bootstrap.css',
  '/static/css/bootstrap-select.css',
  '/static/suneditor.min.js',
  '/static/css/suneditor.min.css',
  '/static/css/materialize.min.css'
];

/* Start the service worker and cache all of the app's content */
self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(cacheName).then(cache => {
      return Promise.all(
        includeToCache.map(url => {
          return fetch(url)
            .then(response => {
              // Check if the response is valid (status code 200 OK)
              if (!response.ok) {
                throw new Error(`Failed to fetch ${url} (status: ${response.status})`);
              }
              return cache.put(url, response);
            })
            .catch(error => {
              console.error(`Caching failed for ${url}: ${error.message}`);
            });
        })
      );
    })
  );
});
/* Serve cached content when offline */
self.addEventListener('fetch', (event) => {
  event.respondWith((async () => {

    const cache = await caches.open(cacheName);

    try {
      const cachedResponse = await cache.match(event.request);
      if (cachedResponse) {
        console.log('cachedResponse: ', event.request.url);
        return cachedResponse;
      }

      const fetchResponse = await fetch(event.request);
      if (fetchResponse) {
        console.log('fetchResponse: ', event.request.url);
        await cache.put(event.request, fetchResponse.clone());
        return fetchResponse;
      }
    } catch (error) {
      console.log('Fetch failed: ', error);
      const cachedResponse = await cache.match('/en/offline.html');
      return cachedResponse;
    }
  })());
});

self.addEventListener('activate', event => {
  // delete any caches that aren't in cacheName
  // which will get rid of version
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.map(key => {
        if (cacheName !== key) {
          return caches.delete(key);
        }
      })
    )).then(() => {
      console.log(cacheName + ' now ready to handle fetches!');
    })
  );
});
