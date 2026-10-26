<?php
declare(strict_types=1);

/*
 * Shared email + password sign-in for the two portals.
 *   'customer' (api/auth.php)        -> only role customer
 *   'admin'    (api/admin_login.php) -> only roles owner / staff
 * A wrong account type gets the same generic 401 as a wrong password, and no session is created.
 * Session fields are exactly the ones the rest of the app reads (customer_* / admin_*).
 * Requires api/config.php (db(), json_input(), respond(), session) to be loaded first.
 */
function seven_sign_in(string $portal): void
{
    $allowedRoles = $portal === 'admin' ? ['owner', 'staff'] : ['customer'];

    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        respond(['ok' => false, 'message' => 'Unsupported method.'], 405);
    }

    $input = json_input();
    $email = strtolower(trim((string)($input['email'] ?? '')));
    $password = (string)($input['password'] ?? '');

    if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email) > 190 || $password === '' || strlen($password) > 4096) {
        respond(['ok' => false, 'message' => 'Enter your registered email address and password.'], 422);
    }

    $pdo = db();
    $stmt = $pdo->prepare(
        'SELECT id, name, username, email, contact_number, password_hash, role, email_verified_at
         FROM users
         WHERE LOWER(email) = ?
         LIMIT 1'
    );
    $stmt->execute([$email]);
    $user = $stmt->fetch();

    // Check the password before the role so both failure kinds cost the same and look the same.
    $passwordOk = $user && password_verify($password, (string)$user['password_hash']);
    if (!$passwordOk || !in_array((string)$user['role'], $allowedRoles, true)) {
        respond(['ok' => false, 'message' => 'Invalid email or password.'], 401);
    }
    $role = (string)$user['role'];

    if ($role === 'customer' && empty($user['email_verified_at'])) {
        unset($_SESSION['customer_user_id'],$_SESSION['customer_username'],$_SESSION['customer_name'],$_SESSION['customer_email'],$_SESSION['customer_contact_number'],$_SESSION['admin_user_id'],$_SESSION['admin_name'],$_SESSION['admin_username'],$_SESSION['admin_role'],$_SESSION['admin_last_activity']);
        session_regenerate_id(true);
        $_SESSION['pending_email_verification_user_id'] = (int)$user['id'];
        respond(['ok'=>false,'requires_verification'=>true,'message'=>'Verify your email before logging in. Enter or resend your code from the email verification step.'],403);
    }

    // A successful sign-in replaces any previous customer/admin identity.
    unset(
        $_SESSION['pending_email_verification_user_id'],
        $_SESSION['customer_user_id'],
        $_SESSION['customer_username'],
        $_SESSION['customer_name'],
        $_SESSION['customer_email'],
        $_SESSION['customer_contact_number'],
        $_SESSION['admin_user_id'],
        $_SESSION['admin_name'],
        $_SESSION['admin_username'],
        $_SESSION['admin_role'],
        $_SESSION['admin_last_activity']
    );
    session_regenerate_id(true);

    if ($role === 'customer') {
        $_SESSION['customer_user_id'] = (int)$user['id'];
        $_SESSION['customer_username'] = (string)$user['username'];
        $_SESSION['customer_name'] = (string)$user['name'];
        $_SESSION['customer_email'] = (string)($user['email'] ?? '');
        $_SESSION['customer_contact_number'] = (string)($user['contact_number'] ?? '');
    } else {
        $_SESSION['admin_user_id'] = (int)$user['id'];
        $_SESSION['admin_name'] = (string)$user['name'];
        $_SESSION['admin_username'] = (string)$user['username'];
        $_SESSION['admin_role'] = $role;
        $_SESSION['admin_last_activity'] = time();
    }

    respond([
        'ok' => true,
        'message' => 'Login successful.',
        'role' => $role,
        'user' => [
            'id' => (int)$user['id'],
            'name' => (string)$user['name'],
            'username' => (string)$user['username'],
            'role' => $role
        ]
    ]);
}
