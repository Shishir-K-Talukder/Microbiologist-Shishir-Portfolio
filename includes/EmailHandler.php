<?php

class EmailHandler {
    private $mailer;
    private $config;
    private $spam_protection;
    
    public function __construct() {
        $this->mailer = SMTPMailer::getInstance();
        $this->config = require_once __DIR__ . '/../config/smtp_config.php';
        $this->spam_protection = new SpamProtection();
    }
    
    public function handleContactForm($data) {
        try {
            // Check for spam before processing
            $this->spam_protection->checkSpam($data);
            
            // Validate required fields
            $required = ['name', 'email', 'message'];
            foreach ($required as $field) {
                if (empty($data[$field])) {
                    throw new Exception("The {$field} field is required.");
                }
            }
            
            // Validate email format
            if (!filter_var($data['email'], FILTER_VALIDATE_EMAIL)) {
                throw new Exception('Please enter a valid email address.');
            }
            
            // Validate field lengths
            if (strlen($data['name']) > 100) {
                throw new Exception('Name is too long (maximum 100 characters).');
            }
            if (strlen($data['email']) > 100) {
                throw new Exception('Email is too long (maximum 100 characters).');
            }
            if (strlen($data['message']) > 5000) {
                throw new Exception('Message is too long (maximum 5000 characters).');
            }
            if (isset($data['subject']) && strlen($data['subject']) > 200) {
                throw new Exception('Subject is too long (maximum 200 characters).');
            }

            // Prepare email content
            $subject = isset($data['subject']) && !empty($data['subject']) 
                ? $data['subject'] 
                : 'New Contact Form Submission';
            
            $body = $this->buildEmailBody($data);
            
            // Send email using our optimized SMTP mailer
            $result = $this->mailer->sendEmail(
                $this->config['smtp']['from_email'],
                $subject,
                $body
            );

            if (!$result['success']) {
                throw new Exception($result['message'] ?? 'Failed to send email. Please try again later.');
            }

            return [
                'success' => true,
                'message' => 'Your message has been sent successfully!'
            ];

        } catch (Exception $e) {
            error_log("Contact form error: " . $e->getMessage());
            return [
                'success' => false,
                'error' => $e->getMessage()
            ];
        }
    }
    
    private function buildEmailBody($data) {
        $timestamp = date('Y-m-d H:i:s');
        return "
            <html>
            <body style='font-family: Arial, sans-serif; line-height: 1.6; color: #333;'>
                <div style='max-width: 600px; margin: 0 auto; padding: 20px;'>
                    <h2 style='color: #2196F3;'>New Contact Form Submission</h2>
                    <div style='background: #f5f5f5; padding: 20px; border-radius: 5px;'>
                        <p><strong>Name:</strong> {$data['name']}</p>
                        <p><strong>Email:</strong> {$data['email']}</p>
                        " . (isset($data['subject']) ? "<p><strong>Subject:</strong> {$data['subject']}</p>" : "") . "
                        <p><strong>Message:</strong><br>{$data['message']}</p>
                        <hr style='border: 1px solid #ddd; margin: 20px 0;'>
                        <p style='color: #666; font-size: 0.9em;'>
                            Sent from your portfolio contact form<br>
                            Time: {$timestamp}
                        </p>
                    </div>
                </div>
            </body>
            </html>
        ";
    }
}
