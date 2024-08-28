const CACHE_NAME = 'my-cache-v1';
const urlsToCache = [
    '/',
    '/static/favicon.png',
    '/static/service-worker.js',
    '/dist/index.bundle.js',
    '/dist/runtime.bundle.js',
    '/dist/index.html',
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return Promise.all(
                urlsToCache.map(url => {
                    return cache.add(url).catch(error => {
                        console.error('Failed to cache:', url, error);
                    });
                })
            );
        }).then(() => {
            return self.skipWaiting();
        }).catch(error => {
            console.error('Failed to cache resources:', error);
        })
    );
});



self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
        .then(response => {
            if (response) {
                return response;
            }

            return fetch(event.request).then(networkResponse => {
                return caches.open(CACHE_NAME).then(cache => {
                    cache.put(event.request, networkResponse.clone());
                    return networkResponse;
                });
            });
        }).catch(() => {
            return new Promise((resolve, reject) => {
                const request = indexedDB.open('FileStorage');

                request.onsuccess = event => {
                    const db = event.target.result;
                    const transaction = db.transaction('files');
                    const store = transaction.objectStore('files');
                    const url = event.request.url;

                    const getRequest = store.get(url);

                    getRequest.onsuccess = () => {
                        if (getRequest.result) {
                            resolve(new Response(getRequest.result.fileContent));
                        } else {
                            reject('No data found in IndexedDB.');
                        }
                    };

                    getRequest.onerror = () => reject(getRequest.error);
                };

                request.onerror = () => reject('IndexedDB request failed.');
            });
        })
    );
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