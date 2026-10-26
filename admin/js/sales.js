/* Owner-only Sales Reports page. No client-side sales aggregation. */
(function () {
  'use strict';

  const state = {
    role: '',
    period: 'daily',
    basis: 'paid',
    rangeMode: 'default',
    preset: '',
    report: null,
    expandedStart: '',
    detail: {},
    loading: false,
    reportRequestId: 0
  };

  const $ = function (id) { return document.getElementById(id); };
  const esc = function (value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  };
  const money = function (value) {
    return '₱' + Number(value || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };
  const number = function (value) {
    return Number(value || 0).toLocaleString('en-PH', { maximumFractionDigits: 0 });
  };
  const periodWord = function (period) {
    return period === 'daily' ? 'day' : (period === 'weekly' ? 'week' : 'month');
  };
  const periodPlural = function (period) {
    return period === 'daily' ? 'days' : (period === 'weekly' ? 'weeks' : 'months');
  };
  const titleCase = function (value) {
    return String(value || '—').replace(/_/g, ' ').replace(/\b[a-z]/g, function (letter) { return letter.toUpperCase(); });
  };

  // API timestamps are store-local MySQL TIMESTAMP values. Parse their components
  // as UTC for display so the administrator's browser timezone cannot shift them.
  function storeDateTime(value) {
    if (!value) return '—';
    const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
    if (!match) return String(value);
    const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5]), Number(match[6] || 0)));
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat('en-PH', {
      month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'UTC'
    }).format(date);
  }
  function storeDate(value) {
    if (!value) return '—';
    const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return String(value);
    const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
    return new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(date);
  }
  function statusClass(order) {
    if (order.payment_status === 'rejected') return 'rejected';
    if (order.order_status === 'cancelled') return 'cancelled';
    if (order.payment_status === 'verified' || order.payment_status === 'paid') return 'verified';
    return 'pending';
  }
  function statusLabel(order) {
    return titleCase(order.order_status) + ' · ' + titleCase(order.payment_status);
  }
  function setMessage(text, isError) {
    const box = $('salesMessage');
    box.textContent = text || '';
    box.className = text ? 'message ' + (isError ? 'error' : 'notice') : 'message';
  }
  // Shows a status message INSIDE the container. (It used to overwrite the container's own class,
  // which stripped .sales-chart-frame from the chart and left every bar unstyled/black.)
  function setPanelState(id, text, type) {
    const message = document.createElement('div');
    message.className = type || 'sales-loading';
    message.textContent = text;
    $(id).replaceChildren(message);
  }

  async function fetchJson(url) {
    const response = await fetch(url, {
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { Accept: 'application/json' }
    });
    let data;
    try { data = await response.json(); } catch (_) { data = {}; }
    if (!response.ok || !data.ok) {
      if (response.status === 401 || response.status === 403) {
        if (response.status === 403) window.location.replace('index.html');
      }
      throw new Error(data.message || 'Unable to load this report.');
    }
    return data;
  }

  async function requireOwner() {
    const response = await fetch('../api/admin_auth.php', {
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { Accept: 'application/json' }
    });
    let data;
    try { data = await response.json(); } catch (_) { data = {}; }
    if (!response.ok || !data.ok || !data.admin) {
      throw new Error('Administrator sign-in is required.');
    }
    state.role = String(data.admin.role || '');
    return state.role === 'owner';
  }

  function reportUrl() {
    const params = new URLSearchParams({ period: state.period, basis: state.basis });
    if (state.rangeMode === 'custom') {
      params.set('from', $('salesFrom').value);
      params.set('to', $('salesTo').value);
    } else if (state.rangeMode === 'preset' && state.preset) {
      params.set('preset', state.preset);
    }
    return '../api/sales.php?' + params.toString();
  }

  function updatePeriodTabs() {
    document.querySelectorAll('[data-period]').forEach(function (tab) {
      const active = tab.dataset.period === state.period;
      tab.classList.toggle('active', active);
      tab.setAttribute('aria-pressed', String(active));
    });
    $('chartTitle').textContent = 'Gross sales by ' + periodWord(state.period);
    $('tableTitle').textContent = titleCase(state.period) + ' breakdown';
  }

  function changeCopy(key, change) {
    if (!change) return 'Compared with previous period';
    const diff = Number(change.difference || 0);
    const direction = diff > 0 ? 'up' : (diff < 0 ? 'down' : 'neutral');
    let text;
    if (change.percentage === null) {
      text = Number(change.current || 0) > 0 ? 'New — no sales in previous period' : 'No sales in either period';
    } else {
      const percent = Math.abs(Number(change.percentage || 0)).toLocaleString('en-PH', { maximumFractionDigits: 1 });
      const sign = Number(change.percentage || 0) > 0 ? '+' : (Number(change.percentage || 0) < 0 ? '−' : '');
      let magnitude = '';
      if (key === 'gross_sales' || key === 'average_order_value') magnitude = money(Math.abs(diff));
      else magnitude = number(Math.abs(diff)) + (key === 'orders' ? ' orders' : ' items');
      const diffSign = diff > 0 ? '+' : (diff < 0 ? '−' : '');
      text = sign + percent + '% vs previous · ' + diffSign + magnitude;
    }
    return { direction: direction, text: text };
  }

  function renderChange(id, key, changes) {
    const display = changeCopy(key, changes[key]);
    const node = $(id);
    if (typeof display === 'string') {
      node.className = 'sales-change neutral';
      node.textContent = display;
      return;
    }
    node.className = 'sales-change ' + display.direction;
    node.textContent = display.text;
  }

  function renderSummary(report) {
    const totals = report.totals || {};
    $('summaryGross').textContent = money(totals.gross_sales);
    $('summaryOrders').textContent = number(totals.orders);
    $('summaryItems').textContent = number(totals.items_sold);
    $('summaryAverage').textContent = money(totals.average_order_value);
    const changes = report.changes || {};
    renderChange('changeGross', 'gross_sales', changes);
    renderChange('changeOrders', 'orders', changes);
    renderChange('changeItems', 'items_sold', changes);
    renderChange('changeAverage', 'average_order_value', changes);
    $('cancelledDetail').textContent = number(totals.cancelled_orders) + ' orders · ' + money(totals.cancelled_amount);
    $('cancelledAmount').textContent = money(totals.cancelled_amount);
    $('rejectedDetail').textContent = number(totals.rejected_payments) + ' orders · ' + money(totals.rejected_amount);
    $('rejectedAmount').textContent = money(totals.rejected_amount);
    $('rowCount').textContent = number((report.rows || []).length) + ' periods';
    $('activeRangeLabel').textContent = storeDate(report.range.from) + ' – ' + storeDate(report.range.to);
    $('storeTimezone').textContent = report.timezone || 'Asia/Manila';
    const generatedText = 'Generated ' + storeDateTime(report.generated_at ? report.generated_at.replace('T', ' ').replace(/[+-]\d\d:\d\d$/, '') : '') + ' (' + (report.timezone || 'Asia/Manila') + ')';
    $('generatedAt').textContent = generatedText;
    $('salesPrintRange').textContent = 'Report range: ' + storeDate(report.range.from) + ' – ' + storeDate(report.range.to) + ' · ' + titleCase(report.period) + ' · ' + (report.basis === 'completed' ? 'Completed only' : 'Paid orders');
    $('salesPrintGenerated').textContent = generatedText;
  }

  function niceMaximum(value) {
    if (!(value > 0)) return 100;
    const power = Math.pow(10, Math.floor(Math.log10(value)));
    const normalized = value / power;
    const step = normalized <= 1 ? 1 : (normalized <= 2 ? 2 : (normalized <= 5 ? 5 : 10));
    return step * power;
  }

  // Mini trend line under each KPI, drawn from the same period rows as the main chart.
  function renderSparklines(rows) {
    const cards = [['summaryGross', 'gross_sales'], ['summaryOrders', 'orders'], ['summaryItems', 'items_sold'], ['summaryAverage', 'average_order_value']];
    cards.forEach(function (entry) {
      const card = $(entry[0]) && $(entry[0]).closest('.sales-stat-card');
      if (!card) return;
      let host = card.querySelector('.sales-spark');
      if (!host) {
        host = document.createElement('div');
        host.className = 'sales-spark';
        host.setAttribute('aria-hidden', 'true');
        card.appendChild(host);
      }
      const values = rows.map(function (row) { return Math.max(0, Number(row[entry[1]] || 0)); });
      if (values.length < 2 || !values.some(function (v) { return v > 0; })) { host.innerHTML = ''; return; }
      const w = 120, h = 28, pad = 2;
      const max = Math.max.apply(null, values) || 1;
      const points = values.map(function (v, i) {
        return (pad + (i / (values.length - 1)) * (w - pad * 2)).toFixed(1) + ',' + (h - pad - (v / max) * (h - pad * 2)).toFixed(1);
      });
      host.innerHTML = '<svg viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none"><polygon class="spark-area" points="' + pad + ',' + h + ' ' + points.join(' ') + ' ' + (w - pad) + ',' + h + '"></polygon><polyline class="spark-line" vector-effect="non-scaling-stroke" points="' + points.join(' ') + '"></polyline></svg>';
    });
  }

  function renderChart(rows) {
    const host = $('salesChartFrame');
    if (!rows.length || (state.report && Number(state.report.totals && state.report.totals.orders || 0) === 0)) {
      host.innerHTML = '<div class="sales-empty">No sales in this period. Calendar periods are still listed as zero rows below.</div>';
      return;
    }
    const width = Math.max(920, rows.length * 32 + 95);
    const maxValue = Math.max.apply(null, rows.map(function (row) { return Number(row.gross_sales || 0); }));
    const ceiling = niceMaximum(maxValue);
    const tick = ceiling / 4;
    // Left margin fits the widest y-axis label (e.g. "20,000,000.00"), so large totals are not clipped.
    const widestLabel = money(ceiling).replace('₱', '').length;
    const height = 270, left = Math.max(62, Math.ceil(widestLabel * 6.4) + 16), right = 20, top = 18, bottom = 54;
    const plotWidth = width - left - right;
    const plotHeight = height - top - bottom;
    const groupWidth = plotWidth / rows.length;
    const barWidth = Math.max(4, Math.min(30, groupWidth * 0.62));
    const nodes = [];
    for (let i = 0; i <= 4; i++) {
      const y = top + plotHeight - ((tick * i) / ceiling) * plotHeight;
      nodes.push('<line class="chart-grid" x1="' + left + '" y1="' + y + '" x2="' + (width - right) + '" y2="' + y + '"></line>');
      nodes.push('<text class="chart-axis" x="' + (left - 9) + '" y="' + (y + 3.5) + '" text-anchor="end">' + esc(money(tick * i).replace('₱', '')) + '</text>');
    }
    rows.forEach(function (row, index) {
      const amount = Math.max(0, Number(row.gross_sales || 0));
      const barHeight = (amount / ceiling) * plotHeight;
      const x = left + index * groupWidth + (groupWidth - barWidth) / 2;
      const y = top + plotHeight - barHeight;
      const label = row.label || row.period_start;
      const shortLabel = state.period === 'daily'
        ? String(row.period_start || '').slice(8, 10)
        : (state.period === 'weekly' ? String(row.period_start || '').slice(5) : String(row.period_start || '').slice(0, 7));
      const aria = label + ': ' + money(amount) + ', ' + number(row.orders) + ' orders. Select to expand order details.';
      const barY = amount > 0 ? y : top + plotHeight - 1;
      const barH = amount > 0 ? Math.max(1, barHeight) : 1;
      nodes.push('<rect class="chart-bar" x="' + x.toFixed(2) + '" y="' + barY.toFixed(2) + '" width="' + barWidth.toFixed(2) + '" height="' + barH.toFixed(2) + '" rx="3" tabindex="0" role="button" data-chart-start="' + esc(row.period_start) + '" aria-label="' + esc(aria) + '"><title>' + esc(label + ' · ' + money(amount) + ' · ' + number(row.orders) + ' orders') + '</title></rect>');
      const showTick = rows.length <= 14 || index % Math.ceil(rows.length / 12) === 0 || index === rows.length - 1;
      if (showTick) nodes.push('<text class="chart-axis" x="' + (x + barWidth / 2) + '" y="' + (height - 28) + '" text-anchor="middle">' + esc(shortLabel) + '</text>');
    });
    nodes.push('<text class="chart-axis" x="' + (left + plotWidth / 2) + '" y="' + (height - 6) + '" text-anchor="middle">' + esc(titleCase(state.period)) + ' starting date</text>');
    host.innerHTML = '<svg viewBox="0 0 ' + width + ' ' + height + '" role="group" aria-label="' + esc('Gross sales bar chart with ' + rows.length + ' ' + periodPlural(state.period) + '. Bars can be focused and activated to expand orders.') + '" xmlns="http://www.w3.org/2000/svg">' + nodes.join('') + '</svg>';
  }

  function renderRow(row, expanded) {
    const start = esc(row.period_start);
    const status = expanded ? '−' : '+';
    return '<tr data-period-row="' + start + '" tabindex="0" role="button" aria-expanded="' + String(expanded) + '" aria-label="' + esc('Show orders for ' + row.label) + '">' +
      '<td><div class="sales-period-cell"><span class="sales-expand-indicator" aria-hidden="true">' + status + '</span><span>' + esc(row.label) + '<span class="sales-period-date">' + esc(row.period_start) + ' – ' + esc(row.period_end) + '</span></span></div></td>' +
      '<td class="numeric">' + number(row.orders) + '</td><td class="numeric">' + number(row.items_sold) + '</td>' +
      '<td class="numeric">' + money(row.average_order_value) + '</td><td class="numeric sales-positive">' + money(row.gross_sales) + '</td>' +
      '<td class="numeric">' + number(row.cancelled_orders) + '<span class="sales-period-date">' + money(row.cancelled_amount) + '</span></td>' +
      '<td class="numeric">' + number(row.rejected_payments) + '<span class="sales-period-date">' + money(row.rejected_amount) + '</span></td></tr>';
  }

  function renderTotalRow(report) {
    const t = report.totals || {};
    return '<tr><td>Totals</td><td class="numeric">' + number(t.orders) + '</td><td class="numeric">' + number(t.items_sold) +
      '</td><td class="numeric">' + money(t.average_order_value) + '</td><td class="numeric">' + money(t.gross_sales) +
      '</td><td class="numeric">' + number(t.cancelled_orders) + '<span class="sales-period-date">' + money(t.cancelled_amount) +
      '</span></td><td class="numeric">' + number(t.rejected_payments) + '<span class="sales-period-date">' + money(t.rejected_amount) + '</span></td></tr>';
  }

  function detailState(start) {
    if (!state.detail[start]) state.detail[start] = { page: 1, pages: 1, total: 0, orders: [], loading: false, error: '' };
    return state.detail[start];
  }

  function renderInline(start) {
    const detail = detailState(start);
    if (detail.loading) return '<div class="sales-inline-panel"><div class="sales-loading">Loading orders for this period…</div></div>';
    if (detail.error) return '<div class="sales-inline-panel"><div class="sales-error">' + esc(detail.error) + '</div></div>';
    if (!detail.orders.length) {
      return '<div class="sales-inline-panel"><div class="sales-empty">No sales in this period.</div></div>';
    }
    const orderRows = detail.orders.map(function (order) {
      return '<div class="sales-inline-order">' +
        '<span class="sales-order-code">Order #' + esc(order.id) + ' · ' + esc(order.order_code) + '</span>' +
        '<span class="sales-order-customer">' + esc(order.customer || '—') + '<br><span class="sales-period-date">' + esc(storeDateTime(order.time)) + '</span></span>' +
        '<span class="sales-order-total">' + money(order.total) + '</span>' +
        '<span class="sales-order-status">' + esc(statusLabel(order)) + '</span>' +
        '<button type="button" class="sales-order-detail-link" data-order-detail="' + esc(order.id) + '">View order</button>' +
        '</div>';
    }).join('');
    const pager = detail.pages > 1
      ? '<div class="sales-detail-pager"><button type="button" data-detail-page="' + esc(start) + '" data-page="' + (detail.page - 1) + '"' + (detail.page <= 1 ? ' disabled' : '') + '>Previous</button><span>Page ' + detail.page + ' of ' + detail.pages + ' · ' + number(detail.total) + ' orders</span><button type="button" data-detail-page="' + esc(start) + '" data-page="' + (detail.page + 1) + '"' + (detail.page >= detail.pages ? ' disabled' : '') + '>Next</button></div>'
      : '<div class="sales-detail-pager"><span>' + number(detail.total) + ' orders in this period</span></div>';
    return '<div class="sales-inline-panel"><div class="sales-inline-head"><strong>Orders behind this period</strong><span>' + esc(start) + '</span></div><div class="sales-inline-orders">' + orderRows + '</div>' + pager + '</div>';
  }

  function renderTable(report) {
    const rows = Array.isArray(report.rows) ? report.rows : [];
    if (!rows.length) {
      $('salesRows').innerHTML = '<tr><td colspan="7">No sales in this period.</td></tr>';
      $('salesTotals').innerHTML = '';
      $('salesMobileList').innerHTML = '<div class="sales-empty">No sales in this period.</div>';
      return;
    }
    const desktop = [];
    const mobile = [];
    rows.forEach(function (row) {
      const expanded = state.expandedStart === row.period_start;
      desktop.push(renderRow(row, expanded));
      mobile.push('<article class="sales-mobile-period"><button type="button" data-mobile-period="' + esc(row.period_start) + '" aria-expanded="' + String(expanded) + '"><span class="sales-mobile-period-head"><strong>' + esc(row.label) + '</strong><span class="sales-expand-indicator" aria-hidden="true">' + (expanded ? '−' : '+') + '</span></span><span class="sales-period-date">' + esc(row.period_start) + ' – ' + esc(row.period_end) + '</span><span class="sales-mobile-sales">' + money(row.gross_sales) + '</span><span class="sales-mobile-metrics"><span>Orders <b>' + number(row.orders) + '</b></span><span>Items <b>' + number(row.items_sold) + '</b></span><span>Average <b>' + money(row.average_order_value) + '</b></span><span>Cancelled <b>' + number(row.cancelled_orders) + ' · ' + money(row.cancelled_amount) + '</b></span><span>Rejected <b>' + number(row.rejected_payments) + ' · ' + money(row.rejected_amount) + '</b></span></span></button>' + (expanded ? '<div class="sales-mobile-expanded">' + renderInline(row.period_start) + '</div>' : '') + '</article>');
      if (expanded) desktop.push('<tr class="sales-inline-row"><td colspan="7">' + renderInline(row.period_start) + '</td></tr>');
    });
    const t = report.totals || {};
    mobile.push('<article class="sales-mobile-period sales-mobile-total"><div class="sales-mobile-total-copy"><strong>Totals</strong><span class="sales-mobile-sales">' + money(t.gross_sales) + '</span></div><div class="sales-mobile-metrics"><span>Orders <b>' + number(t.orders) + '</b></span><span>Items <b>' + number(t.items_sold) + '</b></span><span>Average <b>' + money(t.average_order_value) + '</b></span><span>Cancelled <b>' + number(t.cancelled_orders) + ' · ' + money(t.cancelled_amount) + '</b></span><span>Rejected <b>' + number(t.rejected_payments) + ' · ' + money(t.rejected_amount) + '</b></span></div></article>');
    $('salesRows').innerHTML = desktop.join('');
    $('salesTotals').innerHTML = renderTotalRow(report);
    $('salesMobileList').innerHTML = mobile.join('');
  }

  function renderTopProducts(products) {
    const host = $('topProducts');
    if (!Array.isArray(products) || !products.length) {
      host.innerHTML = '<div class="sales-empty">No products sold in this period.</div>';
      return;
    }
    host.innerHTML = products.map(function (product, index) {
      return '<div class="top-product-row"><span class="top-product-rank">' + (index + 1) + '</span><div><strong class="top-product-name">' + esc(product.product_name || 'Unknown product') + '</strong><span class="top-product-meta">' + number(product.quantity) + ' sold</span></div><strong class="top-product-revenue">' + money(product.revenue) + '</strong></div>';
    }).join('');
  }

  /* ---- Show/hide toggles (eye buttons) ------------------------------------------------
     Hidden sections have their figures REPLACED in the DOM (not just visually hidden), so screen
     readers and the exported PDF never contain them. Rendering code is untouched: a
     MutationObserver re-applies masks after every render; showing a section re-renders it. */
  const MASK_STORE_KEY = 'seven_sales_hidden';
  const MASK_DOT = '•••••';
  const CURRENCY = /₱\s?[\d,]+(?:\.\d+)?/g;
  const maskTargets = {
    gross: { card: 'summaryGross', change: 'changeGross' },
    orders: { card: 'summaryOrders', change: 'changeOrders' },
    items: { card: 'summaryItems', change: 'changeItems' },
    average: { card: 'summaryAverage', change: 'changeAverage' },
    chart: { panel: '.chart-panel' },
    breakdown: { panel: '.sales-table-panel' },
    top: { panel: '.top-products-panel' },
    excluded: { panel: '.excluded-panel' }
  };
  const hidden = (function () {
    try {
      const saved = JSON.parse(localStorage.getItem(MASK_STORE_KEY) || '{}');
      return saved && typeof saved === 'object' ? saved : {};
    } catch (_) { return {}; }
  })();
  function saveHidden() { try { localStorage.setItem(MASK_STORE_KEY, JSON.stringify(hidden)); } catch (_) { /* storage blocked */ } }

  // Only nodeValue/attributes are changed here, so this never triggers the childList observer again.
  function maskCurrencyIn(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      if (node.nodeValue.indexOf('₱') !== -1) node.nodeValue = node.nodeValue.replace(CURRENCY, '₱' + MASK_DOT);
    }
    root.querySelectorAll('[aria-label*="₱"]').forEach(function (el) { el.setAttribute('aria-label', el.getAttribute('aria-label').replace(CURRENCY, 'amount hidden')); });
  }
  function maskWholeText(el, text) {
    if (!el) return;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let node, first = true;
    while ((node = walker.nextNode())) { if (!node.nodeValue.trim()) continue; node.nodeValue = first ? text : ''; first = false; }
  }
  function applyMasks() {
    Object.keys(maskTargets).forEach(function (key) {
      const target = maskTargets[key];
      const on = hidden[key] === true;
      const container = target.card ? $(target.card) && $(target.card).closest('.sales-stat-card') : document.querySelector(target.panel);
      if (!container) return;
      container.classList.toggle('is-masked', on);
      const button = container.querySelector('.sales-eye[data-mask-key="' + key + '"]');
      if (button) {
        button.setAttribute('aria-pressed', String(on));
        button.title = (on ? 'Show ' : 'Hide ') + button.getAttribute('aria-label').replace(/^Hide /, '');
      }
      if (!on) return;
      if (target.card) {
        maskWholeText($(target.card), MASK_DOT);
        maskWholeText($(target.change), 'Hidden');
        $(target.change).className = 'sales-change neutral';
        return;
      }
      if (key === 'chart') {
        container.querySelectorAll('text.chart-axis[text-anchor="end"]').forEach(function (label) { maskWholeText(label, '•••'); });
      }
      maskCurrencyIn(container);
    });
  }
  let maskQueued = false;
  new MutationObserver(function () {
    if (maskQueued) return;
    maskQueued = true;
    queueMicrotask(function () { maskQueued = false; applyMasks(); }); // before the browser paints
  }).observe($('salesApp'), { childList: true, subtree: true });

  $('salesApp').addEventListener('click', function (event) {
    const button = event.target.closest('.sales-eye');
    if (!button) return;
    const key = button.dataset.maskKey;
    hidden[key] = !(hidden[key] === true);
    saveHidden();
    if (hidden[key]) applyMasks();
    else if (state.report) render(state.report); // re-render restores the real figures; other masks re-apply
    else applyMasks();
  });
  applyMasks();

  function render(report) {
    renderSummary(report);
    renderChart(Array.isArray(report.rows) ? report.rows : []);
    renderSparklines(Array.isArray(report.rows) ? report.rows : []);
    renderTable(report);
    renderTopProducts(report.top_products);
    $('chartSubTitle').textContent = 'Select a bar to expand the orders behind it.';
  }

  async function loadReport() {
    const requestId = ++state.reportRequestId;
    state.loading = true;
    setMessage('', false);
    if (!state.report) {
      setPanelState('salesChartFrame', 'Loading chart…', 'sales-loading');
      $('salesRows').innerHTML = '<tr><td colspan="7">Loading sales…</td></tr>';
      $('salesMobileList').innerHTML = '<div class="sales-loading">Loading sales…</div>';
      $('topProducts').innerHTML = '<div class="sales-loading">Loading products…</div>';
    }
    const url = reportUrl();
    try {
      const report = await fetchJson(url);
      if (requestId !== state.reportRequestId) return;
      state.report = report;
      state.detail = {};
      if (!report.rows || !report.rows.length) state.expandedStart = '';
      $('salesFrom').value = report.range.from;
      $('salesTo').value = report.range.to;
      $('chartSubTitle').textContent = 'Select a bar to expand the orders behind it.';
      render(report);
    } catch (error) {
      if (requestId !== state.reportRequestId || state.role !== 'owner') return;
      state.report = null;
      state.expandedStart = '';
      state.detail = {};
      ['summaryGross', 'summaryOrders', 'summaryItems', 'summaryAverage'].forEach(function (id) { $(id).textContent = '—'; });
      ['changeGross', 'changeOrders', 'changeItems', 'changeAverage'].forEach(function (id) { $(id).textContent = ''; });
      $('cancelledDetail').textContent = '—';
      $('cancelledAmount').textContent = '—';
      $('rejectedDetail').textContent = '—';
      $('rejectedAmount').textContent = '—';
      $('rowCount').textContent = '—';
      $('activeRangeLabel').textContent = 'Range unavailable';
      $('generatedAt').textContent = '';
      setMessage(error.message || 'Unable to load sales report.', true);
      $('salesChartFrame').innerHTML = '<div class="sales-error">' + esc(error.message || 'Unable to load chart.') + '</div>';
      $('salesRows').innerHTML = '<tr><td colspan="7">' + esc(error.message || 'Unable to load sales.') + '</td></tr>';
      $('salesTotals').innerHTML = '';
      $('salesMobileList').innerHTML = '<div class="sales-error">' + esc(error.message || 'Unable to load sales.') + '</div>';
      $('topProducts').innerHTML = '<div class="sales-error">' + esc(error.message || 'Unable to load products.') + '</div>';
    } finally {
      if (requestId === state.reportRequestId) state.loading = false;
    }
  }

  async function loadDetail(start, page) {
    const detail = detailState(start);
    if (detail.loading) return;
    detail.loading = true;
    detail.error = '';
    detail.page = page || 1;
    if (state.report) renderTable(state.report);
    const params = new URLSearchParams({
      detail: '1', period: state.period, start: start, basis: state.basis, page: String(detail.page)
    });
    try {
      const data = await fetchJson('../api/sales.php?' + params.toString());
      detail.loading = false;
      if (state.expandedStart !== start) return;
      detail.orders = Array.isArray(data.orders) ? data.orders : [];
      detail.total = Number(data.total || 0);
      detail.page = Number(data.page || 1);
      detail.pages = Math.max(1, Number(data.pages || 1));
      detail.error = '';
    } catch (error) {
      detail.loading = false;
      detail.error = error.message || 'Unable to load orders for this period.';
    }
    if (state.report) renderTable(state.report);
  }

  function togglePeriod(start) {
    if (!start) return;
    if (state.expandedStart === start) {
      state.expandedStart = '';
      renderTable(state.report);
      return;
    }
    state.expandedStart = start;
    renderTable(state.report);
    loadDetail(start, 1);
  }

  function proofMarkup(path, id) {
    const normalized = String(path || '').replace(/\\/g, '/');
    if (!/^uploads\/payments\/[A-Za-z0-9][A-Za-z0-9._-]*\.(?:jpe?g|png|webp)$/i.test(normalized) || normalized.split('/').includes('..')) {
      return '<div class="proof-placeholder">No valid payment proof file is attached to this order.</div>';
    }
    return '<img src="../' + normalized.split('/').map(encodeURIComponent).join('/') + '" alt="GCash payment proof for order #' + Number(id || 0) + '">';
  }

  async function openOrderDetail(id) {
    const backdrop = $('historyDetailBackdrop');
    $('historyDetailTitle').textContent = 'Loading order #' + String(id) + '…';
    $('historyDetailMeta').textContent = '';
    $('historyDetailItems').textContent = 'Loading item details…';
    $('historyDetailFields').textContent = '';
    $('historyProofImage').innerHTML = '<div class="proof-placeholder">Loading payment proof…</div>';
    $('historyPaymentLogs').textContent = '';
    backdrop.hidden = false;
    try {
      // This endpoint looks up by order ID without requiring the order to be in history,
      // so in-progress paid orders can be opened from sales drill-downs too.
      const data = await fetchJson('../api/orders.php?admin_history_detail=' + encodeURIComponent(id));
      const order = data.order || {};
      const items = Array.isArray(order.items) ? order.items : [];
      $('historyDetailTitle').textContent = 'Order #' + String(order.id || id);
      $('historyDetailMeta').innerHTML =
        '<div><span>Placed</span><strong>' + esc(storeDateTime(order.created_at)) + '</strong></div>' +
        '<div><span>Customer</span><strong>' + esc(order.customer_name || '—') + ' · ' + esc(order.contact_number || '—') + '</strong></div>' +
        '<div><span>Last updated</span><strong>' + esc(storeDateTime(order.updated_at)) + '</strong></div>';
      $('historyDetailItems').innerHTML = items.length ? items.map(function (item) {
        let customizations = item.customizations || '';
        if (typeof customizations === 'string') {
          try {
            const parsed = JSON.parse(customizations);
            if (parsed && typeof parsed === 'object') {
              customizations = Object.keys(parsed).filter(function (key) {
                return parsed[key] != null && parsed[key] !== '' && parsed[key] !== 'None' && !(key === 'size' && parsed[key] === 'Medium');
              }).map(function (key) { return titleCase(key) + ': ' + String(parsed[key]); }).join(' · ');
            }
          } catch (_) { }
        }
        return '<article class="history-detail-item"><div class="history-detail-item-head"><strong>' + esc(item.quantity) + ' × ' + esc(item.product_name || 'Item') + '</strong><strong>' + money(item.subtotal) + '</strong></div><p>' + esc(typeof customizations === 'string' ? customizations || 'No customizations' : 'No customizations') + '</p></article>';
      }).join('') : '<div class="queue-empty">No item details.</div>';
      const details = [
        ['Pickup', order.pickup_time || '—'],
        ['Notes', order.notes || '—'],
        ['Payment method', titleCase(order.payment_method)],
        ['Payment status', titleCase(order.payment_status)],
        ['Payment reference', order.payment_reference || '—'],
        ['Order status', titleCase(order.order_status)],
        ['Total', money(order.total_amount)],
        ['Rejection reason', order.rejection_reason || '—']
      ];
      $('historyDetailFields').innerHTML = details.map(function (pair) {
        return '<div><dt>' + esc(pair[0]) + '</dt><dd>' + esc(pair[1]) + '</dd></div>';
      }).join('');
      const logs = Array.isArray(data.payment_logs) ? data.payment_logs : [];
      $('historyPaymentLogs').innerHTML = logs.length ? logs.map(function (log) {
        return '<div class="history-payment-log"><strong>' + esc(titleCase(log.action || 'Payment event')) + '</strong><div>' + esc(log.remarks || 'No remarks') + '</div><time>' + esc(storeDateTime(log.created_at)) + '</time></div>';
      }).join('') : '<div class="queue-empty">No payment log entries.</div>';
      $('historyProofImage').innerHTML = proofMarkup(order.payment_screenshot, order.id);
      const image = $('historyProofImage').querySelector('img');
      if (image) image.addEventListener('error', function () {
        $('historyProofImage').innerHTML = '<div class="proof-placeholder">The saved payment proof could not be loaded.</div>';
      }, { once: true });
    } catch (error) {
      $('historyDetailMeta').textContent = error.message || 'Unable to load this order.';
      $('historyDetailItems').textContent = '';
    }
  }

  function closeOrderDetail() {
    $('historyDetailBackdrop').hidden = true;
    $('historyProofImage').innerHTML = '<div class="proof-placeholder">Payment proof will appear here.</div>';
  }

  function setupNavigation() {
    const sidebar = $('sidebar');
    const backdrop = $('sidebarBackdrop');
    const app = document.querySelector('.app');
    const button = $('mobileMenu');
    function sync() {
      const mobile = window.innerWidth <= 760;
      const expanded = mobile ? sidebar.classList.contains('open') : !app.classList.contains('sidebar-hidden');
      const label = mobile ? (expanded ? 'Close navigation menu' : 'Open navigation menu') : (expanded ? 'Collapse navigation' : 'Expand navigation');
      button.setAttribute('aria-expanded', String(expanded));
      button.setAttribute('aria-label', label);
      button.title = label;
    }
    function closeMobile() {
      sidebar.classList.remove('open');
      backdrop.hidden = true;
      sync();
    }
    button.addEventListener('click', function () {
      if (window.innerWidth <= 760) {
        const open = !sidebar.classList.contains('open');
        sidebar.classList.toggle('open', open);
        backdrop.hidden = !open;
      } else {
        app.classList.toggle('sidebar-hidden');
        try { localStorage.setItem('seven_admin_sidebar_hidden', app.classList.contains('sidebar-hidden') ? '1' : '0'); } catch (_) { }
      }
      sync();
    });
    backdrop.addEventListener('click', closeMobile);
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') {
        closeOrderDetail();
        if (window.innerWidth <= 760 && sidebar.classList.contains('open')) closeMobile();
      }
    });
    window.addEventListener('resize', function () {
      if (window.innerWidth > 760) closeMobile();
      sync();
    });
    document.querySelectorAll('.nav a').forEach(function (link) {
      link.addEventListener('click', function () { if (window.innerWidth <= 760) closeMobile(); });
    });
    try {
      if (localStorage.getItem('seven_admin_sidebar_hidden') === '1' && window.innerWidth > 760) app.classList.add('sidebar-hidden');
    } catch (_) { }
    sync();
  }

  document.querySelectorAll('[data-period]').forEach(function (tab) {
    tab.addEventListener('click', function () {
      if (state.period === tab.dataset.period) return;
      state.period = tab.dataset.period;
      state.expandedStart = '';
      state.detail = {};
      updatePeriodTabs();
      loadReport();
    });
    tab.addEventListener('keydown', function (event) {
      const tabs = Array.from(document.querySelectorAll('[data-period]'));
      const currentIndex = tabs.indexOf(tab);
      let nextIndex = currentIndex;
      if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % tabs.length;
      else if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
      else if (event.key === 'Home') nextIndex = 0;
      else if (event.key === 'End') nextIndex = tabs.length - 1;
      else return;
      event.preventDefault();
      tabs[nextIndex].focus();
      tabs[nextIndex].click();
    });
  });

  document.querySelectorAll('[data-preset]').forEach(function (button) {
    button.addEventListener('click', function () {
      state.rangeMode = 'preset';
      state.preset = button.dataset.preset;
      document.querySelectorAll('[data-preset]').forEach(function (item) {
        item.classList.toggle('active', item === button);
      });
      state.expandedStart = '';
      state.detail = {};
      loadReport();
    });
  });

  $('salesFilters').addEventListener('submit', function (event) {
    event.preventDefault();
    const from = $('salesFrom').value;
    const to = $('salesTo').value;
    if (!from || !to) {
      setMessage('Choose both a From date and a To date.', true);
      return;
    }
    if (from > to) {
      setMessage('The From date must be on or before the To date.', true);
      return;
    }
    state.rangeMode = 'custom';
    state.preset = '';
    state.expandedStart = '';
    state.detail = {};
    document.querySelectorAll('[data-preset]').forEach(function (item) { item.classList.remove('active'); });
    loadReport();
  });

  $('refreshReport').addEventListener('click', function () {
    state.expandedStart = '';
    state.detail = {};
    loadReport();
  });

  // Export PDF: the browser print dialog ("Save as PDF") renders the @media print layout in
  // admin/css/sales.css. The page title becomes the suggested PDF file name.
  $('printSalesReport').addEventListener('click', function () {
    if (!state.report) {
      setMessage('Load a sales report before exporting.', true);
      return;
    }
    const report = state.report;
    const from = String(report.range.from || '').replace(/[^0-9-]/g, '');
    const to = String(report.range.to || '').replace(/[^0-9-]/g, '');
    const originalTitle = document.title;
    document.title = 'SEVEN Sales Report ' + from + ' to ' + to + ' (' + titleCase(state.period) + ')';
    window.addEventListener('afterprint', function restoreTitle() {
      document.title = originalTitle;
      window.removeEventListener('afterprint', restoreTitle);
    });
    window.print();
  });
  $('salesChartFrame').addEventListener('click', function (event) {
    const bar = event.target.closest('[data-chart-start]');
    if (bar) togglePeriod(bar.dataset.chartStart);
  });
  $('salesChartFrame').addEventListener('keydown', function (event) {
    const bar = event.target.closest('[data-chart-start]');
    if (bar && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      togglePeriod(bar.dataset.chartStart);
    }
  });
  $('salesRows').addEventListener('click', function (event) {
    if (event.target.closest('[data-order-detail]')) {
      openOrderDetail(event.target.closest('[data-order-detail]').dataset.orderDetail);
      return;
    }
    const pager = event.target.closest('[data-detail-page]');
    if (pager) {
      const start = pager.dataset.detailPage;
      if (!pager.disabled) loadDetail(start, Number(pager.dataset.page || 1));
      return;
    }
    const row = event.target.closest('[data-period-row]');
    if (row) togglePeriod(row.dataset.periodRow);
  });
  $('salesRows').addEventListener('keydown', function (event) {
    const row = event.target.closest('[data-period-row]');
    if (row && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      togglePeriod(row.dataset.periodRow);
    }
  });
  $('salesMobileList').addEventListener('click', function (event) {
    const order = event.target.closest('[data-order-detail]');
    if (order) {
      openOrderDetail(order.dataset.orderDetail);
      return;
    }
    const pager = event.target.closest('[data-detail-page]');
    if (pager) {
      const start = pager.dataset.detailPage;
      if (!pager.disabled) loadDetail(start, Number(pager.dataset.page || 1));
      return;
    }
    const period = event.target.closest('[data-mobile-period]');
    if (period) togglePeriod(period.dataset.mobilePeriod);
  });
  $('historyDetailClose').addEventListener('click', closeOrderDetail);
  $('historyDetailBackdrop').addEventListener('click', function (event) {
    if (event.target === $('historyDetailBackdrop')) closeOrderDetail();
  });

  // Report requests and sales details are scoped to the selected period and basis.

  setupNavigation();
  requireOwner().then(function (owner) {
    if (!owner) {
      window.location.replace('index.html');
      return;
    }
    document.body.classList.remove('sales-locked');
    $('salesApp').hidden = false;
    updatePeriodTabs();
    loadReport();
  }).catch(function () {
    window.location.replace('login.html?return=' + encodeURIComponent('sales.html'));
  });
})();
