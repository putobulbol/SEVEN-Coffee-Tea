/* My Orders page (orders.html): all of the customer's orders, by status, 10 per page.
   Uses GET api/orders.php?all_orders=1 and the existing resubmit_payment POST. */
(function () {
  'use strict';

  const API = 'api/orders.php';
  const PAGE_SIZE = 10;
  const REFRESH_MS = 25000;
  const STATUSES = ['all', 'active', 'completed', 'cancelled', 'rejected'];
  const MAX_PROOF_BYTES = 5 * 1024 * 1024;
  const PROOF_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

  const el = (id) => document.getElementById(id);
  const list = el('ordersList');
  const more = el('ordersMore');
  const statusLine = el('ordersStatusLine');
  const listView = el('ordersListView');
  const detailView = el('ordersDetailView');
  if (!list || !detailView) return;

  const state = { status: 'all', page: 0, pages: 0, total: 0, orders: [], counts: null, loading: false, detailId: null, loggedOut: false, seq: 0 };

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
  }
  function money(value) {
    const n = Number(value || 0);
    return '₱' + (Number.isFinite(n) ? n : 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function formatDate(value) {
    if (!value) return 'Date unavailable';
    const d = new Date(String(value).replace(' ', 'T'));
    return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
  }

  /* One label + tone per order, matching how the API's status filters partition orders. */
  function describe(order) {
    const s = String(order.order_status || '').toLowerCase();
    const pay = String(order.payment_status || '').toLowerCase();
    if (s === 'cancelled') return { label: 'Cancelled', tone: 'cancelled', active: false };
    if (pay === 'rejected') return { label: 'Payment rejected', tone: 'rejected', active: false };
    if (s === 'completed') return { label: 'Completed', tone: 'completed', active: false };
    if (s === 'ready') return { label: 'Ready for pick-up', tone: 'ready', active: true };
    if (s === 'in_preparation') return { label: 'Preparing', tone: 'active', active: true };
    if (s === 'confirmed') return { label: 'Payment verified', tone: 'active', active: true };
    return { label: pay === 'submitted' ? 'Checking payment' : 'Awaiting payment', tone: 'active', active: true };
  }
  function itemCount(order) {
    return (Array.isArray(order.items) ? order.items : []).reduce((n, i) => n + Math.max(0, Number(i.quantity) || 0), 0);
  }
  function customizations(value) {
    let parsed = value;
    if (typeof value === 'string') { try { parsed = JSON.parse(value); } catch (_) { parsed = value; } }
    if (!parsed) return '';
    if (typeof parsed !== 'object') return '<span class="orders-mod">' + esc(parsed) + '</span>';
    return Object.keys(parsed)
      .filter((k) => { const v = String(parsed[k] == null ? '' : parsed[k]).trim(); return v && !['none', 'n/a'].includes(v.toLowerCase()) && !(k === 'size' && v === 'Medium'); })
      .map((k) => '<span class="orders-mod">' + esc(k.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())) + ': ' + esc(parsed[k]) + '</span>')
      .join('');
  }

  function setStatusLine(text) { statusLine.textContent = text || ''; }

  function renderTabs() {
    document.querySelectorAll('.orders-tab').forEach((tab) => {
      const on = tab.dataset.status === state.status;
      tab.classList.toggle('active', on);
      tab.setAttribute('aria-pressed', String(on));
    });
    document.querySelectorAll('[data-count]').forEach((badge) => {
      const n = state.counts ? Number(state.counts[badge.dataset.count] || 0) : null;
      badge.textContent = n === null ? '' : String(n);
      badge.hidden = n === null;
    });
  }

  function renderList() {
    renderTabs();
    if (state.loggedOut) {
      list.innerHTML = '<div class="orders-empty"><strong>Log in to see your orders</strong><p>Your pickup orders are linked to your customer account.</p>' +
        '<div class="orders-empty-actions"><a class="orders-btn primary" href="login.html?return=' + encodeURIComponent('orders.html') + '">Log In</a><a class="orders-btn" href="register.html">Create account</a></div></div>';
      more.hidden = true;
      return;
    }
    if (!state.orders.length) {
      const empty = {
        all: ['No orders yet', 'When you place a pickup order it will appear here.'],
        active: ['No active orders', 'Orders being checked, prepared or waiting for pick-up appear here.'],
        completed: ['No completed orders yet', 'Orders you have picked up appear here.'],
        cancelled: ['No cancelled orders', 'Good news — nothing was cancelled.'],
        rejected: ['No rejected payments', 'If a GCash payment cannot be verified, you can resubmit it from here.'],
      }[state.status];
      list.innerHTML = state.loading ? '' : '<div class="orders-empty"><strong>' + esc(empty[0]) + '</strong><p>' + esc(empty[1]) + '</p>' +
        (state.status === 'all' || state.status === 'active' ? '<div class="orders-empty-actions"><a class="orders-btn primary" href="menu.html">Browse the menu</a></div>' : '') + '</div>';
      more.hidden = true;
      return;
    }
    list.innerHTML = state.orders.map((order) => {
      const info = describe(order);
      const count = itemCount(order);
      const names = (Array.isArray(order.items) ? order.items : []).slice(0, 3).map((i) => esc(i.product_name || 'Menu item')).join(', ');
      return '<button class="orders-card tone-' + info.tone + '" type="button" data-order-id="' + esc(order.id) + '">' +
        '<span class="orders-card-top"><strong>Order #' + esc(order.id) + '</strong><span class="orders-pill tone-' + info.tone + '">' + esc(info.label) + '</span></span>' +
        '<span class="orders-card-meta">' + esc(formatDate(order.created_at)) + ' · ' + count + ' item' + (count === 1 ? '' : 's') + '</span>' +
        (names ? '<span class="orders-card-items">' + names + (order.items.length > 3 ? '…' : '') + '</span>' : '') +
        '<span class="orders-card-total"><span>Total</span><strong>' + esc(money(order.total_amount)) + '</strong></span></button>';
    }).join('');
    more.hidden = state.page >= state.pages;
    more.disabled = state.loading;
    more.textContent = state.loading ? 'Loading…' : 'Load more';
  }

  function renderDetail(order) {
    const info = describe(order);
    const items = Array.isArray(order.items) ? order.items : [];
    const rejected = info.tone === 'rejected';
    const fields = [
      ['Placed', formatDate(order.created_at)],
      ['Last update', formatDate(order.updated_at)],
      ['Payment', 'GCash · ' + String(order.payment_status || 'unknown').replace(/_/g, ' ')],
      ['GCash reference', order.payment_reference || '—'],
      ['Pickup', order.pickup_time || 'As soon as ready'],
    ];
    detailView.innerHTML =
      '<button class="orders-back" type="button" data-orders-back>‹ Back to orders</button>' +
      '<div class="orders-detail-head"><div><h2>Order #' + esc(order.id) + '</h2><p>' + esc(order.order_code || '') + '</p></div><span class="orders-pill tone-' + info.tone + '">' + esc(info.label) + '</span></div>' +
      (info.active ? '<a class="orders-track-link" href="index.html?order=' + encodeURIComponent(order.order_code || '') + '">Open live tracker →</a>' : '') +
      '<ul class="orders-items">' + (items.length ? items.map((i) =>
        '<li><div><strong>' + esc(i.product_name || 'Menu item') + '</strong><span class="orders-item-qty">' + esc(Number(i.quantity) || 0) + ' × ' + esc(money(i.unit_price)) + '</span>' +
        '<div class="orders-mods">' + customizations(i.customizations) + '</div></div><strong>' + esc(money(i.subtotal)) + '</strong></li>').join('') : '<li>Order items unavailable</li>') + '</ul>' +
      '<div class="orders-detail-total"><span>Total</span><strong>' + esc(money(order.total_amount)) + '</strong></div>' +
      '<dl class="orders-fields">' + fields.map((f) => '<div><dt>' + esc(f[0]) + '</dt><dd>' + esc(f[1]) + '</dd></div>').join('') + '</dl>' +
      (rejected ?
        '<div class="orders-rejected"><strong>Your GCash payment could not be verified.</strong>' +
        (order.payment_rejection_reason ? '<p>Reason: ' + esc(order.payment_rejection_reason) + '</p>' : '') +
        '<form class="orders-resubmit" data-order-code="' + esc(order.order_code || '') + '" novalidate>' +
        '<label>New GCash reference number<input name="payment_reference" required inputmode="numeric" maxlength="13" autocomplete="off" placeholder="13-digit reference number"></label>' +
        '<label>New payment screenshot<input name="payment_screenshot" type="file" required accept="image/jpeg,image/png,image/webp"></label>' +
        '<small>JPG, PNG or WebP · max 5 MB</small>' +
        '<p class="orders-form-error" role="alert"></p>' +
        '<button class="orders-btn primary" type="submit">Resubmit payment proof</button></form></div>' : '');
    listView.hidden = true;
    detailView.hidden = false;
    detailView.querySelector('.orders-back').focus();
  }

  function showList() {
    state.detailId = null;
    detailView.hidden = true;
    detailView.innerHTML = '';
    listView.hidden = false;
  }

  async function fetchPage(status, page) {
    const params = new URLSearchParams({ all_orders: '1', status: status, page: String(page), limit: String(PAGE_SIZE) });
    const response = await fetch(API + '?' + params.toString(), { credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'application/json' } });
    let data;
    try { data = await response.json(); } catch (_) { throw new Error('The server returned an unreadable response. Please try again.'); }
    if (response.status === 401) return { unauthorized: true };
    if (!response.ok || !data.ok) throw new Error(data.message || 'Unable to load your orders.');
    return data;
  }

  /* reset: start the tab over at page 1. Otherwise append the next page. */
  async function load(reset) {
    if (state.loading && !reset) return;
    const seq = ++state.seq;
    state.loading = true;
    if (reset) { state.page = 0; state.pages = 0; state.orders = []; list.innerHTML = '<div class="orders-loading">Loading your orders…</div>'; more.hidden = true; }
    else renderList();
    try {
      const data = await fetchPage(state.status, state.page + 1);
      if (seq !== state.seq) return; // a newer tab/refresh superseded this request
      if (data.unauthorized) { state.loggedOut = true; state.loading = false; setStatusLine(''); renderList(); return; }
      state.loggedOut = false;
      const known = new Set(state.orders.map((o) => String(o.id)));
      state.orders = state.orders.concat((data.orders || []).filter((o) => !known.has(String(o.id))));
      state.page = Number(data.page) || state.page + 1;
      state.pages = Number(data.pages) || 0;
      state.total = Number(data.total) || 0;
      state.counts = data.counts || state.counts;
      setStatusLine(state.total ? 'Showing ' + state.orders.length + ' of ' + state.total + ' order' + (state.total === 1 ? '' : 's') + '.' : '');
    } catch (error) {
      if (seq !== state.seq) return;
      list.innerHTML = '<div class="orders-empty"><strong>' + esc(error.message || 'Unable to load your orders.') + '</strong><p>Check your connection and try again.</p><div class="orders-empty-actions"><button class="orders-btn" type="button" data-orders-retry>Try again</button></div></div>';
      more.hidden = true;
      state.loading = false;
      return;
    } finally {
      if (seq === state.seq) state.loading = false;
    }
    renderList();
  }

  /* Re-fetch every loaded page so statuses stay current without losing "Load more" progress. */
  async function refresh() {
    if (state.loading || state.loggedOut || document.hidden) return;
    if (!(state.status === 'all' || state.status === 'active')) return;
    const resubmit = state.detailId ? detailView.querySelector('.orders-resubmit') : null;
    if (resubmit && (resubmit.elements.payment_reference.value || resubmit.elements.payment_screenshot.files.length)) return; // don't wipe a resubmit in progress
    const seq = ++state.seq;
    try {
      let orders = [];
      let last = null;
      const pagesToLoad = Math.max(1, state.page);
      for (let p = 1; p <= pagesToLoad; p++) {
        last = await fetchPage(state.status, p);
        if (last.unauthorized) { state.loggedOut = true; renderList(); return; }
        orders = orders.concat(last.orders || []);
      }
      if (seq !== state.seq) return;
      state.orders = orders;
      state.pages = Number(last.pages) || 0;
      state.total = Number(last.total) || 0;
      state.counts = last.counts || state.counts;
      if (state.detailId) {
        const current = orders.find((o) => String(o.id) === String(state.detailId));
        if (current) renderDetail(current);
      } else {
        renderList();
      }
    } catch (_) { /* keep showing the last good data; the next tick retries */ }
  }

  function setStatus(status, focusTab) {
    if (!STATUSES.includes(status)) status = 'all';
    state.status = status;
    showList();
    const url = new URL(window.location.href);
    if (status === 'all') url.searchParams.delete('status'); else url.searchParams.set('status', status);
    window.history.replaceState(null, '', url.pathname + url.search);
    renderTabs();
    if (focusTab) document.querySelector('.orders-tab[data-status="' + status + '"]')?.focus();
    load(true);
  }

  document.querySelector('.orders-tabs')?.addEventListener('click', (e) => {
    const tab = e.target.closest('.orders-tab');
    if (tab && tab.dataset.status !== state.status) setStatus(tab.dataset.status);
  });
  document.querySelector('.orders-tabs')?.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const i = STATUSES.indexOf(state.status);
    setStatus(STATUSES[(i + (e.key === 'ArrowRight' ? 1 : STATUSES.length - 1)) % STATUSES.length], true);
  });
  more.addEventListener('click', () => load(false));
  list.addEventListener('click', (e) => {
    if (e.target.closest('[data-orders-retry]')) { load(true); return; }
    const card = e.target.closest('[data-order-id]');
    if (!card) return;
    const order = state.orders.find((o) => String(o.id) === card.dataset.orderId);
    if (order) { state.detailId = order.id; renderDetail(order); }
  });
  detailView.addEventListener('click', (e) => {
    if (!e.target.closest('[data-orders-back]')) return;
    const id = state.detailId;
    showList();
    renderList();
    list.querySelector('[data-order-id="' + CSS.escape(String(id)) + '"]')?.focus();
  });

  /* Resubmit a rejected GCash payment: same POST as the tracker (action=resubmit_payment). */
  detailView.addEventListener('submit', async (e) => {
    const form = e.target.closest('.orders-resubmit');
    if (!form) return;
    e.preventDefault();
    const error = form.querySelector('.orders-form-error');
    const ref = form.elements.payment_reference;
    const file = form.elements.payment_screenshot.files[0];
    ref.value = ref.value.replace(/\D/g, '');
    error.textContent = '';
    if (!/^\d{13}$/.test(ref.value)) { error.textContent = 'Enter the 13-digit GCash reference number.'; ref.focus(); return; }
    if (!file) { error.textContent = 'Attach a screenshot of your GCash payment.'; return; }
    if (!PROOF_TYPES.includes(file.type)) { error.textContent = 'The screenshot must be a JPG, PNG or WebP image.'; return; }
    if (file.size > MAX_PROOF_BYTES) { error.textContent = 'The screenshot must be 5 MB or smaller.'; return; }
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    button.textContent = 'Submitting…';
    try {
      const body = new FormData();
      body.append('action', 'resubmit_payment');
      body.append('order_code', form.dataset.orderCode || '');
      body.append('payment_reference', ref.value);
      body.append('payment_screenshot', file);
      const response = await fetch(API, { method: 'POST', body: body, credentials: 'same-origin' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) throw new Error(data.message || 'Unable to resubmit your payment proof.');
      form.outerHTML = '<p class="orders-success" role="status">Payment proof submitted. The owner will review it again — this order is now back in Active.</p>';
      setTimeout(() => { setStatus('active'); }, 1600);
    } catch (err) {
      error.textContent = err.message || 'Unable to resubmit your payment proof.';
      button.disabled = false;
      button.textContent = 'Resubmit payment proof';
    }
  });
  detailView.addEventListener('input', (e) => {
    if (e.target.name === 'payment_reference') e.target.value = e.target.value.replace(/\D/g, '').slice(0, 13);
  });

  const initial = new URLSearchParams(window.location.search).get('status') || 'all';
  setStatus(STATUSES.includes(initial) ? initial : 'all');
  setInterval(refresh, REFRESH_MS);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
})();
