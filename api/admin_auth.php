<?php
declare(strict_types=1);
require __DIR__ . '/config.php';

function admin_identity(): ?array {
    if (empty($_SESSION['admin_user_id'])) return null;
    return [
        'id' => (int)$_SESSION['admin_user_id'],
        'name' => (string)($_SESSION['admin_name'] ?? ''),
        'username' => (string)($_SESSION['admin_username'] ?? ''),
        'role' => (string)($_SESSION['admin_role'] ?? '')
    ];
}

try {
    $method = $_SERVER['REQUEST_METHOD'];

    if ($method === 'GET') {
        require_admin();
        $admin = admin_identity();
        if (!$admin) respond(['ok' => false, 'authenticated' => false], 401);
        respond(['ok' => true, 'authenticated' => true, 'admin' => $admin]);
    }

    if ($method === 'DELETE') {
        unset(
            $_SESSION['admin_user_id'],
            $_SESSION['admin_name'],
            $_SESSION['admin_username'],
            $_SESSION['admin_role'],
            $_SESSION['admin_last_activity'],
            $_SESSION['customer_user_id'],
            $_SESSION['customer_username'],
            $_SESSION['customer_name'],
            $_SESSION['customer_email'],
            $_SESSION['customer_contact_number']
        );
        session_regenerate_id(true);
        respond(['ok' => true, 'message' => 'Signed out.']);
    }

    if ($method === 'POST') {
        respond(['ok' => false, 'message' => 'Admin accounts must be provisioned in the database.'], 405);
    }

    respond(['ok' => false, 'message' => 'Unsupported method.'], 405);
} catch (Throwable $e) {
    respond(['ok' => false, 'message' => 'Unable to check admin authentication.'], 500);
}
