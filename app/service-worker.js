// Register service worker
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/service-worker.js')
        .then(function(registration) {
            console.log('ServiceWorker registration successful with scope: ', registration.scope);
        })
        .catch(function(error) {
            console.log('ServiceWorker registration failed: ', error);
        });
}

// Fetch tables and files
fetch('/tables')
    .then(response => response.json())
    .then(tables => {
        tables.forEach(table => {
            fetch(`/files/${table}`)
                .then(response => response.json())
                .then(files => {
                    // Cache files using the service worker
                });
        });
    });
