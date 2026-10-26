/* SEVEN Coffee & Tea — admin notification bell (every admin page with a .top-actions bar).
   Lists recent events from api/admin_notifications.php (new orders, payment proof resubmitted),
   with per-admin unread state, "Mark all as read", and the optional desktop-alert toggle. */
(() => {
  'use strict';
  const actions = document.querySelector('.top-actions');
  if (!actions || document.getElementById('adminBell')) return;

  const API = '../api/admin_notifications.php';
  const POLL_MS = 15000;
  const ALERTS_KEY = 'seven_admin_order_alerts_enabled'; // same key as before, so existing choices carry over
  let alertsEnabled = false;
  try { alertsEnabled = localStorage.getItem(ALERTS_KEY) === '1'; } catch (_) { /* storage blocked */ }
  let items = [];
  let unread = 0;
  let newestSeenId = null; // highest id already announced; null until the first load
  let loading = false;
  let configured = true;

  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  function timeAgo(value) {
    const t = Date.parse(String(value || '').replace(' ', 'T'));
    if (!Number.isFinite(t)) return '';
    const s = Math.max(0, Math.round((Date.now() - t) / 1000));
    if (s < 60) return 'just now';
    if (s < 3600) return Math.floor(s / 60) + ' min ago';
    if (s < 86400) return Math.floor(s / 3600) + ' h ago';
    return new Date(t).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
  }

  // ---- Markup ----
  const wrap = document.createElement('div');
  wrap.className = 'admin-bell';
  wrap.innerHTML =
    '<button class="icon-btn admin-bell-button" id="adminBell" type="button" aria-haspopup="true" aria-expanded="false" aria-controls="adminBellPanel">' +
    '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg>' +
    '<span class="admin-bell-count" hidden></span>' +
    '</button>' +
    '<section class="admin-bell-panel" id="adminBellPanel" role="dialog" aria-label="Notifications" hidden>' +
    '<header class="admin-bell-head"><strong>Notifications</strong><button class="admin-bell-markall" type="button">Mark all as read</button></header>' +
    '<div class="admin-bell-list" role="list" aria-live="polite"></div>' +
    '<footer class="admin-bell-foot">' +
    '<label class="admin-bell-alerts"><input type="checkbox" id="adminBellAlerts"> Desktop alerts for new orders</label>' +
    '<p class="admin-bell-alert-status" aria-live="polite"></p>' +
    '<a class="admin-bell-all" href="orders.html">Open orders →</a>' +
    '</footer>' +
    '</section>';
  const avatar = actions.querySelector('.avatar');
  if (avatar) actions.insertBefore(wrap, avatar); else actions.appendChild(wrap);

  const bell = wrap.querySelector('#adminBell');
  const panel = wrap.querySelector('#adminBellPanel');
  const count = wrap.querySelector('.admin-bell-count');
  const list = wrap.querySelector('.admin-bell-list');
  const markAll = wrap.querySelector('.admin-bell-markall');
  const alertsBox = wrap.querySelector('#adminBellAlerts');
  const alertStatus = wrap.querySelector('.admin-bell-alert-status');

  function renderCount() {
    count.hidden = unread < 1;
    count.textContent = unread > 99 ? '99+' : String(unread);
    bell.setAttribute('aria-label', unread > 0 ? 'Notifications, ' + unread + ' unread' : 'Notifications');
    bell.title = bell.getAttribute('aria-label');
    markAll.disabled = unread < 1;
  }

  function renderList() {
    if (!configured) {
      list.innerHTML = '<p class="admin-bell-empty">Notifications are not set up yet. Run <code>database/admin_notifications.sql</code>.</p>';
      return;
    }
    if (!items.length) {
      list.innerHTML = '<p class="admin-bell-empty">' + (loading ? 'Loading…' : 'No notifications in the last 30 days.') + '</p>';
      return;
    }
    list.innerHTML = items.map((n) => {
      const icon = n.type === 'payment_resubmitted'
        ? '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/>'
        : '<path d="M5 8h14l-1.2 11.1a2 2 0 0 1-2 1.9H8.2a2 2 0 0 1-2-1.9L5 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>';
      return '<a class="admin-bell-item' + (n.is_read ? '' : ' unread') + '" role="listitem" href="orders.html' + (n.order_id ? '?focus=' + encodeURIComponent(n.order_id) : '') + '" data-notification-id="' + esc(n.id) + '">' +
        '<svg class="admin-bell-icon" viewBox="0 0 24 24" aria-hidden="true">' + icon + '</svg>' +
        '<span class="admin-bell-text"><strong>' + esc(n.title) + '</strong><span>' + esc(n.message) + '</span><time datetime="' + esc(n.created_at) + '">' + esc(timeAgo(n.created_at)) + '</time></span>' +
        (n.is_read ? '' : '<span class="admin-bell-dot" aria-label="Unread"></span>') +
        '</a>';
    }).join('');
  }

  function syncAlertsUi() {
    alertsBox.checked = alertsEnabled;
    alertStatus.textContent = !alertsEnabled ? '' :
      !('Notification' in window) ? 'This browser does not support desktop alerts.' :
        Notification.permission === 'denied' ? 'Desktop alerts are blocked in this browser’s site settings.' :
          Notification.permission === 'granted' ? 'Desktop alerts are on.' : 'Allow notifications when your browser asks.';
  }

  function announce(fresh) {
    if (!alertsEnabled || !fresh.length || !('Notification' in window) || Notification.permission !== 'granted') return;
    const latest = fresh[0];
    try {
      const note = new Notification(fresh.length === 1 ? latest.title : fresh.length + ' new SEVEN notifications', {
        body: fresh.length === 1 ? latest.message : fresh.map((n) => n.title).join(' · '),
        tag: 'seven-admin-notifications',
        silent: true,
      });
      note.onclick = () => { window.focus(); note.close(); location.href = 'orders.html' + (latest.order_id ? '?focus=' + latest.order_id : ''); };
    } catch (_) { /* some browsers only allow notifications from a service worker */ }
  }

  async function load() {
    if (loading) return;
    loading = true;
    try {
      const response = await fetch(API, { credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'application/json' } });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) return; // signed out or server issue: keep the last good state
      configured = data.configured !== false;
      items = Array.isArray(data.notifications) ? data.notifications : [];
      unread = Number(data.unread_count) || 0;
      const maxId = items.reduce((m, n) => Math.max(m, Number(n.id) || 0), 0);
      if (newestSeenId !== null) announce(items.filter((n) => Number(n.id) > newestSeenId && !n.is_read));
      newestSeenId = Math.max(newestSeenId || 0, maxId);
      renderCount();
      if (!panel.hidden) renderList();
    } catch (_) {
      /* temporary connection issue: try again on the next poll */
    } finally {
      loading = false;
    }
  }

  async function post(body) {
    const response = await fetch(API, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return response.ok;
  }

  function openPanel() {
    panel.hidden = false;
    bell.setAttribute('aria-expanded', 'true');
    renderList();
    syncAlertsUi();
    load();
  }
  function closePanel(returnFocus) {
    if (panel.hidden) return;
    panel.hidden = true;
    bell.setAttribute('aria-expanded', 'false');
    if (returnFocus) bell.focus();
  }

  bell.addEventListener('click', () => (panel.hidden ? openPanel() : closePanel(false)));
  document.addEventListener('click', (e) => { if (!wrap.contains(e.target)) closePanel(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !panel.hidden) closePanel(true); });

  markAll.addEventListener('click', async () => {
    markAll.disabled = true;
    if (await post({ action: 'mark_all_read' })) {
      items = items.map((n) => ({ ...n, is_read: true }));
      unread = 0;
      renderCount();
      renderList();
    } else {
      markAll.disabled = false;
    }
  });

  // Clicking an event marks it read, then follows the link to the order.
  list.addEventListener('click', (e) => {
    const link = e.target.closest('[data-notification-id]');
    if (!link) return;
    const id = Number(link.dataset.notificationId);
    const item = items.find((n) => n.id === id);
    if (!item || item.is_read) return;
    e.preventDefault();
    post({ action: 'mark_read', id: id }).catch(() => false).finally(() => { location.href = link.href; });
  });

  alertsBox.addEventListener('change', async () => {
    alertsEnabled = alertsBox.checked;
    try { localStorage.setItem(ALERTS_KEY, alertsEnabled ? '1' : '0'); } catch (_) { /* storage blocked */ }
    if (alertsEnabled && 'Notification' in window && Notification.permission === 'default') {
      try { await Notification.requestPermission(); } catch (_) { /* ignore */ }
    }
    syncAlertsUi();
  });

  renderCount();
  load();
  setInterval(load, POLL_MS);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) load(); });
})();
