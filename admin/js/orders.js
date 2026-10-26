/* Page logic extracted from admin/orders.html. */
const state = { orders: [], activeVerify: null, adminRole: "", hasLoadedInitialOrders: false, historyLoaded: false, historyPage: 1, historyPages: 1, historyTotal: 0, historyStoreTimezone: "Asia/Manila", historyStoreToday: "", historyStoreWeekStart: "", pendingHistoryPage: 1, alertsActivated: (() => { try { return localStorage.getItem('seven_admin_order_alerts_enabled') === '1' } catch (_) { return false } })(), newOrderIds: [], alertDismissTimer: null };
const money = v => '₱' + Number(v || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 });
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const fmtTimeMs = ms => { const total = Math.max(0, Math.floor(ms / 1000)); const m = String(Math.floor(total / 60)).padStart(2, '0'); const s = String(total % 60).padStart(2, '0'); const h = Math.floor(total / 3600); return h ? String(h).padStart(2, '0') + ':' + m + ':' + s : m + ':' + s };

// MySQL datetimes ("2026-10-23 10:00:00") need a "T" or Safari returns NaN.
const parseDbTime = v => Date.parse(String(v || '').replace(' ', 'T'));
const orderTime = o => { const t = parseDbTime(o.created_at); return Number.isFinite(t) ? t : Number(o.id || 0) };
// Wait-time urgency: under 5 min ok, 5-10 min warn, over 10 min late.
const urgency = ms => ms < 5 * 60000 ? 'ok' : ms < 10 * 60000 ? 'warn' : 'late';
const sortOldest = (a, b) => orderTime(a) - orderTime(b) || Number(a.id || 0) - Number(b.id || 0);
const clockSvg = '<svg class="clock-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 2"></path></svg>';

function customizationMods(value) {
  if (!value) return [];
  let d = value; if (typeof value === 'string') { try { d = JSON.parse(value) } catch (_) { return [] } } if (!d || typeof d !== 'object') return [];
  const order = [['size', 'Size'], ['temperature', 'Temp'], ['sweetness', 'Sweet'], ['milk', 'Milk'], ['drizzle', 'Drizzle'], ['syrup', 'Syrup'], ['sinker', 'Sinker'], ['topping', 'Top'], ['coffeeAddon', 'Coffee']];
  return order.filter(([k]) => d[k] !== null && d[k] !== '' && d[k] !== 'None' && d[k] !== 'N/A' && !(k === 'size' && d[k] === 'Medium')).map(([k, label]) => {
    let v = String(d[k]); if (k === 'coffeeAddon' && v === 'Espresso Shot') v = 'Espresso'; if (k === 'milk' && v === 'Oat Milk') v = 'Oat'; if (k === 'topping' && v === 'Whipping Cream') v = 'Whipping'; if (k === 'topping' && v === 'Sea Salt Cream') v = 'Sea Salt'; if (k === 'sinker' && v === 'Crushed Oreo') v = 'Oreo'; if (k === 'drizzle' && v.endsWith(' Drizzle')) v = v.replace(' Drizzle', ''); if (k === 'syrup' && v === 'Flavored Syrup') v = 'Flavored'; return label + ': ' + v;
  });
}
function shorthand(name) { const map = { 'Cafe Latte': 'Latte', 'Cafe Mocha': 'Mocha', 'Caramel Macchiato': 'Caramel Mac', 'Hazelnut Macchiato': 'Hazelnut Mac' }; return map[name] || name }
function queueFor(o) {
  if (o.payment_status === 'rejected' || o.order_status === 'completed' || o.order_status === 'cancelled') return null;
  if (o.payment_status !== 'verified' && o.payment_status !== 'paid') return 'verification';
  if (o.order_status === 'pending') return 'verification';
  if (o.order_status === 'confirmed') return 'prepare';
  if (o.order_status === 'in_preparation') return 'preparing';
  if (o.order_status === 'ready') return 'ready';
  return null;
}
function msg(text, error = false) { document.getElementById('message').innerHTML = text ? '<div class="' + (error ? 'error' : 'notice') + '">' + esc(text) + '</div>' : '' }
function renderSummary(g) {
  const counts = { verification: g.verification.length, prepare: g.prepare.length, preparing: g.preparing.length, ready: g.ready.length, rejected: state.orders.filter(o => o.payment_status === 'rejected').length };
  const ids = { verification: 'countVerification', prepare: 'countPrepare', preparing: 'countPreparing', ready: 'countReady', rejected: 'countRejected' };
  Object.keys(counts).forEach(k => document.getElementById(ids[k]).textContent = counts[k]);
  const qids = { verification: 'queueVerification', prepare: 'queuePrepare', preparing: 'queuePreparing', ready: 'queueReady' };
  Object.keys(qids).forEach(k => document.getElementById(qids[k]).textContent = counts[k]);
}
function empty(text) { return '<div class="queue-empty">' + esc(text || 'No orders in this queue.') + '</div>' }
function nextAction(q) { if (q === 'verification') return state.adminRole === 'owner' ? { label: 'Verify Payment', disabled: false, cls: 'verify' } : { label: 'Awaiting owner review', disabled: true, cls: 'secondary' }; if (q === 'prepare') return { label: 'Start Preparing', disabled: false, cls: '' }; if (q === 'preparing') return { label: 'Mark Ready', disabled: false, cls: 'ready' }; if (q === 'ready') return { label: 'Complete Order', disabled: false, cls: 'complete' }; return null }
function card(o, q) {
  const items = Array.isArray(o.items) ? o.items : []; const verified = o.payment_status === 'verified' || o.payment_status === 'paid'; const action = nextAction(q); const elapsed = Date.now() - orderTime(o); const pclass = verified ? 'verified' : 'unverified'; const level = urgency(elapsed);
  const itemHtml = items.length ? items.map(i => { const mods = customizationMods(i.customizations); return '<div class="item-row"><div class="item-main">' + esc(i.quantity) + 'x ' + esc(shorthand(i.product_name)) + '</div>' + (mods.length ? '<div class="item-mods">' + mods.map(m => '<div class="item-mod">' + esc(m) + '</div>').join('') + '</div>' : '') + '</div>' }).join('') : '<div class="queue-empty">No items listed.</div>';
  return '<article class="kds-card urgency-' + level + '" data-order-id="' + esc(o.id) + '"><header class="card-header"><div class="card-top"><div><div class="order-number">Order #' + esc(o.id || '—') + '</div><div class="customer-name">' + esc(o.customer_name || 'Guest Customer') + '</div></div><div class="elapsed urgency-' + level + '" data-created="' + esc(o.created_at || '') + '" title="Time since the order was placed">' + clockSvg + '<span>' + fmtTimeMs(elapsed) + '</span></div></div></header><div class="card-body"><div class="item-list">' + itemHtml + '</div><div class="card-toolbar"><div class="payment-line"><span class="payment-badge ' + pclass + '">GCash: ' + (verified ? 'Verified' : 'Not checked') + '</span><span class="payment-meta">Ref: <strong>' + esc(o.payment_reference || '—') + '</strong> <button class="proof-link" type="button" data-proof="' + o.id + '">View receipt ↗</button></span></div><button class="status-action ' + (action.cls || '') + '" type="button" ' + (action.disabled ? 'disabled' : '') + ' data-next="' + o.id + '">' + action.label + '</button></div></div></article>';
}
function render() {
  const g = { verification: [], prepare: [], preparing: [], ready: [] }; state.orders.forEach(o => { const q = queueFor(o); if (q) g[q].push(o) }); Object.values(g).forEach(a => a.sort(sortOldest)); renderSummary(g);
  const bodyIds = { verification: 'queueVerificationBody', prepare: 'queuePrepareBody', preparing: 'queuePreparingBody', ready: 'queueReadyBody' };
  Object.keys(bodyIds).forEach(q => document.getElementById(bodyIds[q]).innerHTML = g[q].length ? g[q].map(o => card(o, q)).join('') : empty());
  document.getElementById('lastUpdated').textContent = 'Updated ' + new Date().toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' });
}
async function loadAdminIdentity() {
  try {
    const r = await fetch('../api/admin_auth.php', { credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'application/json' } });
    const d = await r.json();
    if (r.ok && d.ok && d.admin) state.adminRole = String(d.admin.role || '');
  } catch (_) { }
}
function showNewOrderAlert(newOrders) {
  if (!Array.isArray(newOrders) || !newOrders.length) return;
  const newest = newOrders.slice().sort((a, b) => orderTime(b) - orderTime(a))[0];
  const alert = document.getElementById('newOrderAlert');
  document.getElementById('newOrderAlertTitle').textContent = newOrders.length === 1 ? 'New order received' : newOrders.length + ' new orders received';
  document.getElementById('newOrderAlertBody').textContent = newOrders.length === 1 ? 'Order #' + String(newest.id) + ' · ' + String(newest.customer_name || 'Guest Customer') : 'Orders ' + newOrders.map(o => '#' + String(o.id)).join(', ') + ' have arrived.';
  alert.hidden = false;
  state.newOrderIds = newOrders.map(o => String(o.id));
  if (state.alertDismissTimer) window.clearTimeout(state.alertDismissTimer);
  state.alertDismissTimer = window.setTimeout(function () { alert.hidden = true; state.alertDismissTimer = null }, 6500);
  // Desktop alerts and the bell now live in admin/js/notifications.js (shared by every admin page).
}
document.getElementById('dismissNewOrderAlert').addEventListener('click', function () { document.getElementById('newOrderAlert').hidden = true; if (state.alertDismissTimer) window.clearTimeout(state.alertDismissTimer); state.alertDismissTimer = null });
document.getElementById('openOrdersFromAlert').addEventListener('click', function () {
  document.getElementById('newOrderAlert').hidden = true; if (state.alertDismissTimer) window.clearTimeout(state.alertDismissTimer); state.alertDismissTimer = null;
  const first = state.newOrderIds[0];
  if (first) { const card = [...document.querySelectorAll('.kds-card')].find(el => el.textContent.includes('Order #' + first)); card?.scrollIntoView({ behavior: 'smooth', block: 'center' }) }
});
/* Bell links open orders.html?focus=<id>: highlight that order in the queues, or open it from history. */
let focusPending = (() => { const v = new URLSearchParams(location.search).get('focus'); return /^\d{1,12}$/.test(v || '') ? v : null })();
function focusRequestedOrder() {
  if (!focusPending) return;
  const id = focusPending; focusPending = null;
  const url = new URL(location.href); url.searchParams.delete('focus'); history.replaceState(null, '', url.pathname + url.search + url.hash);
  const card = document.querySelector('.kds-card[data-order-id="' + id + '"]');
  if (card) { showCurrent(); card.scrollIntoView({ behavior: 'smooth', block: 'center' }); card.classList.add('focus-flash'); setTimeout(() => card.classList.remove('focus-flash'), 2600); return }
  openHistoryDetail(id); // no longer in an active queue (completed, cancelled or rejected)
}
async function loadOrders() {
  msg('');
  try {
    const r = await fetch('../api/orders.php?admin_refresh=' + Date.now(), { credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'application/json' } });
    const d = await r.json();
    if (!r.ok || !d.ok) throw new Error(d.message || 'Unable to load orders.');
    const incoming = Array.isArray(d.orders) ? d.orders : [];
    if (state.hasLoadedInitialOrders) {
      const known = new Set(state.orders.map(o => String(o.id)));
      const arrived = incoming.filter(o => !known.has(String(o.id)));
      if (arrived.length) showNewOrderAlert(arrived);
    }
    state.orders = incoming;
    state.hasLoadedInitialOrders = true;
    render();
    focusRequestedOrder();
  } catch (e) { render(); msg(e.message || 'Unable to load orders.', true) }
}
async function patchOrder(id, payload, success) {
  try { const r = await fetch('../api/orders.php', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(Object.assign({ id: id }, payload)) }); const d = await r.json(); if (!r.ok || !d.ok) throw new Error(d.message || 'Update failed.'); msg(success || 'Order updated.'); await loadOrders(); return true } catch (e) { msg(e.message || 'Unable to update order.', true); return false }
}
/* Receipt viewer: wraps the proof <img> in a stage with zoom, rotate, pan and reset. */
function attachProofViewer(root) {
  const img = root.querySelector('img'); if (!img) return;
  const stage = document.createElement('div'); stage.className = 'proof-stage';
  img.replaceWith(stage); stage.appendChild(img); img.draggable = false;
  const tools = document.createElement('div'); tools.className = 'proof-tools'; tools.setAttribute('role', 'toolbar'); tools.setAttribute('aria-label', 'Receipt viewer controls');
  tools.innerHTML = '<button type="button" data-tool="out" aria-label="Zoom out">−</button><span class="proof-zoom" aria-live="polite">100%</span><button type="button" data-tool="in" aria-label="Zoom in">+</button><button type="button" data-tool="rotate" aria-label="Rotate 90 degrees">⟳</button><button type="button" data-tool="reset" aria-label="Reset view">Reset</button><a href="' + esc(img.getAttribute('src')) + '" target="_blank" rel="noopener" aria-label="Open receipt full size in a new tab">↗</a>';
  root.appendChild(tools);
  let zoom = 1, rot = 0, x = 0, y = 0, fit = 1, drag = null;
  const label = tools.querySelector('.proof-zoom');
  function computeFit() { if (rot % 180 === 0) { fit = 1; return } const w = img.offsetWidth, h = img.offsetHeight; fit = w && h ? Math.min(1, stage.clientWidth / h, stage.clientHeight / w) : 1 }
  function apply() { img.style.transform = 'translate(' + x + 'px,' + y + 'px) rotate(' + rot + 'deg) scale(' + (zoom * fit) + ')'; stage.classList.toggle('is-zoomed', zoom > 1); label.textContent = Math.round(zoom * 100) + '%'; tools.querySelector('[data-tool="out"]').disabled = zoom <= 1; tools.querySelector('[data-tool="in"]').disabled = zoom >= 5 }
  function setZoom(next) { zoom = Math.min(5, Math.max(1, next)); if (zoom === 1) { x = 0; y = 0 } apply() }
  tools.addEventListener('click', function (e) { const b = e.target.closest('[data-tool]'); if (!b) return; const t = b.dataset.tool; if (t === 'in') setZoom(zoom * 1.5); else if (t === 'out') setZoom(zoom / 1.5); else if (t === 'rotate') { rot = (rot + 90) % 360; x = 0; y = 0; computeFit(); apply() } else { zoom = 1; rot = 0; x = 0; y = 0; fit = 1; apply() } });
  stage.addEventListener('dblclick', function () { setZoom(zoom > 1 ? 1 : 2) });
  // Ctrl+wheel (and trackpad pinch) zooms; a plain wheel keeps scrolling the modal.
  stage.addEventListener('wheel', function (e) { if (!e.ctrlKey) return; e.preventDefault(); setZoom(zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15)) }, { passive: false });
  stage.addEventListener('pointerdown', function (e) { if (zoom <= 1) return; drag = { px: e.clientX, py: e.clientY, x: x, y: y }; stage.setPointerCapture(e.pointerId); stage.classList.add('is-dragging') });
  stage.addEventListener('pointermove', function (e) { if (!drag) return; x = drag.x + e.clientX - drag.px; y = drag.y + e.clientY - drag.py; apply() });
  ['pointerup', 'pointercancel'].forEach(function (ev) { stage.addEventListener(ev, function () { drag = null; stage.classList.remove('is-dragging') }) });
  apply();
}
function resetVerification() {
  state.activeVerify = null;
  document.getElementById('verifyBackdrop').hidden = true;
  document.getElementById('proofImage').innerHTML = '<div class="proof-placeholder">Payment proof will appear here.</div>';
}
function openVerification(order) {
  resetVerification();
  state.activeVerify = order;
  document.getElementById('verifyTitle').textContent = 'Payment Verification × Order #' + String(order.id || '—');
  document.getElementById('verifyCustomer').textContent = order.customer_name || 'Guest Customer';
  document.getElementById('verifyReference').textContent = order.payment_reference || '—';
  document.getElementById('verifyAmount').textContent = money(order.total_amount);
  const proof = document.getElementById('proofImage');
  const paymentPath = String(order.payment_screenshot || '').replace(/\\/g, '/');
  const validProofPath = /^uploads\/payments\/[A-Za-z0-9][A-Za-z0-9._-]*\.(?:jpe?g|png|webp)$/i.test(paymentPath) && !paymentPath.split('/').includes('..');
  if (validProofPath) {
    const proofUrl = '../' + paymentPath.split('/').map(encodeURIComponent).join('/');
    proof.innerHTML = '<img src="' + proofUrl + '" alt="GCash payment proof for order #' + Number(order.id || 0) + '">';
    const image = proof.querySelector('img');
    image.addEventListener('error', function () { proof.innerHTML = '<div class="proof-placeholder">The saved payment proof could not be loaded. Ask the customer to upload the receipt again.</div>' }, { once: true });
    attachProofViewer(proof);
  } else {
    proof.innerHTML = '<div class="proof-placeholder">No valid payment proof file is attached to this order. Ask the customer to upload the GCash receipt again.</div>';
  }
  document.getElementById('confirmPayment').disabled = state.adminRole !== 'owner';
  document.getElementById('rejectPayment').disabled = state.adminRole !== 'owner';
  document.getElementById('verifyBackdrop').hidden = false;
}
async function handleNext(id) {
  const o = state.orders.find(x => Number(x.id) === Number(id)); if (!o) return; const q = queueFor(o); if (q === 'verification') openVerification(o); else if (q === 'prepare') await patchOrder(id, { order_status: 'in_preparation' }, 'Order moved to Preparing.'); else if (q === 'preparing') await patchOrder(id, { order_status: 'ready' }, 'Order marked Ready for Pick-Up.'); else if (q === 'ready') await patchOrder(id, { order_status: 'completed' }, 'Order completed.');
}
document.getElementById('queues').addEventListener('click', function (e) {
  const proof = e.target.closest('[data-proof]'); if (proof) { const o = state.orders.find(x => Number(x.id) === Number(proof.dataset.proof)); if (o) openVerification(o); return }
  const next = e.target.closest('[data-next]'); if (next && !next.disabled) handleNext(next.dataset.next);
});
document.getElementById('confirmPayment').addEventListener('click', async function () {
  const o = state.activeVerify;
  if (!o) return;
  if (state.adminRole !== 'owner') { msg('Only the owner can verify GCash payments.', true); return }
  if (!window.confirm('Confirm this payment and accept the order?')) return;
  const ok = await patchOrder(o.id, { payment_status: 'verified', order_status: 'confirmed' }, 'Payment verified. The order is now accepted and ready to prepare.');
  if (ok) resetVerification();
});
document.getElementById('rejectPayment').addEventListener('click', async function () {
  const o = state.activeVerify;
  if (!o) return;
  if (state.adminRole !== 'owner') { msg('Only the owner can reject GCash payments.', true); return }
  const reason = window.prompt('Why is this payment being rejected?');
  if (reason === null) return;
  const trimmed = reason.trim();
  if (!trimmed) { msg('A rejection reason is required.', true); return }
  const ok = await patchOrder(o.id, { payment_status: 'rejected', rejection_reason: trimmed }, 'Payment rejected. The customer will see the rejection reason in order tracking.');
  if (ok) resetVerification();
});
document.getElementById('verifyClose').addEventListener('click', resetVerification);
document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !document.getElementById('verifyBackdrop').hidden) resetVerification() });
document.getElementById('verifyBackdrop').addEventListener('click', function (e) { if (e.target.id === 'verifyBackdrop') resetVerification() });

/* Admin read-only order history */
const hist = { view: document.getElementById('orderHistoryView'), current: document.getElementById('currentOrdersView'), currentTab: document.getElementById('currentOrdersTab'), historyTab: document.getElementById('orderHistoryTab'), body: document.getElementById('historyTableBody'), mobile: document.getElementById('historyMobileList'), prev: document.getElementById('historyPrev'), next: document.getElementById('historyNext') };
function historyDate(v) { if (!v) return '—'; const d = new Date(String(v).replace(' ', 'T')); return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' }) }
function historyStatus(o) { return o.payment_status === 'rejected' ? 'Payment rejected' : ({ 'completed': 'Completed', 'cancelled': 'Cancelled' })[o.order_status] || String(o.order_status || '').replace(/_/g, ' ') }
function historyPill(o) { const c = o.payment_status === 'rejected' ? 'payment-rejected' : o.order_status === 'cancelled' ? 'cancelled' : 'completed'; return '<span class="history-status-pill ' + c + '">' + esc(historyStatus(o)) + '</span>' }
function renderHistory(rows) {
  hist.body.innerHTML = rows.length ? rows.map(o => '<tr data-history-id="' + esc(o.id) + '"><td><button class="history-order-link" type="button" data-history-id="' + esc(o.id) + '">Order #' + esc(o.id) + '</button></td><td>' + esc(historyDate(o.created_at)) + '</td><td class="history-customer"><strong>' + esc(o.customer_name || '—') + '</strong><br>' + esc(o.contact_number || '—') + '</td><td class="history-items-summary">' + (o.items || []).map(i => esc(i.quantity) + ' × ' + esc(i.product_name || 'Item')).join('<br>') + '</td><td>' + esc(money(o.total_amount)) + '</td><td>' + esc(String(o.payment_status || '—').replace(/_/g, ' ')) + '</td><td>' + historyPill(o) + '</td><td>' + esc(historyDate(o.updated_at)) + '</td></tr>').join('') : '<tr><td colspan="8">No orders match these filters.</td></tr>';
  hist.mobile.innerHTML = rows.length ? rows.map(o => '<button class="history-mobile-card" type="button" data-history-id="' + esc(o.id) + '"><span class="history-mobile-top"><strong>Order #' + esc(o.id) + '</strong>' + historyPill(o) + '</span><span class="history-mobile-meta">' + esc(historyDate(o.created_at)) + '<br>' + esc(o.customer_name || '—') + ' · ' + esc(o.contact_number || '—') + '<br>' + esc((o.items || []).reduce((n, i) => n + Number(i.quantity || 0), 0) + ' items') + ' · ' + esc(money(o.total_amount)) + '<br>Payment: ' + esc(String(o.payment_status || '—').replace(/_/g, ' ')) + ' · Updated ' + esc(historyDate(o.updated_at)) + '</span></button>').join('') : '<div class="queue-empty">No orders match these filters.</div>';
}
function historyUrl(page) {
  const p = new URLSearchParams({ admin_history: '1', page: String(page), limit: '20', q: document.getElementById('historySearch').value.trim(), status: document.getElementById('historyStatus').value, from: document.getElementById('historyFrom').value, to: document.getElementById('historyTo').value });
  return '../api/orders.php?' + p.toString();
}
function syncHistoryUrl(openHistory = true, page = 1) {
  const url = new URL(window.location.href);
  ['history', 'q', 'status', 'from', 'to', 'page'].forEach(key => url.searchParams.delete(key));
  const query = document.getElementById('historySearch').value.trim();
  const status = document.getElementById('historyStatus').value;
  const from = document.getElementById('historyFrom').value;
  const to = document.getElementById('historyTo').value;
  if (openHistory) url.searchParams.set('history', '1');
  if (query) url.searchParams.set('q', query);
  if (status && status !== 'all') url.searchParams.set('status', status);
  if (from) url.searchParams.set('from', from);
  if (to) url.searchParams.set('to', to);
  if (openHistory && Number(page) > 1) url.searchParams.set('page', String(Number(page)));
  url.hash = openHistory ? 'history' : '';
  window.history.replaceState(null, '', url.pathname + (url.search ? '?' + url.searchParams.toString() : '') + url.hash);
}
function initializeHistoryFiltersFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const query = params.get('q');
  const status = params.get('status');
  const from = params.get('from');
  const to = params.get('to');
  if (query !== null) document.getElementById('historySearch').value = query.slice(0, 120);
  if (['all', 'completed', 'cancelled', 'payment_rejected', 'counted_as_sales'].includes(status || '')) document.getElementById('historyStatus').value = status;
  if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) document.getElementById('historyFrom').value = from;
  if (to && /^\d{4}-\d{2}-\d{2}$/.test(to)) document.getElementById('historyTo').value = to;
  const rawPage = Number(params.get('page') || 1);
  state.pendingHistoryPage = Number.isInteger(rawPage) && rawPage > 0 ? Math.min(rawPage, 1000000) : 1;
  return window.location.hash === '#history' || params.get('history') === '1';
}
function currentStoreDate() {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: state.historyStoreTimezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
    const part = key => parts.find(item => item.type === key)?.value || '';
    return part('year') + '-' + part('month') + '-' + part('day');
  } catch (_) { return state.historyStoreToday || new Date().toISOString().slice(0, 10) }
}
function weekStartForDate(iso) {
  const date = new Date(iso + 'T00:00:00Z');
  if (Number.isNaN(date.getTime())) return iso;
  const weekday = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - weekday + 1);
  return date.toISOString().slice(0, 10);
}
function syncHistoryDateChips() {
  const today = state.historyStoreToday || currentStoreDate();
  const weekStart = state.historyStoreWeekStart || weekStartForDate(today);
  const from = document.getElementById('historyFrom').value;
  const to = document.getElementById('historyTo').value;
  const ranges = { today: today, week: weekStart, month: today.slice(0, 8) + '01' };
  document.querySelectorAll('[data-date-filter]').forEach(button => {
    const active = from === ranges[button.dataset.dateFilter] && to === today;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  syncStatusPills();
}
function syncStatusPills() {
  const value = document.getElementById('historyStatus').value;
  document.querySelectorAll('[data-status-pill]').forEach(b => { const on = b.dataset.statusPill === value; b.classList.toggle('active', on); b.setAttribute('aria-pressed', String(on)) });
}
async function loadHistory(page = 1, updateUrl = true) {
  if (updateUrl) syncHistoryUrl(true, page);
  hist.body.innerHTML = '<tr><td colspan="8">Loading…</td></tr>';
  hist.mobile.innerHTML = '<div class="queue-empty">Loading…</div>';
  const seq = state.historySeq = (state.historySeq || 0) + 1;
  try {
    const r = await fetch(historyUrl(page), { credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'application/json' } });
    const d = await r.json();
    if (seq !== state.historySeq) return; // a newer request superseded this one
    if (!r.ok || !d.ok) throw new Error(d.message || 'Unable to load order history.');
    state.historyLoaded = true;
    state.historyPage = Number(d.page) || 1;
    state.historyPages = Math.max(1, Number(d.pages) || 1);
    state.historyTotal = Number(d.total) || 0;
    state.historyStoreTimezone = String(d.timezone || state.historyStoreTimezone || 'Asia/Manila');
    state.historyStoreToday = String(d.store_today || state.historyStoreToday || '');
    state.historyStoreWeekStart = String(d.store_week_start || state.historyStoreWeekStart || '');
    renderHistory(Array.isArray(d.orders) ? d.orders : []);
    document.getElementById('historySummaryCount').textContent = String(d.summary?.count ?? state.historyTotal);
    document.getElementById('historySummarySales').textContent = money(d.summary?.sales || 0);
    document.getElementById('historyResultCount').textContent = state.historyTotal + ' matching orders';
    document.getElementById('historyPageLabel').textContent = 'Page ' + state.historyPage + ' of ' + state.historyPages;
    hist.prev.disabled = state.historyPage <= 1;
    hist.next.disabled = state.historyPage >= state.historyPages;
    syncHistoryDateChips();
  } catch (e) {
    if (seq !== state.historySeq) return;
    const m = esc(e.message || 'Unable to load order history.');
    hist.body.innerHTML = '<tr><td colspan="8">' + m + '</td></tr>';
    hist.mobile.innerHTML = '<div class="error">' + m + '</div>';
  }
}
async function exportHistoryCsv() {
  const button = document.getElementById('exportHistoryCsv');
  const original = button.textContent;
  button.disabled = true; button.textContent = 'Exporting…';
  syncHistoryUrl(true, state.historyPage);
  try {
    if (!window.SEVEN_CSV || typeof window.SEVEN_CSV.download !== 'function') throw new Error('The CSV helper is unavailable. Refresh this page and try again.');
    const params = new URLSearchParams({
      admin_history_export: '1',
      q: document.getElementById('historySearch').value.trim(),
      status: document.getElementById('historyStatus').value,
      from: document.getElementById('historyFrom').value,
      to: document.getElementById('historyTo').value
    });
    const response = await fetch('../api/orders.php?' + params.toString(), { credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'application/json' } });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.message || 'Unable to export Order History.');
    const orders = Array.isArray(data.orders) ? data.orders : [];
    const headers = ['Order ID', 'Order Code', 'Date / time placed', 'Customer', 'Contact', 'Items', 'Total', 'Payment method', 'Payment status', 'Order status', 'Last updated'];
    const rows = orders.map(function (order) {
      const items = (Array.isArray(order.items) ? order.items : []).map(function (item) {
        return String(item.quantity || 0) + ' × ' + window.SEVEN_CSV.protectText(String(item.product_name || 'Item'));
      }).join('; ');
      return [String(order.id || ''), String(order.order_code || ''), String(order.created_at || ''), String(order.customer_name || ''), String(order.contact_number || ''), items, money(order.total_amount), String(order.payment_method || '').replace(/_/g, ' '), String(order.payment_status || '').replace(/_/g, ' '), String(order.order_status || '').replace(/_/g, ' '), String(order.updated_at || '')];
    });
    window.SEVEN_CSV.download('seven-order-history-export.csv', headers, rows);
    const message = data.truncated
      ? 'Exported the latest 5,000 of ' + Number(data.total || 0).toLocaleString('en-PH') + ' matching orders. Narrow the filters to export fewer rows.'
      : 'Exported ' + orders.length.toLocaleString('en-PH') + ' matching orders.';
    msg(message);
  } catch (error) {
    msg(error.message || 'Unable to export Order History.', true);
  } finally {
    button.disabled = false; button.textContent = original;
  }
}
document.getElementById('exportHistoryCsv').addEventListener('click', exportHistoryCsv);
// Sidebar highlight follows the view: "Orders" for current orders, the "Order History"
// sub-link for history — the same treatment Sales Reports gets on its own page.
function syncNavActive(historyView) {
  const ordersLink = document.querySelector('.nav a[href="orders.html"]');
  const historyLink = document.querySelector('.nav a.nav-sub-link[href="orders.html#history"]');
  [[ordersLink, !historyView], [historyLink, historyView]].forEach(([link, on]) => {
    if (!link) return;
    link.classList.toggle('active', on);
    if (on) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
  });
}
function showHistory() {
  syncNavActive(true);
  hist.current.hidden = true; hist.view.hidden = false;
  hist.currentTab.classList.remove('active'); hist.currentTab.setAttribute('aria-selected', 'false');
  hist.historyTab.classList.add('active'); hist.historyTab.setAttribute('aria-selected', 'true');
  if (!state.historyLoaded) loadHistory(state.pendingHistoryPage || 1);
}
function showCurrent() {
  syncNavActive(false);
  hist.view.hidden = true; hist.current.hidden = false;
  hist.historyTab.classList.remove('active'); hist.historyTab.setAttribute('aria-selected', 'false');
  hist.currentTab.classList.add('active'); hist.currentTab.setAttribute('aria-selected', 'true');
}
initializeHistoryFiltersFromUrl();
hist.currentTab.addEventListener('click', e => { e.preventDefault(); showCurrent(); syncHistoryUrl(false, 1) });
hist.historyTab.addEventListener('click', e => { e.preventDefault(); showHistory(); syncHistoryUrl(true, state.historyPage || state.pendingHistoryPage || 1) });
document.getElementById('historyFilters').addEventListener('submit', e => { e.preventDefault(); document.querySelectorAll('[data-date-filter]').forEach(b => b.classList.remove('active')); syncHistoryUrl(true, 1); loadHistory(1, false) });
document.getElementById('historyClear').addEventListener('click', () => {
  document.getElementById('historyFilters').reset();
  document.querySelectorAll('[data-date-filter]').forEach(b => b.classList.remove('active'));
  syncHistoryUrl(true, 1);
  loadHistory(1, false);
});
hist.prev.addEventListener('click', () => { if (state.historyPage > 1) loadHistory(state.historyPage - 1) });
hist.next.addEventListener('click', () => { if (state.historyPage < state.historyPages) loadHistory(state.historyPage + 1) });
document.querySelectorAll('[data-date-filter]').forEach(button => button.addEventListener('click', () => {
  const today = state.historyStoreToday || currentStoreDate();
  const weekStart = state.historyStoreWeekStart || weekStartForDate(today);
  const starts = { today: today, week: weekStart, month: today.slice(0, 8) + '01' };
  document.getElementById('historyFrom').value = starts[button.dataset.dateFilter] || today;
  document.getElementById('historyTo').value = today;
  syncHistoryDateChips();
  syncHistoryUrl(true, 1);
  loadHistory(1, false);
}));
document.querySelectorAll('[data-status-pill]').forEach(button => button.addEventListener('click', () => {
  document.getElementById('historyStatus').value = button.dataset.statusPill;
  syncStatusPills();
  syncHistoryUrl(true, 1);
  loadHistory(1, false);
}));
document.getElementById('historyStatus').addEventListener('change', syncStatusPills);
// Search as you type (debounced) instead of waiting for "Apply filters".
let historySearchTimer = null;
document.getElementById('historySearch').addEventListener('input', () => {
  clearTimeout(historySearchTimer);
  historySearchTimer = setTimeout(() => { syncHistoryUrl(true, 1); loadHistory(1, false) }, 400);
});
syncStatusPills();
const hBackdrop = document.getElementById('historyDetailBackdrop');
function closeHistoryDetail() { hBackdrop.hidden = true; document.getElementById('historyProofImage').innerHTML = '<div class="proof-placeholder">Payment proof will appear here.</div>' }
function historyProof(path, id) { const root = document.getElementById('historyProofImage'), p = String(path || '').replace(/\\/g, '/'); if (!/^uploads\/payments\/[A-Za-z0-9][A-Za-z0-9._-]*\.(?:jpe?g|png|webp)$/i.test(p) || p.split('/').includes('..')) { root.innerHTML = '<div class="proof-placeholder">No valid payment proof file is attached to this order.</div>'; return } root.innerHTML = '<img src="../' + p.split('/').map(encodeURIComponent).join('/') + '" alt="GCash payment proof for order #' + Number(id || 0) + '">'; root.querySelector('img').addEventListener('error', () => { root.innerHTML = '<div class="proof-placeholder">The saved payment proof could not be loaded.</div>' }, { once: true }); attachProofViewer(root) }
async function openHistoryDetail(id) {
  try {
    const r = await fetch('../api/orders.php?admin_history_detail=' + encodeURIComponent(id), { credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'application/json' } }); const d = await r.json(); if (!r.ok || !d.ok) throw new Error(d.message || 'Unable to load this order.'); const o = d.order, items = Array.isArray(o.items) ? o.items : [];
    document.getElementById('historyDetailTitle').textContent = 'Order #' + o.id; document.getElementById('historyDetailMeta').innerHTML = '<div><span>Placed</span><strong>' + esc(historyDate(o.created_at)) + '</strong></div><div><span>Customer</span><strong>' + esc(o.customer_name || '—') + ' · ' + esc(o.contact_number || '—') + '</strong></div><div><span>Last updated</span><strong>' + esc(historyDate(o.updated_at)) + '</strong></div>';
    document.getElementById('historyDetailItems').innerHTML = items.length ? items.map(i => '<article class="history-detail-item"><div class="history-detail-item-head"><strong>' + esc(i.quantity) + ' × ' + esc(i.product_name || 'Item') + '</strong><strong>' + esc(money(i.subtotal)) + '</strong></div><p>' + esc(customizationMods(i.customizations).join(' · ') || 'No customizations') + '</p></article>').join('') : '<div class="queue-empty">No item details.</div>';
    const details = [['Pickup', o.pickup_time || '—'], ['Notes', o.notes || '—'], ['Payment method', String(o.payment_method || '—').replace(/_/g, ' ')], ['Payment status', String(o.payment_status || '—').replace(/_/g, ' ')], ['Payment reference', o.payment_reference || '—'], ['Order status', String(o.order_status || '—').replace(/_/g, ' ')], ['Total', money(o.total_amount)], ['Rejection reason', o.rejection_reason || '—']]; document.getElementById('historyDetailFields').innerHTML = details.map(([k, v]) => '<div><dt>' + esc(k) + '</dt><dd>' + esc(v) + '</dd></div>').join('');
    const logs = Array.isArray(d.payment_logs) ? d.payment_logs : []; document.getElementById('historyPaymentLogs').innerHTML = logs.length ? logs.map(l => '<div class="history-payment-log"><strong>' + esc(String(l.action || 'Payment event').replace(/_/g, ' ')) + '</strong><div>' + esc(l.remarks || 'No remarks') + '</div><time>' + esc(historyDate(l.created_at)) + '</time></div>').join('') : '<div class="queue-empty">No payment log entries.</div>'; historyProof(o.payment_screenshot, o.id); hBackdrop.hidden = false;
  } catch (e) { msg(e.message || 'Unable to load order details.', true) }
}
hist.body.addEventListener('click', e => { const x = e.target.closest('[data-history-id]'); if (x) openHistoryDetail(x.dataset.historyId) }); hist.mobile.addEventListener('click', e => { const x = e.target.closest('[data-history-id]'); if (x) openHistoryDetail(x.dataset.historyId) }); document.getElementById('historyDetailClose').addEventListener('click', closeHistoryDetail); hBackdrop.addEventListener('click', e => { if (e.target === hBackdrop) closeHistoryDetail() }); document.addEventListener('keydown', e => { if (e.key === 'Escape') closeHistoryDetail() });
if (location.hash === '#history' || new URLSearchParams(location.search).get('history') === '1') showHistory(); else showCurrent();
// Clicking the sidebar "Order History" link while already on this page only changes the hash.
window.addEventListener('hashchange', () => { if (location.hash === '#history') { showHistory(); syncHistoryUrl(true, state.historyPage || 1) } else showCurrent() });
const sidebar = document.getElementById('sidebar');
const navBackdrop = document.getElementById('sidebarBackdrop'), app = document.querySelector('.app');
const mobileMenu = document.getElementById('mobileMenu');
function syncNavigationButton() { const mobile = window.innerWidth <= 760; const expanded = mobile ? sidebar.classList.contains('open') : !app.classList.contains('sidebar-hidden'); const label = mobile ? (expanded ? 'Close navigation menu' : 'Open navigation menu') : (expanded ? 'Collapse navigation' : 'Expand navigation'); mobileMenu.setAttribute('aria-expanded', String(expanded)); mobileMenu.setAttribute('aria-label', label); mobileMenu.title = label }
function setDrawerOpen(open) { sidebar.classList.toggle('open', open); navBackdrop.hidden = !open; syncNavigationButton() }
function toggleDesktopSidebar() { app.classList.toggle('sidebar-hidden'); localStorage.setItem('seven_admin_sidebar_hidden', app.classList.contains('sidebar-hidden') ? '1' : '0'); syncNavigationButton() }
mobileMenu.addEventListener('click', function () { if (window.innerWidth <= 760) setDrawerOpen(!sidebar.classList.contains('open')); else toggleDesktopSidebar() });
navBackdrop.addEventListener('click', function () { setDrawerOpen(false) });
function closeSidebar() { if (window.innerWidth <= 760) setDrawerOpen(false); else sidebar.classList.remove('open') }
document.addEventListener('keydown', function (event) { if (event.key === 'Escape' && window.innerWidth <= 760 && sidebar.classList.contains('open')) setDrawerOpen(false) });
window.addEventListener('resize', function () { if (window.innerWidth > 760) setDrawerOpen(false); syncNavigationButton() });
syncNavigationButton();
document.querySelectorAll('.nav a').forEach(function (link) { link.addEventListener('click', function () { if (window.innerWidth <= 760) closeSidebar() }) });
if (localStorage.getItem('seven_admin_sidebar_hidden') === '1' && window.innerWidth > 760) document.querySelector('.app').classList.add('sidebar-hidden');
syncNavigationButton();
loadAdminIdentity().then(loadOrders); setInterval(loadOrders, 5000); setInterval(function () { document.querySelectorAll('.elapsed[data-created]').forEach(function (el) { const t = parseDbTime(el.dataset.created); if (!Number.isFinite(t)) return; const ms = Date.now() - t, level = urgency(ms); el.querySelector('span').textContent = fmtTimeMs(ms); if (!el.classList.contains('urgency-' + level)) { ['ok', 'warn', 'late'].forEach(function (l) { el.classList.toggle('urgency-' + l, l === level); el.closest('.kds-card')?.classList.toggle('urgency-' + l, l === level) }) } }) }, 1000);
