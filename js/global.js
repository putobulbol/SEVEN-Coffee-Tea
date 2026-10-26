/* Shared customer JavaScript; must load before page modules. */

/* SEVEN COFFEE & TEA — ONE CUSTOMER JAVASCRIPT FILE */

const MENU_IMAGE = 'assets/Latte.png';
let products = [], categories = [];
/* Menu chip key: the part before ' · ' (sub-category separator), trimmed, single-spaced, case-insensitive. */
function categoryKey(value) { return String(value == null ? '' : value).split('·')[0].trim().replace(/\s+/g, ' ').toLowerCase() }
function categoryLabel(value) { return String(value == null ? '' : value).split('·')[0].trim().replace(/\s+/g, ' ') || 'Uncategorized' }
let cart = (() => { try { const saved = JSON.parse(localStorage.getItem('seven_cart') || '[]'); return Array.isArray(saved) ? saved.filter(x => x && x.id) : [] } catch (_) { return [] } })();
const money = v => '₱' + Number(v).toLocaleString('en-PH', { minimumFractionDigits: 0 });
const $ = id => document.getElementById(id), cartItems = $('cartItems'), cartCount = $('cartCount'), cartTotal = $('cartTotal'), drawer = $('drawer'), backdrop = $('backdrop'), checkoutModal = $('checkoutModal'), toast = $('toast');
function toastMsg(t) { if (!toast) return; toast.textContent = t; toast.classList.add('show'); clearTimeout(window.toastTimer); window.toastTimer = setTimeout(() => toast.classList.remove('show'), 1800) }
function saveCart() { try { localStorage.setItem('seven_cart', JSON.stringify(cart)) } catch (_) { } }
function normalizeApiProduct(p) { return { id: p.id, name: p.name, category: String(p.category || 'Uncategorized'), prices: p.prices || {}, desc: p.description || 'SEVEN Coffee & Tea menu item.', image: p.image || MENU_IMAGE, images: Array.isArray(p.images) ? p.images : [], available: p.available !== false, status: p.status || 'active', isBestseller: Number(p.is_bestseller) === 1, isSignature: Number(p.is_signature) === 1, totalSold: Number(p.total_sold || 0), lastSaleAt: p.last_sale_at || '' } }
async function loadProducts() {
  try {
    const r = await fetch('api/products.php', { cache: 'no-store' }), d = await r.json();
    if (!r.ok || !d.ok) throw new Error(d.message || 'Unable to load menu.');
    products = (d.products || []).map(normalizeApiProduct);
    window.sevenBestSellerProducts = (d.best_sellers || []).map(normalizeApiProduct);
    // One chip per category key ("Coffee", "coffee " and "COFFEE" are the same); first spelling wins.
    const seenCategories = new Map(); products.forEach(function (p) { const label = categoryLabel(p.category || 'Uncategorized'); const key = label.toLowerCase(); if (!seenCategories.has(key)) seenCategories.set(key, label) }); categories = [...seenCategories.values()];
  } catch (e) { products = []; categories = []; window.sevenBestSellerProducts = []; toastMsg(e.message || 'Unable to load menu.') }
  renderCart(); window.dispatchEvent(new Event('seven:products-loaded'));
}
function selectedBasePrice(p, s) { if (s === 'Large') return p.prices.large; if (s === 'Medium' || !s) return p.prices.medium ?? Object.values(p.prices || {})[0] ?? 0; return p.prices.medium ?? Object.values(p.prices || {})[0] ?? 0 } function cartDetails(i) { return [(i.size === 'Large' ? 'Large' : ''), i.temperature, (i.sweetness && i.sweetness !== 'N/A' ? i.sweetness : '')].filter(Boolean).join(' · ') }
function escapeCartText(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]) }
/* Badge list shared by the drawer and the cart page. */
function cartBadges(i) { const base = [i.size === 'Large' ? 'Large' : 'Medium', i.temperature, (i.sweetness && i.sweetness !== 'N/A' ? i.sweetness + ' sweet' : '')].filter(Boolean), extras = [i.milk, i.drizzle, i.syrup, i.sinker, i.topping, i.coffeeAddon].filter(x => x && x !== 'None'); return base.map(x => '<span class="cart-badge">' + escapeCartText(x) + '</span>').join('') + extras.map(x => '<span class="cart-badge addon">+ ' + escapeCartText(x) + '</span>').join('') }
const CART_EMPTY_ART = '<svg class="cart-empty-art" viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="56" class="bg"/><path class="steam" d="M48 30c0 6 6 6 6 12M62 26c0 6 6 6 6 12"/><path class="cup" d="M34 48h52l-5 44a8 8 0 0 1-8 7H47a8 8 0 0 1-8-7l-5-44Z"/><path class="band" d="M37 64h46"/><path class="cup" d="M86 56h4a9 9 0 0 1 0 18h-6"/></svg>';
function renderCart() { if (!cartItems) return; cartCount.textContent = cart.reduce((s, i) => s + i.qty, 0); cartTotal.textContent = money(cart.reduce((s, i) => s + i.unitPrice * i.qty, 0)); const checkoutBtn = $('checkoutBtn'); if (checkoutBtn) checkoutBtn.disabled = !cart.length; cartItems.innerHTML = cart.length ? cart.map((i, n) => `<div class="item cart-line"><img class="cart-thumb" src="${escapeCartText(i.image || MENU_IMAGE)}" alt="" loading="lazy" onerror="this.onerror=null;this.src='${MENU_IMAGE}'"><div class="cart-line-body"><div class="cart-line-top"><b>${escapeCartText(i.name)}</b><button class="cart-remove" data-remove="${n}" type="button" aria-label="Remove ${escapeCartText(i.name)} from cart"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/></svg></button></div><div class="cart-badges">${cartBadges(i)}</div><div class="cart-line-bottom"><div class="qty"><button data-dec="${n}" type="button" aria-label="${i.qty <= 1 ? 'Remove' : 'Decrease quantity of'} ${escapeCartText(i.name)}">−</button><span aria-live="polite">${i.qty}</span><button data-inc="${n}" type="button" aria-label="Increase quantity of ${escapeCartText(i.name)}" ${i.qty >= 99 ? 'disabled' : ''}>+</button></div><strong>${money(i.unitPrice * i.qty)}</strong></div></div></div>`).join('') : '<div class="empty cart-empty">' + CART_EMPTY_ART + '<strong>Your cart is empty</strong><p>Find a drink you love and make it yours.</p><a class="cart-explore" href="menu.html">Explore Drinks</a></div>' } function openCart() { drawer?.classList.add('open'); backdrop?.classList.add('open') } function closeCart() { drawer?.classList.remove('open'); backdrop?.classList.remove('open') }
async function openCheckout() {
  if (!cart.length) { toastMsg('Add an item before checkout'); return }
  if (!checkoutModal) return;
  try {
    const auth = await fetch('api/customer_auth.php', { credentials: 'same-origin', cache: 'no-store' });
    const data = await auth.json();
    if (!auth.ok || !data.ok) {
      const returnUrl = 'menu.html?checkout=1';
      location.href = 'login.html?return=' + encodeURIComponent(returnUrl);
      return;
    }
    // Pull the latest signed-in customer details each time checkout opens.
    // Assign empty strings too, so details from a previously used account cannot linger.
    const customer = data.customer || {};
    if ($('name')) $('name').value = String(customer.name || '');
    if ($('contact')) $('contact').value = String(customer.contact_number || '');
  } catch (_) {
    toastMsg('Please log in before checking out.');
    return;
  } const total = cart.reduce((s, i) => s + i.unitPrice * i.qty, 0); $('gcashAmount').textContent = money(total); $('checkoutSummary').innerHTML = cart.map(i => `<div class="row"><span>${escapeCartText(i.name)} × ${Number(i.qty) || 0}</span><span>${money(i.unitPrice * i.qty)}</span></div>`).join('') + `<div class="row total-row"><span>Total</span><span>${money(total)}</span></div>`; $('checkoutForm').hidden = false; $('success').hidden = true; checkoutModal.classList.add('open')
} function closeCheckout() { checkoutModal?.classList.remove('open') } cartItems?.addEventListener('click', e => { const inc = e.target.closest('[data-inc]'), dec = e.target.closest('[data-dec]'), rm = e.target.closest('[data-remove]'); if (rm) { const i = +rm.dataset.remove; if (cart[i]) { const name = cart[i].name; cart.splice(i, 1); toastMsg(name + ' removed') } } if (inc) { const i = +inc.dataset.inc; if (cart[i]) cart[i].qty = Math.min(99, Number(cart[i].qty || 0) + 1) } if (dec) { const i = +dec.dataset.dec; if (cart[i]) { cart[i].qty = Number(cart[i].qty || 0) - 1; if (cart[i].qty <= 0) cart.splice(i, 1) } } saveCart(); renderCart() }); $('openCart')?.addEventListener('click', openCart); $('ctaCart')?.addEventListener('click', openCart); $('closeCart')?.addEventListener('click', closeCart); backdrop?.addEventListener('click', () => { closeCart(); window.sevenMenu?.closeCustom() }); $('checkoutBtn')?.addEventListener('click', openCheckout); $('closeCheckout')?.addEventListener('click', closeCheckout); $('gcashScreenshot')?.setAttribute('required', 'required'); $('gcashReference')?.setAttribute('required', 'required'); $('checkoutForm')?.addEventListener('submit', async e => { e.preventDefault(); const btn = e.submitter; $('checkoutForm').querySelector('button[type="submit"]')?.setAttribute('disabled', 'disabled'); const fd = new FormData(); fd.append('customer_name', $('name').value.trim()); fd.append('contact_number', $('contact').value.trim()); fd.append('notes', $('notes').value.trim()); fd.append('payment_reference', $('gcashReference').value.trim()); fd.append('items', JSON.stringify(cart)); const file = $('gcashScreenshot')?.files?.[0]; if (!file) { toastMsg('GCash payment screenshot is required.'); btn?.removeAttribute('disabled'); return } if (!$('gcashReference')?.value.trim()) { toastMsg('GCash reference number is required.'); btn?.removeAttribute('disabled'); return } fd.append('payment_screenshot', file); try { const r = await fetch('api/orders.php', { method: 'POST', body: fd }), d = await r.json(); if (!r.ok || !d.ok) throw new Error(d.message || 'Unable to submit your order.'); const o = d.order; cart = []; saveCart(); renderCart(); closeCheckout(); closeCart(); location.href = `index.html?order=${encodeURIComponent(o.order_code)}` } catch (err) { toastMsg(err.message || 'Unable to submit your order.'); btn?.removeAttribute('disabled'); $('checkoutForm').querySelector('button[type="submit"]')?.removeAttribute('disabled') } }); $('done')?.addEventListener('click', () => { cart = []; saveCart(); renderCart(); closeCheckout(); closeCart() }); document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeCart(); window.sevenMenu?.closeCustom(); closeCheckout() } }); loadProducts();

/* ===== Customer order tracking ===== */
(() => {
  const customerPages = ["page-home", "page-menu", "page-story", "page-location", "page-cart", "page-faq"];
  if (!customerPages.some(function (page) { return document.body.classList.contains(page) })) return;
  let activeTrackTab = "current", historyPage = 0, historyPages = 0, historyTotal = 0, historyOrders = [], historyLoading = false;
  function $(id) { return document.getElementById(id) }
  function escapeTrackHtml(value) { return String(value == null ? "" : value).replace(/[&<>"']/g, function (ch) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch] }) }
  function trackMoney(value) { const amount = Number(value || 0); return "₱" + (Number.isFinite(amount) ? amount : 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }
  function stopTrackingPolling() { if (window.orderTrackTimer) { window.clearInterval(window.orderTrackTimer); window.orderTrackTimer = null } }
  function inject() {
    if ($("orderTrackModal")) return;
    document.body.insertAdjacentHTML("beforeend",
      '<button class="order-track-launcher" id="orderTrackLauncher" type="button">Track Order</button>' +
      '<div class="order-track-modal" id="orderTrackModal" hidden><section class="order-track-card" aria-label="Order tracking" role="dialog" aria-modal="true" aria-labelledby="orderTrackTitle">' +
      '<div class="order-track-head"><div><div class="order-track-kicker">Order Tracking</div><h2 class="order-track-title" id="orderTrackTitle">Your Orders</h2></div><button class="order-track-close" id="orderTrackClose" type="button" aria-label="Close order tracking">×</button></div>' +
      '<div class="order-track-tabs" role="tablist" aria-label="Order views"><button class="order-track-tab active" id="orderTrackCurrentTab" type="button" role="tab" aria-selected="true" aria-controls="orderTrackCurrentPane">Current Order</button><button class="order-track-tab" id="orderTrackHistoryTab" type="button" role="tab" aria-selected="false" aria-controls="orderTrackHistoryPane">History <span class="order-track-tab-count" id="orderTrackHistoryCount" hidden>0</span></button></div>' +
      '<div class="order-track-pane" id="orderTrackCurrentPane" role="tabpanel" aria-labelledby="orderTrackCurrentTab"><div class="order-track-code" id="orderTrackCode"></div><div class="order-track-status"><span class="order-track-badge" id="orderTrackBadge">—</span><span class="order-track-updated" id="orderTrackUpdated">Checking your account...</span></div><div class="order-track-steps" id="orderTrackSteps"></div><div class="order-track-details" id="orderTrackDetails" hidden></div><a class="order-track-more" id="orderTrackMore" href="orders.html?status=active" hidden></a></div>' +
      '<div class="order-track-pane" id="orderTrackHistoryPane" role="tabpanel" aria-labelledby="orderTrackHistoryTab" hidden><div class="order-track-history" id="orderTrackHistoryList" aria-live="polite"><div class="order-track-account-state">Open History to load your past orders.</div></div><button class="order-track-load-more" id="orderTrackHistoryMore" type="button" hidden>Load more</button></div>' +
      '<p class="order-track-note" id="orderTrackNote">Your current pickup order is connected to your customer account.</p></section></div>');
  }
  /* 5-step customer timeline. The API only allows "confirmed" after payment is verified, so
     pending = awaiting verification, confirmed/in_preparation = preparing, ready, completed. */
  const trackSteps = ["Order Placed", "Payment Verified", "Preparing", "Ready for Pick-Up", "Completed"];
  function trackStepIndex(order) {
    const s = String(order.order_status || "pending").toLowerCase();
    if (s === "completed") return 5; if (s === "ready") return 3; if (s === "in_preparation" || s === "confirmed") return 2; return 1;
  }
  function trackStepNote(order, index) {
    const s = String(order.order_status || "").toLowerCase(), pay = String(order.payment_status || "").toLowerCase();
    if (index === 1) return pay === "submitted" ? "Checking your GCash payment" : "Waiting for your GCash payment";
    if (index === 2) return s === "confirmed" ? "In the queue — up next" : "Your drink is being made";
    if (index === 3) return "Head to the counter";
    return "";
  }
  function stepsMarkup(order) {
    const active = trackStepIndex(order);
    return trackSteps.map(function (label, index) {
      const done = index < active, current = index === active, ready = current && index === 3;
      const note = current ? trackStepNote(order, index) : "";
      return '<div class="order-track-step ' + (done ? "done " : "") + (current ? "active " : "") + (ready ? "ready" : "") + '"' + (current ? ' aria-current="step"' : "") + '><div class="order-track-dot">' + (done ? "✓" : index + 1) + '</div><div class="order-track-step-label">' + label + (note ? '<small class="order-track-step-note">' + escapeTrackHtml(note) + "</small>" : "") + "</div></div>";
    }).join("");
  }
  function itemsMarkup(order) {
    const items = Array.isArray(order.items) ? order.items : [];
    return items.length ? items.map(function (item) { const quantity = Math.max(0, Number(item.quantity) || 0); return '<li><span class="order-track-detail-item"><strong>' + escapeTrackHtml(item.product_name || "Menu item") + '</strong><span>' + quantity + ' × ' + escapeTrackHtml(trackMoney(item.unit_price)) + '</span>' + customizationMarkup(item.customizations) + '</span><strong>' + escapeTrackHtml(trackMoney(item.subtotal)) + '</strong></li>' }).join("") : '<li><span>Order items unavailable</span></li>';
  }
  /* "You have N more active order(s)" — the panel itself still shows only the newest active order. */
  function renderMoreActive(activeCount) { const link = $("orderTrackMore"); if (!link) return; const extra = Math.max(0, (Number(activeCount) || 0) - 1); link.hidden = extra < 1; link.textContent = extra < 1 ? "" : "You have " + extra + " more active order" + (extra === 1 ? "" : "s") + " — View all" }
  function hideTrackDetails() { const d = $("orderTrackDetails"); if (d) { d.hidden = true; d.innerHTML = "" } const b = $("orderTrackBadge"); if (b) b.classList.remove("is-ready") }
  function renderTrackDetails(order) {
    const d = $("orderTrackDetails"); if (!d) return;
    const rows = [["Placed", formatTrackDate(order.created_at)], ["Payment", String(order.payment_status || "Unknown").replace(/_/g, " ")]];
    if (order.payment_reference) rows.push(["GCash reference", order.payment_reference]);
    d.innerHTML = '<h3 class="order-track-details-title">Order details</h3><ul class="order-track-history-items">' + itemsMarkup(order) + '</ul><div class="order-track-history-total"><span>Total</span><strong>' + escapeTrackHtml(trackMoney(order.total_amount)) + '</strong></div><dl class="order-track-payment-details">' + rows.map(function (r) { return '<div><dt>' + r[0] + '</dt><dd>' + escapeTrackHtml(r[1]) + '</dd></div>' }).join("") + '</dl>';
    d.hidden = false;
  }
  function render(order) {
    if (!order) { renderNoOrder(); return }
    hideTrackDetails();
    $("orderTrackCode").textContent = "Order #" + (order.id || "");
    $("orderTrackUpdated").textContent = order.updated_at ? "Updated " + new Date(String(order.updated_at).replace(" ", "T")).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Status available";
    if (String(order.payment_status || "") === "rejected") {
      $("orderTrackBadge").textContent = "Payment Rejected";
      $("orderTrackSteps").innerHTML = '<div class="order-track-account-state"><strong>Payment rejected</strong><p>Your GCash payment could not be verified.</p><p id="paymentRejectionReason" style="margin:8px 0 0"></p><form id="resubmitPaymentForm" enctype="multipart/form-data" style="display:grid;gap:8px;margin-top:14px;text-align:left"><label style="font-size:11px;font-weight:800">New GCash reference number<input name="payment_reference" required inputmode="numeric" pattern="[0-9]{13}" maxlength="13" minlength="13" title="Enter exactly 13 digits" placeholder="13-digit reference number" style="width:100%;margin-top:5px;padding:9px 10px;border:1px solid #dccbb0;border-radius:9px"></label><label style="font-size:11px;font-weight:800">New payment proof<input name="payment_screenshot" required type="file" accept="image/jpeg,image/png,image/webp" style="display:block;width:100%;margin-top:5px;font-size:10px"></label><button class="order-track-auth-btn login" type="submit" style="border:0;width:100%;cursor:pointer">Resubmit Payment Proof</button></form></div>';
      $("paymentRejectionReason").textContent = order.payment_rejection_reason ? "Reason: " + order.payment_rejection_reason : "";
      $("orderTrackNote").textContent = "Submit a new GCash proof and reference for this same order. The owner will review it again."; return;
    }
    const orderStatus = String(order.order_status || "pending").toLowerCase();
    if (orderStatus === "cancelled") { $("orderTrackBadge").textContent = "Cancelled"; $("orderTrackSteps").innerHTML = '<div class="order-track-account-state"><strong>This order was cancelled.</strong><p>Check History for your other orders.</p></div>'; $("orderTrackNote").textContent = "This order is cancelled and no longer active."; return }
    const index = trackStepIndex(order);
    $("orderTrackSteps").innerHTML = stepsMarkup(order);
    $("orderTrackBadge").textContent = index >= 5 ? "Completed" : trackSteps[index];
    $("orderTrackBadge").classList.toggle("is-ready", index === 3);
    $("orderTrackNote").textContent = index >= 5 ? "This order has been completed. Thank you for choosing SEVEN Coffee & Tea." : index === 1 ? "Your order is placed. We'll start once your GCash payment is verified." : index === 2 ? (orderStatus === "confirmed" ? "Payment verified — your order is in the queue." : "Your drink is being prepared now.") : "Your order is ready for pick-up.";
    renderTrackDetails(order);
  }
  function renderMessage(message) {
    hideTrackDetails();
    $("orderTrackBadge").textContent = "—"; $("orderTrackCode").textContent = ""; $("orderTrackUpdated").textContent = "";
    $("orderTrackSteps").innerHTML = '<div class="order-track-account-state"><strong>' + escapeTrackHtml(message) + '</strong><div class="order-track-account-actions"><a class="order-track-auth-btn login" href="login.html">Log In</a><a class="order-track-auth-btn signup" href="register.html">Sign Up</a></div></div>';
    $("orderTrackNote").textContent = "Sign in to view orders connected to your customer account.";
  }
  function renderNoOrder() {
    hideTrackDetails();
    $("orderTrackBadge").textContent = "No active order"; $("orderTrackCode").textContent = ""; $("orderTrackUpdated").textContent = "";
    $("orderTrackSteps").innerHTML = '<div class="order-track-account-state"><strong>No active order</strong><p>Your completed, cancelled, or payment-rejected orders are available in History.</p><a class="order-track-menu-btn" href="menu.html">Browse menu</a></div>';
    $("orderTrackNote").textContent = "Only active pickup orders appear in Current Order."; window.currentTrackedOrder = "";
  }
  function formatTrackDate(value) { if (!value) return "Date unavailable"; const parsed = new Date(String(value).replace(" ", "T")); return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) }
  function statusLabel(order) { if (String(order.payment_status || "") === "rejected") return "Payment Rejected"; const labels = { pending: "Pending", confirmed: "Accepted", in_preparation: "Preparing", ready: "Ready for Pick-Up", completed: "Completed", cancelled: "Cancelled" }; return labels[String(order.order_status || "").toLowerCase()] || "Order Update" }
  function historyStatusClass(order) { if (String(order.payment_status || "") === "rejected") return "payment-rejected"; return String(order.order_status || "").toLowerCase() === "cancelled" ? "cancelled" : "completed" }
  function updateHistoryCount(total) { const count = $("orderTrackHistoryCount"); if (!count) return; count.textContent = String(Number(total) || 0); count.hidden = !(Number(total) > 0) }
  function customizationMarkup(value) {
    if (value === null || value === undefined || value === "") return '<div class="order-track-customizations">No customizations</div>';
    let parsed = value; if (typeof value === "string") { try { parsed = JSON.parse(value) } catch (_) { parsed = value } }
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const entries = Object.keys(parsed).filter(function (key) { const item = parsed[key]; return item !== null && item !== undefined && String(item).trim() !== "" && String(item).toLowerCase() !== "none" });
      if (entries.length) return '<div class="order-track-customizations">' + entries.map(function (key) { const label = key.replace(/([A-Z])/g, " $1").replace(/_/g, " ").replace(/^./, function (ch) { return ch.toUpperCase() }); return '<span><strong>' + escapeTrackHtml(label) + ':</strong> ' + escapeTrackHtml(parsed[key]) + "</span>" }).join("") + "</div>";
      return '<div class="order-track-customizations">No customizations</div>';
    }
    return '<div class="order-track-customizations">' + escapeTrackHtml(parsed) + "</div>";
  }
  function renderHistoryList() {
    const list = $("orderTrackHistoryList"), more = $("orderTrackHistoryMore"); if (!list) return; updateHistoryCount(historyTotal);
    if (!historyOrders.length) { list.innerHTML = '<div class="order-track-account-state"><strong>No order history yet</strong><p>Completed, cancelled, and unresolved payment-rejected orders will appear here.</p></div>'; if (more) more.hidden = true; return }
    list.innerHTML = historyOrders.map(function (order) {
      const items = Array.isArray(order.items) ? order.items : [], count = items.reduce(function (total, item) { return total + Math.max(0, Number(item.quantity) || 0) }, 0), itemCount = count + " " + (count === 1 ? "item" : "items");
      return '<button class="order-track-history-card" type="button" data-history-order="' + escapeTrackHtml(order.id) + '"><span class="order-track-history-head"><span><strong class="order-track-history-title">Order #' + escapeTrackHtml(order.id || "") + '</strong><span class="order-track-history-meta">' + escapeTrackHtml(formatTrackDate(order.created_at)) + ' · ' + escapeTrackHtml(itemCount) + '</span></span><span class="order-track-history-status ' + historyStatusClass(order) + '">' + escapeTrackHtml(statusLabel(order)) + '</span></span><span class="order-track-history-total"><span>Total</span><strong>' + escapeTrackHtml(trackMoney(order.total_amount)) + '</strong></span></button>';
    }).join("");
    if (more) { more.hidden = historyPage >= historyPages; more.disabled = historyLoading; more.textContent = historyLoading ? "Loading…" : "Load more" }
  }
  function renderHistoryDetail(order) {
    const list = $("orderTrackHistoryList"); if (!list) return;
    const itemMarkup = itemsMarkup(order);
    const rejection = order.payment_rejection_reason ? '<p class="order-track-rejection-reason"><strong>Rejection reason:</strong> ' + escapeTrackHtml(order.payment_rejection_reason) + '</p>' : "";
    const resubmit = String(order.payment_status || "") === "rejected" ? '<button class="order-track-menu-btn" type="button" data-reopen-rejected="' + escapeTrackHtml(order.id) + '">Review rejected payment</button>' : "";
    list.innerHTML = '<div class="order-track-history-detail"><button class="order-track-history-back" type="button" data-history-back>‹ Back to History</button><div class="order-track-detail-heading"><h3>Order #' + escapeTrackHtml(order.id || "") + '</h3><span class="order-track-history-status ' + historyStatusClass(order) + '">' + escapeTrackHtml(statusLabel(order)) + '</span></div><p class="order-track-history-meta">' + escapeTrackHtml(formatTrackDate(order.created_at)) + '</p><ul class="order-track-history-items">' + itemMarkup + '</ul><div class="order-track-history-total"><span>Total</span><strong>' + escapeTrackHtml(trackMoney(order.total_amount)) + '</strong></div><dl class="order-track-payment-details"><div><dt>Payment status</dt><dd>' + escapeTrackHtml(String(order.payment_status || "Unknown").replace(/_/g, " ")) + '</dd></div><div><dt>Payment method</dt><dd>' + escapeTrackHtml(String(order.payment_method || "Unknown").replace(/_/g, " ")) + '</dd></div></dl>' + rejection + resubmit + '</div>';
    $("orderTrackHistoryMore").hidden = true;
  }
  async function requestJson(url) {
    const response = await fetch(url, { cache: "no-store", credentials: "same-origin", headers: { Accept: "application/json" } });
    let data; try { data = await response.json() } catch (_) { throw new Error("The server returned an unreadable response. Check PHP errors and try again.") }
    if (response.status === 401) return { unauthorized: true, data: data }; if (!response.ok || !data.ok) throw new Error(data.message || "Unable to load your orders."); return { unauthorized: false, data: data };
  }
  function renderHistoryLogin() { const list = $("orderTrackHistoryList"); if (list) list.innerHTML = '<div class="order-track-account-state"><strong>Log in to track your order</strong><div class="order-track-account-actions"><a class="order-track-auth-btn login" href="login.html">Log In</a><a class="order-track-auth-btn signup" href="register.html">Sign Up</a></div></div>'; $("orderTrackHistoryMore").hidden = true }
  async function loadHistory(reset) {
    if (historyLoading) return; if (!reset && historyPage >= historyPages) return; historyLoading = true; const more = $("orderTrackHistoryMore");
    if (more) { more.disabled = true; more.hidden = false; more.textContent = "Loading…" }
    if (reset) { historyPage = 0; historyPages = 0; historyTotal = 0; historyOrders = []; $("orderTrackHistoryList").innerHTML = '<div class="order-track-account-state">Loading order history...</div>'; if (more) more.hidden = true }
    const requestedPage = reset ? 1 : historyPage + 1;
    try {
      const result = await requestJson("api/orders.php?history=1&page=" + requestedPage + "&limit=10");
      if (result.unauthorized) { renderHistoryLogin(); $("orderTrackNote").textContent = "Sign in to view completed, cancelled, and payment-rejected orders."; return }
      const data = result.data; historyPage = Number(data.page) || requestedPage; historyPages = Number(data.pages) || 0; historyTotal = Number(data.total) || 0;
      const incoming = Array.isArray(data.orders) ? data.orders : [];
      if (reset) historyOrders = incoming;
      else { const known = new Set(historyOrders.map(function (order) { return String(order.id) })); historyOrders = historyOrders.concat(incoming.filter(function (order) { return !known.has(String(order.id)) })); }
      renderHistoryList(); $("orderTrackNote").textContent = historyTotal ? "Showing " + historyOrders.length + " of " + historyTotal + " past orders." : "Your past orders will appear here.";
    } catch (error) {
      $("orderTrackHistoryList").innerHTML = '<div class="order-track-account-state"><strong>' + escapeTrackHtml(error.message || "Unable to load order history.") + '</strong><p>Please try again.</p><button class="order-track-history-back" type="button" data-history-retry>Try again</button></div>'; $("orderTrackNote").textContent = "Unable to load order history."; if (more) more.hidden = true;
    } finally { historyLoading = false; if (more) { more.disabled = false; if (historyPages > historyPage && historyOrders.length) { more.hidden = false; more.textContent = "Load more" } else more.hidden = true } }
  }
  async function refresh(code) {
    try {
      const result = await requestJson(code ? "api/orders.php?order=" + encodeURIComponent(code) : "api/orders.php?current=1");
      if (result.unauthorized) { renderMessage("Log in to track your order"); return }
      const order = result.data.order; renderMoreActive(code ? 0 : result.data.active_count); if (!order) { renderNoOrder(); return } window.currentTrackedOrder = order.order_code || code || ""; render(order);
    } catch (error) {
      hideTrackDetails();
      $("orderTrackBadge").textContent = "Unable to Load"; $("orderTrackCode").textContent = ""; $("orderTrackUpdated").textContent = "";
      $("orderTrackSteps").innerHTML = '<div class="order-track-account-state"><strong>' + escapeTrackHtml(error.message || "Unable to load your order.") + '</strong><p>Check your connection and try again.</p></div>'; $("orderTrackNote").textContent = "Please try again.";
    }
  }
  function setTrackTab(tab) {
    activeTrackTab = tab; const current = tab === "current";
    const currentTab = $("orderTrackCurrentTab"), historyTab = $("orderTrackHistoryTab"), currentPane = $("orderTrackCurrentPane"), historyPane = $("orderTrackHistoryPane");
    if (currentTab) { currentTab.classList.toggle("active", current); currentTab.setAttribute("aria-selected", current ? "true" : "false") }
    if (historyTab) { historyTab.classList.toggle("active", !current); historyTab.setAttribute("aria-selected", current ? "false" : "true") }
    if (currentPane) currentPane.hidden = !current; if (historyPane) historyPane.hidden = current; if (!current) stopTrackingPolling();
  }
  function startTracking(code) {
    stopTrackingPolling(); window.trackedOrderDeepLink = code || ""; window.currentTrackedOrder = code || ""; setTrackTab("current"); refresh(code || "");
    const modal = $("orderTrackModal"); if (modal && !modal.hidden) window.orderTrackTimer = window.setInterval(function () { if (modal.hidden || activeTrackTab !== "current") { stopTrackingPolling(); return } refresh(window.trackedOrderDeepLink || "") }, 5000);
  }
  function closeTracking() { const modal = $("orderTrackModal"); if (modal) modal.hidden = true; stopTrackingPolling() }
  function init() {
    inject(); const modal = $("orderTrackModal");
    $("orderTrackHistoryList").addEventListener("click", function (event) {
      const target = event.target;
      if (target.closest("[data-history-back]")) { renderHistoryList(); $("orderTrackNote").textContent = historyTotal ? "Showing " + historyOrders.length + " of " + historyTotal + " past orders." : "Your past orders will appear here."; return }
      if (target.closest("[data-history-retry]")) { loadHistory(true); return }
      const review = target.closest("[data-reopen-rejected]");
      if (review) { const order = historyOrders.find(function (item) { return String(item.id) === String(review.getAttribute("data-reopen-rejected")) }); if (order) { modal.hidden = false; setTrackTab("current"); startTracking(order.order_code || "") } return }
      const row = target.closest("[data-history-order]"); if (row) { const order = historyOrders.find(function (item) { return String(item.id) === String(row.getAttribute("data-history-order")) }); if (order) renderHistoryDetail(order) }
    });
    $("orderTrackHistoryMore").addEventListener("click", function () { loadHistory(false) });
    $("orderTrackClose").addEventListener("click", closeTracking); $("orderTrackLauncher").addEventListener("click", function () { modal.hidden = false; startTracking("") });
    $("orderTrackCurrentTab").addEventListener("click", function () { window.trackedOrderDeepLink = ""; startTracking("") });
    $("orderTrackHistoryTab").addEventListener("click", function () { setTrackTab("history"); loadHistory(true) });
    modal.addEventListener("click", function (event) { if (event.target === modal) closeTracking() });
    modal.addEventListener("submit", async function (event) {
      if (!event.target || event.target.id !== "resubmitPaymentForm") return; event.preventDefault();
      const form = event.target, button = form.querySelector('button[type="submit"]'); button.disabled = true; button.textContent = "Submitting…";
      try {
        const formData = new FormData(form); formData.append("action", "resubmit_payment"); formData.append("order_code", window.currentTrackedOrder || "");
        const response = await fetch("api/orders.php", { method: "POST", body: formData, credentials: "same-origin" }), data = await response.json();
        if (!response.ok || !data.ok) throw new Error(data.message || "Unable to resubmit payment proof.");
        form.outerHTML = '<div class="order-track-account-state"><strong>Payment proof submitted</strong><p>Your updated GCash payment is waiting for owner verification.</p></div>';
        $("orderTrackNote").textContent = "Payment submitted for verification."; window.trackedOrderDeepLink = ""; window.setTimeout(function () { refresh("") }, 800);
      } catch (error) { button.disabled = false; button.textContent = "Resubmit Payment Proof"; $("orderTrackNote").textContent = String(error.message || "Unable to resubmit payment proof.") }
    });
    document.addEventListener("keydown", function (event) { if (event.key === "Escape" && !modal.hidden) closeTracking() });
    const url = new URL(window.location.href), requestedOrder = url.searchParams.get("order"), requestedTrack = url.searchParams.get("track");
    if (requestedOrder || requestedTrack) { modal.hidden = false; if (requestedTrack === "history") { setTrackTab("history"); loadHistory(true) } else startTracking(requestedOrder ? requestedOrder.toUpperCase() : ""); url.searchParams.delete("track"); url.searchParams.delete("order"); window.history.replaceState({}, document.title, url.pathname + url.search + url.hash) }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();

/* ===== Cart item editing ===== */
(() => { const opt = { sweetness: [{ value: '100%', label: '100%' }, { value: '75%', label: '75%' }, { value: '50%', label: '50%' }, { value: '25%', label: '25%' }, { value: '0%', label: '0%' }], milk: [{ value: 'None', label: 'None' }, { value: 'Oat Milk', label: 'Oat Milk + ₱20' }], drizzle: [{ value: 'None', label: 'None' }, { value: 'Chocolate Drizzle', label: 'Chocolate Drizzle + ₱8' }, { value: 'Caramel Drizzle', label: 'Caramel Drizzle + ₱8' }], syrup: [{ value: 'None', label: 'None' }, { value: 'Flavored Syrup', label: 'Flavored Syrup + ₱10' }], sinker: [{ value: 'None', label: 'None' }, { value: 'Pearls', label: 'Pearls + ₱10' }, { value: 'Nata', label: 'Nata + ₱10' }, { value: 'Crushed Oreo', label: 'Crushed Oreo + ₱10' }, { value: 'Coffee Jelly', label: 'Coffee Jelly + ₱15' }], topping: [{ value: 'None', label: 'None' }, { value: 'Cream Cheese', label: 'Cream Cheese + ₱15' }, { value: 'Whipping Cream', label: 'Whipping Cream + ₱15' }, { value: 'Salty Cream', label: 'Salty Cream + ₱15' }, { value: 'Sea Salt Cream', label: 'Sea Salt Cream + ₱15' }, { value: 'Fresh Jam', label: 'Fresh Jam + ₱15' }], coffeeAddon: [{ value: 'None', label: 'None' }, { value: 'Espresso Shot', label: 'Espresso Shot + ₱15' }] }; let ei = -1, ec = []; const gf = v => `₱${Number(v).toLocaleString('en-PH', { minimumFractionDigits: 0 })}`; function grp(n, items, v) { return `<div class="option-group"><strong>${n === 'coffeeAddon' ? 'Coffee Add-on' : n[0].toUpperCase() + n.slice(1)}</strong><div class="option-grid">${items.map(x => `<label><input type="radio" name="${n}" value="${x.value}" ${x.value === v ? 'checked' : ''}><span>${x.label}</span></label>`).join('')}</div></div>` } function build() { if ($('indexCartEditModal')) return; const m = document.createElement('div'); m.id = 'indexCartEditModal'; m.className = 'index-edit-modal'; m.innerHTML = '<div class="modal-card"><div class="modal-head"><div><div class="eyebrow" style="color:var(--gold)">Edit cart item</div><h2 id="indexEditTitle">Edit Item</h2></div><button class="close" id="indexEditClose" type="button">×</button></div><form id="indexEditForm"><div id="indexEditOptions"></div><div class="field"><label for="indexEditQty">Quantity</label><input id="indexEditQty" type="number" min="1" max="99" value="1"></div><div class="summary"><div class="row total-row"><span>Item Total</span><strong id="indexEditTotal">₱0</strong></div></div><div class="index-edit-actions"><button class="btn" id="indexEditCancel" type="button">Cancel</button><button class="btn primary" type="submit">Update Item</button></div></form></div>'; document.body.appendChild(m); $('indexEditClose').onclick = close; $('indexEditCancel').onclick = close; $('indexEditForm').addEventListener('input', total); $('indexEditForm').addEventListener('change', total); $('indexEditForm').onsubmit = save; m.onclick = e => { if (e.target === m) close() } } function openEdit(i) { ec = cart.slice(); const item = ec[i], p = products.find(x => x.id === item?.id); if (!item || !p?.prices) return; ei = i; build(); const hot = p.category === 'Hot Beverages', sizes = []; if (p.prices.medium != null) sizes.push({ value: 'Medium', label: `Medium · ${gf(p.prices.medium)}` }); if (p.prices.large != null) sizes.push({ value: 'Large', label: `Large · ${gf(p.prices.large)}` }); let h = grp('temperature', hot ? [{ value: 'Hot', label: 'Hot' }] : [{ value: 'Iced', label: 'Iced' }], item.temperature || (hot ? 'Hot' : 'Iced')); if (p.prices.large != null && p.prices.medium != null) { const largeExtra = Number(p.prices.large) - Number(p.prices.medium); h += `<div class="option-group"><strong>Size</strong><div class="option-grid"><label><input type="checkbox" name="size" value="Large" ${item.size === 'Large' ? 'checked' : ''}><span>Large${largeExtra > 0 ? ' + ' + gf(largeExtra) : ''}</span></label></div></div>`; }; if (/Coffee|Milktea|Cream Cheese|Cheesecake/.test(p.category)) h += grp('sweetness', opt.sweetness, item.sweetness || '100%'); h += grp('milk', opt.milk, item.milk === 'Oat Milk' ? 'Oat Milk' : 'None') + grp('drizzle', opt.drizzle, item.drizzle || 'None') + grp('syrup', opt.syrup, item.syrup || 'None') + grp('sinker', opt.sinker, item.sinker || 'None') + grp('topping', opt.topping, item.topping || 'None'); if (p.category.includes('Coffee') || hot || p.category.includes('Salty Cream')) h += grp('coffeeAddon', opt.coffeeAddon, item.coffeeAddon || 'None'); $('indexEditTitle').textContent = item.name; $('indexEditOptions').innerHTML = h; $('indexEditQty').value = Math.max(1, Number(item.qty || 1)); total(); $('indexCartEditModal').classList.add('open') } function vals() { const f = $('indexEditForm'), v = n => f.querySelector(`input[name="${n}"]:checked`)?.value || 'None'; return { temperature: v('temperature'), size: v('size') === 'Large' ? 'Large' : 'Medium', sweetness: v('sweetness') === 'None' ? 'N/A' : v('sweetness'), milk: v('milk'), drizzle: v('drizzle'), syrup: v('syrup'), sinker: v('sinker'), topping: v('topping'), coffeeAddon: v('coffeeAddon'), qty: Math.max(1, Math.min(99, Number($('indexEditQty').value || 1))) } } function calc(p) { const v = vals(); let extra = 0; if (v.milk === 'Oat Milk') extra += 20; if (v.drizzle !== 'None') extra += 8; if (v.syrup !== 'None') extra += 10; if (['Pearls', 'Nata', 'Crushed Oreo'].includes(v.sinker)) extra += 10; if (v.sinker === 'Coffee Jelly') extra += 15; if (v.topping !== 'None') extra += 15; if (v.coffeeAddon === 'Espresso Shot') extra += 15; const base = selectedBasePrice(p, v.size); return { ...v, basePrice: base, extra, unitPrice: base + extra } } function total() { if (ei < 0) return; const item = ec[ei], p = products.find(x => x.id === item?.id); if (p) { const r = calc(p); $('indexEditTotal').textContent = gf(r.unitPrice * r.qty) } } function save(e) { e.preventDefault(); ec = cart.slice(); const item = ec[ei], p = products.find(x => x.id === item?.id); if (!item || !p) return; const r = calc(p), key = [item.id, r.temperature, r.size, r.sweetness, r.milk, r.drizzle, r.syrup, r.sinker, r.topping, r.coffeeAddon].join('|'), dup = ec.findIndex((x, i) => i !== ei && x.key === key); if (dup >= 0) { ec[dup].qty = Number(ec[dup].qty || 0) + r.qty; ec.splice(ei, 1) } else ec[ei] = { ...item, ...r, key }; cart = ec; saveCart(); renderCart(); toastMsg(`${item.name} updated`); close() } function close() { const m = $('indexCartEditModal'); if (m) m.classList.remove('open'); ei = -1 } function decorate() { const wrap = $('cartItems'); if (!wrap) return; wrap.querySelectorAll('.item').forEach((el, i) => { if (el.querySelector('[data-edit-cart]')) return; const d = el.querySelector('.item-main>div'); if (!d) return; const b = document.createElement('button'); b.type = 'button'; b.className = 'index-cart-edit-btn'; b.dataset.editCart = i; b.textContent = 'Edit'; b.onclick = () => openEdit(i); d.insertBefore(b, d.querySelector('.qty')) }) } function init() { build(); decorate(); const w = $('cartItems'); if (w) new MutationObserver(decorate).observe(w, { childList: true, subtree: true }) } if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init() })();

/* Shared notifications/profile UI and animation hook. */

/* SEVEN COFFEE & TEA — HEADER UI FIXES */
(function () {
  'use strict';

  const sevenProfile = { name: '', contact: '' };

  const MOBILE_BREAKPOINT = 767;

  function isMobile() {
    return window.matchMedia(`(max-width:${MOBILE_BREAKPOINT}px)`).matches;
  }

  function ensureModal(id, html) {
    let el = document.getElementById(id);
    if (!el) {
      document.body.insertAdjacentHTML('beforeend', html);
      el = document.getElementById(id);
    }
    return el;
  }

  function closePanels() {
    document.getElementById('sevenNotificationPanel')?.classList.remove('open');
    document.getElementById('sevenProfilePanel')?.classList.remove('open');
  }

  function setupHeaderPanels() {
    const notification = ensureModal('sevenNotificationPanel', `
      <div class="notification-panel" id="sevenNotificationPanel" aria-hidden="true">
        <div class="notification-card" role="dialog" aria-modal="true" aria-labelledby="sevenNotificationTitle">
          <div class="notification-head">
            <div>
              <strong id="sevenNotificationTitle">Notifications</strong>
              <div style="font-size:11px;color:var(--muted);margin-top:3px">SEVEN Coffee & Tea updates</div>
            </div>
            <button class="notification-close" type="button" data-seven-close="notification" aria-label="Close notifications">×</button>
          </div>
          <div class="notification-toolbar"><button class="notification-mark-all" id="sevenMarkAllRead" type="button">Mark all as read</button></div>
          <div class="notification-content" aria-live="polite">Log in to view your order notifications.</div>
        </div>
      </div>
    `);

    const notificationContent = notification.querySelector('.notification-content');
    const notificationButtons = Array.from(document.querySelectorAll('#globalNotificationBtn'));
    const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, ch => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    })[ch]);
    const setUnreadBadge = (count) => {
      notificationButtons.forEach((button) => {
        const n = Math.max(0, Number(count) || 0);
        button.classList.toggle('has-unread', n > 0);
        if (n > 0) button.dataset.unread = n > 99 ? '99+' : String(n);
        else delete button.dataset.unread;
        button.setAttribute('aria-label', n > 0 ? `Notifications, ${n} unread` : 'Open notifications');
      });
    };
    async function refreshNotifications() {
      if (!notificationContent) return;
      try {
        const response = await fetch('api/notifications.php', {
          method: 'GET', credentials: 'same-origin', cache: 'no-store',
          headers: { Accept: 'application/json' }
        });
        const data = await response.json();
        if (response.status === 401) {
          setUnreadBadge(0);
          notificationContent.innerHTML = '<div class="notification-empty"><strong>Log in to see your notifications.</strong><p>Your order updates will be saved to your customer account.</p><a href="login.html">Log In</a> <a href="register.html">Sign Up</a></div>';
          return;
        }
        if (!response.ok || !data.ok) throw new Error(data.message || 'Notifications are temporarily unavailable.');
        if (data.configured === false) {
          setUnreadBadge(0);
          notificationContent.innerHTML = '<div class="notification-empty"><strong>Notifications need database setup.</strong><p>Run the customer account and notifications migration in phpMyAdmin, then reload.</p></div>';
          return;
        }
        const list = Array.isArray(data.notifications) ? data.notifications : [];
        setUnreadBadge(data.unread_count || 0);
        if (!list.length) {
          notificationContent.innerHTML = '<div class="notification-empty"><strong>You\'re all caught up.</strong><p>Order submission, payment, and pickup updates will appear here.</p></div>';
          return;
        }
        notificationContent.innerHTML = list.map((item) => {
          const read = Number(item.is_read) === 1;
          const stamp = item.created_at ? new Date(String(item.created_at).replace(' ', 'T')).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';
          const order = item.order_code ? 'Order #' + item.order_code : '';
          return '<button type="button" class="notification-item ' + (read ? 'read' : 'unread') + '" data-notification-id="' + Number(item.id) + '">' +
            '<span class="notification-item-title">' + escapeHtml(item.title) + '</span>' +
            '<span class="notification-item-message">' + escapeHtml(item.message) + '</span>' +
            '<span class="notification-item-meta">' + escapeHtml(order) + ' ' + escapeHtml(stamp) + '</span></button>';
        }).join('');
      } catch (error) {
        notificationContent.innerHTML = '<div class="notification-empty"><strong>Unable to load notifications.</strong><p>' + escapeHtml(error.message || 'Please try again.') + '</p></div>';
      }
    }
    const markNotificationRead = async (id) => {
      try {
        await fetch('api/notifications.php', {
          method: 'PATCH', credentials: 'same-origin', cache: 'no-store',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ id: Number(id) })
        });
        await refreshNotifications();
      } catch (_) { }
    };
    document.getElementById('sevenMarkAllRead')?.addEventListener('click', async () => {
      try {
        const response = await fetch('api/notifications.php', {
          method: 'PATCH', credentials: 'same-origin', cache: 'no-store',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ action: 'mark_all_read' })
        });
        const data = await response.json();
        if (!response.ok || !data.ok) throw new Error(data.message || 'Unable to update notifications.');
        await refreshNotifications();
      } catch (error) {
        if (notificationContent) notificationContent.insertAdjacentHTML('afterbegin', '<p class="notification-error">' + escapeHtml(error.message) + '</p>');
      }
    });
    notificationContent?.addEventListener('click', (event) => {
      const item = event.target.closest('[data-notification-id]');
      if (item && item.classList.contains('unread')) markNotificationRead(item.dataset.notificationId);
    });
    if (!window.sevenNotificationRefreshTimer) {
      window.sevenNotificationRefreshTimer = window.setInterval(refreshNotifications, 15000);
    }

    const profile = ensureModal('sevenProfilePanel', `
      <div class="profile-modal-global" id="sevenProfilePanel" aria-hidden="true">
        <section class="profile-card-global" role="dialog" aria-modal="true" aria-labelledby="sevenProfileTitle">
          <div class="profile-head">
            <span></span>
            <button class="close-profile" type="button" data-seven-close="profile" aria-label="Close profile">×</button>
          </div>
          <div class="profile-big">7</div>
          <h2 id="sevenProfileTitle">Customer Profile</h2>
          <div class="profile-content"></div>
        </section>
      </div>
    `);

    if (!document.getElementById('sevenProfileAuthStyles')) {
      const style = document.createElement('style');
      style.id = 'sevenProfileAuthStyles';
      style.textContent = `
        .profile-actions{display:flex;gap:10px;margin-top:18px}
        .profile-auth-btn{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:0 18px;border:0;border-radius:10px;font:inherit;font-weight:700;text-decoration:none;cursor:pointer;box-sizing:border-box}
        .profile-auth-btn.login,.profile-auth-btn.logout{background:var(--green-dark,#082f2c);color:#fff}
        .profile-auth-btn.signup{background:var(--gold,#c9973c);color:#fff}
        .profile-auth-btn.profile{background:var(--gold,#c9973c);color:#fff}
        .profile-auth-btn:disabled{opacity:.65;cursor:not-allowed}
      `;
      document.head.appendChild(style);
    }

    const profileCard = profile.querySelector('.profile-card-global') || profile;
    profileCard.innerHTML = `
      <div class="profile-head">
        <span></span>
        <button class="close-profile" type="button" data-seven-close="profile" aria-label="Close profile">×</button>
      </div>
      <div class="profile-big">7</div>
      <h2 id="sevenProfileTitle">Customer Profile</h2>
      <div class="profile-content"></div>
    `;

    const content = profileCard.querySelector('.profile-content');
    const renderProfile = (customer) => {
      if (!content) return;

      if (customer) {
        const username = String(customer.username || 'Customer').replace(/[&<>"']/g, function (ch) {
          return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[ch];
        });

        content.innerHTML = `
          <p>You're logged in as <strong>${username}</strong>.</p>
          <div class="profile-actions">
            <a class="profile-auth-btn profile" href="profile.html">View Profile</a>
            <button class="profile-auth-btn logout" id="globalProfileLogout" type="button">Log Out</button>
          </div>
        `;

        document.getElementById('globalProfileLogout')?.addEventListener('click', async (event) => {
          const button = event.currentTarget;
          button.disabled = true;
          button.textContent = 'Logging Out...';

          try {
            const response = await fetch('api/customer_auth.php', {
              method: 'DELETE',
              credentials: 'same-origin',
              cache: 'no-store'
            });
            const data = await response.json();
            if (!response.ok || !data.ok) throw new Error(data.message || 'Unable to log out.');

            renderProfile(null);
            profile.classList.remove('open');
            profile.setAttribute('aria-hidden', 'true');
          } catch (error) {
            button.disabled = false;
            button.textContent = 'Log Out';
            window.alert(error.message || 'Unable to log out.');
          }
        });
        return;
      }

      content.innerHTML = `
        <p>Log in to your account or create a new customer account.</p>
        <div class="profile-actions">
          <a class="profile-auth-btn login" href="login.html">Log In</a>
          <a class="profile-auth-btn signup" href="register.html">Sign Up</a>
        </div>
      `;
    };

    const refreshProfile = async () => {
      try {
        const response = await fetch('api/customer_auth.php', {
          method: 'GET',
          credentials: 'same-origin',
          cache: 'no-store'
        });
        const data = await response.json();
        renderProfile(response.ok && data.ok ? data.customer : null);
      } catch (_) {
        renderProfile(null);
      }
    };

    const openNotification = () => {
      profile.classList.remove('open');
      profile.setAttribute('aria-hidden', 'true');
      notification.classList.add('open');
      notification.setAttribute('aria-hidden', 'false');
      refreshNotifications();
    };

    const openProfile = async () => {
      notification.classList.remove('open');
      notification.setAttribute('aria-hidden', 'true');
      profile.classList.add('open');
      profile.setAttribute('aria-hidden', 'false');
      await refreshProfile();
    };

    renderProfile(null);
    refreshNotifications();

    document.querySelectorAll('#globalNotificationBtn').forEach((button) => {
      if (button.dataset.sevenUiBound === 'notification') return;
      button.dataset.sevenUiBound = 'notification';
      button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopImmediatePropagation();
        openNotification();
      }, true);
    });

    document.querySelectorAll('#globalProfileBtn').forEach((button) => {
      if (button.dataset.sevenUiBound === 'profile') return;
      button.dataset.sevenUiBound = 'profile';
      button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopImmediatePropagation();
        openProfile();
      }, true);
    });

    if (notification.dataset.sevenUiPanelBound !== '1') {
      notification.dataset.sevenUiPanelBound = '1';
      notification.addEventListener('click', (event) => {
        if (event.target === notification || event.target.closest('[data-seven-close="notification"]')) {
          notification.classList.remove('open');
          notification.setAttribute('aria-hidden', 'true');
        }
      });
    }

    if (profile.dataset.sevenUiPanelBound !== '1') {
      profile.dataset.sevenUiPanelBound = '1';
      profile.addEventListener('click', (event) => {
        if (event.target === profile || event.target.closest('[data-seven-close="profile"]')) {
          profile.classList.remove('open');
          profile.setAttribute('aria-hidden', 'true');
        }
      });
    }

    const mobileProfileLinks = document.querySelectorAll('.mobile-profile-link');
    mobileProfileLinks.forEach((link) => {
      if (link.dataset.sevenUiBound === 'profile-link') return;
      link.dataset.sevenUiBound = 'profile-link';
      link.addEventListener('click', (event) => {
        event.preventDefault();
        if (!isMobile()) return;
        openProfile();
      });
    });
  }

  function setupSingleMobileNavToggle() {
    const header = document.querySelector('.site-header');
    if (!header) return;
    const nav = header.querySelector('.links');
    if (!nav) return;

    let toggles = Array.from(header.querySelectorAll('.mobile-nav-toggle'));
    if (!toggles.length) {
      const button = document.createElement('button');
      button.className = 'mobile-nav-toggle';
      button.type = 'button';
      button.textContent = '☰';
      button.setAttribute('aria-label', 'Open navigation');
      button.setAttribute('aria-expanded', 'false');
      if (!nav.id) nav.id = 'primaryNav';
      button.setAttribute('aria-controls', nav.id);
      header.querySelector('.brand')?.insertAdjacentElement('afterend', button);
      toggles = [button];
    }

    toggles.slice(1).forEach((button) => button.remove());
    const toggle = toggles[0];
    if (!toggle) return;

    if (!nav.querySelector('.mobile-profile-link')) {
      const profileLink = document.createElement('a');
      profileLink.href = '#customer-profile';
      profileLink.className = 'mobile-profile-link';
      profileLink.textContent = 'PROFILE';
      profileLink.setAttribute('aria-label', 'Open customer profile');
      nav.appendChild(profileLink);
    }

    if (toggle.dataset.sevenUiBound !== 'nav') {
      toggle.dataset.sevenUiBound = 'nav';
      toggle.addEventListener('click', (event) => {
        if (!isMobile()) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        const open = nav.classList.toggle('is-open');
        toggle.setAttribute('aria-expanded', String(open));
        toggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
      }, true);
    }

    if (nav.dataset.sevenUiBound !== '1') {
      nav.dataset.sevenUiBound = '1';
      nav.addEventListener('click', (event) => {
        if (event.target.closest('a')) {
          nav.classList.remove('is-open');
          toggle.setAttribute('aria-expanded', 'false');
          toggle.setAttribute('aria-label', 'Open navigation');
        }
      });
    }
  }

  function normalizeHeader() {
    setupSingleMobileNavToggle();
    setupHeaderPanels();
  }

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closePanels();
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', normalizeHeader, { once: true });
  } else {
    normalizeHeader();
  }
})();

/* SEVEN — motion bootstrap
   Deliberately avoids identical section-by-section reveal effects. */

(function () {
  'use strict';
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  window.sevenAnimations = {
    refresh: function () {
      /* Kept as a stable public hook for existing pages/extensions. */
    }
  };
})();
