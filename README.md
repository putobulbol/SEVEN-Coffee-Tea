# SEVEN Coffee & Tea

SEVEN Coffee & Tea is a web-based pickup ordering system built for a customer storefront and an administrator dashboard.

## Main stack

- Frontend: HTML, CSS, JavaScript
- Backend: PHP + PDO
- Database: MySQL (`seven_coffee`)
- Local development: XAMPP/Apache + MySQL

## Customer pages

- `index.html` — homepage, promotions, signature drinks, cart, checkout
- `menu.html` — database-driven menu and drink customization
- `story.html` — brand/story page
- `location.html` — location and map search
- `cart.html` — cart review
- `login.html` — customer sign-in
- `orders.html` — customer order history (all orders, by status)
- `register.html` — customer registration

## API

- `api/auth.php` — customer sign-in (rejects owner/staff accounts)
- `api/admin_login.php` — admin sign-in for owner/staff (rejects customer accounts)
- `api/customer_auth.php` — customer registration, session details, and logout
- `api/products.php` — public menu data
- `api/banners.php` — active homepage banners
- `api/orders.php` — order creation, customer tracking, and admin order operations
- `api/sales.php` — owner-only sales reports, period totals, dashboard summary, and paged order details
- `api/admin_auth.php` — administrator session validation and logout
- `api/admin_notifications.php` — admin bell: recent events, per-admin unread count, mark read / mark all read
- `api/admin_products.php` — administrator product management
- `api/admin_banners.php` — administrator banner management

## Database setup

For a **fresh database only**, import `database/seven.sql`. This script drops and recreates project tables, so **do not run it against a database containing data you need to keep**.

When upgrading an existing database, run the required migration scripts instead:
- `database/frontend_menu_contract.sql` for the frontend/menu schema contract.
- `database/customer_account_notifications.sql` to add customer contact/terms fields and the customer notifications table. Run this once in phpMyAdmin against `seven_coffee`.
- `database/customer_order_history.sql` to add the `orders(user_id, created_at)` index used by paginated customer history. Run this in phpMyAdmin against `seven_coffee`; it is safe to rerun.
- `database/admin_order_history.sql` to add indexes used by admin order-history queries. Run this in phpMyAdmin against `seven_coffee`; it is safe to rerun.
- `database/admin_roles.sql` if an existing database's `users.role` column does not yet support `customer`, `owner`, and `staff`.
- `database/admin_notifications.sql` to add the admin bell tables (`admin_notifications` and the per-admin `admin_notification_reads`). Run this in phpMyAdmin against `seven_coffee`; it is safe to rerun. New orders and resubmitted GCash proofs are recorded from then on (earlier orders are not back-filled). Until it is run, ordering still works and the bell shows a setup message.

For local XAMPP, the default database settings target `seven_coffee` on `127.0.0.1`. Non-local deployments should provide `SEVEN_DB_HOST`, `SEVEN_DB_NAME`, `SEVEN_DB_USER`, `SEVEN_DB_PASS`, and `SEVEN_APP_ORIGIN`.

## Login pages and account setup

Customers and store staff sign in on separate pages:

- Customer sign-in: `http://localhost/Tea/login.html` (posts to `api/auth.php`)
- Customer registration: `http://localhost/Tea/register.html`
- Admin sign-in (owner/staff): `http://localhost/Tea/admin/login.html` (posts to `api/admin_login.php`)

Both endpoints share `api/lib/sign_in.php`, and each accepts only its own account types. A customer account on the admin page, or an owner/staff account on the customer page, gets the same generic "Invalid email or password" response as a wrong password, and no session is created. Customers return to the storefront or their saved checkout destination; owners and staff go to the admin dashboard or the admin page they requested (for example `admin/login.html?return=orders.html`). Signing in replaces the previous customer/admin identity in the session. Admin APIs still validate the server-side owner/staff role.

Admin accounts are created by an authorized database administrator, not through a public signup page. `admin/register.html` redirects to the admin sign-in page.

### Local test admin account

For local XAMPP testing only, open phpMyAdmin, select the `seven_coffee` database, and import `database/test_admin_account.sql`. The test credentials are:

- Login email: `admin123@seven.local`
- Password: `123456`

Use the email address, not the username, on the admin sign-in page (`admin/login.html`). This local test address is not a real email inbox; email verification is not required for the test owner account.

The SQL stores a PHP-compatible password hash. This is a deliberately weak test password; remove the test account or replace its password before deploying or exposing the application outside your local machine. Do not import this test account into a production database.

## PHP upload limits (XAMPP)

The admin screens and PHP endpoints validate product and banner images up to 50 MB each. PHP also has its own request limits, so a file can still be rejected before the application sees it. In XAMPP, open `php.ini`, check `upload_max_filesize` is at least `50M`, set `post_max_size` higher than the combined size of the files in one save request (for example `256M` for a batch under that total), and restart Apache. If multiple large images are uploaded together, `post_max_size` must be increased enough for their combined request size.

## Current order flow

Menu → Customize Drink → Cart → Customer Login → Pickup Details → GCash Proof → Order Confirmation → Account-bound Order Tracking.

The floating Track Order control appears on Home, Menu, Our Story, Location, and Cart. Current Order shows the latest active, non-rejected order. History loads completed, cancelled, and unresolved payment-rejected orders 10 at a time. Selecting an order displays items, customizations, totals, and payment details; results are restricted to the signed-in customer account.

Online payment gateways, delivery integrations, and loyalty/reward systems are outside the current project scope.
## Pickup timing

Pickup is fixed to **As soon as ready**. Checkout shows this value as plain text, and the PHP API ignores client-supplied `pickup_time`. The existing `orders.pickup_time` column remains for older order records.

## Customer profile

Signed-in customers can use `profile.html` to edit their name and contact number, view their email and username, and change their password after confirming the current password. Order history remains in the floating tracker; the profile page links to its History tab.

## Email verification setup

Customer registration requires a six-digit email code. **For local XAMPP**, copy `api/mail-config.example.php` to `api/mail-config.local.php` and enter your Gmail address and Google App Password in the copied file. Keep the `from` address the same as the authenticated Gmail account. The local file is ignored by Git so credentials are not committed. Never paste the App Password into chat or commit it to the repository.

Google App Passwords require 2-Step Verification: https://support.google.com/accounts/answer/185833. Use the generated App Password, not your normal Gmail password. The default SMTP server is `smtp.gmail.com`, using STARTTLS on port `587`; port `465` can use `secure => 'ssl'`.

Alternatively, configure the PHP/Apache environment variables: `SEVEN_SMTP_HOST`, `SEVEN_SMTP_PORT`, `SEVEN_SMTP_USER`, `SEVEN_SMTP_PASS`, `SEVEN_SMTP_FROM`, optional `SEVEN_SMTP_FROM_NAME`, and optional `SEVEN_SMTP_SECURE`. Environment variables take priority over the local file. By default, registration accepts Gmail (`gmail.com` or `googlemail.com`) and education domains ending in `.edu` or `.edu.xx`, including common Philippine school domains such as `.edu.ph`. Email verification is required for both. Set `SEVEN_REQUIRE_GMAIL=0` to allow any valid email domain.

PHPMailer 6.10.0 is bundled under `api/lib/PHPMailer` without Composer. Run `database/customer_email_verification.sql` when upgrading an existing database. The migration marks existing customers verified only when it first adds `users.email_verified_at`; rerunning it will not verify future registrations. SMTP failures are recorded in the PHP/Apache error log without logging the verification code.

## Story and Location photos to supply

The pages reference three replaceable photo files: `assets/story-1.jpg`, `assets/story-2.jpg`, and `assets/location-store.jpg`. Until the final photos are provided, the browser falls back to `assets/coffee-story.jpg` for Story 1 and Location, and `assets/Coffeemenu.png` for Story 2. Keep supplied images optimized for the web, ideally under 300 KB each; the HTML includes descriptive alt text and lazy loading.

## Menu category icons

The menu category chips use local SVGs in `assets/categories/`. Category matching is case-insensitive; unfamiliar admin-defined category names use the generic cup icon. Keep the icon set local so category visuals do not depend on external icon services.

## Sales reporting rules

Admin sales reports and the dashboard use the following shared definition. All reporting date boundaries are based on the store timezone configured by `SEVEN_STORE_TZ` (default: `Asia/Manila`), not the administrator's browser clock. An order is counted on the date it was placed (`orders.created_at`).

### Counted orders

An order counts as a sale when `payment_status IN ('verified', 'paid')` and `order_status <> 'cancelled'`. Paid orders still being prepared or awaiting pickup count. Pending, submitted/unverified, rejected, and cancelled orders do not count. (The Sales Reports page no longer offers a "Completed only" switch; `api/sales.php` still accepts `basis=completed` for compatibility, but the page always requests the paid basis.)

**Gross sales** is the sum of `orders.total_amount` for the qualifying orders. Calculate this from `orders` alone: joining order totals directly to `order_items` can repeat each order total once per item and inflate sales. Aggregate item quantities separately from `order_items`; product rankings use the saved `order_items.product_name` so historical products remain visible even if the live product is later removed.

Reporting periods use calendar dates in the store timezone. A week runs Monday through Sunday, and a month is a calendar month. Periods with no qualifying orders should still appear with zero totals. When comparing periods, compare the selected range with the immediately preceding range of equal length and handle a zero previous-period value without dividing by zero.

## Admin exports and printing

The owner-only Admin Sales Reports page (`admin/sales.html`) supports Daily, Weekly and Monthly reports, CSV export, and Print / Save as PDF. Sales CSV uses UTF-8 with a BOM for Excel and neutralizes text fields that could be interpreted as spreadsheet formulas.

Admin Order History (`admin/orders.html#history`) also supports CSV export with the active search, status and date filters. Its **Counted as sales** status filter uses the same shared paid-sales eligibility rule as Sales Reports and the dashboard, and its sales summary excludes cancelled, unverified, and rejected-payment orders. Today / This week shortcuts use the store timezone rather than the browser's calendar. Search, status, and date filters are reflected in the URL, so a filtered history view can be bookmarked or shared (for example, `admin/orders.html?history=1&status=counted_as_sales&from=2026-10-01&to=2026-10-22#history`). `GET api/orders.php?admin_history_export=1` enforces a server-side maximum of 5,000 matching orders and reports whether the export was truncated. Both exports use the shared `window.SEVEN_CSV` helper from `admin/js/global.js`.

## Best sellers

The menu's Best Seller carousel ranks active products by quantity sold on orders with payment status verified or paid and order status not cancelled. Ties sort by most recent sale, then product name. If fewer than five products qualify, the admin-selected Best Seller fallback fills the remaining positions. Run `database/best_seller_sales.sql` on an existing database; fresh installs include the same `order_items(product_id)` index.

## Terms and FAQ

`terms.html` explains Gmail email verification, profile/account details, order history, fixed as-soon-as-ready pickup, GCash verification, and cancellation/refund details that still require store-owner confirmation. `faq.html` is the customer help page for order cancellation and ordering rules; store hours, contact number and refund details remain marked as placeholders until confirmed.

## Customer FAQ

`faq.html` covers cancellation limits, payment verification, accepted order statuses, fixed pickup timing, Track Order history, and store details that still need confirmation. It uses the storefront header/footer and the same floating Track Order control. Keep store hours, contact number and refund details marked as placeholders until the owner confirms them.

Email verification uses an explicit rate-limit response when the resend cooldown has not elapsed. Unverified-login attempts go to the verification step, but do not establish a customer session; sign-in and logout clear any pending verification-only session marker.
