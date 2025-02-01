// Performance optimization utilities
const PerformanceOptimizer = {
    // Initialize performance optimizations
    init() {
        this.setupLazyLoading();
        this.setupImageOptimization();
        this.setupIntersectionObserver();
        this.setupEventListeners();
        this.optimizeThirdPartyResources();
    },

    // Lazy loading implementation
    setupLazyLoading() {
        if ('loading' in HTMLImageElement.prototype) {
            document.querySelectorAll('img[loading="lazy"]').forEach(img => {
                if (img.dataset.src) {
                    img.src = img.dataset.src;
                }
            });
        } else {
            // Fallback for browsers that don't support native lazy loading
            this.loadScript('https://cdnjs.cloudflare.com/ajax/libs/lazysizes/5.3.2/lazysizes.min.js');
        }
    },

    // Image optimization
    setupImageOptimization() {
        // Check WebP support
        const checkWebP = (callback) => {
            const webP = new Image();
            webP.onload = webP.onerror = () => {
                callback(webP.height === 2);
            };
            webP.src = 'data:image/webp;base64,UklGRjoAAABXRUJQVlA4IC4AAACyAgCdASoCAAIALmk0mk0iIiIiIgBoSygABc6WWgAA/veff/0PP8bA//LwYAAA';
        };

        // Add WebP class if supported
        checkWebP((support) => {
            if (support) document.body.classList.add('webp');
        });

        // Progressive image loading
        document.querySelectorAll('img.blur-load').forEach(img => {
            img.style.filter = 'blur(20px)';
            const loaded = () => {
                img.style.filter = 'none';
                img.style.transition = 'filter 0.5s ease-out';
            };
            if (img.complete) {
                loaded();
            } else {
                img.addEventListener('load', loaded);
            }
        });
    },

    // Intersection Observer for animations and lazy loading
    setupIntersectionObserver() {
        const observerCallback = (entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    if (entry.target.dataset.src) {
                        entry.target.src = entry.target.dataset.src;
                        entry.target.removeAttribute('data-src');
                    }
                    observer.unobserve(entry.target);
                }
            });
        };

        const observer = new IntersectionObserver(observerCallback, {
            root: null,
            rootMargin: '50px',
            threshold: 0.1
        });

        document.querySelectorAll('.animate-on-scroll, img[data-src]').forEach(el => {
            observer.observe(el);
        });
    },

    // Event listeners optimization
    setupEventListeners() {
        // Throttle scroll and resize events
        const throttle = (func, limit) => {
            let inThrottle;
            return function(...args) {
                if (!inThrottle) {
                    func.apply(this, args);
                    inThrottle = true;
                    setTimeout(() => inThrottle = false, limit);
                }
            };
        };

        // Optimized scroll handler
        const scrollHandler = throttle(() => {
            requestAnimationFrame(() => {
                // Handle scroll-based animations
                const scrolled = window.scrollY;
                document.documentElement.style.setProperty('--scroll', scrolled);
            });
        }, 100);

        window.addEventListener('scroll', scrollHandler, { passive: true });

        // Mobile menu optimization
        const mobileMenu = document.querySelector('.mobile-menu');
        const navLinks = document.querySelector('.nav-links');
        
        if (mobileMenu && navLinks) {
            mobileMenu.addEventListener('click', () => {
                const expanded = mobileMenu.getAttribute('aria-expanded') === 'true';
                mobileMenu.setAttribute('aria-expanded', !expanded);
                navLinks.classList.toggle('active');
            });
        }
    },

    // Optimize third-party resource loading
    optimizeThirdPartyResources() {
        // Defer non-critical third-party scripts
        const deferThirdParty = () => {
            const thirdPartyScripts = [
                { src: 'https://cdn.jsdelivr.net/particles.js/2.0.0/particles.min.js', async: true },
                { src: 'https://unpkg.com/aos@next/dist/aos.js', defer: true }
            ];

            thirdPartyScripts.forEach(script => {
                const scriptEl = document.createElement('script');
                Object.assign(scriptEl, script);
                document.body.appendChild(scriptEl);
            });
        };

        // Load third-party resources after page load
        if (document.readyState === 'complete') {
            deferThirdParty();
        } else {
            window.addEventListener('load', deferThirdParty);
        }
    },

    // Utility function to load scripts
    loadScript(src) {
        const script = document.createElement('script');
        script.src = src;
        script.async = true;
        document.body.appendChild(script);
    }
};

// Initialize performance optimizations when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => PerformanceOptimizer.init());
} else {
    PerformanceOptimizer.init();
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PerformanceOptimizer;
}
