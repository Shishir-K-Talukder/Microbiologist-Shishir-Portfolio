const CACHE_NAME = 'portfolio-v1';
const OFFLINE_URL = '/offline.html';

// Resources to cache
const PRECACHE_URLS = [
    '/',
    '/index.html',
    '/styles.css',
    '/js/optimized.js',
    '/js/analytics.js',
    '/js/cache.js',
    '/images/Hero.webp',
    '/images/project1.webp',
    '/images/project2.webp',
    OFFLINE_URL
];

// Install Service Worker
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(PRECACHE_URLS))
            .then(() => self.skipWaiting())
    );
});

// Activate Service Worker
self.addEventListener('activate', event => {
    event.waitUntil(
        Promise.all([
            // Clean up old caches
            caches.keys().then(cacheNames => {
                return Promise.all(
                    cacheNames
                        .filter(cacheName => cacheName !== CACHE_NAME)
                        .map(cacheName => caches.delete(cacheName))
                );
            }),
            // Take control of all clients
            self.clients.claim()
        ])
    );
});

// Fetch Event Handler
self.addEventListener('fetch', event => {
    // Skip cross-origin requests
    if (!event.request.url.startsWith(self.location.origin)) {
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then(response => {
                if (response) {
                    // Return cached response
                    return response;
                }

                // Clone the request
                const fetchRequest = event.request.clone();

                return fetch(fetchRequest)
                    .then(response => {
                        // Check if valid response
                        if (!response || response.status !== 200 || response.type !== 'basic') {
                            return response;
                        }

                        // Clone the response
                        const responseToCache = response.clone();

                        // Cache the fetched response
                        caches.open(CACHE_NAME)
                            .then(cache => {
                                cache.put(event.request, responseToCache);
                            });

                        return response;
                    })
                    .catch(error => {
                        // Check if request is for a page
                        if (event.request.mode === 'navigate') {
                            return caches.match(OFFLINE_URL);
                        }
                        throw error;
                    });
            })
    );
});

// Background Sync
self.addEventListener('sync', event => {
    if (event.tag === 'sync-forms') {
        event.waitUntil(syncForms());
    }
});

// Push Notifications
self.addEventListener('push', event => {
    const options = {
        body: event.data.text(),
        icon: '/images/icon.png',
        badge: '/images/badge.png'
    };

    event.waitUntil(
        self.registration.showNotification('Portfolio Update', options)
    );
});

// Helper Functions
async function syncForms() {
    try {
        const cache = await caches.open(CACHE_NAME);
        const responses = await cache.match('form-data');
        if (responses) {
            // Process cached form data
            const formData = await responses.json();
            // Send to server
            await fetch('/api/submit-form', {
                method: 'POST',
                body: JSON.stringify(formData),
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            // Clear cached form data
            await cache.delete('form-data');
        }
    } catch (error) {
        console.error('Form sync failed:', error);
    }
}
