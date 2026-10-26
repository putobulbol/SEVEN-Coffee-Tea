<?php
declare(strict_types=1);
require __DIR__ . '/config.php';

const BANNER_MAX_IMAGE_BYTES = 50 * 1024 * 1024;

function banner_file(array $file): array {
    return [
        'name' => (string)($file['name'] ?? ''),
        'type' => (string)($file['type'] ?? ''),
        'tmp_name' => (string)($file['tmp_name'] ?? ''),
        'error' => (int)($file['error'] ?? UPLOAD_ERR_NO_FILE),
        'size' => (int)($file['size'] ?? 0)
    ];
}

function save_banner_image(array $file): string {
    if ($file['error'] !== UPLOAD_ERR_OK) throw new RuntimeException('Banner image upload failed.');
    if ($file['size'] <= 0 || $file['size'] > BANNER_MAX_IMAGE_BYTES) throw new RuntimeException('Banner image must be 50 MB or smaller.');
    if (!is_uploaded_file($file['tmp_name'])) throw new RuntimeException('Invalid banner upload.');

    $allowed = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];
    $mime = (new finfo(FILEINFO_MIME_TYPE))->file($file['tmp_name']);
    if (!isset($allowed[$mime]) || @getimagesize($file['tmp_name']) === false) {
        throw new RuntimeException('Banner image must be a real JPG, PNG, or WebP image.');
    }

    $dir = __DIR__ . '/../uploads/banners';
    if (!is_dir($dir) && !mkdir($dir, 0755, true) && !is_dir($dir)) throw new RuntimeException('Unable to create the banner upload directory.');

    $filename = 'banner-' . bin2hex(random_bytes(12)) . '.' . $allowed[$mime];
    $path = $dir . '/' . $filename;
    if (!move_uploaded_file($file['tmp_name'], $path)) throw new RuntimeException('Unable to save banner image.');

    return 'uploads/banners/' . $filename;
}

function banner_url_is_safe(string $url): bool {
    if ($url === '') return true;
    if (preg_match('/^\s*javascript:/i', $url)) return false;
    return (bool)preg_match('/^(https?:\/\/|\/|[A-Za-z0-9][A-Za-z0-9._\/?#=&%-]*$)/', $url);
}

try {
    require_admin();
    $pdo = db();
    $method = $_SERVER['REQUEST_METHOD'];

    if ($method === 'GET') {
        $stmt = $pdo->query('SELECT id,image_path,title,description,cta_label,cta_url,display_order,active,created_at,updated_at FROM carousel_banners ORDER BY display_order ASC,id ASC');
        $banners = array_map(static function(array $row): array {
            $row['id'] = (int)$row['id'];
            $row['display_order'] = (int)$row['display_order'];
            $row['active'] = (int)$row['active'] === 1;
            return $row;
        }, $stmt->fetchAll());
        respond(['ok' => true, 'banners' => $banners]);
    }

    if ($method !== 'POST') respond(['ok' => false, 'message' => 'Unsupported method.'], 405);

    $action = trim((string)($_POST['action'] ?? ''));
    if (!in_array($action, ['create','update','set_status','reorder','delete','bulk_status','bulk_delete'], true)) respond(['ok' => false, 'message' => 'Invalid banner action.'], 422);

    if ($action === 'bulk_status' || $action === 'bulk_delete') {
        $ids = json_decode((string)($_POST['ids'] ?? '[]'), true);
        if (!is_array($ids)) respond(['ok' => false, 'message' => 'Invalid banner selection.'], 422);
        $ids = array_values(array_unique(array_filter(array_map('intval', $ids), static fn(int $v): bool => $v > 0)));
        if (!$ids) respond(['ok' => false, 'message' => 'No banners selected.'], 422);
        $placeholders = implode(',', array_fill(0, count($ids), '?'));

        if ($action === 'bulk_status') {
            $active = (int)($_POST['active'] ?? 0) === 1 ? 1 : 0;
            $stmt = $pdo->prepare("UPDATE carousel_banners SET active=? WHERE id IN ($placeholders)");
            $stmt->execute(array_merge([$active], $ids));
            respond(['ok' => true, 'message' => count($ids) . ' banner' . (count($ids) === 1 ? '' : 's') . ' updated.']);
        }

        $paths = $pdo->prepare("SELECT image_path FROM carousel_banners WHERE id IN ($placeholders)");
        $paths->execute($ids);
        $files = $paths->fetchAll(PDO::FETCH_COLUMN);
        $stmt = $pdo->prepare("DELETE FROM carousel_banners WHERE id IN ($placeholders)");
        $stmt->execute($ids);
        foreach ($files as $file) @unlink(__DIR__ . '/../' . ltrim((string)$file, '/'));
        respond(['ok' => true, 'message' => count($ids) . ' banner' . (count($ids) === 1 ? '' : 's') . ' deleted.']);
    }

    if ($action === 'delete') {
        $id = (int)($_POST['id'] ?? 0);
        $stmt = $pdo->prepare('SELECT image_path FROM carousel_banners WHERE id=?');
        $stmt->execute([$id]);
        $path = $stmt->fetchColumn();
        if (!$path) respond(['ok' => false, 'message' => 'Banner not found.'], 404);
        $pdo->prepare('DELETE FROM carousel_banners WHERE id=?')->execute([$id]);
        @unlink(__DIR__ . '/../' . ltrim((string)$path, '/'));
        respond(['ok' => true, 'message' => 'Banner deleted.']);
    }

    if ($action === 'set_status') {
        $id = (int)($_POST['id'] ?? 0);
        $active = (int)($_POST['active'] ?? 0) === 1 ? 1 : 0;
        $stmt = $pdo->prepare('UPDATE carousel_banners SET active=? WHERE id=?');
        $stmt->execute([$active, $id]);
        respond(['ok' => true, 'message' => 'Banner status updated.']);
    }

    if ($action === 'reorder') {
        $orders = json_decode((string)($_POST['orders'] ?? '[]'), true);
        if (!is_array($orders)) respond(['ok' => false, 'message' => 'Invalid banner order data.'], 422);
        $stmt = $pdo->prepare('UPDATE carousel_banners SET display_order=? WHERE id=?');
        $pdo->beginTransaction();
        try {
            foreach ($orders as $order) {
                $id = (int)($order['id'] ?? 0);
                $position = (int)($order['order'] ?? 0);
                if ($id > 0 && $position > 0) $stmt->execute([$position, $id]);
            }
            $pdo->commit();
        } catch (Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }
        respond(['ok' => true, 'message' => 'Banner order updated.']);
    }

    $id = (int)($_POST['id'] ?? 0);
    $title = trim((string)($_POST['title'] ?? ''));
    $description = trim((string)($_POST['description'] ?? ''));
    $ctaLabel = trim((string)($_POST['cta_label'] ?? ''));
    $ctaUrl = trim((string)($_POST['cta_url'] ?? ''));
    $displayOrder = max(1, (int)($_POST['display_order'] ?? 1));
    $active = (int)($_POST['active'] ?? 1) === 1 ? 1 : 0;

    // Banner text fields are optional; database column sizes remain the final storage limits.
    if (!banner_url_is_safe($ctaUrl)) respond(['ok' => false, 'message' => 'CTA URL is not allowed.'], 422);

    $newImage = null;
    if (isset($_FILES['image']) && $_FILES['image']['error'] !== UPLOAD_ERR_NO_FILE) {
        $newImage = save_banner_image(banner_file($_FILES['image']));
    }

    if ($action === 'create') {
        if (!$newImage) $newImage = 'assets/banner.svg';
        $stmt = $pdo->prepare('INSERT INTO carousel_banners (image_path,title,description,cta_label,cta_url,display_order,active) VALUES (?,?,?,?,?,?,?)');
        $stmt->execute([$newImage, $title ?: null, $description ?: null, $ctaLabel ?: null, $ctaUrl ?: null, $displayOrder, $active]);
        respond(['ok' => true, 'message' => 'Banner created.']);
    }

    if ($action === 'update') {
        if ($id <= 0) respond(['ok' => false, 'message' => 'Invalid banner ID.'], 422);
        $currentStmt = $pdo->prepare('SELECT image_path FROM carousel_banners WHERE id=?');
        $currentStmt->execute([$id]);
        $oldImage = $currentStmt->fetchColumn();
        if (!$oldImage) respond(['ok' => false, 'message' => 'Banner not found.'], 404);

        $sql = 'UPDATE carousel_banners SET title=?,description=?,cta_label=?,cta_url=?,display_order=?,active=?';
        $params = [$title ?: null, $description ?: null, $ctaLabel ?: null, $ctaUrl ?: null, $displayOrder, $active];
        if ($newImage) {
            $sql .= ',image_path=?';
            $params[] = $newImage;
        }
        $sql .= ' WHERE id=?';
        $params[] = $id;
        $pdo->prepare($sql)->execute($params);
        if ($newImage && $oldImage) @unlink(__DIR__ . '/../' . ltrim((string)$oldImage, '/'));
        respond(['ok' => true, 'message' => 'Banner updated.']);
    }

    respond(['ok' => false, 'message' => 'Unsupported banner action.'], 422);
} catch (Throwable $e) {
    respond(['ok' => false, 'message' => 'Unable to manage banner.'], 400);
}
