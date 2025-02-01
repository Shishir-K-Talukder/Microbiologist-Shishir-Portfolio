// Cache Optimization Module
const CacheOptimizer = {
    init() {
        this.setupServiceWorker();
        this.initializeCache();
        this.prefetchResources();
    },

    // Setup Service Worker
    async setupServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.register('/sw.js');
                console.log('ServiceWorker registered:', registration);
            } catch (error) {
                console.error('ServiceWorker registration failed:', error);
            }
        }
    },

    // Initialize Cache
    async initializeCache() {
        if ('caches' in window) {
            try {
                const cache = await caches.open('portfolio-v1');
                const resourcesToCache = [
                    '/',
                    '/index.html',
                    '/styles.css',
                    '/js/optimized.js',
                    '/js/analytics.js',
                    '/images/Hero.webp',
                    '/images/project1.webp',
                    '/images/project2.webp'
                ];
                await cache.addAll(resourcesToCache);
            } catch (error) {
                console.error('Cache initialization failed:', error);
            }
        }
    },

    // Prefetch Resources
    prefetchResources() {
        const prefetchLinks = [
            '/about.html',
            '/research.html',
            '/contact.html'
        ];

        prefetchLinks.forEach(link => {
            const prefetchLink = document.createElement('link');
            prefetchLink.rel = 'prefetch';
            prefetchLink.href = link;
            document.head.appendChild(prefetchLink);
        });
    },

    // Cache API Utilities
    async cacheResource(url, response) {
        if ('caches' in window) {
            try {
                const cache = await caches.open('portfolio-v1');
                await cache.put(url, response);
                return true;
            } catch (error) {
                console.error('Cache storage failed:', error);
                return false;
            }
        }
        return false;
    },

    async getCachedResource(url) {
        if ('caches' in window) {
            try {
                const cache = await caches.open('portfolio-v1');
                return await cache.match(url);
            } catch (error) {
                console.error('Cache retrieval failed:', error);
                return null;
            }
        }
        return null;
    },

    // Clear Old Caches
    async clearOldCaches() {
        if ('caches' in window) {
            try {
                const cacheNames = await caches.keys();
                await Promise.all(
                    cacheNames
                        .filter(name => name !== 'portfolio-v1')
                        .map(name => caches.delete(name))
                );
            } catch (error) {
                console.error('Cache cleanup failed:', error);
            }
        }
    }
};

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CacheOptimizer;
}
