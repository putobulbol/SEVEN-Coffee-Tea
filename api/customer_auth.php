<?php
declare(strict_types=1);
require __DIR__ . '/config.php';

function customer_identity(): ?array {
    if (empty($_SESSION['customer_user_id'])) return null;
    return [
        'id' => (int)$_SESSION['customer_user_id'],
        'username' => (string)($_SESSION['customer_username'] ?? ''),
        'name' => (string)($_SESSION['customer_name'] ?? ''),
        'email' => (string)($_SESSION['customer_email'] ?? ''),
        'contact_number' => (string)($_SESSION['customer_contact_number'] ?? '')
    ];
}

function set_customer_session(array $user): void {
    unset(
        $_SESSION['pending_email_verification_user_id'],
        $_SESSION['admin_user_id'],
        $_SESSION['admin_name'],
        $_SESSION['admin_username'],
        $_SESSION['admin_role'],
        $_SESSION['admin_last_activity']
    );
    session_regenerate_id(true);
    $_SESSION['customer_user_id'] = (int)$user['id'];
    $_SESSION['customer_username'] = (string)$user['username'];
    $_SESSION['customer_name'] = (string)$user['name'];
    $_SESSION['customer_email'] = (string)($user['email'] ?? '');
    $_SESSION['customer_contact_number'] = (string)($user['contact_number'] ?? '');
}

try {
    $pdo = db();
    $method = $_SERVER['REQUEST_METHOD'];

    if ($method === 'GET') {
        $customer = customer_identity();
        if (!$customer) respond(['ok' => false, 'message' => 'Customer is not logged in.'], 401);
        respond(['ok' => true, 'customer' => $customer]);
    }

    if ($method === 'DELETE') {
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
        respond(['ok' => true]);
    }

    if ($method !== 'POST') respond(['ok' => false, 'message' => 'Unsupported method.'], 405);

    $input = json_input();
    $action = strtolower(trim((string)($input['action'] ?? 'login')));
    $password = (string)($input['password'] ?? '');

    // Login keeps the old minimum so existing accounts are unaffected; new passwords use the policy below.
    if ($action !== 'register' && strlen($password) < 6) {
        respond(['ok' => false, 'message' => 'Password must be at least 6 characters.'], 422);
    }

    if ($action === 'register') {
        require_once __DIR__ . '/lib/password_policy.php';
        $passwordError = seven_password_policy_error($password);
        if ($passwordError !== null) {
            respond(['ok' => false, 'field' => 'password', 'message' => $passwordError], 422);
        }
        $name = trim((string)($input['name'] ?? ''));
        $username = trim((string)($input['username'] ?? ''));
        $email = strtolower(trim((string)($input['email'] ?? '')));
        $contact = trim((string)($input['contact_number'] ?? ''));
        $termsAccepted = filter_var($input['terms_accepted'] ?? false, FILTER_VALIDATE_BOOLEAN);

        if ($name === '' || mb_strlen($name) < 2 || mb_strlen($name) > 120) {
            respond(['ok' => false, 'field' => 'fullName', 'message' => 'Enter your full name (2–120 characters).'], 422);
        }
        if (!preg_match('/^[A-Za-z0-9._-]{3,15}$/', $username)) {
            respond(['ok' => false, 'field' => 'username', 'message' => 'Username must be 3–15 characters and use only letters, numbers, dot, underscore, or hyphen.'], 422);
        }
        if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email) > 190) {
            respond(['ok' => false, 'field' => 'email', 'message' => 'Enter a valid email address.'], 422);
        }
        if (SEVEN_REQUIRE_GMAIL) {
            $domain = strtolower(substr(strrchr($email, '@') ?: '', 1));
            $isGmail = in_array($domain, ['gmail.com', 'googlemail.com'], true);
            // Accept common academic domains such as university.edu and school.edu.ph.
            $isEducationDomain = preg_match('/(?:^|\\.)edu(?:\\.[a-z]{2})?$/i', $domain) === 1;
            if (!$isGmail && !$isEducationDomain) {
                respond([
                    'ok' => false,
                    'field' => 'email',
                    'message' => 'Use a Gmail address or a school email ending in .edu or .edu.ph to receive your verification code.'
                ], 422);
            }
        }
        if (!preg_match('/^[0-9+().\s-]{7,40}$/', $contact)) {
            respond(['ok' => false, 'field' => 'contactNumber', 'message' => 'Enter a valid contact number.'], 422);
        }
        if (!$termsAccepted) {
            respond(['ok' => false, 'field' => 'termsAccepted', 'message' => 'You must agree to the Terms and Conditions to register.'], 422);
        }

        $check = $pdo->prepare('SELECT id FROM users WHERE username=? OR email=? LIMIT 1');
        $check->execute([$username, $email]);
        if ($check->fetch()) respond(['ok' => false, 'field' => 'username', 'message' => 'That username or email is already registered.'], 409);

        $hash = password_hash($password, PASSWORD_DEFAULT);
        $stmt = $pdo->prepare("INSERT INTO users (name,username,email,contact_number,password_hash,terms_accepted_at,role) VALUES (?,?,?,?,?,NOW(),'customer')");
        $stmt->execute([$name, $username, $email, $contact, $hash]);
        $id = (int)$pdo->lastInsertId();

        // Store only a pending verification reference, never an authenticated customer session.
        unset($_SESSION['customer_user_id'],$_SESSION['customer_username'],$_SESSION['customer_name'],$_SESSION['customer_email'],$_SESSION['customer_contact_number'],$_SESSION['admin_user_id'],$_SESSION['admin_name'],$_SESSION['admin_username'],$_SESSION['admin_role'],$_SESSION['admin_last_activity']);
        session_regenerate_id(true);
        $_SESSION['pending_email_verification_user_id'] = $id;
        require_once __DIR__ . '/lib/email_verification_service.php';
        try {
            seven_send_email_verification($pdo, $id, $email);
            respond(['ok'=>true,'requires_verification'=>true,'email'=>$email,'message'=>'We sent a six-digit verification code to your email. It expires in 10 minutes.']);
        } catch (Throwable $mailError) {
            respond(['ok'=>false,'verification_required'=>true,'email'=>$email,'message'=>$mailError->getMessage()],503);
        }
    }

    if ($action === 'login') {
        $email = strtolower(trim((string)($input['email'] ?? '')));
        if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email) > 190) {
            respond(['ok' => false, 'field' => 'email', 'message' => 'Enter your registered email address.'], 422);
        }

        $stmt = $pdo->prepare("SELECT id,name,username,email,contact_number,password_hash,email_verified_at FROM users WHERE LOWER(email)=? AND role='customer' LIMIT 1");
        $stmt->execute([$email]);
        $user = $stmt->fetch();
        if (!$user || !password_verify($password, (string)$user['password_hash'])) {
            respond(['ok' => false, 'message' => 'Invalid email or password.'], 401);
        }

        if (empty($user['email_verified_at'])) {
            unset($_SESSION['customer_user_id'],$_SESSION['customer_username'],$_SESSION['customer_name'],$_SESSION['customer_email'],$_SESSION['customer_contact_number'],$_SESSION['admin_user_id'],$_SESSION['admin_name'],$_SESSION['admin_username'],$_SESSION['admin_role'],$_SESSION['admin_last_activity']);
            session_regenerate_id(true);
            $_SESSION['pending_email_verification_user_id'] = (int)$user['id'];
            respond(['ok'=>false,'requires_verification'=>true,'message'=>'Verify your email before logging in. Enter or resend the code on the email verification step.'],403);
        }
        set_customer_session($user);
        respond(['ok' => true, 'customer' => customer_identity()]);
    }

    respond(['ok' => false, 'message' => 'Invalid customer authentication action.'], 422);
} catch (Throwable $e) {
    respond(['ok' => false, 'message' => 'Customer authentication failed.'], 500);
}
