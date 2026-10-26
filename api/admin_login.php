<?php
declare(strict_types=1);
require __DIR__ . '/config.php';
require __DIR__ . '/lib/sign_in.php';

// Admin sign-in (admin/login.html). Only owner/staff; customer accounts get the generic error.
try {
    seven_sign_in('admin');
} catch (Throwable $e) {
    respond(['ok' => false, 'message' => 'Unable to sign in. Please try again.'], 500);
}
