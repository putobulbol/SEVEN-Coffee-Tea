<?php
declare(strict_types=1);
require __DIR__ . '/config.php';

try {
    $pdo = db();

    $stmt = $pdo->query(
        "SELECT id, name, description, category, price, large_price, status, is_bestseller, is_signature
         FROM products
         WHERE status IN ('active','out_of_stock')
         ORDER BY id ASC"
    );
    $rows = $stmt->fetchAll();

    $imageStmt = $pdo->query(
        "SELECT product_id, image_path
         FROM product_images
         ORDER BY product_id ASC, sort_order ASC, id ASC"
    );

    $images = [];
    foreach ($imageStmt->fetchAll() as $row) {
        $images[(int)$row['product_id']][] = (string)$row['image_path'];
    }

    $products = array_map(static function (array $row) use ($images): array {
        $id = (int)$row['id'];
        $category = (string)$row['category'];
        $price = (float)$row['price'];
        $largePrice = $row['large_price'] !== null ? (float)$row['large_price'] : null;
        $imageList = $images[$id] ?? [];
        $isHot = $category === 'Hot Beverages';

        return [
            'id' => 'p' . $id,
            'name' => (string)$row['name'],
            'description' => (string)($row['description'] ?? ''),
            'category' => $category,
            'prices' => $price > 0
                ? (['medium' => $price] + ($largePrice !== null ? ['large' => $largePrice] : []))
                : null,
            'available' => (string)$row['status'] === 'active',
            'status' => (string)$row['status'],
            'is_bestseller' => (int)$row['is_bestseller'],
            'is_signature' => (int)$row['is_signature'],
            'image' => $imageList[0] ?? 'assets/Latte.png',
            'images' => $imageList ?: ['assets/Latte.png']
        ];
    }, $rows);

    // Rank active catalog products only by qualifying verified/paid, non-cancelled sales.
    $productById = [];
    foreach ($products as $product) {
        if (($product['status'] ?? '') === 'active') $productById[(string)$product['id']] = $product;
    }
    $salesStmt = $pdo->query(
        "SELECT p.id, SUM(oi.quantity) AS total_sold, MAX(o.created_at) AS last_sale_at
         FROM products p
         INNER JOIN order_items oi ON oi.product_id=p.id
         INNER JOIN orders o ON o.id=oi.order_id
         WHERE p.status='active'
           AND o.order_status <> 'cancelled'
           AND o.payment_status IN ('verified','paid')
         GROUP BY p.id
         ORDER BY total_sold DESC, last_sale_at DESC, p.name ASC
         LIMIT 5"
    );
    $bestSellers = [];
    foreach ($salesStmt->fetchAll() as $sale) {
        $key = 'p' . (int)$sale['id'];
        if (!isset($productById[$key])) continue;
        $candidate = $productById[$key];
        $candidate['total_sold'] = (int)$sale['total_sold'];
        $candidate['last_sale_at'] = (string)($sale['last_sale_at'] ?? '');
        $bestSellers[] = $candidate;
    }

    respond(['ok' => true, 'products' => $products, 'best_sellers' => $bestSellers]);
} catch (Throwable $e) {
    respond(['ok' => false, 'message' => 'Unable to load products.'], 500);
}
