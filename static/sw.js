const cacheName = 'cache_v1';
const includeToCache = [
    '/',
    '/static/Varela Round.ttf',
    '/static/favicon.png',
    '/static/icon.png',
    '/static/data.json',
    '/static/custom_content.json',
    '/static/jquery.js',
    '/static/jquery.min.js',
    '/static/sw.js',
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
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(cacheName).then(cache => {
            return cache.addAll(includeToCache);
        }).then(() => {
            return self.skipWaiting();
        }).catch(error => {
            console.error('Failed to cache:', error);
        })
    );
});

/* Serve cached content when offline */
self.addEventListener('fetch', event => {
    if (event.request.method === 'GET') {
        event.respondWith(
            caches.match(event.request).then(cachedResponse => {
                if (cachedResponse) {
                    console.log('Serving from cache:', event.request.url);
                    return cachedResponse;
                }

                return fetch(event.request).then(fetchResponse => {
                    return caches.open(cacheName).then(cache => {
                        cache.put(event.request, fetchResponse.clone());
                        return fetchResponse;
                    });
                });
            }).catch(error => {
                console.error('Fetch failed:', error);
                // You can return a fallback page here if needed
            })
        );
    }
});

/* Activate the service worker */
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.map(key => {
                    if (key !== cacheName) {
                        console.log('Deleting old cache:', key);
                        return caches.delete(key);
                    }
                })
            );
        }).then(() => {
            console.log(cacheName + ' is now ready to handle fetches!');
            return self.clients.claim();
        })
    );
});

self.addEventListener('message', event => {
    if (event.data.action === 'updateCache') {
        updateCache();
    }
});


function updateCache() {
    caches.keys().then(function(names) {
        return Promise.all(names.map(name => caches.delete(name)));
    }).then(function() {
        caches.open(cacheName).then(cache => {
            return Promise.all(
                includeToCache.map(url => {
                    return fetch(url, { cache: 'no-store' }).then(response => {
                        if (!response.ok) {
                            throw new Error('Network response was not ok');
                        }
                        return cache.put(url, response);
                    }).catch(error => {
                        console.error('Failed to fetch and cache:', url, error);
                    });
                })
            );
        });
    }).then(() => {
        self.clients.matchAll().then(clients => {
            clients.forEach(client => client.postMessage({ action: 'cacheUpdated' }));
        });
    });
}