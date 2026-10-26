<?php
declare(strict_types=1);

require __DIR__ . '/config.php';

function sales_query_string(string $name, string $default = ''): string
{
    $value = $_GET[$name] ?? $default;
    if (!is_scalar($value)) {
        respond(['ok' => false, 'message' => 'Invalid ' . $name . ' parameter.'], 422);
    }
    return trim((string)$value);
}

function sales_parse_date(string $value, string $name): DateTimeImmutable
{
    $timezone = new DateTimeZone(SEVEN_STORE_TZ);
    $date = DateTimeImmutable::createFromFormat('!Y-m-d', $value, $timezone);
    $errors = DateTimeImmutable::getLastErrors();

    if (
        $value === '' ||
        $date === false ||
        ($errors !== false && ($errors['warning_count'] > 0 || $errors['error_count'] > 0)) ||
        $date->format('Y-m-d') !== $value
    ) {
        respond(['ok' => false, 'message' => $name . ' must be a valid date in YYYY-MM-DD format.'], 422);
    }

    return $date;
}

function sales_bucket_expression(string $period, string $alias = 'o'): string
{
    $createdAt = $alias !== '' ? $alias . '.created_at' : 'created_at';

    if ($period === 'daily') {
        return 'DATE(' . $createdAt . ')';
    }
    if ($period === 'weekly') {
        return 'DATE_SUB(DATE(' . $createdAt . '), INTERVAL WEEKDAY(' . $createdAt . ') DAY)';
    }
    return "DATE_FORMAT(" . $createdAt . ", '%Y-%m-01')";
}

function sales_sale_condition(string $basis, string $alias = 'o'): string
{
    return seven_sales_condition($basis, $alias);
}

function sales_period_label(string $period, DateTimeImmutable $start, DateTimeImmutable $end): string
{
    if ($period === 'daily') {
        return $start->format('M j, Y');
    }
    if ($period === 'monthly') {
        return $start->format('F Y');
    }

    if ($start->format('Y') === $end->format('Y')) {
        return $start->format('M j') . ' - ' . $end->format('M j, Y');
    }

    return $start->format('M j, Y') . ' - ' . $end->format('M j, Y');
}

function sales_bucket_end(string $period, DateTimeImmutable $start): DateTimeImmutable
{
    if ($period === 'daily') {
        return $start;
    }
    if ($period === 'weekly') {
        return $start->modify('+6 days');
    }
    return $start->modify('first day of next month')->modify('-1 day');
}

function sales_fetch_grouped_orders(
    PDO $pdo,
    string $period,
    DateTimeImmutable $start,
    DateTimeImmutable $endExclusive,
    string $basis
): array {
    $bucket = sales_bucket_expression($period, 'o');
    $saleCondition = sales_sale_condition($basis, 'o');
    $sql = "
        SELECT
            {$bucket} AS period_start,
            SUM(CASE WHEN {$saleCondition} THEN 1 ELSE 0 END) AS sale_orders,
            COALESCE(SUM(CASE WHEN {$saleCondition} THEN o.total_amount ELSE 0 END), 0) AS gross_sales,
            CASE
                WHEN SUM(CASE WHEN {$saleCondition} THEN 1 ELSE 0 END) = 0 THEN 0
                ELSE SUM(CASE WHEN {$saleCondition} THEN o.total_amount ELSE 0 END)
                    / SUM(CASE WHEN {$saleCondition} THEN 1 ELSE 0 END)
            END AS average_order_value,
            SUM(CASE WHEN o.order_status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled_orders,
            SUM(CASE WHEN o.order_status = 'cancelled' THEN o.total_amount ELSE 0 END) AS cancelled_amount,
            SUM(CASE WHEN o.payment_status = 'rejected' AND o.order_status <> 'cancelled' THEN 1 ELSE 0 END) AS rejected_payments,
            SUM(CASE WHEN o.payment_status = 'rejected' AND o.order_status <> 'cancelled' THEN o.total_amount ELSE 0 END) AS rejected_amount
        FROM orders o
        WHERE o.created_at >= ? AND o.created_at < ?
        GROUP BY {$bucket}
        ORDER BY period_start
    ";
    $stmt = $pdo->prepare($sql);
    $stmt->execute([
        $start->format('Y-m-d H:i:s'),
        $endExclusive->format('Y-m-d H:i:s')
    ]);
    return $stmt->fetchAll();
}

function sales_fetch_grouped_items(
    PDO $pdo,
    string $period,
    DateTimeImmutable $start,
    DateTimeImmutable $endExclusive,
    string $basis
): array {
    $bucket = sales_bucket_expression($period, 'o');
    $saleCondition = sales_sale_condition($basis, 'o');
    $sql = "
        SELECT {$bucket} AS period_start, COALESCE(SUM(oi.quantity), 0) AS items_sold
        FROM orders o
        INNER JOIN order_items oi ON oi.order_id = o.id
        WHERE o.created_at >= ? AND o.created_at < ?
          AND {$saleCondition}
        GROUP BY {$bucket}
        ORDER BY period_start
    ";
    $stmt = $pdo->prepare($sql);
    $stmt->execute([
        $start->format('Y-m-d H:i:s'),
        $endExclusive->format('Y-m-d H:i:s')
    ]);
    return $stmt->fetchAll();
}

function sales_fetch_totals(
    PDO $pdo,
    DateTimeImmutable $start,
    DateTimeImmutable $endExclusive,
    string $basis
): array {
    $saleCondition = sales_sale_condition($basis, 'o');
    $sql = "
        SELECT
            SUM(CASE WHEN {$saleCondition} THEN 1 ELSE 0 END) AS orders,
            COALESCE(SUM(CASE WHEN {$saleCondition} THEN o.total_amount ELSE 0 END), 0) AS gross_sales,
            CASE
                WHEN SUM(CASE WHEN {$saleCondition} THEN 1 ELSE 0 END) = 0 THEN 0
                ELSE SUM(CASE WHEN {$saleCondition} THEN o.total_amount ELSE 0 END)
                    / SUM(CASE WHEN {$saleCondition} THEN 1 ELSE 0 END)
            END AS average_order_value,
            SUM(CASE WHEN o.order_status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled_orders,
            COALESCE(SUM(CASE WHEN o.order_status = 'cancelled' THEN o.total_amount ELSE 0 END), 0) AS cancelled_amount,
            SUM(CASE WHEN o.payment_status = 'rejected' AND o.order_status <> 'cancelled' THEN 1 ELSE 0 END) AS rejected_payments,
            COALESCE(SUM(CASE WHEN o.payment_status = 'rejected' AND o.order_status <> 'cancelled' THEN o.total_amount ELSE 0 END), 0) AS rejected_amount
        FROM orders o
        WHERE o.created_at >= ? AND o.created_at < ?
    ";
    $stmt = $pdo->prepare($sql);
    $stmt->execute([
        $start->format('Y-m-d H:i:s'),
        $endExclusive->format('Y-m-d H:i:s')
    ]);
    $totals = $stmt->fetch() ?: [];

    // Item quantity is aggregated separately so each order total is never multiplied
    // by its number of order_items rows.
    $itemSql = "
        SELECT COALESCE(SUM(oi.quantity), 0)
        FROM orders o
        INNER JOIN order_items oi ON oi.order_id = o.id
        WHERE o.created_at >= ? AND o.created_at < ?
          AND {$saleCondition}
    ";
    $itemStmt = $pdo->prepare($itemSql);
    $itemStmt->execute([
        $start->format('Y-m-d H:i:s'),
        $endExclusive->format('Y-m-d H:i:s')
    ]);
    $totals['items_sold'] = (int)$itemStmt->fetchColumn();

    return [
        'orders' => (int)($totals['orders'] ?? 0),
        'items_sold' => (int)($totals['items_sold'] ?? 0),
        'gross_sales' => round((float)($totals['gross_sales'] ?? 0), 2),
        'average_order_value' => round((float)($totals['average_order_value'] ?? 0), 2),
        'cancelled_orders' => (int)($totals['cancelled_orders'] ?? 0),
        'cancelled_amount' => round((float)($totals['cancelled_amount'] ?? 0), 2),
        'rejected_payments' => (int)($totals['rejected_payments'] ?? 0),
        'rejected_amount' => round((float)($totals['rejected_amount'] ?? 0), 2)
    ];
}

function sales_percent_change(float $current, float $previous): ?float
{
    if ($previous == 0.0) {
        return $current == 0.0 ? 0.0 : null;
    }
    return round((($current - $previous) / abs($previous)) * 100, 2);
}

function sales_build_changes(array $current, array $previous): array
{
    $changes = [];
    foreach (['gross_sales', 'orders', 'items_sold', 'average_order_value'] as $key) {
        $currentValue = (float)($current[$key] ?? 0);
        $previousValue = (float)($previous[$key] ?? 0);
        $difference = $currentValue - $previousValue;
        $changes[$key] = [
            'current' => $currentValue,
            'previous' => $previousValue,
            'difference' => round($difference, 2),
            'percentage' => sales_percent_change($currentValue, $previousValue)
        ];
    }
    return $changes;
}

function sales_fetch_top_products(
    PDO $pdo,
    DateTimeImmutable $start,
    DateTimeImmutable $endExclusive,
    string $basis
): array {
    $saleCondition = sales_sale_condition($basis, 'o');
    $sql = "
        SELECT
            oi.product_name,
            COALESCE(SUM(oi.quantity), 0) AS quantity,
            COALESCE(SUM(oi.subtotal), 0) AS revenue
        FROM orders o
        INNER JOIN order_items oi ON oi.order_id = o.id
        WHERE o.created_at >= ? AND o.created_at < ?
          AND {$saleCondition}
        GROUP BY oi.product_name
        ORDER BY SUM(oi.quantity) DESC, SUM(oi.subtotal) DESC, oi.product_name ASC
        LIMIT 5
    ";
    $stmt = $pdo->prepare($sql);
    $stmt->execute([
        $start->format('Y-m-d H:i:s'),
        $endExclusive->format('Y-m-d H:i:s')
    ]);

    return array_map(static function (array $row): array {
        return [
            'product_name' => (string)$row['product_name'],
            'quantity' => (int)$row['quantity'],
            'revenue' => round((float)$row['revenue'], 2)
        ];
    }, $stmt->fetchAll());
}

function sales_run_summary(PDO $pdo): void
{
    $timezone = new DateTimeZone(SEVEN_STORE_TZ);
    $now = new DateTimeImmutable('now', $timezone);
    $todayStart = $now->setTime(0, 0, 0);
    $tomorrowStart = $todayStart->modify('+1 day');
    $weekStart = $todayStart->modify('-' . ((int)$todayStart->format('N') - 1) . ' days');
    $monthStart = $todayStart->modify('first day of this month');
    $queryStart = $weekStart < $monthStart ? $weekStart : $monthStart;
    $saleCondition = sales_sale_condition('paid', 'o');

    $sql = "
        SELECT
            COALESCE(SUM(CASE WHEN {$saleCondition} AND o.created_at >= ? AND o.created_at < ? THEN o.total_amount ELSE 0 END), 0) AS today_sales,
            SUM(CASE WHEN {$saleCondition} AND o.created_at >= ? AND o.created_at < ? THEN 1 ELSE 0 END) AS today_orders,
            COALESCE(SUM(CASE WHEN {$saleCondition} AND o.created_at >= ? AND o.created_at < ? THEN o.total_amount ELSE 0 END), 0) AS week_sales,
            SUM(CASE WHEN {$saleCondition} AND o.created_at >= ? AND o.created_at < ? THEN 1 ELSE 0 END) AS week_orders,
            COALESCE(SUM(CASE WHEN {$saleCondition} AND o.created_at >= ? AND o.created_at < ? THEN o.total_amount ELSE 0 END), 0) AS month_sales,
            SUM(CASE WHEN {$saleCondition} AND o.created_at >= ? AND o.created_at < ? THEN 1 ELSE 0 END) AS month_orders
        FROM orders o
        WHERE o.created_at >= ? AND o.created_at < ?
    ";
    $stmt = $pdo->prepare($sql);
    $stmt->execute([
        $todayStart->format('Y-m-d H:i:s'), $tomorrowStart->format('Y-m-d H:i:s'),
        $todayStart->format('Y-m-d H:i:s'), $tomorrowStart->format('Y-m-d H:i:s'),
        $weekStart->format('Y-m-d H:i:s'), $tomorrowStart->format('Y-m-d H:i:s'),
        $weekStart->format('Y-m-d H:i:s'), $tomorrowStart->format('Y-m-d H:i:s'),
        $monthStart->format('Y-m-d H:i:s'), $tomorrowStart->format('Y-m-d H:i:s'),
        $monthStart->format('Y-m-d H:i:s'), $tomorrowStart->format('Y-m-d H:i:s'),
        $queryStart->format('Y-m-d H:i:s'), $tomorrowStart->format('Y-m-d H:i:s')
    ]);
    $row = $stmt->fetch() ?: [];
    $count = $pdo->query('SELECT COUNT(*) FROM orders')->fetchColumn();

    respond([
        'ok' => true,
        'timezone' => SEVEN_STORE_TZ,
        'today' => [
            'sales' => round((float)($row['today_sales'] ?? 0), 2),
            'orders' => (int)($row['today_orders'] ?? 0)
        ],
        'this_week' => [
            'sales' => round((float)($row['week_sales'] ?? 0), 2),
            'orders' => (int)($row['week_orders'] ?? 0)
        ],
        'this_month' => [
            'sales' => round((float)($row['month_sales'] ?? 0), 2),
            'orders' => (int)($row['month_orders'] ?? 0)
        ],
        'total_orders' => (int)$count
    ]);
}

function sales_run_detail(PDO $pdo): void
{
    $period = sales_query_string('period', 'daily');
    if (!in_array($period, ['daily', 'weekly', 'monthly'], true)) {
        respond(['ok' => false, 'message' => 'Period must be daily, weekly, or monthly.'], 422);
    }

    $basis = sales_query_string('basis', 'paid');
    if (!in_array($basis, ['paid', 'completed'], true)) {
        respond(['ok' => false, 'message' => 'Basis must be paid or completed.'], 422);
    }

    $startText = sales_query_string('start');
    $start = sales_parse_date($startText, 'start');
    if (
        ($period === 'weekly' && $start->format('N') !== '1') ||
        ($period === 'monthly' && $start->format('d') !== '01')
    ) {
        respond(['ok' => false, 'message' => 'start must be the first day of the selected ' . ($period === 'weekly' ? 'week (Monday).' : 'month.')], 422);
    }

    $endExclusive = $period === 'daily'
        ? $start->modify('+1 day')
        : ($period === 'weekly' ? $start->modify('+1 week') : $start->modify('+1 month'));

    $pageValue = filter_var(sales_query_string('page', '1'), FILTER_VALIDATE_INT);
    if ($pageValue === false || $pageValue < 1 || $pageValue > 1000000) {
        respond(['ok' => false, 'message' => 'page must be a positive integer.'], 422);
    }
    $page = (int)$pageValue;
    $limit = 20;
    $offset = ($page - 1) * $limit;
    $saleCondition = sales_sale_condition($basis, 'o');

    $countStmt = $pdo->prepare("
        SELECT COUNT(*)
        FROM orders o
        WHERE o.created_at >= ? AND o.created_at < ?
          AND {$saleCondition}
    ");
    $countStmt->execute([
        $start->format('Y-m-d H:i:s'),
        $endExclusive->format('Y-m-d H:i:s')
    ]);
    $total = (int)$countStmt->fetchColumn();

    $stmt = $pdo->prepare("
        SELECT
            o.id,
            o.order_code,
            o.created_at AS time,
            o.customer_name AS customer,
            o.total_amount AS total,
            o.payment_status,
            o.order_status
        FROM orders o
        WHERE o.created_at >= ? AND o.created_at < ?
          AND {$saleCondition}
        ORDER BY o.created_at ASC, o.id ASC
        LIMIT ? OFFSET ?
    ");
    $stmt->bindValue(1, $start->format('Y-m-d H:i:s'), PDO::PARAM_STR);
    $stmt->bindValue(2, $endExclusive->format('Y-m-d H:i:s'), PDO::PARAM_STR);
    $stmt->bindValue(3, $limit, PDO::PARAM_INT);
    $stmt->bindValue(4, $offset, PDO::PARAM_INT);
    $stmt->execute();

    $orders = array_map(static function (array $order): array {
        return [
            'id' => (int)$order['id'],
            'order_code' => (string)$order['order_code'],
            'time' => (string)$order['time'],
            'customer' => (string)$order['customer'],
            'total' => round((float)$order['total'], 2),
            'payment_status' => (string)$order['payment_status'],
            'order_status' => (string)$order['order_status']
        ];
    }, $stmt->fetchAll());

    respond([
        'ok' => true,
        'period' => $period,
        'start' => $start->format('Y-m-d'),
        'basis' => $basis,
        'orders' => $orders,
        'total' => $total,
        'page' => $page,
        'limit' => $limit,
        'pages' => $total > 0 ? (int)ceil($total / $limit) : 0
    ]);
}

try {
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
        respond(['ok' => false, 'message' => 'Only GET requests are supported.'], 405);
    }

    require_admin();
    if ((string)($_SESSION['admin_role'] ?? '') !== 'owner') {
        respond(['ok' => false, 'message' => 'Only the owner can access sales reports.'], 403);
    }

    $summaryFlag = sales_query_string('summary', '0');
    $detailFlag = sales_query_string('detail', '0');
    if (!in_array($summaryFlag, ['0', '1'], true) || !in_array($detailFlag, ['0', '1'], true)) {
        respond(['ok' => false, 'message' => 'summary and detail must be 0 or 1.'], 422);
    }
    if ($summaryFlag === '1' && $detailFlag === '1') {
        respond(['ok' => false, 'message' => 'summary and detail cannot be requested together.'], 422);
    }

    $pdo = db();

    if ($summaryFlag === '1') {
        sales_run_summary($pdo);
    }
    if ($detailFlag === '1') {
        sales_run_detail($pdo);
    }

    $period = sales_query_string('period', 'daily');
    if (!in_array($period, ['daily', 'weekly', 'monthly'], true)) {
        respond(['ok' => false, 'message' => 'Period must be daily, weekly, or monthly.'], 422);
    }

    $basis = sales_query_string('basis', 'paid');
    if (!in_array($basis, ['paid', 'completed'], true)) {
        respond(['ok' => false, 'message' => 'Basis must be paid or completed.'], 422);
    }

    $timezone = new DateTimeZone(SEVEN_STORE_TZ);
    $today = (new DateTimeImmutable('now', $timezone))->setTime(0, 0, 0);
    $fromText = sales_query_string('from');
    $toText = sales_query_string('to');
    $preset = sales_query_string('preset');
    $allowedPresets = ['today', 'yesterday', 'this_week', 'last_week', 'this_month', 'last_month'];

    if ($preset !== '' && !in_array($preset, $allowedPresets, true)) {
        respond(['ok' => false, 'message' => 'Invalid date preset.'], 422);
    }
    if (($fromText === '') !== ($toText === '')) {
        respond(['ok' => false, 'message' => 'Provide both from and to dates, or omit both to use the default range.'], 422);
    }
    if ($preset !== '' && ($fromText !== '' || $toText !== '')) {
        respond(['ok' => false, 'message' => 'Use either a date preset or a custom from/to range, not both.'], 422);
    }

    if ($preset !== '') {
        $monday = $today->modify('-' . ((int)$today->format('N') - 1) . ' days');
        $monthStart = $today->modify('first day of this month');

        switch ($preset) {
            case 'today':
                $from = $today;
                $to = $today;
                break;
            case 'yesterday':
                $from = $today->modify('-1 day');
                $to = $from;
                break;
            case 'this_week':
                $from = $monday;
                $to = $monday->modify('+6 days');
                break;
            case 'last_week':
                $from = $monday->modify('-1 week');
                $to = $from->modify('+6 days');
                break;
            case 'this_month':
                $from = $monthStart;
                $to = $monthStart->modify('last day of this month');
                break;
            case 'last_month':
                $from = $monthStart->modify('-1 month');
                $to = $from->modify('last day of this month');
                break;
        }
    } elseif ($fromText === '' && $toText === '') {
        if ($period === 'daily') {
            $from = $today->modify('-29 days');
            $to = $today;
        } elseif ($period === 'weekly') {
            $currentMonday = $today->modify('-' . ((int)$today->format('N') - 1) . ' days');
            $from = $currentMonday->modify('-11 weeks');
            $to = $currentMonday->modify('+6 days');
        } else {
            $monthStart = $today->modify('first day of this month');
            $from = $monthStart->modify('-11 months');
            $to = $monthStart->modify('last day of this month');
        }
    } else {
        $from = sales_parse_date($fromText, 'from');
        $to = sales_parse_date($toText, 'to');
        if ($from > $to) {
            respond(['ok' => false, 'message' => 'from must be on or before to.'], 422);
        }
    }

    // Normalize the user-selected dates to complete store-local report periods.
    if ($period === 'daily') {
        $rangeStart = $from->setTime(0, 0, 0);
        $endExclusive = $to->setTime(0, 0, 0)->modify('+1 day');
        $bucketCount = $rangeStart->diff($endExclusive)->days;
        $maximum = 366;
        $step = 'day';
    } elseif ($period === 'weekly') {
        $rangeStart = $from->modify('-' . ((int)$from->format('N') - 1) . ' days')->setTime(0, 0, 0);
        $toMonday = $to->modify('-' . ((int)$to->format('N') - 1) . ' days')->setTime(0, 0, 0);
        $endExclusive = $toMonday->modify('+1 week');
        $bucketCount = (int)($rangeStart->diff($endExclusive)->days / 7);
        $maximum = 104;
        $step = 'week';
    } else {
        $rangeStart = $from->modify('first day of this month')->setTime(0, 0, 0);
        $toMonth = $to->modify('first day of this month')->setTime(0, 0, 0);
        $endExclusive = $toMonth->modify('+1 month');
        $bucketCount = (((int)$endExclusive->format('Y') - (int)$rangeStart->format('Y')) * 12)
            + ((int)$endExclusive->format('n') - (int)$rangeStart->format('n'));
        $maximum = 60;
        $step = 'month';
    }

    if ($bucketCount < 1 || $bucketCount > $maximum) {
        respond(['ok' => false, 'message' => 'The selected range exceeds the maximum of ' . $maximum . ' ' . ($period === 'daily' ? 'days.' : ($period === 'weekly' ? 'weeks.' : 'months.'))], 422);
    }

    $previousStart = $rangeStart->modify('-' . $bucketCount . ' ' . ($period === 'daily' ? 'days' : ($period === 'weekly' ? 'weeks' : 'months')));
    $previousEndExclusive = $rangeStart;

    $orderRows = sales_fetch_grouped_orders($pdo, $period, $rangeStart, $endExclusive, $basis);
    $itemRows = sales_fetch_grouped_items($pdo, $period, $rangeStart, $endExclusive, $basis);
    $orderMap = [];
    foreach ($orderRows as $row) {
        $orderMap[(string)$row['period_start']] = $row;
    }
    $itemMap = [];
    foreach ($itemRows as $row) {
        $itemMap[(string)$row['period_start']] = (int)$row['items_sold'];
    }

    $rows = [];
    for ($cursor = $rangeStart; $cursor < $endExclusive; $cursor = $period === 'daily'
        ? $cursor->modify('+1 day')
        : ($period === 'weekly' ? $cursor->modify('+1 week') : $cursor->modify('+1 month'))) {
        $key = $cursor->format('Y-m-d');
        $orderRow = $orderMap[$key] ?? [];
        $end = sales_bucket_end($period, $cursor);
        $rows[] = [
            'period_start' => $key,
            'period_end' => $end->format('Y-m-d'),
            'label' => sales_period_label($period, $cursor, $end),
            'orders' => (int)($orderRow['sale_orders'] ?? 0),
            'items_sold' => (int)($itemMap[$key] ?? 0),
            'gross_sales' => round((float)($orderRow['gross_sales'] ?? 0), 2),
            'average_order_value' => round((float)($orderRow['average_order_value'] ?? 0), 2),
            'cancelled_orders' => (int)($orderRow['cancelled_orders'] ?? 0),
            'cancelled_amount' => round((float)($orderRow['cancelled_amount'] ?? 0), 2),
            'rejected_payments' => (int)($orderRow['rejected_payments'] ?? 0),
            'rejected_amount' => round((float)($orderRow['rejected_amount'] ?? 0), 2)
        ];
    }

    $totals = sales_fetch_totals($pdo, $rangeStart, $endExclusive, $basis);
    $previousTotals = sales_fetch_totals($pdo, $previousStart, $previousEndExclusive, $basis);
    $topProducts = sales_fetch_top_products($pdo, $rangeStart, $endExclusive, $basis);
    $previousEnd = $previousEndExclusive->modify('-1 day');

    respond([
        'ok' => true,
        'timezone' => SEVEN_STORE_TZ,
        'period' => $period,
        'basis' => $basis,
        'range' => [
            'from' => $rangeStart->format('Y-m-d'),
            'to' => $endExclusive->modify('-1 day')->format('Y-m-d')
        ],
        'previous_range' => [
            'from' => $previousStart->format('Y-m-d'),
            'to' => $previousEnd->format('Y-m-d')
        ],
        'rows' => $rows,
        'totals' => $totals,
        'previous_totals' => $previousTotals,
        'changes' => sales_build_changes($totals, $previousTotals),
        'top_products' => $topProducts,
        'generated_at' => (new DateTimeImmutable('now', $timezone))->format(DateTimeInterface::ATOM)
    ]);
} catch (Throwable $e) {
    error_log('[SEVEN sales] ' . $e->getMessage());
    respond(['ok' => false, 'message' => 'Unable to load sales report.'], 500);
}
