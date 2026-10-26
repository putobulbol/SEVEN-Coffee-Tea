<?php
declare(strict_types=1);
require __DIR__ . '/config.php';

/*
 * Admin bell (database/admin_notifications.sql).
 *   GET                                  -> recent events + this admin's unread_count
 *   POST {"action":"mark_read","id":N}   -> mark one as read for this admin
 *   POST {"action":"mark_all_read"}      -> mark every recent event as read for this admin
 * Read state is per admin account. Only the last 30 days are listed/counted.
 */
const ADMIN_NOTIFICATION_WINDOW_DAYS = 30;
const ADMIN_NOTIFICATION_LIST_LIMIT = 30;

try {
    require_admin();
    $adminId = (int)($_SESSION['admin_user_id'] ?? 0);
    $pdo = db();
    $window = 'n.created_at >= (NOW() - INTERVAL ' . ADMIN_NOTIFICATION_WINDOW_DAYS . ' DAY)';
    $method = $_SERVER['REQUEST_METHOD'];

    if ($method === 'GET') {
        $list = $pdo->prepare(
            "SELECT n.id, n.order_id, o.order_code, n.type, n.title, n.message, n.created_at,
                    (r.notification_id IS NOT NULL) AS is_read
             FROM admin_notifications n
             LEFT JOIN orders o ON o.id = n.order_id
             LEFT JOIN admin_notification_reads r ON r.notification_id = n.id AND r.admin_user_id = ?
             WHERE $window
             ORDER BY n.created_at DESC, n.id DESC
             LIMIT " . ADMIN_NOTIFICATION_LIST_LIMIT
        );
        $list->execute([$adminId]);
        $rows = array_map(static function (array $row): array {
            return [
                'id' => (int)$row['id'],
                'order_id' => $row['order_id'] !== null ? (int)$row['order_id'] : null,
                'order_code' => $row['order_code'],
                'type' => (string)$row['type'],
                'title' => (string)$row['title'],
                'message' => (string)$row['message'],
                'created_at' => (string)$row['created_at'],
                'is_read' => (int)$row['is_read'] === 1,
            ];
        }, $list->fetchAll());

        $unread = $pdo->prepare(
            "SELECT COUNT(*) FROM admin_notifications n
             LEFT JOIN admin_notification_reads r ON r.notification_id = n.id AND r.admin_user_id = ?
             WHERE r.notification_id IS NULL AND $window"
        );
        $unread->execute([$adminId]);
        respond(['ok' => true, 'configured' => true, 'notifications' => $rows, 'unread_count' => (int)$unread->fetchColumn()]);
    }

    if ($method === 'POST') {
        $input = json_input();
        $action = (string)($input['action'] ?? '');

        if ($action === 'mark_all_read') {
            $stmt = $pdo->prepare(
                "INSERT IGNORE INTO admin_notification_reads (notification_id, admin_user_id)
                 SELECT n.id, ? FROM admin_notifications n WHERE $window"
            );
            $stmt->execute([$adminId]);
            respond(['ok' => true, 'updated' => $stmt->rowCount()]);
        }

        if ($action === 'mark_read') {
            $id = filter_var($input['id'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
            if ($id === false || $id === null) respond(['ok' => false, 'message' => 'Notification ID is required.'], 422);
            $exists = $pdo->prepare('SELECT 1 FROM admin_notifications WHERE id = ? LIMIT 1');
            $exists->execute([$id]);
            if (!$exists->fetchColumn()) respond(['ok' => false, 'message' => 'Notification not found.'], 404);
            $stmt = $pdo->prepare('INSERT IGNORE INTO admin_notification_reads (notification_id, admin_user_id) VALUES (?, ?)');
            $stmt->execute([$id, $adminId]);
            respond(['ok' => true, 'updated' => $stmt->rowCount()]);
        }

        respond(['ok' => false, 'message' => 'Invalid notification action.'], 422);
    }

    respond(['ok' => false, 'message' => 'Method not allowed.'], 405);
} catch (PDOException $e) {
    // Bell still works (empty) before database/admin_notifications.sql has been run.
    if ($e->getCode() === '42S02') {
        respond(['ok' => true, 'configured' => false, 'notifications' => [], 'unread_count' => 0]);
    }
    error_log('Admin notifications failed: ' . $e->getMessage());
    respond(['ok' => false, 'message' => 'Unable to load notifications.'], 500);
} catch (Throwable $e) {
    error_log('Admin notifications failed: ' . $e->getMessage());
    respond(['ok' => false, 'message' => 'Unable to load notifications.'], 500);
}
