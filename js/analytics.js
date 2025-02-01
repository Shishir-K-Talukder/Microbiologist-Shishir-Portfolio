// Performance Analytics Module
const PerformanceAnalytics = {
    metrics: {
        FCP: 0,    // First Contentful Paint
        LCP: 0,    // Largest Contentful Paint
        FID: 0,    // First Input Delay
        CLS: 0,    // Cumulative Layout Shift
        TTI: 0     // Time to Interactive
    },

    init() {
        this.observeWebVitals();
        this.setupPerformanceObserver();
        this.monitorResources();
        this.trackUserInteraction();
    },

    // Observe Web Vitals
    observeWebVitals() {
        // First Contentful Paint
        new PerformanceObserver((entryList) => {
            const entries = entryList.getEntries();
            this.metrics.FCP = entries[entries.length - 1].startTime;
            console.log(`FCP: ${this.metrics.FCP}ms`);
        }).observe({ entryTypes: ['paint'] });

        // Largest Contentful Paint
        new PerformanceObserver((entryList) => {
            const entries = entryList.getEntries();
            this.metrics.LCP = entries[entries.length - 1].startTime;
            console.log(`LCP: ${this.metrics.LCP}ms`);
        }).observe({ entryTypes: ['largest-contentful-paint'] });

        // First Input Delay
        new PerformanceObserver((entryList) => {
            const entries = entryList.getEntries();
            this.metrics.FID = entries[0].processingStart - entries[0].startTime;
            console.log(`FID: ${this.metrics.FID}ms`);
        }).observe({ entryTypes: ['first-input'] });

        // Cumulative Layout Shift
        new PerformanceObserver((entryList) => {
            for (const entry of entryList.getEntries()) {
                if (!entry.hadRecentInput) {
                    this.metrics.CLS += entry.value;
                }
            }
            console.log(`CLS: ${this.metrics.CLS}`);
        }).observe({ entryTypes: ['layout-shift'] });
    },

    // Monitor Resource Loading
    setupPerformanceObserver() {
        new PerformanceObserver((entryList) => {
            entryList.getEntries().forEach(entry => {
                if (entry.initiatorType === 'resource') {
                    console.log(`Resource Loaded: ${entry.name} - ${entry.duration}ms`);
                }
            });
        }).observe({ entryTypes: ['resource'] });
    },

    // Monitor Resource Timing
    monitorResources() {
        window.addEventListener('load', () => {
            const resources = performance.getEntriesByType('resource');
            const resourceMetrics = resources.map(resource => ({
                name: resource.name,
                type: resource.initiatorType,
                duration: resource.duration,
                size: resource.transferSize
            }));

            console.log('Resource Metrics:', resourceMetrics);
        });
    },

    // Track User Interaction
    trackUserInteraction() {
        let lastInteraction = 0;
        const interactions = [];

        const trackInteraction = (e) => {
            const now = performance.now();
            const timeSinceLastInteraction = now - lastInteraction;
            
            interactions.push({
                type: e.type,
                target: e.target.tagName,
                time: now,
                timeSinceLastInteraction
            });

            lastInteraction = now;
        };

        ['click', 'scroll', 'keypress'].forEach(event => {
            document.addEventListener(event, trackInteraction, { passive: true });
        });
    },

    // Get Performance Report
    getPerformanceReport() {
        return {
            metrics: this.metrics,
            memory: performance.memory ? {
                usedJSHeapSize: performance.memory.usedJSHeapSize,
                totalJSHeapSize: performance.memory.totalJSHeapSize
            } : null,
            navigation: performance.getEntriesByType('navigation')[0],
            resources: performance.getEntriesByType('resource')
        };
    }
};

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PerformanceAnalytics;
}
