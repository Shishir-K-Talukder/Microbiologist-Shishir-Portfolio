<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

// Load required files
require_once '../vendor/PHPMailer/Exception.php';
require_once '../vendor/PHPMailer/PHPMailer.php';
require_once '../vendor/PHPMailer/SMTP.php';
require_once '../includes/autoload.php';

// Set headers
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

// Only allow POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    die(json_encode(['error' => 'Method not allowed']));
}

try {
    // Get and validate JSON data
    $data = json_decode(file_get_contents('php://input'), true);
    if (!$data) {
        throw new Exception('Invalid JSON data');
    }

    // Sanitize input
    $data = array_map('trim', $data);
    $data = array_map('strip_tags', $data);
    
    // Handle email
    $emailHandler = new EmailHandler();
    $result = $emailHandler->handleContactForm($data);
    
    // Output result
    echo json_encode($result);
    
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['error' => $e->getMessage()]);
}
