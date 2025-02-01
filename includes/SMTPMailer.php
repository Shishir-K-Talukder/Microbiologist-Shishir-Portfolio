<?php

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

class SMTPMailer {
    private $mailer;
    private $config;
    private static $instance = null;
    private $connection_established = false;
    private $email_count = 0;
    private $last_send_time = 0;
    private static $cache = [];
    private $metrics = [];
    private $queue = [];

    private function __construct() {
        $this->config = require_once __DIR__ . '/../config/smtp_config.php';
        $this->initializeMailer();
        $this->initializeDirectories();
        $this->startMetrics();
    }

    private function initializeDirectories() {
        $directories = [
            $this->config['smtp']['cache_dir'],
            $this->config['smtp']['log_path']
        ];

        foreach ($directories as $dir) {
            if (!file_exists($dir)) {
                mkdir($dir, 0755, true);
            }
        }
    }

    private function startMetrics() {
        $this->metrics = [
            'start_time' => microtime(true),
            'total_emails' => 0,
            'successful_sends' => 0,
            'failed_sends' => 0,
            'retry_count' => 0,
            'average_send_time' => 0
        ];
    }

    public static function getInstance() {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function initializeMailer() {
        $this->mailer = new PHPMailer(true);
        
        try {
            // Server settings with optimized timeouts
            $this->mailer->SMTPDebug = $this->config['smtp']['debug'];
            $this->mailer->isSMTP();
            $this->mailer->Host = $this->config['smtp']['host'];
            $this->mailer->Port = $this->config['smtp']['port'];
            $this->mailer->SMTPAuth = true;
            $this->mailer->Username = $this->config['smtp']['username'];
            $this->mailer->Password = $this->config['smtp']['password'];
            $this->mailer->SMTPSecure = $this->config['smtp']['encryption'];
            
            // Advanced connection settings
            $this->mailer->SMTPKeepAlive = $this->config['smtp']['keep_alive'];
            $this->mailer->AuthType = $this->config['smtp']['auth_type'];
            $this->mailer->CharSet = $this->config['smtp']['charset'];
            $this->mailer->Timeout = $this->config['smtp']['timeout'];
            $this->mailer->SMTPOptions = [
                'ssl' => [
                    'verify_peer' => $this->config['smtp']['verify_peer'],
                    'allow_self_signed' => $this->config['smtp']['allow_self_signed']
                ]
            ];
            
            // Resource limits
            ini_set('memory_limit', $this->config['smtp']['memory_limit']);
            $this->mailer->MaxLineLength = $this->config['smtp']['chunk_size'];
            
            // Default sender
            $this->mailer->setFrom(
                $this->config['smtp']['from_email'],
                $this->config['smtp']['from_name']
            );
            
        } catch (Exception $e) {
            $this->logError("Mailer initialization failed: " . $e->getMessage());
            throw new Exception("Mailer initialization failed: " . $e->getMessage());
        }
    }

    private function checkRateLimit() {
        $current_time = time();
        $hour_ago = $current_time - 3600;
        
        // Clean up old metrics
        $this->metrics = array_filter($this->metrics, function($time) use ($hour_ago) {
            return $time > $hour_ago;
        });
        
        return count($this->metrics) < $this->config['smtp']['rate_limit'];
    }

    private function cacheTemplate($key, $content) {
        if (!$this->config['smtp']['enable_cache']) {
            return;
        }
        
        $cache_file = $this->config['smtp']['cache_dir'] . '/' . md5($key);
        file_put_contents($cache_file, serialize([
            'content' => $content,
            'expires' => time() + $this->config['smtp']['cache_ttl']
        ]));
    }

    private function getCachedTemplate($key) {
        if (!$this->config['smtp']['enable_cache']) {
            return null;
        }
        
        $cache_file = $this->config['smtp']['cache_dir'] . '/' . md5($key);
        if (file_exists($cache_file)) {
            $data = unserialize(file_get_contents($cache_file));
            if ($data['expires'] > time()) {
                return $data['content'];
            }
            unlink($cache_file);
        }
        return null;
    }

    private function logError($message) {
        $log_file = $this->config['smtp']['log_path'] . '/error.log';
        $timestamp = date('Y-m-d H:i:s');
        file_put_contents($log_file, "[$timestamp] $message\n", FILE_APPEND);
    }

    private function updateMetrics($success, $send_time) {
        $this->metrics['total_emails']++;
        if ($success) {
            $this->metrics['successful_sends']++;
        } else {
            $this->metrics['failed_sends']++;
        }
        
        // Update average send time
        $current_avg = $this->metrics['average_send_time'];
        $total_emails = $this->metrics['total_emails'];
        $this->metrics['average_send_time'] = 
            ($current_avg * ($total_emails - 1) + $send_time) / $total_emails;
    }

    public function sendEmail($to, $subject, $body, $isHTML = true) {
        if (!$this->checkRateLimit()) {
            throw new Exception("Rate limit exceeded");
        }

        // Throttle if needed
        $current_time = microtime(true);
        $time_since_last = $current_time - $this->last_send_time;
        if ($time_since_last < $this->config['smtp']['throttle_delay']) {
            usleep(($this->config['smtp']['throttle_delay'] - $time_since_last) * 1000000);
        }

        try {
            $start_time = microtime(true);
            
            // Check cache for template
            $cache_key = md5($subject . $body);
            $cached_content = $this->getCachedTemplate($cache_key);
            if ($cached_content) {
                $body = $cached_content;
            }

            // Reset recipients and body
            $this->mailer->clearAddresses();
            $this->mailer->clearAttachments();
            
            // Set email parameters with resource limits
            $this->mailer->addAddress($to);
            $this->mailer->Subject = $subject;
            $this->mailer->isHTML($isHTML);
            
            // Chunk large bodies
            if (strlen($body) > $this->config['smtp']['chunk_size']) {
                $body = $this->chunkBody($body);
            }
            
            $this->mailer->Body = $body;
            
            if ($isHTML) {
                $this->mailer->AltBody = strip_tags($body);
            }

            // Implement optimized retry mechanism
            $retryCount = 0;
            $maxRetries = $this->config['smtp']['retry_count'];
            $retryInterval = $this->config['smtp']['retry_interval'];
            
            while ($retryCount < $maxRetries) {
                try {
                    $result = $this->mailer->send();
                    $this->last_send_time = microtime(true);
                    $send_time = $this->last_send_time - $start_time;
                    
                    // Update metrics
                    $this->updateMetrics(true, $send_time);
                    
                    // Cache template if successful
                    if (!$cached_content) {
                        $this->cacheTemplate($cache_key, $body);
                    }
                    
                    return [
                        'success' => true,
                        'message' => 'Email sent successfully',
                        'metrics' => [
                            'send_time' => $send_time,
                            'retries' => $retryCount
                        ]
                    ];
                } catch (Exception $e) {
                    $retryCount++;
                    $this->metrics['retry_count']++;
                    
                    if ($retryCount >= $maxRetries) {
                        throw $e;
                    }
                    
                    // Exponential backoff
                    sleep($retryInterval * pow(2, $retryCount - 1));
                }
            }
        } catch (Exception $e) {
            $this->logError($e->getMessage());
            $this->updateMetrics(false, microtime(true) - $start_time);
            
            return [
                'success' => false,
                'message' => $e->getMessage(),
                'metrics' => $this->metrics
            ];
        }
    }

    private function chunkBody($body) {
        $chunk_size = $this->config['smtp']['chunk_size'];
        $chunks = str_split($body, $chunk_size);
        return implode("\r\n", $chunks);
    }

    public function getMetrics() {
        return $this->metrics;
    }

    public function __destruct() {
        if ($this->mailer && $this->mailer->SMTPKeepAlive) {
            $this->mailer->smtpClose();
        }
    }
}
