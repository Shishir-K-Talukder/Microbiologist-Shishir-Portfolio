<?php

return [
    'smtp' => [
        'host' => 'smtp.gmail.com',
        'port' => 587,
        'encryption' => 'tls',
        'username' => '',
        'password' => '',
        'from_email' => '',
        'from_name' => 'Portfolio Contact',
        
        // Connection settings
        'timeout' => 30,
        'keep_alive' => true,
        'auth_type' => 'XOAUTH2',
        'charset' => 'UTF-8',
        
        // Performance optimizations
        'connection_timeout' => 10,    // Connection timeout in seconds
        'timeout_threshold' => 5,      // Threshold for timing out operations
        'pool_limit' => 10,           // Increased connection pool limit
        'retry_count' => 3,
        'retry_interval' => 2,        // Seconds between retries
        'batch_size' => 50,           // Maximum emails per connection
        
        // Resource management
        'memory_limit' => '128M',     // Memory limit for mail processing
        'max_recipients' => 50,       // Maximum recipients per email
        'max_attachment_size' => 10,  // Maximum attachment size in MB
        'chunk_size' => 1024,        // Chunk size for large emails in KB
        
        // Caching
        'enable_cache' => true,       // Enable template caching
        'cache_ttl' => 3600,         // Cache time-to-live in seconds
        'cache_dir' => '../cache/mail', // Cache directory
        
        // Queue settings
        'enable_queue' => true,       // Enable email queue
        'queue_retry_limit' => 5,     // Maximum queue retry attempts
        'queue_retry_interval' => 300, // Seconds between queue retries
        
        // Logging and monitoring
        'debug' => 0,                 // Debug level (0-4)
        'log_level' => 'error',       // Log level (debug, info, warning, error)
        'log_path' => '../logs/mail', // Log directory
        'enable_metrics' => true,     // Enable performance metrics
        
        // Anti-spam and security
        'rate_limit' => 100,          // Maximum emails per hour
        'throttle_delay' => 1,        // Delay between sends in seconds
        'verify_peer' => true,        // Verify SSL certificates
        'allow_self_signed' => false, // Disallow self-signed certificates
    ]
];
