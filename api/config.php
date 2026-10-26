<?php
declare(strict_types=1);

$storeTimezoneName = trim((string)(getenv('SEVEN_STORE_TZ') ?: 'Asia/Manila'));
try {
    $storeTimezone = new DateTimeZone($storeTimezoneName);
} catch (Throwable $e) {
    error_log('[SEVEN] Invalid SEVEN_STORE_TZ value; falling back to Asia/Manila.');
    $storeTimezoneName = 'Asia/Manila';
    $storeTimezone = new DateTimeZone($storeTimezoneName);
}
define('SEVEN_STORE_TZ', $storeTimezoneName);
date_default_timezone_set(SEVEN_STORE_TZ);

header('Content-Type: application/json; charset=utf-8');
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$allowedOrigins = [
    'http://localhost',
    'http://127.0.0.1',
];
$configuredOrigin = trim((string)(getenv('SEVEN_APP_ORIGIN') ?: ''));
if ($configuredOrigin !== '') $allowedOrigins[] = rtrim($configuredOrigin, '/');
if ($origin !== '' && in_array($origin, $allowedOrigins, true)) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Access-Control-Allow-Credentials: true');
    header('Vary: Origin');
}
header('Access-Control-Allow-Headers: Content-Type');
session_name('seven_admin');
if (session_status() !== PHP_SESSION_ACTIVE) {
    $secureCookie = !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/',
        'secure' => $secureCookie,
        'httponly' => true,
        'samesite' => 'Lax'
    ]);
    session_start();
}
header('Access-Control-Allow-Methods: GET, POST, PATCH, DELETE, OPTIONS');

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// Local-development configuration. Change these values for your PHP/MySQL environment.
define('DB_HOST', getenv('SEVEN_DB_HOST') ?: '127.0.0.1');
define('DB_NAME', getenv('SEVEN_DB_NAME') ?: 'seven_coffee');
define('DB_USER', getenv('SEVEN_DB_USER') ?: 'root');
define('DB_PASS', getenv('SEVEN_DB_PASS') !== false ? (string)getenv('SEVEN_DB_PASS') : '');
define('ADMIN_SESSION_TIMEOUT', 60 * 60 * 8);
define('SEVEN_REQUIRE_GMAIL', getenv('SEVEN_REQUIRE_GMAIL') === false ? true : filter_var(getenv('SEVEN_REQUIRE_GMAIL'), FILTER_VALIDATE_BOOLEAN));

function db(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4';
    $pdo = new PDO($dsn, DB_USER, DB_PASS, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);

    // MySQL's named timezone tables may be unavailable in local XAMPP installs.
    // Set a numeric session offset derived from the configured store timezone.
    $storeTimezone = new DateTimeZone(SEVEN_STORE_TZ);
    $storeNow = new DateTimeImmutable('now', $storeTimezone);
    $offsetSeconds = $storeTimezone->getOffset($storeNow);
    $absoluteOffset = abs($offsetSeconds);
    $mysqlOffset = sprintf(
        '%s%02d:%02d',
        $offsetSeconds < 0 ? '-' : '+',
        intdiv($absoluteOffset, 3600),
        intdiv($absoluteOffset % 3600, 60)
    );
    $timezoneStatement = $pdo->prepare('SET SESSION time_zone = ?');
    $timezoneStatement->execute([$mysqlOffset]);

    return $pdo;
}

function json_input(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || trim($raw) === '') {
        return [];
    }
    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : [];
}

function respond(array $data, int $status = 200)
{
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

/**
 * Shared sales eligibility rule used by Sales Reports and Order History.
 * Paid basis: verified/paid payment and not cancelled.
 * Completed basis: verified/paid payment and completed order status.
 */
function seven_sales_condition(string $basis = 'paid', string $alias = 'o'): string
{
    $prefix = $alias !== '' ? $alias . '.' : '';
    $condition = $prefix . "payment_status IN ('verified','paid')";

    if ($basis === 'completed') {
        return $condition . ' AND ' . $prefix . "order_status = 'completed'";
    }

    return $condition . ' AND ' . $prefix . "order_status <> 'cancelled'";
}

function require_admin(): void
{
    $userId = (int)($_SESSION['admin_user_id'] ?? 0);
    $role = (string)($_SESSION['admin_role'] ?? '');
    $lastActivity = (int)($_SESSION['admin_last_activity'] ?? 0);

    if ($lastActivity > 0 && (time() - $lastActivity) > ADMIN_SESSION_TIMEOUT) {
        unset($_SESSION['admin_user_id'], $_SESSION['admin_username'], $_SESSION['admin_role'], $_SESSION['admin_last_activity']);
        respond(['ok' => false, 'message' => 'Admin session expired. Please log in again.'], 401);
    }

    if ($userId <= 0 || !in_array($role, ['owner', 'staff'], true)) {
        respond(['ok' => false, 'message' => 'Administrator authentication is required.'], 403);
    }

    $_SESSION['admin_last_activity'] = time();
}
