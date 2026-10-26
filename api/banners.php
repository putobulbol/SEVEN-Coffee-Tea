<?php
declare(strict_types=1);
require __DIR__ . '/config.php';

function public_banner_url(string $path): string {
    $path = '/' . ltrim(str_replace('\\', '/', $path), '/');
    $script = str_replace('\\', '/', (string)($_SERVER['SCRIPT_NAME'] ?? '/api/banners.php'));
    $apiDir = dirname($script);
    $basePath = rtrim(dirname($apiDir), '/');
    return ($basePath === '' ? '' : $basePath) . $path;
}

try {
    $stmt = db()->query(
        "SELECT id, image_path, title, description, cta_label, cta_url, display_order
         FROM carousel_banners
         WHERE active = 1
         ORDER BY display_order ASC, id ASC"
    );

    $banners = array_map(static fn(array $row): array => [
        'id' => (int)$row['id'],
        'image' => public_banner_url((string)$row['image_path']),
        'imagePath' => (string)$row['image_path'],
        'title' => (string)($row['title'] ?? ''),
        'description' => (string)($row['description'] ?? ''),
        'ctaLabel' => (string)($row['cta_label'] ?? ''),
        'targetLink' => (string)($row['cta_url'] ?? ''),
        'order' => (int)$row['display_order']
    ], $stmt->fetchAll());

    respond(['ok' => true, 'banners' => $banners]);
} catch (Throwable $e) {
    respond(['ok' => false, 'message' => 'Unable to load carousel banners.'], 500);
}
