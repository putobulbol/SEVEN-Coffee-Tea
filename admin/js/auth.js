(async function () {
  const loginPage = /\/admin\/login\.html$/i.test(location.pathname);
  if (loginPage) return;

  function injectLogout() {
    if (document.getElementById('adminLogout')) return;
    const host = document.querySelector('.top-actions') || document.querySelector('.top');
    if (!host) return;
    const button = document.createElement('button');
    button.id = 'adminLogout';
    button.type = 'button';
    button.className = 'admin-logout-button';
    button.textContent = 'Log out';
    button.style.cssText = 'border:1px solid #e6dfd2;background:#fffdf8;color:#18312f;border-radius:10px;padding:9px 11px;font-weight:800;cursor:pointer;';
    button.addEventListener('click', async () => {
      try { await fetch('../api/admin_auth.php', { method: 'DELETE', credentials: 'same-origin' }); } catch (_) { }
      location.href = 'login.html';
    });
    host.appendChild(button);
  }

  try {
    const r = await fetch('../api/admin_auth.php', { credentials: 'same-origin', cache: 'no-store' });
    if (!r.ok) throw new Error('Admin login required.');
    const d = await r.json();
    if (!d.ok) throw new Error('Admin login required.');
    injectLogout();
  } catch (_) {
    const current = location.pathname.split('/').pop() || 'index.html';
    const allowed = /^(index|orders|products|banners|sales)\.html$/i.test(current);
    // Admin pages sign in on their own page (admin/login.html), never the customer login.
    location.href = 'login.html?return=' + encodeURIComponent(allowed ? current : 'index.html');
  }
})();
