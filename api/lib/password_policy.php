<?php
declare(strict_types=1);

/*
 * Password rules for NEW passwords (registration and change-password).
 * Login does not use this, so existing accounts with older passwords keep working.
 * Mirrors js/password-policy.js; keep the two in sync.
 */
const SEVEN_PASSWORD_MIN_LENGTH = 8;
const SEVEN_PASSWORD_MAX_LENGTH = 16;
const SEVEN_PASSWORD_RULES_MESSAGE = 'Password must be 8–16 characters and include an uppercase letter, a lowercase letter, a number, and a symbol or space.';

/** Returns null when the password meets every rule, otherwise the user-facing message. */
function seven_password_policy_error(string $password): ?string
{
    if (!mb_check_encoding($password, 'UTF-8')) {
        return SEVEN_PASSWORD_RULES_MESSAGE;
    }
    $length = mb_strlen($password, 'UTF-8');
    $ok = $length >= SEVEN_PASSWORD_MIN_LENGTH
        && $length <= SEVEN_PASSWORD_MAX_LENGTH
        && preg_match('/[a-z]/', $password) === 1
        && preg_match('/[A-Z]/', $password) === 1
        && preg_match('/[0-9]/', $password) === 1
        && preg_match('/[^A-Za-z0-9]/u', $password) === 1; // any symbol or a space
    return $ok ? null : SEVEN_PASSWORD_RULES_MESSAGE;
}
