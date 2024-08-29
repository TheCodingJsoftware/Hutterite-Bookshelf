const CACHE_NAME = 'my-cache-v2';
const urlsToCache = [
    '/',
    '/static/favicon.png',
    '/static/icon.png',
    '/serviceWorker.js',
    '/dist/index.bundle.js',
    '/dist/index.html',
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            console.log('Opened cache');
            return Promise.all(
                urlsToCache.map(url => {
                    return fetch(url).then(response => {
                        if (!response.ok) {
                            throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
                        }
                        console.log(`Caching ${url}`);
                        return cache.put(url, response.clone());
                    }).catch(error => {
                        console.error(`Error caching ${url}:`, error);
                    });
                })
            );
        }).then(() => {
            return self.skipWaiting();
        }).catch(error => {
            console.error('Failed to open cache:', error);
        })
    );
});


self.addEventListener('fetch', event => {
    if (event.request.method === 'GET') {
        event.respondWith(
            caches.match(event.request).then(cachedResponse => {
                if (cachedResponse) {
                    console.log('Serving from cache:', event.request.url);
                    return cachedResponse;
                }

                if (event.request.mode === 'navigate') {
                    return caches.match('/dist/index.html');
                }

                return fetch(event.request).then(fetchResponse => {
                    return caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, fetchResponse.clone());
                        return fetchResponse;
                    });
                }).catch(error => {
                    console.error('Fetch failed:', error);
                    return new Response("You are offline, and this resource is not cached.");
                });
            })
        );
    }
});


self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.map(key => {
                    if (key !== CACHE_NAME) {
                        console.log('Deleting old cache:', key);
                        return caches.delete(key);
                    }
                })
            );
        }).then(() => {
            console.log(CACHE_NAME + ' is now ready to handle fetches!');
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
    caches.keys().then(function (names) {
        return Promise.all(names.map(name => caches.delete(name)));
    }).then(function () {
        caches.open(CACHE_NAME).then(cache => {
            return Promise.all(
                urlsToCache.map(url => {
                    return fetch(url, {
                        cache: 'no-store'
                    }).then(response => {
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
            clients.forEach(client => client.postMessage({
                action: 'cacheUpdated'
            }));
        });
    });
}