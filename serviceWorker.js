const CACHE_NAME = `cache`;
const urlsToCache = [
    '/',
    '/static/css/theme.css',
    '/static/css/style.css',
    '/static/icons/favicon.png',
    '/static/icons/icon.png',
    '/serviceWorker.js',
    '/dist/index.bundle.js',
    '/dist/runtime.bundle.js',
    '/dist/361.bundle.js',
    '/dist/index.html',
    '/dist/privacy_policy.html',
];

// Install event: cache resources
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

// Fetch event: serve from cache, then network
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);
    if (event.request.method === 'GET') {
        event.respondWith(
            caches.match(event.request).then(cachedResponse => {
                if (cachedResponse) {
                    console.log('Serving from cache:', event.request.url);
                    return cachedResponse;
                }

                return fetch(event.request).then(fetchResponse => {
                    return caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, fetchResponse.clone());
                        return fetchResponse;
                    });
                }).catch(error => {
                    console.error('Fetch failed:', error);
                    // Return a fallback page or message
                    return new Response("You are offline, and this resource is not cached.");
                });
            })
        );
    }
});


// Activate event: clear old caches
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

// Message event: update cache when version changes
self.addEventListener('message', event => {
    if (event.data.action === 'newUpdateCache') {
        updateCache(true);
    }
    if (event.data.action === 'updateCache') {
        updateCache(false);
    }
});

function updateCache(giveResponse) {
    caches.keys().then(function (names) {
        return Promise.all(names.map(name => caches.delete(name)));
    }).then(function () {
        return caches.open(CACHE_NAME).then(cache => {
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
        if (giveResponse) {
            self.clients.matchAll().then(clients => {
                clients.forEach(client => client.postMessage({
                    action: 'cacheUpdated'
                }));
            });
        }
    });
}
