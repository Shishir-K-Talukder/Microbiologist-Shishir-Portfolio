<?php

class SpamProtection {
    private $config;
    private $cache_dir;
    private $ip_address;
    private $blacklist_file;
    private $honeypot_fields = ['website', 'phone', 'company'];
    
    public function __construct() {
        $this->config = require_once __DIR__ . '/../config/smtp_config.php';
        $this->cache_dir = $this->config['smtp']['cache_dir'];
        $this->ip_address = $this->getClientIP();
        $this->blacklist_file = $this->cache_dir . '/blacklist.json';
        $this->initializeFiles();
    }
    
    private function initializeFiles() {
        if (!file_exists($this->cache_dir)) {
            mkdir($this->cache_dir, 0755, true);
        }
        if (!file_exists($this->blacklist_file)) {
            file_put_contents($this->blacklist_file, json_encode([
                'ips' => [],
                'emails' => [],
                'patterns' => []
            ]));
        }
    }
    
    private function getClientIP() {
        $headers = [
            'HTTP_CLIENT_IP',
            'HTTP_X_FORWARDED_FOR',
            'HTTP_X_FORWARDED',
            'HTTP_X_CLUSTER_CLIENT_IP',
            'HTTP_FORWARDED_FOR',
            'HTTP_FORWARDED',
            'REMOTE_ADDR'
        ];
        
        foreach ($headers as $header) {
            if (isset($_SERVER[$header])) {
                $ip = trim(explode(',', $_SERVER[$header])[0]);
                if (filter_var($ip, FILTER_VALIDATE_IP)) {
                    return $ip;
                }
            }
        }
        return '0.0.0.0';
    }
    
    public function checkSpam($data) {
        try {
            // Check if IP is blacklisted
            if ($this->isIPBlacklisted()) {
                throw new Exception('Access denied from your IP address.');
            }
            
            // Check submission rate
            if ($this->isRateLimitExceeded()) {
                $this->incrementViolationCount();
                throw new Exception('Too many attempts. Please try again later.');
            }
            
            // Check honeypot fields
            if ($this->checkHoneypotFields($data)) {
                $this->blacklistIP('Honeypot triggered');
                throw new Exception('Invalid submission detected.');
            }
            
            // Check for spam patterns in content
            if ($this->containsSpamPatterns($data)) {
                $this->incrementViolationCount();
                throw new Exception('Your message contains prohibited content.');
            }
            
            // Check for suspicious patterns
            if ($this->isSuspiciousContent($data)) {
                $this->incrementViolationCount();
                throw new Exception('Your message appears to be spam.');
            }
            
            // Check token and timing
            if (!$this->validateTokenAndTiming($data)) {
                throw new Exception('Invalid submission. Please try again.');
            }
            
            // All checks passed
            return true;
            
        } catch (Exception $e) {
            $this->logSpamAttempt($data, $e->getMessage());
            throw $e;
        }
    }
    
    private function isIPBlacklisted() {
        $blacklist = json_decode(file_get_contents($this->blacklist_file), true);
        return in_array($this->ip_address, $blacklist['ips']);
    }
    
    private function blacklistIP($reason) {
        $blacklist = json_decode(file_get_contents($this->blacklist_file), true);
        if (!in_array($this->ip_address, $blacklist['ips'])) {
            $blacklist['ips'][] = $this->ip_address;
            file_put_contents($this->blacklist_file, json_encode($blacklist));
        }
        $this->logBlacklist($reason);
    }
    
    private function isRateLimitExceeded() {
        $rate_file = $this->cache_dir . '/rate_' . md5($this->ip_address) . '.json';
        
        if (!file_exists($rate_file)) {
            $this->resetRateLimit($rate_file);
            return false;
        }
        
        $rate_data = json_decode(file_get_contents($rate_file), true);
        $now = time();
        
        // Clean up old entries
        $rate_data['attempts'] = array_filter($rate_data['attempts'], function($time) use ($now) {
            return $time > ($now - 3600); // Keep last hour
        });
        
        // Check limits
        $minute_count = count(array_filter($rate_data['attempts'], function($time) use ($now) {
            return $time > ($now - 60);
        }));
        
        $hour_count = count($rate_data['attempts']);
        
        // Update file
        $rate_data['attempts'][] = $now;
        file_put_contents($rate_file, json_encode($rate_data));
        
        return $minute_count >= 5 || $hour_count >= 50; // Max 5 per minute, 50 per hour
    }
    
    private function resetRateLimit($rate_file) {
        file_put_contents($rate_file, json_encode([
            'attempts' => [time()],
            'violations' => 0
        ]));
    }
    
    private function incrementViolationCount() {
        $rate_file = $this->cache_dir . '/rate_' . md5($this->ip_address) . '.json';
        if (file_exists($rate_file)) {
            $rate_data = json_decode(file_get_contents($rate_file), true);
            $rate_data['violations']++;
            
            // Auto-blacklist after 3 violations
            if ($rate_data['violations'] >= 3) {
                $this->blacklistIP('Multiple violations');
            }
            
            file_put_contents($rate_file, json_encode($rate_data));
        }
    }
    
    private function checkHoneypotFields($data) {
        foreach ($this->honeypot_fields as $field) {
            if (isset($data[$field]) && !empty($data[$field])) {
                return true;
            }
        }
        return false;
    }
    
    private function containsSpamPatterns($data) {
        $spam_patterns = [
            '/\b(viagra|cialis|casino|porn|sex|xxx)\b/i',
            '/\b(buy|sell|cheap|discount|free|offer|price)\b.*\b(now|today|limited)\b/i',
            '/\[url=|<a\s+href/i',
            '/\b(http|https|www\.)\b/i',
            '/\b[A-Z]{10,}\b/',  // Excessive caps
            '/(.)\1{4,}/',       // Character repetition
        ];
        
        $content = strtolower($data['subject'] . ' ' . $data['message']);
        
        foreach ($spam_patterns as $pattern) {
            if (preg_match($pattern, $content)) {
                return true;
            }
        }
        
        return false;
    }
    
    private function isSuspiciousContent($data) {
        $content = $data['message'];
        
        // Check for excessive URLs
        $url_count = preg_match_all('/\b(?:https?:\/\/|www\.)\S+\b/i', $content);
        if ($url_count > 2) {
            return true;
        }
        
        // Check for excessive special characters
        $special_char_ratio = strlen(preg_replace('/[a-zA-Z0-9\s]/', '', $content)) / strlen($content);
        if ($special_char_ratio > 0.3) {
            return true;
        }
        
        // Check for repeated words
        $words = str_word_count(strtolower($content), 1);
        $word_freq = array_count_values($words);
        foreach ($word_freq as $word => $freq) {
            if (strlen($word) > 3 && $freq > 5) {
                return true;
            }
        }
        
        return false;
    }
    
    private function validateTokenAndTiming($data) {
        if (!isset($data['_token']) || !isset($data['_timing'])) {
            return false;
        }
        
        // Verify token
        $expected_token = hash('sha256', session_id() . $_SERVER['HTTP_USER_AGENT']);
        if ($data['_token'] !== $expected_token) {
            return false;
        }
        
        // Verify timing (submission should take at least 5 seconds)
        $submission_time = time() - intval($data['_timing']);
        return $submission_time >= 5;
    }
    
    private function logSpamAttempt($data, $reason) {
        $log_file = $this->cache_dir . '/spam_log.json';
        $log_entry = [
            'timestamp' => time(),
            'ip' => $this->ip_address,
            'reason' => $reason,
            'data' => array_diff_key($data, array_flip(['_token', '_timing'])), // Exclude sensitive fields
            'headers' => [
                'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? 'Unknown',
                'referer' => $_SERVER['HTTP_REFERER'] ?? 'Unknown'
            ]
        ];
        
        $logs = file_exists($log_file) ? json_decode(file_get_contents($log_file), true) : [];
        $logs[] = $log_entry;
        
        // Keep only last 1000 entries
        if (count($logs) > 1000) {
            array_shift($logs);
        }
        
        file_put_contents($log_file, json_encode($logs));
    }
    
    private function logBlacklist($reason) {
        $log_file = $this->cache_dir . '/blacklist_log.json';
        $log_entry = [
            'timestamp' => time(),
            'ip' => $this->ip_address,
            'reason' => $reason,
            'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? 'Unknown'
        ];
        
        $logs = file_exists($log_file) ? json_decode(file_get_contents($log_file), true) : [];
        $logs[] = $log_entry;
        
        file_put_contents($log_file, json_encode($logs));
    }
    
    public function generateToken() {
        return [
            'token' => hash('sha256', session_id() . $_SERVER['HTTP_USER_AGENT']),
            'timing' => time()
        ];
    }
}
