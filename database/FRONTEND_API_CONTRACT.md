# SEVEN Coffee & Tea — Frontend/API Contract

## Stack

- Frontend: HTML/CSS/JavaScript
- API: PHP + PDO
- Database: MySQL (`seven_coffee`)
- Main order endpoint: `api/orders.php`

## Database setup

1. Import `database/seven.sql` into MySQL.
2. Run `database/frontend_menu_contract.sql` after it when upgrading an older database.
3. Run `database/catalog_menu_migration.sql` once to archive the prior catalog and insert the new menu while preserving historical orders.
3. Run `database/admin_order_history.sql` on an existing database to add admin history indexes.
3. Run `database/customer_order_history.sql` on an existing database to add the account/date index for customer-history pagination.
3. Configure the `SEVEN_DB_*` and `SEVEN_APP_ORIGIN` environment variables for non-default deployments.

The base schema includes `products.large_price` for explicit Large pricing, `products.catalog_version` for catalog migration tracking, and `products.is_signature`. Best Sellers are calculated from qualifying sales; the legacy `is_bestseller` field is not used as a fallback.

## Customer authentication

`api/customer_auth.php`

- `POST` with `action=register` creates a customer account.
- `POST` with `action=login` signs in a customer.
- `GET` checks the current customer session.
- `DELETE` signs out.

A customer session is required to place an order and view account-bound order tracking.

## Create order

`POST api/orders.php`

The customer frontend sends `multipart/form-data` with:

- `customer_name`
- `contact_number`
- `pickup_time`
- `notes`
- `payment_reference`
- `items`: JSON array from `seven_cart`
- `payment_screenshot`

GCash is the current supported payment method. The server stores the payment as `submitted` until an administrator verifies it.

The API does not trust the frontend total. It resolves products from MySQL and recalculates the selected Medium or Large price and allowed customization add-ons on the server.

## Customer order tracking

All storefront tracking endpoints require a signed-in customer session and scope results to that session's `customer_user_id`.

- `GET api/orders.php?current=1` returns the latest active order in Pending, Accepted, Preparing, or Ready for Pick-Up status. Completed, cancelled, and payment-rejected orders do not appear in Current Order. With no active order, the endpoint returns `{"ok":true,"order":null}`.
- `GET api/orders.php?history=1&page=1&limit=10` returns completed, cancelled, and unresolved payment-rejected orders, newest first, with at most 10 orders per page. The response includes `orders`, `total`, `page`, `limit`, and `pages`. Items and rejection reasons are fetched in batched queries for the current page.
- `GET api/orders.php?order=7C-AB12CD34` returns an order only when its code belongs to the signed-in customer. This remains available for specific-order tracking and rejected-payment resubmission.

The storefront opens the floating tracker through `?track=1`; `?track=history` opens its History tab. Current Order refreshes every five seconds only while the tracker remains open. History does not poll.

## Administrator authentication

`api/admin_auth.php`

- `POST` with `action=login` signs in an existing `owner` or `staff` user.
- `GET` checks the administrator session.
- `DELETE` signs out.
- `POST` with `action=register` can create the first `owner` account only from the local XAMPP server and only when no administrator account exists yet.

Admin order, product, and banner APIs require an authenticated administrator session. Authorization is handled through the server-side admin session.

## Admin order history

`GET api/orders.php?admin_history=1&page=1&limit=20&q=&status=all&from=&to=` requires an authenticated administrator. It caps page size at 50, filters and searches orders, sorts newest first, and fetches the current page's items in one batched query. Supported status filters are `all`, `completed`, `cancelled`, `payment_rejected`, and `counted_as_sales`. The last option applies the shared paid-sales rule (`payment_status IN ('verified','paid')` and `order_status <> 'cancelled'`) within Order History's archived-record scope. Its summary uses that same rule when calculating sales. The response also includes `timezone`, `store_today`, and `store_week_start` so date shortcuts can follow `SEVEN_STORE_TZ` instead of the browser's timezone. `GET api/orders.php?admin_history_detail=ORDER_ID` returns read-only order details, payment screenshot path, rejection reason and payment logs. Admin refresh returns active and payment-rejected orders only.

The Order History page reads and updates the URL query parameters `history=1`, `q`, `status`, `from`, `to`, and `page`. Use `#history` with those parameters to deep-link to the filtered history tab; dates must use `YYYY-MM-DD`.

### Admin Order History CSV export

- `GET api/orders.php?admin_history_export=1&q=&status=all&from=&to=` requires an authenticated administrator session and uses the same search, status and date filters as the Order History table.
- Accepted status filters match the history list: `all`, `completed`, `cancelled`, `payment_rejected`, and `counted_as_sales`. The last filter uses the shared paid-sales definition. Dates use `YYYY-MM-DD`; either date may be omitted, but if both are supplied the From date must not be after To.
- The export returns at most 5,000 matching orders, sorted newest first, with order details and their item names/quantities. `total`, `export_limit`, and `truncated` indicate whether additional matching orders were omitted. The browser formats the response through the shared CSV helper, which adds a UTF-8 BOM and neutralizes spreadsheet formula-like text cells.

## Pickup timing

`pickup_time` remains in the database for old-order display. New orders always store `As soon as ready`; the API ignores client-supplied pickup times.

## Customer profile

`GET api/profile.php` returns the signed-in customer's name, contact number, username and email. `PATCH api/profile.php` with `action=update_profile` updates name/contact; `action=change_password` requires the current password and a new password of at least six characters. Both actions require the customer's authenticated session and update session profile values after an edit.

## Email verification

Registration creates an unverified customer without an authenticated customer session. `GET api/email_verification.php` reads the pending email for the current verification session; `POST` actions `verify` and `resend` confirm or resend the code. Codes are hashed, expire in 10 minutes, allow five incorrect attempts, and enforce a 60-second resend cooldown. Both login APIs and order submission require `users.email_verified_at`. SMTP uses `SEVEN_SMTP_*` environment variables. Existing databases must run `database/customer_email_verification.sql`.

## Best sellers

`GET api/products.php` also returns up to five active products in `best_sellers`, ranked by quantity sold on verified/paid non-cancelled orders. Ties sort by most recent sale and then name. No manual fallback is used; products without qualifying sales do not appear in Best Sellers. The menu refreshes on load and every three minutes. Run `database/best_seller_sales.sql` on existing databases to add the `order_items(product_id)` index.

## FAQ content constraints

The customer FAQ must reflect the app: GCash only with a 13-digit reference and payment screenshot, payment verification before acceptance, Pending → Accepted → Preparing → Ready for Pick-Up → Completed, pickup timing fixed to `As soon as ready`, no delivery, no in-app cancellation, and past orders in Track Order > History. Store hours, contact number, and refund details are placeholders until the store owner confirms them.

Resend cooldown violations return HTTP 429. Successful authentication and logout clear the pending verification session marker; no customer session is created until verification is complete and a separate login succeeds.

## Sales reports

`GET api/sales.php` is an owner-only endpoint. A valid owner admin session is required; staff requests receive HTTP 403. It supports GET only.

### Report query

- `period=daily|weekly|monthly`; defaults to `daily`.
- `from=YYYY-MM-DD` and `to=YYYY-MM-DD` are optional together. If supplied, both must be valid dates and `from` must not be after `to`. Invalid parameters and ranges that exceed the configured maximum return HTTP 422.
- `preset=today|yesterday|this_week|last_week|this_month|last_month` is an optional quick range calculated on the server in `SEVEN_STORE_TZ`. Use either `preset` or custom `from`/`to`, not both. Presets expand to whole store-calendar periods after applying the selected report period.
- `basis=paid|completed`; defaults to `paid`.
- Defaults: daily returns 30 days, weekly returns 12 calendar weeks, and monthly returns 12 calendar months. Maximums are 366 daily rows, 104 weekly rows, and 60 monthly rows. Input dates are expanded to whole report periods.
- All date boundaries use `SEVEN_STORE_TZ` (default `Asia/Manila`). An order is assigned to the date it was placed, based on `orders.created_at`. Weeks start Monday and end Sunday; months use calendar months.

### Sales definition

For `basis=paid`, a sale has `payment_status IN ('verified','paid')` and `order_status <> 'cancelled'`. Orders still being prepared or awaiting pickup count. Pending, submitted/unverified, rejected and cancelled orders do not count.

For `basis=completed`, the payment must be verified or paid and `order_status = 'completed'`.

Gross sales are calculated from `orders.total_amount` without joining `order_items` into the order-total sum. Item quantities and product revenue are aggregated separately. Historical product names come from `order_items.product_name`. Empty calendar periods are included with zero totals.

The report response contains `range`, `previous_range`, `rows`, `totals`, `previous_totals`, `changes`, `top_products`, `basis`, `period`, `timezone`, and `generated_at`. Each row includes `period_start`, `period_end`, `label`, `orders`, `items_sold`, `gross_sales`, `average_order_value`, `cancelled_orders`, `cancelled_amount`, `rejected_payments`, and `rejected_amount`. `changes` provides current value, previous value, difference and percentage for gross sales, order count, item quantity and average order value. If the previous value is zero, percentage change is `0` when the current value is also zero, and `null` otherwise.

### Dashboard summary

- `GET api/sales.php?summary=1` returns `today`, `this_week`, and `this_month`, each containing `sales` and `orders`, plus `total_orders` for every order ever placed. Period sales use the default paid basis and store timezone.

### Order details for a report row

- `GET api/sales.php?detail=1&period=daily|weekly|monthly&start=YYYY-MM-DD&basis=paid|completed&page=1` returns the individual qualifying sale orders in one report row. Weekly `start` must be a Monday and monthly `start` must be the first calendar day. Results contain `id`, `order_code`, `time`, `customer`, `total`, `payment_status`, and `order_status`, with 20 orders per page. `total`, `page`, `limit`, and `pages` are included for pagination.

The report range and totals use SQL aggregation. `orders.created_at` already has an index in the base schema and the order-items foreign key supports order-to-items lookups. Run `EXPLAIN` against the actual XAMPP database before adding a further composite index; no additional index migration is required by this endpoint at this stage.
