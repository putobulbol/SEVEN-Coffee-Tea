<?php
declare(strict_types=1);
require __DIR__ . '/config.php';
require __DIR__ . '/lib/sign_in.php';

// Customer sign-in (login.html). Owner/staff accounts are rejected here; they use admin/login.html.
try {
    seven_sign_in('customer');
} catch (Throwable $e) {
    respond(['ok' => false, 'message' => 'Unable to sign in. Please try again.'], 500);
}
