# Project Context

## Repository
https://github.com/putobulbol/SEVEN-Coffee-Tea

## Deployment
Not deployed yet.

## Product
SEVEN Coffee & Tea web-based pickup ordering system with a customer landing page, full product menu, drink customization, cart, checkout, payment proof handling, order tracking, and admin order management.

## Audience
Local students, young professionals, and nearby coffee and tea customers.

## Goal
Introduce SEVEN Coffee & Tea, showcase the full menu, let customers customize drinks, build a cart, place pickup orders, submit GCash proof or choose Cash on Pickup, and track order status.

## Brand
Warm, youthful, energetic, slightly premium, friendly, and café-focused.

## Final Design Reference — LOCKED
The uploaded final-design screenshots are the locked visual source of truth for the SEVEN Coffee & Tea website. Preserve the existing functionality and page structure while matching the approved visual language: a taller deep-teal navigation bar (76px on desktop and 64px on mobile), with a 40px desktop logo, 13px desktop links, and 42px desktop icon controls. Keep the brand and page links on the left, with notification, cart, and profile controls grouped at the far right. On mobile, retain the hamburger dropdown and prevent horizontal overflow at 360px. Keep the white/cream page background, teal script-style page headings, centered section titles, warm beige and coffee-brown accents, rounded product cards, circular category icons, clean spacing, and simple compact footer treatment. The homepage uses a wide coffee promotional banner, a smaller promotional strip, a dark-teal signature-drinks section, product-card grids, and a light illustrated lower section. The menu uses a Best Seller heading, centered featured-product carousel, circular category icons, and recommendation/product grids. The cart uses a centered Shopping Cart heading, table-style product summary, beige Add More button, right-aligned subtotal/checkout area, and clean white space. The Our Story page uses a script heading, a decorative horizontal strip, alternating image/text story blocks, and a centered testimonial heading with three cards. The Location page uses a script Location heading and a large rounded location panel combining a store image, dark overlay text, and a map panel. The uploaded screenshots are design references only; do not treat their placeholder text, addresses, prices, or image content as verified business data.

## Page Structure
Hero, introduction, full menu with category filters, drink customization modal, cart drawer, pickup checkout, payment section, order confirmation, order tracking, admin order management, and footer.

## Copy Direction
Direct, specific, friendly café language. Avoid generic marketing filler and exaggerated claims. Main CTA is Order Now.

## Assets
Primary logo asset: assets/seven-logo.svg. Additional visual assets should be added only when needed to faithfully implement the approved final design. Customer GCash screenshots are handled by the PHP backend when deployed on a PHP-capable host.

## Functionality
Customer-side flow: Menu → Customize Drink → Cart → Pickup Details → Payment Method → Order Confirmation → Order Tracking. Customers can choose temperature, size, sweetness where relevant, milk, drizzle, syrup, sinkers, toppings, and espresso shot. Checkout currently supports GCash with screenshot/reference submission. Customer login/registration is enabled because checkout and account-bound order tracking require a customer session. Admin can view orders, verify payment status, and update order status.

## Menu Source of Truth
Use the full SEVEN Coffee & Tea menu supplied in the project discussion. Categories include Iced Coffee (Signature and Classic), Special Iced Coffee, Iced Non-Coffee (Classic and Special), Salty Cream Series, Iced Blended/Frappe (Coffee Base and Non-Coffee Base), Hot Beverages, Milktea (Classic), Creamcheese & Cheesecake Milktea, Refresher (Fruit Tea, Yakult, Soda), Fresh Lemonade, and Promos & Special Series. Add-ons/options include Espresso Shot, Chocolate Drizzle, Caramel Drizzle, Flavored Syrup, Pearls, Nata, Crushed Oreo, Coffee Jelly, Cream Cheese, Whipping Cream, Salty Cream, Sea Salt Cream, and Oat Milk.

## Pricing
The seven provided Iced Coffee Signature prices are preserved: Americano ₱80, Butterscotch ₱90, Cafe Latte ₱90, Cafe Mocha ₱95, Hazelnut Macchiato ₱100, Salted Caramel ₱95, Vanilla Macchiato ₱100. Other prices in the database/menu are working project prices because the supplied menu list did not include their board prices. Do not present working prices as verified real-world prices.

## Functionality Boundaries
Online payment gateways, delivery integrations, and loyalty/reward systems are out of scope. GCash is handled by customer-submitted screenshot and reference number for admin verification.

## Avoid
React, Tailwind, npm, build systems unless explicitly requested; unnecessary pages; delivery integrations; online payment gateway integrations; loyalty features; forced customer login/registration; and vercel.json.

## Current Decisions
The existing layout and ordering flow remain the functional source structure. The uploaded final-design screenshots are the approved and locked visual target. The supplied SEVEN cup/7 mark remains the primary logo. Animation-heavy styling is not part of the locked final visual reference and must not be reintroduced unless explicitly requested. The frontend currently uses page-specific CSS/JS plus shared scripts. New shared files should be added only when they serve a clear cross-page purpose. The homepage uses the consolidated stylesheet with the approved deep teal/green, cream/white, warm beige, coffee-brown, and gold palette. The official order status path is Pending → Confirmed → In Preparation → Ready for Pickup → Completed. Payment status is Pending/Submitted/Verified/Paid/Rejected. Customer tracking is a floating control on Home, Menu, Our Story, Location, and Cart. Current Order shows the latest active, non-rejected order for the signed-in customer. History is paginated 10 at a time and includes completed, cancelled, and unresolved payment-rejected orders belonging only to that customer. Selecting a history entry shows items, quantities, customizations, prices, payment method, and payment status. Poll Current Order every five seconds only while the tracker is open; do not poll while History is open or the modal is closed. Customer accounts/authentication are part of the current implementation. The full 95-item menu and customization-ready order-item schema remain the project source of truth.


## Admin order history

Admin order history is read-only and separate from active kitchen queues. It contains completed, cancelled and payment-rejected orders, supports server-side search/status/date filters and pagination, and reports matching orders plus verified/paid sales excluding cancelled orders. The queue refresh endpoint returns active orders and rejected payment rows only.


## Pending storefront photography

Final photo files still need to be supplied by the project owner: `assets/story-1.jpg`, `assets/story-2.jpg`, and `assets/location-store.jpg`. Until then, Story 1 and Location fall back to `assets/coffee-story.jpg`; Story 2 falls back to `assets/Coffeemenu.png`. Images are lazy-loaded and should be optimized, ideally under 300 KB.


## Menu category visuals

Menu category chips display small, locally stored SVG icons from `assets/categories/`, including an All icon and a generic cup fallback for unknown free-text categories. Category matching is case-insensitive.


## Best sellers

The Best Seller carousel displays up to five active products ranked by quantity sold on verified/paid non-cancelled orders. Ties use most recent sale then product name. The admin checkbox is a fallback only when fewer than five sales-ranked products exist; the carousel refreshes on load and every three minutes.


## Customer terms and FAQ

Terms cover email verification, account/profile data, Track Order history, fixed pickup timing, and GCash verification. Store hours, contact details and refund details remain explicitly marked for confirmation. FAQ content must match the current ordering flow and say that customers cannot cancel through the website.


## FAQ

`faq.html` uses the shared customer navigation/footer and a native accordion. It documents GCash-only payment, the 13-digit reference and screenshot, payment verification before acceptance, the order status sequence, pickup-only service, no in-app cancellation, Track Order history, and unconfirmed store-hours/contact/refund placeholders.
