<?php
declare(strict_types=1);
require __DIR__ . '/config.php';

try {
    $userId = (int)($_SESSION['customer_user_id'] ?? 0);
    if ($userId <= 0) respond(['ok'=>false,'message'=>'Please log in to manage your profile.'],401);
    $pdo = db();
    $method = $_SERVER['REQUEST_METHOD'];

    if ($method === 'GET') {
        $stmt = $pdo->prepare('SELECT id,name,username,email,contact_number FROM users WHERE id=? AND role=? LIMIT 1');
        $stmt->execute([$userId,'customer']);
        $user = $stmt->fetch();
        if (!$user) respond(['ok'=>false,'message'=>'Customer account not found.'],404);
        respond(['ok'=>true,'profile'=>[
            'id'=>(int)$user['id'],'name'=>(string)$user['name'],'username'=>(string)($user['username'] ?? ''),
            'email'=>(string)$user['email'],'contact_number'=>(string)($user['contact_number'] ?? '')
        ]]);
    }

    if ($method !== 'PATCH') respond(['ok'=>false,'message'=>'Unsupported method.'],405);
    $input = json_input();
    $action = (string)($input['action'] ?? 'update_profile');

    if ($action === 'update_profile') {
        $name = trim((string)($input['name'] ?? ''));
        $contact = trim((string)($input['contact_number'] ?? ''));
        if (mb_strlen($name) < 2 || mb_strlen($name) > 120) respond(['ok'=>false,'field'=>'name','message'=>'Name must be between 2 and 120 characters.'],422);
        if ($contact !== '' && !preg_match('/^[0-9+().\s-]{7,40}$/', $contact)) respond(['ok'=>false,'field'=>'contact_number','message'=>'Enter a valid contact number.'],422);
        $stmt = $pdo->prepare("UPDATE users SET name=?,contact_number=? WHERE id=? AND role='customer'");
        $stmt->execute([$name,$contact !== '' ? $contact : null,$userId]);
        if ($stmt->rowCount() === 0) {
            $check = $pdo->prepare("SELECT id FROM users WHERE id=? AND role='customer'");
            $check->execute([$userId]);
            if (!$check->fetch()) respond(['ok'=>false,'message'=>'Customer account not found.'],404);
        }
        $_SESSION['customer_name'] = $name;
        $_SESSION['customer_contact_number'] = $contact;
        respond(['ok'=>true,'message'=>'Profile updated.','profile'=>[
            'name'=>$name,'contact_number'=>$contact,
            'username'=>(string)($_SESSION['customer_username'] ?? ''),
            'email'=>(string)($_SESSION['customer_email'] ?? '')
        ]]);
    }

    if ($action === 'change_password') {
        $current = (string)($input['current_password'] ?? '');
        $next = (string)($input['new_password'] ?? '');
        if ($current === '' || strlen($current) > 4096) respond(['ok'=>false,'field'=>'current_password','message'=>'Enter your current password.'],422);
        require_once __DIR__ . '/lib/password_policy.php';
        $passwordError = seven_password_policy_error($next);
        if ($passwordError !== null) respond(['ok'=>false,'field'=>'new_password','message'=>$passwordError],422);
        $stmt = $pdo->prepare("SELECT password_hash FROM users WHERE id=? AND role='customer' LIMIT 1");
        $stmt->execute([$userId]);
        $hash = $stmt->fetchColumn();
        if (!is_string($hash) || !password_verify($current,$hash)) respond(['ok'=>false,'field'=>'current_password','message'=>'Your current password is incorrect.'],401);
        $update = $pdo->prepare("UPDATE users SET password_hash=? WHERE id=? AND role='customer'");
        $update->execute([password_hash($next,PASSWORD_DEFAULT),$userId]);
        respond(['ok'=>true,'message'=>'Password changed successfully.']);
    }

    respond(['ok'=>false,'message'=>'Invalid profile action.'],422);
} catch (Throwable $e) {
    respond(['ok'=>false,'message'=>'Unable to update your profile. Please try again.'],500);
}
