<?php
declare(strict_types=1);
require __DIR__ . '/config.php';

try {
    db()->query('SELECT 1');
    respond(['ok' => true, 'database' => 'connected']);
} catch (Throwable $e) {
    // Never expose driver/connection details (host, user, paths) to the client.
    error_log('Health check failed: ' . $e->getMessage());
    respond(['ok' => false, 'database' => 'not connected', 'message' => 'Database is unavailable.'], 500);
}
