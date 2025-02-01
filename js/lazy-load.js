// Advanced Lazy Loading Utility
class LazyLoader {
    constructor(options = {}) {
        this.options = {
            rootMargin: '50px 0px',
            threshold: [0, 0.25, 0.5, 0.75, 1], // Multiple thresholds for smoother loading
            loadingClass: 'lazy-loading',
            loadedClass: 'lazy-loaded',
            errorClass: 'lazy-error',
            placeholderColor: '#f0f0f0',
            blurUpSize: '10px',
            retryCount: 3,
            retryDelay: 2000,
            preloadDistance: 100, // pixels
            ...options
        };
        
        this.observer = null;
        this.imageCache = new Map();
        this.retryQueue = new Map();
        this.init();
        
        // Handle visibility change
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                this.handleVisibilityChange();
            }
        });
        
        // Handle network status change
        window.addEventListener('online', () => this.handleNetworkChange(true));
        window.addEventListener('offline', () => this.handleNetworkChange(false));
        
        // Handle scroll performance
        this.scrollTimeout = null;
        window.addEventListener('scroll', () => {
            if (!this.scrollTimeout) {
                this.scrollTimeout = setTimeout(() => {
                    this.refreshObserver();
                    this.scrollTimeout = null;
                }, 150);
            }
        }, { passive: true });
    }
    
    init() {
        if ('IntersectionObserver' in window) {
            this.observer = new IntersectionObserver(this.handleIntersection.bind(this), {
                rootMargin: this.options.rootMargin,
                threshold: this.options.threshold
            });
            
            this.observe();
        } else {
            this.loadAllImages();
        }
        
        // Add default styles
        this.addStyles();
    }
    
    handleIntersection(entries, observer) {
        entries.forEach(entry => {
            const img = entry.target;
            
            // Calculate loading priority based on visibility ratio
            const priority = entry.intersectionRatio;
            
            if (entry.isIntersecting) {
                // Start loading when even slightly visible
                if (!img.dataset.loading) {
                    this.loadImage(img, priority);
                }
                
                // Preload nearby images
                if (priority > 0.5) {
                    this.preloadNearbyImages(img);
                }
            }
        });
    }
    
    async loadImage(img, priority = 0) {
        if (img.dataset.loading) return;
        
        img.dataset.loading = 'true';
        img.classList.add(this.options.loadingClass);
        
        const src = img.dataset.src;
        const srcset = img.dataset.srcset;
        const sizes = img.dataset.sizes;
        
        try {
            // Generate and apply blur-up placeholder
            await this.applyBlurUpPlaceholder(img);
            
            // Load the actual image
            const imageData = await this.loadImageWithRetry(src, srcset, sizes);
            
            // Apply the loaded image
            if (srcset) {
                img.srcset = srcset;
                img.sizes = sizes;
            }
            img.src = src;
            
            // Cache the successful load
            this.imageCache.set(src, true);
            
            // Apply success classes
            img.classList.remove(this.options.loadingClass);
            img.classList.add(this.options.loadedClass);
            
            // Clean up data attributes
            this.cleanupDataAttributes(img);
            
            // Dispatch success event
            this.dispatchEvent(img, 'lazyloaded');
            
        } catch (error) {
            console.error(`Failed to load image: ${src}`, error);
            this.handleLoadError(img, error);
        }
    }
    
    async loadImageWithRetry(src, srcset, sizes, retryCount = 0) {
        try {
            const response = await this.loadImageData(src, srcset, sizes);
            return response;
        } catch (error) {
            if (retryCount < this.options.retryCount) {
                await this.delay(this.options.retryDelay);
                return this.loadImageWithRetry(src, srcset, sizes, retryCount + 1);
            }
            throw error;
        }
    }
    
    loadImageData(src, srcset, sizes) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            
            img.onload = () => resolve({ img, src });
            img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
            
            if (srcset) {
                img.srcset = srcset;
                img.sizes = sizes;
            }
            img.src = src;
        });
    }
    
    async applyBlurUpPlaceholder(img) {
        if (!img.dataset.src) return;
        
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Set small canvas size for blur-up effect
        canvas.width = 40;
        canvas.height = 40;
        
        // Fill with placeholder color
        ctx.fillStyle = this.options.placeholderColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Apply the blur-up effect
        img.style.filter = `blur(${this.options.blurUpSize})`;
        
        // Create tiny placeholder
        const placeholder = canvas.toDataURL('image/jpeg', 0.1);
        img.src = placeholder;
    }
    
    preloadNearbyImages(currentImg) {
        const nearbyImages = this.getNearbyImages(currentImg);
        nearbyImages.forEach(img => {
            if (!img.dataset.loading && !img.classList.contains(this.options.loadedClass)) {
                // Preload with low priority
                this.loadImage(img, 0.1);
            }
        });
    }
    
    getNearbyImages(currentImg) {
        const allImages = Array.from(document.querySelectorAll('img[data-src]'));
        const currentIndex = allImages.indexOf(currentImg);
        const preloadDistance = this.options.preloadDistance;
        
        return allImages.filter((img, index) => {
            if (img.classList.contains(this.options.loadedClass)) return false;
            
            const rect = img.getBoundingClientRect();
            const viewportDistance = Math.abs(rect.top - window.innerHeight/2);
            
            return viewportDistance < preloadDistance;
        });
    }
    
    handleLoadError(img, error) {
        img.classList.remove(this.options.loadingClass);
        img.classList.add(this.options.errorClass);
        
        // Add to retry queue if online
        if (navigator.onLine) {
            this.retryQueue.set(img, {
                retryCount: 0,
                lastAttempt: Date.now()
            });
        }
        
        // Dispatch error event
        this.dispatchEvent(img, 'lazyloaderror', { error });
    }
    
    handleNetworkChange(isOnline) {
        if (isOnline && this.retryQueue.size > 0) {
            this.retryFailedLoads();
        }
    }
    
    handleVisibilityChange() {
        this.refreshObserver();
        if (document.visibilityState === 'visible') {
            this.retryFailedLoads();
        }
    }
    
    async retryFailedLoads() {
        for (const [img, data] of this.retryQueue.entries()) {
            if (data.retryCount < this.options.retryCount) {
                try {
                    await this.loadImage(img);
                    this.retryQueue.delete(img);
                } catch (error) {
                    data.retryCount++;
                    data.lastAttempt = Date.now();
                }
            }
        }
    }
    
    refreshObserver() {
        if (this.observer) {
            const images = document.querySelectorAll('img[data-src]');
            images.forEach(img => {
                if (!img.classList.contains(this.options.loadedClass)) {
                    this.observer.observe(img);
                }
            });
        }
    }
    
    cleanupDataAttributes(img) {
        ['src', 'srcset', 'sizes', 'loading'].forEach(attr => {
            img.removeAttribute(`data-${attr}`);
        });
    }
    
    dispatchEvent(img, eventName, detail = {}) {
        const event = new CustomEvent(eventName, {
            detail: { img, ...detail },
            bubbles: true,
            cancelable: true
        });
        img.dispatchEvent(event);
    }
    
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    addStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .lazy-loading {
                opacity: 0.5;
                transition: opacity 0.3s ease-in-out, filter 0.5s ease-in-out;
            }
            
            .lazy-loaded {
                opacity: 1;
                filter: blur(0) !important;
                transition: opacity 0.3s ease-in-out, filter 0.5s ease-in-out;
            }
            
            .lazy-error {
                opacity: 0.2;
                filter: grayscale(100%);
                transition: opacity 0.3s ease-in-out;
            }
            
            img[data-src] {
                background: ${this.options.placeholderColor};
                transition: filter 0.5s ease-in-out;
            }
            
            @keyframes lazyShimmer {
                0% { background-position: -200% 0; }
                100% { background-position: 200% 0; }
            }
            
            .lazy-loading::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: linear-gradient(
                    90deg,
                    transparent 0%,
                    rgba(255, 255, 255, 0.2) 50%,
                    transparent 100%
                );
                background-size: 200% 100%;
                animation: lazyShimmer 1.5s infinite;
            }
        `;
        document.head.appendChild(style);
    }
    
    observe() {
        const images = document.querySelectorAll('img[data-src]');
        images.forEach(img => {
            if (this.observer && !img.classList.contains(this.options.loadedClass)) {
                this.observer.observe(img);
            }
        });
    }
    
    loadAllImages() {
        const images = document.querySelectorAll('img[data-src]');
        images.forEach(img => this.loadImage(img));
    }
    
    refresh() {
        this.observe();
        this.retryFailedLoads();
    }
}

// Initialize lazy loading when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Initialize lazy loading with custom options
    window.lazyLoader = new LazyLoader({
        rootMargin: '50px 0px',
        threshold: [0, 0.25, 0.5, 0.75, 1],
        loadingClass: 'lazy-loading',
        loadedClass: 'lazy-loaded',
        errorClass: 'lazy-error',
        placeholderColor: '#f0f0f0',
        blurUpSize: '10px',
        retryCount: 3,
        retryDelay: 2000,
        preloadDistance: 100
    });
    
    // Refresh lazy loading after dynamic content changes
    document.addEventListener('lazyload:refresh', () => {
        window.lazyLoader.refresh();
    });
});
