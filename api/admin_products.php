<?php
declare(strict_types=1);
require __DIR__ . '/config.php';

const PRODUCT_MAX_IMAGE_BYTES = 50 * 1024 * 1024;
const PRODUCT_MAX_IMAGES_PER_REQUEST = 100;

/**
 * Normalizes a category so "Coffee", "coffee " and "COFFEE" never become separate categories:
 * collapses whitespace, standardizes the " · " sub-category separator, caps at the column size,
 * and reuses the spelling of an existing category that matches case-insensitively.
 * $excludeId skips the product being edited, so changing the casing of a product's own unique category still works.
 */
function product_normalize_category(PDO $pdo, string $raw, int $excludeId = 0): string {
    $value = preg_replace('/\s+/u', ' ', $raw) ?? $raw;
    $value = preg_replace('/\s*·\s*/u', ' · ', $value) ?? $value;
    $value = trim($value, " \t\n\r\0\x0B·");
    $value = mb_substr($value, 0, 100);
    if ($value === '') return '';
    $existing = $pdo->prepare('SELECT category FROM products WHERE LOWER(category) = LOWER(?) AND id <> ? ORDER BY id ASC LIMIT 1');
    $existing->execute([$value, $excludeId]);
    $match = $existing->fetchColumn();
    return is_string($match) && $match !== '' ? $match : $value;
}

function product_status_is_valid(string $status): bool {
    return in_array($status, ['active', 'out_of_stock', 'hidden'], true);
}

function product_files(array $files): array {
    if (!isset($files['name'])) return [];
    if (!is_array($files['name'])) {
        $files = [
            'name' => [$files['name'] ?? ''],
            'type' => [$files['type'] ?? ''],
            'tmp_name' => [$files['tmp_name'] ?? ''],
            'error' => [$files['error'] ?? UPLOAD_ERR_NO_FILE],
            'size' => [$files['size'] ?? 0]
        ];
    }
    $out = [];
    foreach ($files['name'] as $i => $name) {
        $out[] = [
            'name' => (string)$name,
            'type' => (string)($files['type'][$i] ?? ''),
            'tmp_name' => (string)($files['tmp_name'][$i] ?? ''),
            'error' => (int)($files['error'][$i] ?? UPLOAD_ERR_NO_FILE),
            'size' => (int)($files['size'][$i] ?? 0)
        ];
    }
    return array_values(array_filter($out, static fn(array $f): bool => $f['error'] !== UPLOAD_ERR_NO_FILE));
}

function save_product_images(int $productId, array $files, PDO $pdo): array {
    $files = product_files($files);
    if (count($files) > PRODUCT_MAX_IMAGES_PER_REQUEST) {
        throw new RuntimeException('Too many product images were submitted at once.');
    }

    $uploadDir = __DIR__ . '/../uploads/products';
    if (!is_dir($uploadDir) && !mkdir($uploadDir, 0755, true) && !is_dir($uploadDir)) {
        throw new RuntimeException('Unable to create the product upload directory.');
    }

    $allowed = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];
    $nextStmt = $pdo->prepare('SELECT COALESCE(MAX(sort_order), 0) + 1 FROM product_images WHERE product_id = ?');
    $nextStmt->execute([$productId]);
    $sort = (int)$nextStmt->fetchColumn();
    $insert = $pdo->prepare('INSERT INTO product_images (product_id, image_path, sort_order) VALUES (?, ?, ?)');
    $created = [];

    foreach ($files as $file) {
        if ($file['error'] !== UPLOAD_ERR_OK) throw new RuntimeException('A product image upload failed.');
        if ($file['size'] <= 0 || $file['size'] > PRODUCT_MAX_IMAGE_BYTES) {
            throw new RuntimeException('Each product image must be 50 MB or smaller.');
        }
        if (!is_uploaded_file($file['tmp_name'])) {
            throw new RuntimeException('Invalid product image upload.');
        }

        $mime = (new finfo(FILEINFO_MIME_TYPE))->file($file['tmp_name']);
        $imageInfo = @getimagesize($file['tmp_name']);
        if (!isset($allowed[$mime]) || $imageInfo === false) {
            throw new RuntimeException('Product images must be real JPG, PNG, or WebP images.');
        }

        $filename = 'product-' . $productId . '-' . bin2hex(random_bytes(10)) . '.' . $allowed[$mime];
        $destination = $uploadDir . '/' . $filename;
        if (!move_uploaded_file($file['tmp_name'], $destination)) {
            throw new RuntimeException('Unable to save a product image.');
        }

        $relative = 'uploads/products/' . $filename;
        $insert->execute([$productId, $relative, $sort++]);
        $created[] = $relative;
    }

    return $created;
}

function product_payload(PDO $pdo, int $id): array {
    $stmt = $pdo->prepare('SELECT id,name,description,category,price,large_price,status,is_bestseller,is_signature,created_at,updated_at FROM products WHERE id=?');
    $stmt->execute([$id]);
    $product = $stmt->fetch();
    if (!$product) throw new RuntimeException('Product not found.');

    $img = $pdo->prepare('SELECT id,image_path,sort_order FROM product_images WHERE product_id=? ORDER BY sort_order ASC,id ASC');
    $img->execute([$id]);
    $product['id'] = (int)$product['id'];
    $product['price'] = (float)$product['price'];
    $product['large_price'] = $product['large_price'] !== null ? (float)$product['large_price'] : null;
    $product['images'] = $img->fetchAll();

    return $product;
}

try {
    require_admin();
    $pdo = db();

    $method = $_SERVER['REQUEST_METHOD'];

    if ($method === 'GET') {
        $search = trim((string)($_GET['search'] ?? ''));
        $status = trim((string)($_GET['status'] ?? 'all'));
        $category = trim((string)($_GET['category'] ?? 'all'));

        $where = [];
        $params = [];
        if ($search !== '') {
            $where[] = '(name LIKE ? OR description LIKE ? OR category LIKE ?)';
            $like = '%' . $search . '%';
            array_push($params, $like, $like, $like);
        }
        if ($status !== 'all') {
            if (!product_status_is_valid($status)) respond(['ok' => false, 'message' => 'Invalid status.'], 422);
            $where[] = 'status = ?';
            $params[] = $status;
        }
        if ($category !== '' && $category !== 'all') {
            $where[] = 'category = ?';
            $params[] = $category;
        }

        $sql = 'SELECT id,name,description,category,price,large_price,status,is_bestseller,is_signature,created_at,updated_at FROM products';
        if ($where) $sql .= ' WHERE ' . implode(' AND ', $where);
        $sql .= ' ORDER BY id DESC';

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $products = $stmt->fetchAll();

        $imgStmt = $pdo->query('SELECT id,product_id,image_path,sort_order FROM product_images ORDER BY product_id ASC,sort_order ASC,id ASC');
        $map = [];
        foreach ($imgStmt->fetchAll() as $row) $map[(int)$row['product_id']][] = $row;

        foreach ($products as &$p) {
            $p['id'] = (int)$p['id'];
            $p['price'] = (float)$p['price'];
            $p['large_price'] = $p['large_price'] !== null ? (float)$p['large_price'] : null;
            $p['is_bestseller'] = (int)$p['is_bestseller'];
            $p['is_signature'] = (int)$p['is_signature'];
            $p['images'] = $map[$p['id']] ?? [];
        }
        unset($p);

        respond(['ok' => true, 'products' => $products]);
    }

    if ($method !== 'POST') respond(['ok' => false, 'message' => 'Unsupported method.'], 405);

    $action = trim((string)($_POST['action'] ?? ''));
    if (!in_array($action, ['create','update','set_status','delete','remove_image','bulk_update','bulk_delete'], true)) {
        respond(['ok' => false, 'message' => 'Invalid product action.'], 422);
    }

    if ($action === 'bulk_delete' || $action === 'bulk_update') {
        $ids = json_decode((string)($_POST['ids'] ?? '[]'), true);
        if (!is_array($ids)) respond(['ok' => false, 'message' => 'Invalid product selection.'], 422);
        $ids = array_values(array_unique(array_filter(array_map('intval', $ids), static fn(int $v): bool => $v > 0)));
        if (!$ids) respond(['ok' => false, 'message' => 'No products selected.'], 422);
        $placeholders = implode(',', array_fill(0, count($ids), '?'));

        if ($action === 'bulk_delete') {
            $stmt = $pdo->prepare("UPDATE products SET status='hidden', available=0, is_bestseller=0, is_signature=0 WHERE id IN ($placeholders)");
            $stmt->execute($ids);
            respond(['ok' => true, 'message' => count($ids) . ' product' . (count($ids) === 1 ? '' : 's') . ' archived. Sales history and images were preserved.']);
        }

        $category = product_normalize_category($pdo, (string)($_POST['category'] ?? ''));
        $status = trim((string)($_POST['status'] ?? ''));
        if ($category === '' && $status === '') respond(['ok' => false, 'message' => 'Nothing to update.'], 422);
        if ($status !== '' && !product_status_is_valid($status)) respond(['ok' => false, 'message' => 'Invalid status.'], 422);

        $fields = [];
        $params = [];
        if ($category !== '') { $fields[] = 'category=?'; $params[] = $category; }
        if ($status !== '') { $fields[] = 'status=?'; $fields[] = 'available=?'; $params[] = $status; $params[] = $status === 'active' ? 1 : 0; }
        $stmt = $pdo->prepare("UPDATE products SET " . implode(',', $fields) . " WHERE id IN ($placeholders)");
        $stmt->execute(array_merge($params, $ids));
        respond(['ok' => true, 'message' => 'Selected products updated.']);
    }

    if ($action === 'delete') {
        $id = (int)($_POST['id'] ?? 0);
        if ($id <= 0) respond(['ok' => false, 'message' => 'Invalid product ID.'], 422);
        $stmt = $pdo->prepare("UPDATE products SET status='hidden', available=0, is_bestseller=0, is_signature=0 WHERE id=?");
        $stmt->execute([$id]);
        if ($stmt->rowCount() < 1) {
            $check = $pdo->prepare('SELECT COUNT(*) FROM products WHERE id=?'); $check->execute([$id]);
            if (!(int)$check->fetchColumn()) respond(['ok' => false, 'message' => 'Product not found.'], 404);
        }
        respond(['ok' => true, 'message' => 'Product archived. Sales history and images were preserved.']);
    }

    if ($action === 'remove_image') {
        $imageId = (int)($_POST['image_id'] ?? 0);
        if ($imageId <= 0) respond(['ok' => false, 'message' => 'Invalid image ID.'], 422);
        $stmt = $pdo->prepare('SELECT image_path FROM product_images WHERE id=?');
        $stmt->execute([$imageId]);
        $path = $stmt->fetchColumn();
        if (!$path) respond(['ok' => false, 'message' => 'Image not found.'], 404);
        $pdo->prepare('DELETE FROM product_images WHERE id=?')->execute([$imageId]);
        @unlink(__DIR__ . '/../' . ltrim((string)$path, '/'));
        respond(['ok' => true, 'message' => 'Product image removed.']);
    }

    $id = (int)($_POST['id'] ?? 0);
    if ($action === 'set_status') {
        $status = trim((string)($_POST['status'] ?? ''));
        if ($id <= 0 || !product_status_is_valid($status)) respond(['ok' => false, 'message' => 'Invalid status update.'], 422);
        $available = $status === 'active' ? 1 : 0;
        $stmt = $pdo->prepare('UPDATE products SET status=?, available=? WHERE id=?');
        $stmt->execute([$status, $available, $id]);
        respond(['ok' => true, 'message' => 'Product status updated.', 'product' => product_payload($pdo, $id)]);
    }

    $name = trim((string)($_POST['name'] ?? ''));
    $description = trim((string)($_POST['description'] ?? ''));
    $category = product_normalize_category($pdo, (string)($_POST['category'] ?? ''), (int)($_POST['id'] ?? 0));
    $priceRaw = trim((string)($_POST['price'] ?? ''));
    $largePriceRaw = trim((string)($_POST['large_price'] ?? ''));
    $status = trim((string)($_POST['status'] ?? 'active'));
    $isBestseller = (int)($_POST['is_bestseller'] ?? 0) === 1 ? 1 : 0;
    $isSignature = (int)($_POST['is_signature'] ?? 0) === 1 ? 1 : 0;

    if ($name === '') respond(['ok' => false, 'message' => 'Product name is required.'], 422);
    if ($category === '') $category = 'Uncategorized';
    if ($priceRaw === '' || !is_numeric($priceRaw) || (float)$priceRaw < 0) respond(['ok' => false, 'message' => 'A valid Medium price is required.'], 422);
    $largePrice = null;
    if ($largePriceRaw !== '') {
        if (!is_numeric($largePriceRaw) || (float)$largePriceRaw < 0) respond(['ok' => false, 'message' => 'Enter a valid Large price or leave it blank for single-size products.'], 422);
        $largePrice = (float)$largePriceRaw;
    }
    if (!product_status_is_valid($status)) $status = 'active';

    $available = $status === 'active' ? 1 : 0;
    $pdo->beginTransaction();
    $createdFiles = [];

    try {
        if ($action === 'create') {
            $stmt = $pdo->prepare('INSERT INTO products (name,description,category,price,large_price,available,status,is_bestseller,is_signature) VALUES (?,?,?,?,?,?,?,?,?)');
            $stmt->execute([$name, $description !== '' ? $description : null, $category, (float)$priceRaw, $largePrice, $available, $status, $isBestseller, $isSignature]);
            $id = (int)$pdo->lastInsertId();
        } elseif ($action === 'update') {
            if ($id <= 0) throw new RuntimeException('Invalid product ID.');
            $stmt = $pdo->prepare('UPDATE products SET name=?,description=?,category=?,price=?,large_price=?,available=?,status=?,is_bestseller=?,is_signature=? WHERE id=?');
            $stmt->execute([$name, $description !== '' ? $description : null, $category, (float)$priceRaw, $largePrice, $available, $status, $isBestseller, $isSignature, $id]);
            if ($stmt->rowCount() === 0) {
                $check = $pdo->prepare('SELECT COUNT(*) FROM products WHERE id=?');
                $check->execute([$id]);
                if ((int)$check->fetchColumn() === 0) throw new RuntimeException('Product not found.');
            }
        } else {
            throw new RuntimeException('Invalid product action.');
        }

        if (isset($_FILES['images'])) {
            $createdFiles = save_product_images($id, $_FILES['images'], $pdo);
        }

        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        foreach ($createdFiles as $file) @unlink(__DIR__ . '/../' . ltrim($file, '/'));
        throw $e;
    }

    respond([
        'ok' => true,
        'message' => $action === 'create' ? 'Product created.' : 'Product updated.',
        'product' => product_payload($pdo, $id)
    ]);
} catch (Throwable $e) {
    respond(['ok' => false, 'message' => 'Unable to manage product.'], 400);
}
