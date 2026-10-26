/* Page logic extracted from admin/index.html. */
const money = v => `₱${Number(v || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
function msg(text, error = false) { document.getElementById('message').innerHTML = text ? '<div class="' + (error ? 'error' : 'notice') + '">' + esc(text) + '</div>' : '' }
let dashboardRolePromise = null;
async function getDashboardRole() {
  if (!dashboardRolePromise) {
    dashboardRolePromise = fetch('../api/admin_auth.php', { credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'application/json' } })
      .then(async response => {
        const data = await response.json();
        if (!response.ok || !data.ok || !data.admin) throw new Error(data.message || 'Unable to verify administrator access.');
        return String(data.admin.role || '');
      });
  }
  return dashboardRolePromise;
}
function setRestrictedSalesCards() {
  document.getElementById('statTotal').textContent = '—';
  document.getElementById('statTotalNote').textContent = 'Owner dashboard metric';
  document.getElementById('statSales').textContent = '—';
  document.getElementById('statSalesNote').textContent = 'Owner dashboard metric';
  document.getElementById('statWeekSales').textContent = '—';
  document.getElementById('statWeekNote').textContent = 'Owner dashboard metric';
  document.getElementById('statMonthSales').textContent = '—';
  document.getElementById('statMonthNote').textContent = 'Owner dashboard metric';
  document.getElementById('salesReportsLink').hidden = true;
}
async function loadStats() {
  try {
    const role = await getDashboardRole();
    const response = await fetch('../api/orders.php?admin_refresh=1', { credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'application/json' } });
    const activeData = await response.json();
    if (!response.ok || !activeData.ok) throw new Error(activeData.message || 'Unable to load active orders.');
    const orders = Array.isArray(activeData.orders) ? activeData.orders : [];
    const prep = orders.filter(order => ['pending', 'confirmed', 'in_preparation'].includes(order.order_status)).length;
    const payment = orders.filter(order => order.payment_method === 'gcash' && order.payment_status === 'submitted').length;
    document.getElementById('statPrepare').textContent = String(prep);
    document.getElementById('statPayment').textContent = String(payment);

    if (role !== 'owner') {
      setRestrictedSalesCards();
      msg('');
      return;
    }

    const summaryResponse = await fetch('../api/sales.php?summary=1', { credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'application/json' } });
    const summary = await summaryResponse.json();
    if (!summaryResponse.ok || !summary.ok) throw new Error(summary.message || 'Unable to load sales summary.');
    const today = summary.today || {}, week = summary.this_week || {}, month = summary.this_month || {};
    document.getElementById('statTotal').textContent = Number(summary.total_orders || 0).toLocaleString('en-PH');
    document.getElementById('statTotalNote').textContent = 'All orders ever placed';
    document.getElementById('statSales').textContent = money(today.sales);
    document.getElementById('statSalesNote').textContent = Number(today.orders || 0).toLocaleString('en-PH') + ' qualifying order' + (Number(today.orders || 0) === 1 ? '' : 's') + ' today';
    document.getElementById('statWeekSales').textContent = money(week.sales);
    document.getElementById('statWeekNote').textContent = Number(week.orders || 0).toLocaleString('en-PH') + ' qualifying order' + (Number(week.orders || 0) === 1 ? '' : 's') + ' this week';
    document.getElementById('statMonthSales').textContent = money(month.sales);
    document.getElementById('statMonthNote').textContent = Number(month.orders || 0).toLocaleString('en-PH') + ' qualifying order' + (Number(month.orders || 0) === 1 ? '' : 's') + ' this month';
    document.getElementById('salesReportsLink').hidden = false;
    msg('');
  } catch (error) {
    msg(error.message || 'Unable to load dashboard statistics.', true);
  }
}
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
function initAdminNav() {
  const links = [...document.querySelectorAll('.nav a')];
  links.forEach(link => { if (link.getAttribute('href') === 'index.html') link.classList.add('active'); link.addEventListener('click', () => { links.forEach(x => x.classList.remove('active')); link.classList.add('active'); if (window.innerWidth <= 760) closeSidebar() }) });
}
if (localStorage.getItem('seven_admin_sidebar_hidden') === '1' && window.innerWidth > 760) document.querySelector('.app').classList.add('sidebar-hidden');
syncNavigationButton();
initAdminNav();
loadStats();
setInterval(loadStats, 5000);
