// Rate limiting implementation
class RateLimiter {
    constructor(maxRequests = 5, timeWindow = 3600000) { // 1 hour window
        this.maxRequests = maxRequests;
        this.timeWindow = timeWindow;
        this.requests = new Map();
    }

    isRateLimited(clientId) {
        const now = Date.now();
        const clientRequests = this.requests.get(clientId) || [];
        
        // Remove old requests outside the time window
        const validRequests = clientRequests.filter(time => now - time < this.timeWindow);
        
        if (validRequests.length >= this.maxRequests) {
            return true;
        }

        validRequests.push(now);
        this.requests.set(clientId, validRequests);
        return false;
    }
}

// CSRF Token generation
function generateCSRFToken() {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

// Initialize security features
document.addEventListener('DOMContentLoaded', function() {
    // Initialize rate limiter
    const rateLimiter = new RateLimiter();
    
    // Add CSRF token to forms
    document.querySelectorAll('form').forEach(form => {
        const csrfToken = generateCSRFToken();
        const tokenInput = document.createElement('input');
        tokenInput.type = 'hidden';
        tokenInput.name = 'csrf_token';
        tokenInput.value = csrfToken;
        form.appendChild(tokenInput);
        
        // Store token in session storage
        sessionStorage.setItem('csrf_token', csrfToken);
    });

    // Handle form submissions
    document.querySelectorAll('form').forEach(form => {
        form.addEventListener('submit', async function(e) {
            e.preventDefault();

            // Check rate limiting
            const clientId = localStorage.getItem('clientId') || 
                           crypto.randomUUID();
            localStorage.setItem('clientId', clientId);

            if (rateLimiter.isRateLimited(clientId)) {
                alert('Too many requests. Please try again later.');
                return;
            }

            // Verify CSRF token
            const formToken = this.querySelector('[name="csrf_token"]').value;
            const storedToken = sessionStorage.getItem('csrf_token');
            
            if (formToken !== storedToken) {
                alert('Security validation failed. Please refresh the page.');
                return;
            }

            // Proceed with form submission
            try {
                const formData = new FormData(this);
                const response = await fetch(this.action, {
                    method: 'POST',
                    body: formData,
                    headers: {
                        'X-CSRF-Token': formToken
                    }
                });

                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }

                // Handle success
                const result = await response.json();
                if (result.success) {
                    // Show success message
                    const popup = document.getElementById('success-popup');
                    if (popup) {
                        popup.classList.add('show');
                        setTimeout(() => popup.classList.remove('show'), 3000);
                    }
                    this.reset();
                }
            } catch (error) {
                console.error('Error:', error);
                alert('An error occurred. Please try again.');
            }
        });
    });
});
