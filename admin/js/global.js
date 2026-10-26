/* Shared UTF-8 CSV helper. Text values that could become spreadsheet formulas are neutralized. */
window.SEVEN_CSV = window.SEVEN_CSV || (function () {
  function protectText(value) {
    const text = String(value == null ? '' : value);
    return /^[\u0000-\u0020]*[=+\-@]/.test(text) ? "'" + text : text;
  }
  function csvCell(value) {
    let text;
    if (typeof value === 'number' && Number.isFinite(value)) text = String(value);
    else if (typeof value === 'boolean') text = value ? 'TRUE' : 'FALSE';
    else text = protectText(value);
    return '"' + text.replace(/"/g, '""') + '"';
  }
  function build(headers, rows) {
    const all = [headers].concat(Array.isArray(rows) ? rows : []);
    return '\uFEFF' + all.map(function (row) {
      return (Array.isArray(row) ? row : []).map(csvCell).join(',');
    }).join('\r\n');
  }
  function download(filename, headers, rows) {
    const csv = build(headers, rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = String(filename || 'export.csv').replace(/[\\/:*?"<>|]/g, '_');
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(function () { URL.revokeObjectURL(url) }, 1000);
  }
  return { build: build, download: download, protectText: protectText };
})();

/* Shared admin accessibility helpers and owner-only navigation. */
document.querySelectorAll('.nav a').forEach(function (link) {
  var label = link.querySelector('span:last-child');
  if (label) {
    var name = label.textContent.trim();
    link.title = name;
    link.setAttribute('aria-label', name);
  }
});
document.querySelectorAll('.store-status').forEach(function (status) {
  var copy = status.querySelector('.store-status-copy');
  if (copy) {
    var label = copy.textContent.trim();
    status.title = label;
    status.setAttribute('aria-label', label);
  }
});

// Every admin page gets the same Orders sub-menu (Order History, then owner-only Sales Reports).
// Only orders.html/sales.html had it in their markup, so the Sales link used to appear alone elsewhere.
(function ensureOrderHistorySubLink() {
  const nav = document.querySelector('.nav');
  const ordersLink = nav && nav.querySelector('a[href="orders.html"]');
  if (!ordersLink || nav.querySelector('a.nav-sub-link[href="orders.html#history"]')) return;
  const link = document.createElement('a');
  link.className = 'nav-sub-link';
  link.href = 'orders.html#history';
  link.textContent = 'Order History';
  ordersLink.insertAdjacentElement('afterend', link);
})();

(async function addOwnerSalesNavigation() {
  try {
    const response = await fetch('../api/admin_auth.php', {
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { Accept: 'application/json' }
    });
    if (!response.ok) return;
    const data = await response.json();
    if (!data.ok || !data.admin || String(data.admin.role || '') !== 'owner') return;

    const nav = document.querySelector('.nav');
    if (!nav || nav.querySelector('a[href="sales.html"]')) return;
    const historyLink = nav.querySelector('a.nav-sub-link[href="orders.html#history"]');
    const ordersLink = nav.querySelector('a[href="orders.html"]');
    const anchor = historyLink || ordersLink;
    if (!anchor) return;

    const link = document.createElement('a');
    link.href = 'sales.html';
    link.className = 'nav-sub-link sales-nav-link';
    link.textContent = 'Sales Reports';
    link.title = 'Sales Reports';
    link.setAttribute('aria-label', 'Sales Reports');
    if (/\/admin\/sales\.html$/i.test(location.pathname)) {
      link.classList.add('active');
      link.setAttribute('aria-current', 'page');
    }
    anchor.insertAdjacentElement('afterend', link);
    link.addEventListener('click', function () {
      if (window.innerWidth <= 760) {
        const sidebar = document.getElementById('sidebar') || document.getElementById('side');
        const backdrop = document.getElementById('sidebarBackdrop');
        if (sidebar) sidebar.classList.remove('open');
        if (backdrop) backdrop.hidden = true;
      }
    });
  } catch (_) {
    // Navigation stays conservative when the role check cannot be completed.
  }
})();
