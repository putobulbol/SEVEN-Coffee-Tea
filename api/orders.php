<?php
declare(strict_types=1);
require __DIR__ . '/config.php';

function product_id_from_value($value): int {
    if (is_int($value)) return $value;
    $text = (string)$value;
    if (preg_match('/(\d+)/', $text, $m)) return (int)$m[1];
    return 0;
}

function large_size_surcharge(string $category): float {
    return $category === 'Hot Beverages' ? 0.0 : 10.0;
}

function customization_extra(array $c): float {
    $extra = 0.0;
    if (($c['milk'] ?? 'None') === 'Oat Milk') $extra += 20.0;
    if (($c['drizzle'] ?? 'None') !== 'None') $extra += 8.0;
    if (($c['syrup'] ?? 'None') !== 'None') $extra += 10.0;
    if (in_array(($c['sinker'] ?? 'None'), ['Pearls','Nata','Crushed Oreo'], true)) $extra += 10.0;
    if (($c['sinker'] ?? 'None') === 'Coffee Jelly') $extra += 15.0;
    if (($c['topping'] ?? 'None') !== 'None') $extra += 15.0;
    if (($c['coffeeAddon'] ?? 'None') === 'Espresso Shot') $extra += 15.0;
    return $extra;
}

function item_price(array $product, array $customizations): float {
    $price = (float)$product['price'];
    if (($customizations['size'] ?? 'Medium') === 'Large') {
        $price += large_size_surcharge((string)$product['category']);
    }
    return $price + customization_extra($customizations);
}

function attach_latest_rejection_reason(PDO $pdo, array &$order): void {
    $stmt = $pdo->prepare("SELECT remarks FROM payment_logs WHERE order_id=? AND action='payment_rejected' ORDER BY id DESC LIMIT 1");
    $stmt->execute([(int)$order['id']]);
    $remarks = $stmt->fetchColumn();
    if ($remarks !== false) {
        $parts = explode(' | Reason: ', (string)$remarks, 2);
        $order['payment_rejection_reason'] = count($parts) === 2 ? trim($parts[1]) : trim((string)$remarks);
    }
}

/**
 * Admin bell event (database/admin_notifications.sql). Never allowed to break a customer's order:
 * any failure (including the table not existing yet) is logged and ignored.
 */
function add_admin_notification(PDO $pdo, ?int $orderId, string $type, string $title, string $message): void {
    try {
        $stmt = $pdo->prepare('INSERT INTO admin_notifications (order_id,type,title,message) VALUES (?,?,?,?)');
        $stmt->execute([$orderId, $type, mb_substr($title, 0, 160), mb_substr($message, 0, 500)]);
    } catch (Throwable $e) {
        error_log('Admin notification not saved (' . $type . '): ' . $e->getMessage());
    }
}

function add_customer_notification(PDO $pdo, int $userId, ?int $orderId, string $type, string $title, string $message): void {
    if ($userId <= 0) return;
    try {
        $stmt = $pdo->prepare('INSERT INTO customer_notifications (user_id,order_id,type,title,message) VALUES (?,?,?,?,?)');
        $stmt->execute([$userId, $orderId, $type, $title, $message]);
    } catch (PDOException $e) {
        // Preserve ordering if an existing local database has not run the notification migration yet.
        if ($e->getCode() === '42S02') return;
        throw $e;
    }
}

try {
    $pdo = db();
    $method = $_SERVER['REQUEST_METHOD'];

    if ($method === 'POST') {
        $customerUserId = !empty($_SESSION['customer_user_id']) ? (int)$_SESSION['customer_user_id'] : 0;
        if ($customerUserId <= 0) {
            respond(['ok'=>false,'message'=>'Please log in to your customer account before placing an order.'],401);
        }
        $verifiedStmt = $pdo->prepare("SELECT email_verified_at FROM users WHERE id=? AND role='customer' LIMIT 1");
        $verifiedStmt->execute([$customerUserId]);
        $emailVerifiedAt = $verifiedStmt->fetchColumn();
        if ($emailVerifiedAt === false || $emailVerifiedAt === null) {
            respond(['ok'=>false,'message'=>'Verify your email before placing an order.'],403);
        }

        if (isset($_POST['action']) && $_POST['action'] === 'resubmit_payment') {
            $orderCode = strtoupper(trim((string)($_POST['order_code'] ?? '')));
            $paymentRef = trim((string)($_POST['payment_reference'] ?? ''));
            if ($orderCode === '') respond(['ok'=>false,'message'=>'Order code is required.'],422);
            if ($paymentRef === '') respond(['ok'=>false,'message'=>'GCash reference number is required.'],422);
            if (!preg_match('/^\d{13}$/', $paymentRef)) respond(['ok'=>false,'message'=>'GCash reference number must be exactly 13 digits.'],422);
            if (!isset($_FILES['payment_screenshot']) || $_FILES['payment_screenshot']['error'] !== UPLOAD_ERR_OK) {
                respond(['ok'=>false,'message'=>'GCash payment screenshot is required.'],422);
            }

            $findRejected = $pdo->prepare('SELECT id,payment_status,customer_name FROM orders WHERE order_code=? AND user_id=? LIMIT 1');
            $findRejected->execute([$orderCode,$customerUserId]);
            $existingOrder = $findRejected->fetch();
            if (!$existingOrder) respond(['ok'=>false,'message'=>'Order not found for this account.'],404);
            if ((string)$existingOrder['payment_status'] !== 'rejected') {
                respond(['ok'=>false,'message'=>'This order is not awaiting payment resubmission.'],409);
            }

            if ($_FILES['payment_screenshot']['size'] > 5*1024*1024) respond(['ok'=>false,'message'=>'Payment screenshot must be 5 MB or smaller.'],422);
            $allowed = ['image/jpeg'=>'jpg','image/png'=>'png','image/webp'=>'webp'];
            $mime = mime_content_type($_FILES['payment_screenshot']['tmp_name']);
            if (!isset($allowed[$mime])) respond(['ok'=>false,'message'=>'Payment screenshot must be JPG, PNG, or WebP.'],422);

            $uploadDir = __DIR__.'/../uploads/payments';
            if (!is_dir($uploadDir) && !mkdir($uploadDir,0755,true) && !is_dir($uploadDir)) {
                respond(['ok'=>false,'message'=>'Unable to create payment upload directory.'],500);
            }

            $filename = $orderCode.'-resubmitted-'.bin2hex(random_bytes(3)).'.'.$allowed[$mime];
            $destination = $uploadDir.'/'.$filename;
            if (!move_uploaded_file($_FILES['payment_screenshot']['tmp_name'],$destination)) {
                respond(['ok'=>false,'message'=>'Unable to save payment screenshot.'],500);
            }

            $screenshotPath = 'uploads/payments/'.$filename;
            $update = $pdo->prepare('UPDATE orders SET payment_reference=?,payment_screenshot=?,payment_status=? WHERE id=? AND user_id=?');
            $update->execute([$paymentRef,$screenshotPath,'submitted',(int)$existingOrder['id'],$customerUserId]);

            $log = $pdo->prepare('INSERT INTO payment_logs (order_id,action,remarks) VALUES (?, ?, ?)');
            $log->execute([(int)$existingOrder['id'],'payment_resubmitted','Updated GCash proof after payment rejection.']);
            add_customer_notification($pdo, $customerUserId, (int)$existingOrder['id'], 'payment_resubmitted', 'Payment proof resubmitted', 'Your updated GCash payment proof was received and is awaiting review.');
            add_admin_notification($pdo, (int)$existingOrder['id'], 'payment_resubmitted', 'Payment resubmitted · Order #'.(int)$existingOrder['id'], (string)($existingOrder['customer_name'] ?? 'A customer').' sent a new GCash proof after a rejection. Review needed.');

            respond(['ok'=>true,'message'=>'Payment proof resubmitted successfully.','order_code'=>$orderCode,'payment_status'=>'submitted']);
        }

        $isMultipart = isset($_POST['customer_name']);
        $input = $isMultipart ? $_POST : json_input();
        $items = isset($input['items']) ? (is_string($input['items']) ? json_decode($input['items'], true) : $input['items']) : [];
        if (!is_array($items) || count($items) === 0) respond(['ok'=>false,'message'=>'Cart is empty.'],422);

        $name = trim((string)($input['customer_name'] ?? ''));
        $contact = trim((string)($input['contact_number'] ?? ''));
        $pickup = 'As soon as ready'; // Always use the fixed pickup option.
        $notes = trim((string)($input['notes'] ?? ''));
        $paymentMethod = 'gcash';
        $paymentRef = trim((string)($input['payment_reference'] ?? ''));
        // Customer checkout details are required and must be supplied by the signed-in
        // customer (auto-filled from the account or edited before placing the order).
        if ($name === '' || mb_strlen($name) > 120) {
            respond(['ok'=>false,'message'=>'Enter a customer name (up to 120 characters).'],422);
        }
        if (!preg_match('/^[0-9+().\\s-]{7,40}$/', $contact)) {
            respond(['ok'=>false,'message'=>'Enter a valid contact number (7–40 characters).'],422);
        }
        // GCash is the only supported customer payment method.
        if ($paymentRef === '') respond(['ok'=>false,'message'=>'GCash reference number is required.'],422);
        if (!preg_match('/^\d{13}$/', $paymentRef)) respond(['ok'=>false,'message'=>'GCash reference number must be exactly 13 digits.'],422);
        if (!isset($_FILES['payment_screenshot']) || $_FILES['payment_screenshot']['error'] === UPLOAD_ERR_NO_FILE) {
            respond(['ok'=>false,'message'=>'GCash payment screenshot is required.'],422);
        }

        $pdo->beginTransaction();
        $total = 0.0;
        $normalizedItems = [];
        $findProduct = $pdo->prepare("SELECT id,name,category,price FROM products WHERE id=? AND status='active'");

        foreach ($items as $item) {
            $productId = product_id_from_value($item['id'] ?? 0);
            $quantity = (int)($item['qty'] ?? $item['quantity'] ?? 0);
            if ($productId <= 0 || $quantity <= 0) continue;
            $findProduct->execute([$productId]);
            $product = $findProduct->fetch();
            if (!$product) continue;

            $customizations = $item['customizations'] ?? $item;
            if (is_array($customizations)) {
                $customizations = json_decode(json_encode($customizations, JSON_UNESCAPED_UNICODE), true) ?: [];
            } else {
                $customizations = [];
            }

            $unitPrice = item_price($product, $customizations);
            $subtotal = $unitPrice * $quantity;
            $total += $subtotal;
            $customizationJson = json_encode([
                'temperature' => $customizations['temperature'] ?? null,
                'size' => $customizations['size'] ?? 'Medium',
                'sweetness' => $customizations['sweetness'] ?? 'N/A',
                'milk' => $customizations['milk'] ?? 'None',
                'drizzle' => $customizations['drizzle'] ?? 'None',
                'syrup' => $customizations['syrup'] ?? 'None',
                'sinker' => $customizations['sinker'] ?? 'None',
                'topping' => $customizations['topping'] ?? 'None',
                'coffeeAddon' => $customizations['coffeeAddon'] ?? 'None'
            ], JSON_UNESCAPED_UNICODE);

            $normalizedItems[] = [
                'product_id' => (int)$product['id'],
                'product_name' => $product['name'],
                'unit_price' => $unitPrice,
                'quantity' => $quantity,
                'subtotal' => $subtotal,
                'customizations' => $customizationJson
            ];
        }

        if (!$normalizedItems) {
            $pdo->rollBack();
            respond(['ok'=>false,'message'=>'No valid products were found.'],422);
        }

        $orderCode = '7C-'.strtoupper(substr(bin2hex(random_bytes(4)),0,8));
        $paymentStatus = 'submitted';
        $screenshotPath = null;
        if ($_FILES['payment_screenshot']['error'] !== UPLOAD_ERR_NO_FILE) {
            if ($_FILES['payment_screenshot']['error'] !== UPLOAD_ERR_OK) throw new RuntimeException('Payment screenshot upload failed.');
            if ($_FILES['payment_screenshot']['size'] > 5*1024*1024) throw new RuntimeException('Payment screenshot must be 5 MB or smaller.');
            $allowed = ['image/jpeg'=>'jpg','image/png'=>'png','image/webp'=>'webp'];
            $mime = mime_content_type($_FILES['payment_screenshot']['tmp_name']);
            if (!isset($allowed[$mime])) throw new RuntimeException('Payment screenshot must be JPG, PNG, or WebP.');
            $uploadDir = __DIR__.'/../uploads/payments';
            if (!is_dir($uploadDir) && !mkdir($uploadDir,0755,true) && !is_dir($uploadDir)) throw new RuntimeException('Unable to create payment upload directory.');
            $filename = $orderCode.'-'.bin2hex(random_bytes(3)).'.'.$allowed[$mime];
            $destination = $uploadDir.'/'.$filename;
            if (!move_uploaded_file($_FILES['payment_screenshot']['tmp_name'],$destination)) throw new RuntimeException('Unable to save payment screenshot.');
            $screenshotPath = 'uploads/payments/'.$filename;
        }

        $insertOrder = $pdo->prepare('INSERT INTO orders (order_code,user_id,customer_name,contact_number,pickup_time,notes,payment_method,payment_status,order_status,payment_reference,payment_screenshot,total_amount) VALUES (?, ?, ?, ?, ?, ?, ?, ?, \'pending\', ?, ?, ?)');
        $insertOrder->execute([$orderCode,$customerUserId,$name,$contact,$pickup,$notes?:null,$paymentMethod,$paymentStatus,$paymentRef?:null,$screenshotPath,$total]);
        $orderId = (int)$pdo->lastInsertId();

        $insertItem = $pdo->prepare('INSERT INTO order_items (order_id,product_id,product_name,unit_price,quantity,subtotal,customizations) VALUES (?, ?, ?, ?, ?, ?, ?)');
        foreach ($normalizedItems as $item) {
            $insertItem->execute([$orderId,$item['product_id'],$item['product_name'],$item['unit_price'],$item['quantity'],$item['subtotal'],$item['customizations']]);
        }

        $log = $pdo->prepare('INSERT INTO payment_logs (order_id,action,remarks) VALUES (?, ?, ?)');
        $log->execute([$orderId,'order_created','GCash proof submitted.']);
        add_customer_notification($pdo, $customerUserId, $orderId, 'order_submitted', 'Order submitted', 'Your order has been submitted and is waiting for GCash payment verification.');
        $pdo->commit();
        // After commit: the admin alert can only ever follow a saved order, never undo one.
        add_admin_notification($pdo, $orderId, 'new_order', 'New order #'.$orderId, $name.' · ₱'.number_format((float)$total, 2).' · GCash proof submitted, ready for payment review.');

        respond(['ok'=>true,'message'=>'Order created successfully.','order'=>['id'=>$orderId,'order_code'=>$orderCode,'payment_status'=>$paymentStatus,'order_status'=>'pending','pickup_time'=>$pickup,'total_amount'=>$total]],201);
    }

    if ($method === 'GET') {
        $orderCode = strtoupper(trim((string)($_GET['order'] ?? '')));
        if ($orderCode !== '') {
            $customerUserId = !empty($_SESSION['customer_user_id']) ? (int)$_SESSION['customer_user_id'] : 0;
            if ($customerUserId <= 0) respond(['ok'=>false,'message'=>'Please log in to track your order.'],401);
            $stmt=$pdo->prepare('SELECT id,order_code,customer_name,pickup_time,payment_method,payment_status,order_status,total_amount,created_at,updated_at FROM orders WHERE order_code=? AND user_id=? LIMIT 1');
            $stmt->execute([$orderCode,$customerUserId]);$order=$stmt->fetch();
            if(!$order)respond(['ok'=>false,'message'=>'Order not found for this account.'],404);
            $itemsStmt=$pdo->prepare('SELECT product_name,quantity,unit_price,subtotal,customizations FROM order_items WHERE order_id=? ORDER BY id');$itemsStmt->execute([(int)$order['id']]);$order['items']=$itemsStmt->fetchAll();attach_latest_rejection_reason($pdo,$order);
            respond(['ok'=>true,'order'=>$order]);
        }
        if (isset($_GET['admin_history_export'])) {
            require_admin();

            foreach (['q', 'status', 'from', 'to'] as $filterKey) {
                if (isset($_GET[$filterKey]) && !is_scalar($_GET[$filterKey])) {
                    respond(['ok'=>false,'message'=>'Invalid order history export filter.'],422);
                }
            }

            $q=substr(trim((string)($_GET['q']??'')),0,120);
            $status=(string)($_GET['status']??'all');
            if(!in_array($status,['all','completed','cancelled','payment_rejected','counted_as_sales'],true)) {
                respond(['ok'=>false,'message'=>'Invalid order status filter.'],422);
            }

            $from=(string)($_GET['from']??'');
            $to=(string)($_GET['to']??'');
            $validDate=static function(string $value):bool {
                if($value==='')return true;
                $date=DateTimeImmutable::createFromFormat('!Y-m-d',$value,new DateTimeZone(SEVEN_STORE_TZ));
                $errors=DateTimeImmutable::getLastErrors();
                return $date!==false
                    && ($errors===false||($errors['warning_count']===0&&$errors['error_count']===0))
                    && $date->format('Y-m-d')===$value;
            };
            if(!$validDate($from)||!$validDate($to))respond(['ok'=>false,'message'=>'Dates must use YYYY-MM-DD format.'],422);
            if($from!==''&&$to!==''&&$from>$to)respond(['ok'=>false,'message'=>'The From date must be on or before the To date.'],422);

            $conds=["(o.order_status IN ('completed','cancelled') OR o.payment_status='rejected')"];
            $params=[];
            if($q!==''){
                $conds[]="(o.order_code LIKE ? OR CAST(o.id AS CHAR) LIKE ? OR o.customer_name LIKE ? OR o.contact_number LIKE ?)";
                $like='%'.$q.'%';
                array_push($params,$like,$like,$like,$like);
            }
            if($status==='completed')$conds[]="o.order_status='completed'";
            if($status==='cancelled')$conds[]="o.order_status='cancelled'";
            if($status==='payment_rejected')$conds[]="o.payment_status='rejected'";
             if($status==='counted_as_sales')$conds[]=seven_sales_condition('paid','o');
            if($from!==''){$conds[]='o.created_at >= ?';$params[]=$from.' 00:00:00';}
            if($to!==''){$conds[]='o.created_at < DATE_ADD(?, INTERVAL 1 DAY)';$params[]=$to.' 00:00:00';}
            $where=implode(' AND ',$conds);

            $count=$pdo->prepare("SELECT COUNT(*) FROM orders o WHERE $where");
            $count->execute($params);
            $total=(int)$count->fetchColumn();

            // The API never returns more than 5,000 matching orders for a CSV export.
            $stmt=$pdo->prepare("
                SELECT o.id,o.order_code,o.customer_name,o.contact_number,o.payment_method,
                       o.payment_status,o.order_status,o.total_amount,o.created_at,o.updated_at
                FROM orders o
                WHERE $where
                ORDER BY o.created_at DESC,o.id DESC
                LIMIT 5000
            ");
            $stmt->execute($params);
            $orders=$stmt->fetchAll();

            if($orders){
                $ids=array_map(static fn($order)=>(int)$order['id'],$orders);
                $marks=implode(',',array_fill(0,count($ids),'?'));
                $itemsStmt=$pdo->prepare("SELECT order_id,product_name,quantity FROM order_items WHERE order_id IN ($marks) ORDER BY order_id,id");
                $itemsStmt->execute($ids);
                $items=[];
                foreach($itemsStmt->fetchAll() as $item){
                    $orderId=(int)$item['order_id'];
                    $items[$orderId][]=[
                        'product_name'=>(string)$item['product_name'],
                        'quantity'=>(int)$item['quantity']
                    ];
                }
                foreach($orders as &$order){
                    $order['id']=(int)$order['id'];
                    $order['total_amount']=(float)$order['total_amount'];
                    $order['items']=$items[(int)$order['id']]??[];
                }
                unset($order);
            }

            respond([
                'ok'=>true,
                'orders'=>$orders,
                'total'=>$total,
                'export_limit'=>5000,
                'truncated'=>$total>5000,
                'filters'=>['q'=>$q,'status'=>$status,'from'=>$from,'to'=>$to]
            ]);
        }

        if (isset($_GET['admin_history_detail'])) {
            require_admin();
            $orderId=filter_var($_GET['admin_history_detail'],FILTER_VALIDATE_INT);
            if($orderId===false||$orderId<=0)respond(['ok'=>false,'message'=>'A valid order ID is required.'],422);
            $stmt=$pdo->prepare('SELECT id,order_code,customer_name,contact_number,pickup_time,notes,payment_method,payment_status,order_status,payment_reference,payment_screenshot,total_amount,created_at,updated_at FROM orders WHERE id=? LIMIT 1');$stmt->execute([(int)$orderId]);$order=$stmt->fetch();
            if(!$order)respond(['ok'=>false,'message'=>'Order not found.'],404);
            $itemsStmt=$pdo->prepare('SELECT product_name,quantity,unit_price,subtotal,customizations FROM order_items WHERE order_id=? ORDER BY id');$itemsStmt->execute([(int)$orderId]);$order['items']=$itemsStmt->fetchAll();
            $logsStmt=$pdo->prepare('SELECT action,remarks,created_at FROM payment_logs WHERE order_id=? ORDER BY id DESC');$logsStmt->execute([(int)$orderId]);$logs=$logsStmt->fetchAll();$order['rejection_reason']='';
            foreach($logs as $log){if((string)$log['action']==='payment_rejected'){$parts=explode(' | Reason: ',(string)($log['remarks']??''),2);$order['rejection_reason']=count($parts)===2?trim($parts[1]):trim((string)($log['remarks']??''));break;}}
            respond(['ok'=>true,'order'=>$order,'payment_logs'=>$logs]);
        }
        if (isset($_GET['admin_history'])) {
            require_admin();
            $pv=filter_var($_GET['page']??'1',FILTER_VALIDATE_INT);$lv=filter_var($_GET['limit']??'20',FILTER_VALIDATE_INT);
            if($pv===false||$pv<1||$pv>1000000)respond(['ok'=>false,'message'=>'Page must be a positive integer.'],422);if($lv===false||$lv<1)respond(['ok'=>false,'message'=>'Limit must be a positive integer.'],422);
            foreach(['q','status','from','to'] as $filterKey){if(isset($_GET[$filterKey])&&!is_scalar($_GET[$filterKey]))respond(['ok'=>false,'message'=>'Invalid order history filter.'],422);}
            $page=(int)$pv;$limit=min(50,(int)$lv);$offset=($page-1)*$limit;$q=substr(trim((string)($_GET['q']??'')),0,120);$status=(string)($_GET['status']??'all');
            if(!in_array($status,['all','completed','cancelled','payment_rejected','counted_as_sales'],true))respond(['ok'=>false,'message'=>'Invalid order status filter.'],422);
            $from=(string)($_GET['from']??'');$to=(string)($_GET['to']??'');$validDate=static function(string $v):bool{if($v==='')return true;$d=DateTimeImmutable::createFromFormat('!Y-m-d',$v,new DateTimeZone(SEVEN_STORE_TZ));$errors=DateTimeImmutable::getLastErrors();return $d!==false&&($errors===false||($errors['warning_count']===0&&$errors['error_count']===0))&&$d->format('Y-m-d')===$v;};
            if(!$validDate($from)||!$validDate($to))respond(['ok'=>false,'message'=>'Dates must use YYYY-MM-DD format.'],422);if($from!==''&&$to!==''&&$from>$to)respond(['ok'=>false,'message'=>'The From date must be on or before the To date.'],422);
            $conds=["(o.order_status IN ('completed','cancelled') OR o.payment_status='rejected')"];$params=[];
            if($q!==''){$conds[]="(o.order_code LIKE ? OR CAST(o.id AS CHAR) LIKE ? OR o.customer_name LIKE ? OR o.contact_number LIKE ?)";$like='%'.$q.'%';array_push($params,$like,$like,$like,$like);}
            if($status==='completed')$conds[]="o.order_status='completed'";if($status==='cancelled')$conds[]="o.order_status='cancelled'";if($status==='payment_rejected')$conds[]="o.payment_status='rejected'";if($status==='counted_as_sales')$conds[]=seven_sales_condition('paid','o');
            if($from!==''){$conds[]='o.created_at >= ?';$params[]=$from.' 00:00:00';}if($to!==''){$conds[]='o.created_at < DATE_ADD(?, INTERVAL 1 DAY)';$params[]=$to.' 00:00:00';}$where=implode(' AND ',$conds);
            $count=$pdo->prepare("SELECT COUNT(*) FROM orders o WHERE $where");$count->execute($params);$total=(int)$count->fetchColumn();$pages=$total?(int)ceil($total/$limit):0;
            $stmt=$pdo->prepare("SELECT o.id,o.order_code,o.customer_name,o.contact_number,o.pickup_time,o.notes,o.payment_method,o.payment_status,o.order_status,o.payment_reference,o.payment_screenshot,o.total_amount,o.created_at,o.updated_at FROM orders o WHERE $where ORDER BY o.created_at DESC,o.id DESC LIMIT ? OFFSET ?");
            foreach($params as $i=>$v)$stmt->bindValue($i+1,$v,PDO::PARAM_STR);$stmt->bindValue(count($params)+1,$limit,PDO::PARAM_INT);$stmt->bindValue(count($params)+2,$offset,PDO::PARAM_INT);$stmt->execute();$orders=$stmt->fetchAll();
            if($orders){$ids=array_map(static fn($o)=>(int)$o['id'],$orders);$marks=implode(',',array_fill(0,count($ids),'?'));$itemStmt=$pdo->prepare("SELECT order_id,product_name,quantity,unit_price,subtotal,customizations FROM order_items WHERE order_id IN ($marks) ORDER BY order_id,id");$itemStmt->execute($ids);$items=[];foreach($itemStmt->fetchAll() as $it){$id=(int)$it['order_id'];$items[$id][]=['product_name'=>$it['product_name'],'quantity'=>(int)$it['quantity'],'unit_price'=>(float)$it['unit_price'],'subtotal'=>(float)$it['subtotal'],'customizations'=>$it['customizations']];}foreach($orders as &$o)$o['items']=$items[(int)$o['id']]??[];unset($o);}
            $salesCondition=seven_sales_condition('paid','o');$sum=$pdo->prepare("SELECT COUNT(*) AS count,COALESCE(SUM(CASE WHEN $salesCondition THEN o.total_amount ELSE 0 END),0) AS sales FROM orders o WHERE $where");$sum->execute($params);$summary=$sum->fetch()?:['count'=>$total,'sales'=>0];
            $storeNow=new DateTimeImmutable('now',new DateTimeZone(SEVEN_STORE_TZ));$storeWeekStart=$storeNow->modify('-'.((int)$storeNow->format('N')-1).' days')->format('Y-m-d');
             respond(['ok'=>true,'orders'=>$orders,'total'=>$total,'page'=>$page,'pages'=>$pages,'summary'=>['count'=>(int)$summary['count'],'sales'=>(float)$summary['sales']],'timezone'=>SEVEN_STORE_TZ,'store_today'=>$storeNow->format('Y-m-d'),'store_week_start'=>$storeWeekStart]);
        }

        if(isset($_GET['admin_refresh'])){
            require_admin();
            $stmt=$pdo->query("SELECT id,order_code,customer_name,contact_number,pickup_time,notes,payment_method,payment_status,order_status,payment_reference,payment_screenshot,total_amount,created_at,updated_at FROM orders WHERE order_status IN ('pending','confirmed','in_preparation','ready') OR payment_status='rejected' ORDER BY created_at DESC");$orders=$stmt->fetchAll();
            if($orders){
                $orderIds=array_map(static fn($order)=>(int)$order['id'],$orders);$placeholders=implode(',',array_fill(0,count($orderIds),'?'));
                $itemsStmt=$pdo->prepare("SELECT order_id,product_name,unit_price,quantity,subtotal,customizations FROM order_items WHERE order_id IN ($placeholders) ORDER BY order_id,id");$itemsStmt->execute($orderIds);$itemsByOrder=[];
                foreach($itemsStmt->fetchAll() as $item){$orderId=(int)$item['order_id'];$itemsByOrder[$orderId][]=['product_name'=>$item['product_name'],'unit_price'=>(float)$item['unit_price'],'quantity'=>(int)$item['quantity'],'subtotal'=>(float)$item['subtotal'],'customizations'=>$item['customizations']];}
                foreach($orders as &$order)$order['items']=$itemsByOrder[(int)$order['id']]??[];unset($order);
            }
            respond(['ok'=>true,'orders'=>$orders]);
        }
        $customerUserId=!empty($_SESSION['customer_user_id'])?(int)$_SESSION['customer_user_id']:0;
        if($customerUserId<=0)respond(['ok'=>false,'message'=>'Please log in to track your orders.'],401);
        if(isset($_GET['history'])){
            $rawPage=$_GET['page']??'1';$rawLimit=$_GET['limit']??'10';
            if(!is_scalar($rawPage)||!is_scalar($rawLimit))respond(['ok'=>false,'message'=>'Page and limit must be positive integers.'],422);
            $pageValue=filter_var((string)$rawPage,FILTER_VALIDATE_INT);$limitValue=filter_var((string)$rawLimit,FILTER_VALIDATE_INT);
            if($pageValue===false||$pageValue<1||$pageValue>1000000)respond(['ok'=>false,'message'=>'Page must be a valid positive integer.'],422);
            if($limitValue===false||$limitValue<1)respond(['ok'=>false,'message'=>'Limit must be a positive integer.'],422);
            $page=(int)$pageValue;$limit=min(10,(int)$limitValue);$offset=($page-1)*$limit;
            $historyCondition="(order_status IN ('completed','cancelled') OR payment_status='rejected')";
            $countStmt=$pdo->prepare("SELECT COUNT(*) FROM orders WHERE user_id=? AND $historyCondition");$countStmt->execute([$customerUserId]);$total=(int)$countStmt->fetchColumn();$pages=$total>0?(int)ceil($total/$limit):0;
            $ordersStmt=$pdo->prepare("SELECT id,order_code,customer_name,pickup_time,payment_method,payment_status,order_status,total_amount,created_at,updated_at FROM orders WHERE user_id=? AND $historyCondition ORDER BY created_at DESC,id DESC LIMIT ? OFFSET ?");
            $ordersStmt->bindValue(1,$customerUserId,PDO::PARAM_INT);$ordersStmt->bindValue(2,$limit,PDO::PARAM_INT);$ordersStmt->bindValue(3,$offset,PDO::PARAM_INT);$ordersStmt->execute();$orders=$ordersStmt->fetchAll();
            if($orders){
                $orderIds=array_map(static fn($order)=>(int)$order['id'],$orders);$placeholders=implode(',',array_fill(0,count($orderIds),'?'));
                $itemsStmt=$pdo->prepare("SELECT order_id,product_name,quantity,unit_price,subtotal,customizations FROM order_items WHERE order_id IN ($placeholders) ORDER BY order_id,id");$itemsStmt->execute($orderIds);$itemsByOrder=[];
                foreach($itemsStmt->fetchAll() as $item){$orderId=(int)$item['order_id'];$itemsByOrder[$orderId][]=['product_name'=>$item['product_name'],'quantity'=>(int)$item['quantity'],'unit_price'=>(float)$item['unit_price'],'subtotal'=>(float)$item['subtotal'],'customizations'=>$item['customizations']];}
                foreach($orders as &$listedOrder)$listedOrder['items']=$itemsByOrder[(int)$listedOrder['id']]??[];unset($listedOrder);
                $rejectedOrderIds=[];foreach($orders as $listedOrder)if((string)($listedOrder['payment_status']??'')==='rejected')$rejectedOrderIds[]=(int)$listedOrder['id'];
                if($rejectedOrderIds){
                    $logPlaceholders=implode(',',array_fill(0,count($rejectedOrderIds),'?'));$logsStmt=$pdo->prepare("SELECT order_id,remarks FROM payment_logs WHERE action='payment_rejected' AND order_id IN ($logPlaceholders) ORDER BY id DESC");$logsStmt->execute($rejectedOrderIds);$reasons=[];
                    foreach($logsStmt->fetchAll() as $log){$logOrderId=(int)$log['order_id'];if(array_key_exists($logOrderId,$reasons))continue;$remarks=(string)($log['remarks']??'');$parts=explode(' | Reason: ',$remarks,2);$reasons[$logOrderId]=count($parts)===2?trim($parts[1]):trim($remarks);}
                    foreach($orders as &$listedOrder)$listedOrder['payment_rejection_reason']=$reasons[(int)$listedOrder['id']]??'';unset($listedOrder);
                }
            }
            respond(['ok'=>true,'orders'=>$orders,'total'=>$total,'page'=>$page,'limit'=>$limit,'pages'=>$pages]);
        }
        // Customer "My Orders" page: every order for this account, filterable, 10 per page.
        // The five statuses partition all orders (a cancelled order with a rejected payment counts as cancelled).
        if(isset($_GET['all_orders'])){
            $statusFilters=[
                'all'=>'1=1',
                'active'=>"order_status IN ('pending','confirmed','in_preparation','ready') AND payment_status<>'rejected'",
                'completed'=>"order_status='completed'",
                'cancelled'=>"order_status='cancelled'",
                'rejected'=>"payment_status='rejected' AND order_status<>'cancelled'",
            ];
            $rawStatus=$_GET['status']??'all';$rawPage=$_GET['page']??'1';$rawLimit=$_GET['limit']??'10';
            if(!is_scalar($rawStatus)||!is_scalar($rawPage)||!is_scalar($rawLimit))respond(['ok'=>false,'message'=>'Invalid order filters.'],422);
            $status=strtolower(trim((string)$rawStatus));
            if(!array_key_exists($status,$statusFilters))respond(['ok'=>false,'message'=>'Status must be all, active, completed, cancelled, or rejected.'],422);
            $pageValue=filter_var((string)$rawPage,FILTER_VALIDATE_INT);$limitValue=filter_var((string)$rawLimit,FILTER_VALIDATE_INT);
            if($pageValue===false||$pageValue<1||$pageValue>1000000)respond(['ok'=>false,'message'=>'Page must be a valid positive integer.'],422);
            if($limitValue===false||$limitValue<1)respond(['ok'=>false,'message'=>'Limit must be a positive integer.'],422);
            $page=(int)$pageValue;$limit=min(10,(int)$limitValue);$offset=($page-1)*$limit;
            $condition=$statusFilters[$status]; // fixed SQL fragments from the whitelist above, never user text

            $countSql='SELECT COUNT(*) AS total_all';
            foreach($statusFilters as $key=>$fragment)if($key!=='all')$countSql.=",COALESCE(SUM(CASE WHEN $fragment THEN 1 ELSE 0 END),0) AS total_$key";
            $countStmt=$pdo->prepare($countSql.' FROM orders WHERE user_id=?');$countStmt->execute([$customerUserId]);$countRow=$countStmt->fetch()?:[];
            $counts=[];foreach(array_keys($statusFilters) as $key)$counts[$key]=(int)($countRow['total_'.$key]??0);
            $total=$counts[$status];$pages=$total>0?(int)ceil($total/$limit):0;

            $ordersStmt=$pdo->prepare("SELECT id,order_code,customer_name,pickup_time,payment_method,payment_status,order_status,payment_reference,total_amount,created_at,updated_at FROM orders WHERE user_id=? AND $condition ORDER BY created_at DESC,id DESC LIMIT ? OFFSET ?");
            $ordersStmt->bindValue(1,$customerUserId,PDO::PARAM_INT);$ordersStmt->bindValue(2,$limit,PDO::PARAM_INT);$ordersStmt->bindValue(3,$offset,PDO::PARAM_INT);$ordersStmt->execute();$orders=$ordersStmt->fetchAll();
            if($orders){
                $orderIds=array_map(static fn($order)=>(int)$order['id'],$orders);$placeholders=implode(',',array_fill(0,count($orderIds),'?'));
                $itemsStmt=$pdo->prepare("SELECT order_id,product_name,quantity,unit_price,subtotal,customizations FROM order_items WHERE order_id IN ($placeholders) ORDER BY order_id,id");$itemsStmt->execute($orderIds);$itemsByOrder=[];
                foreach($itemsStmt->fetchAll() as $item){$orderId=(int)$item['order_id'];$itemsByOrder[$orderId][]=['product_name'=>$item['product_name'],'quantity'=>(int)$item['quantity'],'unit_price'=>(float)$item['unit_price'],'subtotal'=>(float)$item['subtotal'],'customizations'=>$item['customizations']];}
                foreach($orders as &$listedOrder){$listedOrder['items']=$itemsByOrder[(int)$listedOrder['id']]??[];$listedOrder['payment_rejection_reason']='';if((string)($listedOrder['payment_status']??'')==='rejected')attach_latest_rejection_reason($pdo,$listedOrder);}unset($listedOrder);
            }
            respond(['ok'=>true,'orders'=>$orders,'status'=>$status,'counts'=>$counts,'total'=>$total,'page'=>$page,'limit'=>$limit,'pages'=>$pages]);
        }
        if(isset($_GET['customer_orders'])){
            $ordersStmt=$pdo->prepare('SELECT id,order_code,customer_name,pickup_time,payment_method,payment_status,order_status,total_amount,created_at,updated_at FROM orders WHERE user_id=? ORDER BY created_at DESC,id DESC');$ordersStmt->execute([$customerUserId]);$orders=$ordersStmt->fetchAll();
            if($orders){
                $orderIds=array_map(static fn($order)=>(int)$order['id'],$orders);$placeholders=implode(',',array_fill(0,count($orderIds),'?'));
                $itemsStmt=$pdo->prepare("SELECT order_id,product_name,quantity,unit_price,subtotal,customizations FROM order_items WHERE order_id IN ($placeholders) ORDER BY order_id,id");$itemsStmt->execute($orderIds);$itemsByOrder=[];
                foreach($itemsStmt->fetchAll() as $item){$orderId=(int)$item['order_id'];$itemsByOrder[$orderId][]=['product_name'=>$item['product_name'],'quantity'=>(int)$item['quantity'],'unit_price'=>(float)$item['unit_price'],'subtotal'=>(float)$item['subtotal'],'customizations'=>$item['customizations']];}
                foreach($orders as &$listedOrder){$listedOrder['items']=$itemsByOrder[(int)$listedOrder['id']]??[];if((string)($listedOrder['payment_status']??'')==='rejected')attach_latest_rejection_reason($pdo,$listedOrder);}unset($listedOrder);
            }
            respond(['ok'=>true,'orders'=>$orders]);
        }
        // Current Order contains only active, non-rejected orders.
        $stmt=$pdo->prepare("SELECT id,order_code,customer_name,pickup_time,payment_method,payment_status,order_status,total_amount,created_at,updated_at FROM orders WHERE user_id=? AND order_status IN ('pending','confirmed','in_preparation','ready') AND payment_status <> 'rejected' ORDER BY created_at DESC,id DESC LIMIT 1");
        $stmt->execute([$customerUserId]);$order=$stmt->fetch();
        // active_count lets the tracker say "You have N more active orders" (the panel still shows only the newest).
        $activeStmt=$pdo->prepare("SELECT COUNT(*) FROM orders WHERE user_id=? AND order_status IN ('pending','confirmed','in_preparation','ready') AND payment_status <> 'rejected'");
        $activeStmt->execute([$customerUserId]);$activeCount=(int)$activeStmt->fetchColumn();
        if(!$order)respond(['ok'=>true,'order'=>null,'active_count'=>$activeCount]);
        $itemsStmt=$pdo->prepare('SELECT product_name,quantity,unit_price,subtotal,customizations FROM order_items WHERE order_id=? ORDER BY id');$itemsStmt->execute([(int)$order['id']]);$order['items']=$itemsStmt->fetchAll();
        respond(['ok'=>true,'order'=>$order,'active_count'=>$activeCount]);
    }

    if ($method === 'PATCH') {
        require_admin();
        $input = json_input();
        $orderId = (int)($input['id'] ?? 0);
        if ($orderId <= 0) respond(['ok'=>false,'message'=>'Order ID is required.'],422);

        $currentStmt=$pdo->prepare('SELECT payment_status,order_status,user_id FROM orders WHERE id=? LIMIT 1');
        $currentStmt->execute([$orderId]);
        $current=$currentStmt->fetch();
        if (!$current) respond(['ok'=>false,'message'=>'Order not found.'],404);

        $currentPayment=(string)$current['payment_status'];
        $currentOrder=(string)$current['order_status'];
        $customerUserId=(int)($current['user_id'] ?? 0);
        $nextPayment=array_key_exists('payment_status',$input)?(string)$input['payment_status']:$currentPayment;
        $nextOrder=array_key_exists('order_status',$input)?(string)$input['order_status']:$currentOrder;
        $validPayment=['pending','submitted','verified','rejected'];
        $validOrder=['pending','confirmed','in_preparation','ready','completed','cancelled'];

        if (!in_array($nextPayment,$validPayment,true)) respond(['ok'=>false,'message'=>'Invalid payment status.'],422);
        if (!in_array($nextOrder,$validOrder,true)) respond(['ok'=>false,'message'=>'Invalid order status.'],422);

        $adminRole=(string)($_SESSION['admin_role']??'');
        $adminName=trim((string)($_SESSION['admin_name']??$_SESSION['admin_username']??'Admin'));

        if (in_array($nextPayment,['verified','rejected'],true) && $adminRole!=='owner') {
            respond(['ok'=>false,'message'=>'Only the owner can verify or reject GCash payments.'],403);
        }

        if ($nextPayment!==$currentPayment) {
            if ($nextPayment==='verified' && $currentPayment!=='submitted') {
                respond(['ok'=>false,'message'=>'Only submitted payments can be verified.'],409);
            }
            if ($nextPayment==='rejected' && !in_array($currentPayment,['submitted','pending'],true)) {
                respond(['ok'=>false,'message'=>'Only pending or submitted payments can be rejected.'],409);
            }
            if ($nextPayment==='submitted' && $currentPayment!=='pending') {
                respond(['ok'=>false,'message'=>'Payment can only move from pending to submitted.'],409);
            }
        }

        $rejectionReason=trim((string)($input['rejection_reason']??''));
        if ($nextPayment==='rejected' && $nextPayment!==$currentPayment && $rejectionReason==='') {
            respond(['ok'=>false,'message'=>'A rejection reason is required.'],422);
        }

        if ($nextOrder==='confirmed' && $currentOrder!=='confirmed' && $nextPayment!=='verified') {
            respond(['ok'=>false,'message'=>'Verify the GCash payment before accepting the order.'],409);
        }
        if ($nextOrder==='in_preparation') {
            if ($currentOrder!=='confirmed') respond(['ok'=>false,'message'=>'The order must be accepted before preparation starts.'],409);
            if ($nextPayment!=='verified') respond(['ok'=>false,'message'=>'Verify the GCash payment before preparation starts.'],409);
        }
        if ($nextOrder==='ready' && $currentOrder!=='in_preparation') {
            respond(['ok'=>false,'message'=>'The order must be in preparation before it can be marked ready.'],409);
        }
        if ($nextOrder==='completed' && $currentOrder!=='ready') {
            respond(['ok'=>false,'message'=>'The order must be ready for pick-up before it can be completed.'],409);
        }
        if ($nextOrder==='pending' && $currentOrder!=='pending') {
            respond(['ok'=>false,'message'=>'Active order status cannot move back to pending.'],409);
        }
        if ($nextPayment==='rejected' && $nextOrder!==$currentOrder && $nextOrder!=='pending') {
            respond(['ok'=>false,'message'=>'Rejected payments cannot advance the order.'],409);
        }

        $fields=[]; $params=[];
        if ($nextPayment!==$currentPayment) {$fields[]='payment_status=?';$params[]=$nextPayment;}
        if ($nextOrder!==$currentOrder) {$fields[]='order_status=?';$params[]=$nextOrder;}
        if (!$fields) respond(['ok'=>false,'message'=>'No valid status changes supplied.'],422);

        $params[]=$orderId;
        $pdo->beginTransaction();
        try {
            $stmt=$pdo->prepare('UPDATE orders SET '.implode(', ',$fields).' WHERE id=?');
            $stmt->execute($params);

            if ($nextPayment==='verified' && $nextPayment!==$currentPayment) {
                $log=$pdo->prepare('INSERT INTO payment_logs (order_id,action,remarks) VALUES (?, ?, ?)');
                $log->execute([$orderId,'payment_verified','Verified by '.$adminName.' | At: '.date('Y-m-d H:i:s').' | Payment proof manually reviewed.']);
            }
            if ($nextPayment==='rejected' && $nextPayment!==$currentPayment) {
                $log=$pdo->prepare('INSERT INTO payment_logs (order_id,action,remarks) VALUES (?, ?, ?)');
                $log->execute([$orderId,'payment_rejected','Rejected by '.$adminName.' | At: '.date('Y-m-d H:i:s').' | Reason: '.$rejectionReason]);
            }

            if ($nextPayment !== $currentPayment && $nextPayment === 'verified') {
                add_customer_notification($pdo, $customerUserId, $orderId, 'payment_verified', 'Payment verified', 'Your GCash payment was verified and your order has been accepted. It will be prepared soon.');
            } elseif ($nextPayment !== $currentPayment && $nextPayment === 'rejected') {
                add_customer_notification($pdo, $customerUserId, $orderId, 'payment_rejected', 'Payment needs attention', 'Your GCash payment was rejected. Reason: '.$rejectionReason.' Please review the reason and resubmit your proof.');
            } elseif ($nextOrder !== $currentOrder && $nextOrder === 'in_preparation') {
                add_customer_notification($pdo, $customerUserId, $orderId, 'preparing', 'Order is being prepared', 'Your order is now being prepared.');
            } elseif ($nextOrder !== $currentOrder && $nextOrder === 'ready') {
                add_customer_notification($pdo, $customerUserId, $orderId, 'ready', 'Ready for pick-up', 'Your order is ready for pick-up.');
            } elseif ($nextOrder !== $currentOrder && $nextOrder === 'completed') {
                add_customer_notification($pdo, $customerUserId, $orderId, 'completed', 'Order completed', 'Your order has been marked as completed. Thank you for choosing SEVEN Coffee & Tea.');
            }

            $pdo->commit();
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $e;
        }

        respond(['ok'=>true,'message'=>'Order updated.']);
    }

    respond(['ok'=>false,'message'=>'Method not allowed.'],405);
} catch (Throwable $e) {
    if (isset($pdo) && $pdo instanceof PDO && $pdo->inTransaction()) $pdo->rollBack();
    respond(['ok'=>false,'message'=>'Unable to process the request.'],500);
}
