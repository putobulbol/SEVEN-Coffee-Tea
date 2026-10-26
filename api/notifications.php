<?php
declare(strict_types=1);
require __DIR__ . '/config.php';

try {
    $pdo = db();
    $customerUserId = !empty($_SESSION['customer_user_id']) ? (int)$_SESSION['customer_user_id'] : 0;
    if ($customerUserId <= 0) respond(['ok' => false, 'message' => 'Please log in to view notifications.'], 401);

    $method = $_SERVER['REQUEST_METHOD'];
    if ($method === 'GET') {
        $stmt = $pdo->prepare(
            'SELECT n.id,n.order_id,o.order_code,n.type,n.title,n.message,n.is_read,n.created_at
             FROM customer_notifications n
             LEFT JOIN orders o ON o.id=n.order_id
             WHERE n.user_id=?
             ORDER BY n.created_at DESC,n.id DESC
             LIMIT 40'
        );
        $stmt->execute([$customerUserId]);
        $notifications = $stmt->fetchAll();
        $unreadStmt = $pdo->prepare('SELECT COUNT(*) FROM customer_notifications WHERE user_id=? AND is_read=0');
        $unreadStmt->execute([$customerUserId]);
        respond(['ok' => true, 'configured' => true, 'notifications' => $notifications, 'unread_count' => (int)$unreadStmt->fetchColumn()]);
    }

    if ($method === 'PATCH') {
        $input = json_input();
        $action = (string)($input['action'] ?? '');
        if ($action === 'mark_all_read') {
            $stmt = $pdo->prepare('UPDATE customer_notifications SET is_read=1 WHERE user_id=? AND is_read=0');
            $stmt->execute([$customerUserId]);
            respond(['ok' => true, 'updated' => $stmt->rowCount()]);
        }

        $id = (int)($input['id'] ?? 0);
        if ($id <= 0) respond(['ok' => false, 'message' => 'Notification ID is required.'], 422);
        $stmt = $pdo->prepare('UPDATE customer_notifications SET is_read=1 WHERE id=? AND user_id=?');
        $stmt->execute([$id, $customerUserId]);
        respond(['ok' => true, 'updated' => $stmt->rowCount()]);
    }

    respond(['ok' => false, 'message' => 'Method not allowed.'], 405);
} catch (PDOException $e) {
    if ($e->getCode() === '42S02') {
        respond(['ok' => true, 'configured' => false, 'notifications' => [], 'unread_count' => 0]);
    }
    respond(['ok' => false, 'message' => 'Unable to load customer notifications.'], 500);
} catch (Throwable $e) {
    respond(['ok' => false, 'message' => 'Unable to load customer notifications.'], 500);
}
