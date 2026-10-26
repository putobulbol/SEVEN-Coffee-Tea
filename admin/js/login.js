/* Admin sign-in (admin/login.html). Posts to api/admin_login.php, which only accepts owner/staff. */
(function () {
  'use strict';

  const form = document.getElementById('adminLoginForm');
  const email = document.getElementById('adminEmail');
  const password = document.getElementById('adminPassword');
  const message = document.getElementById('adminLoginMessage');
  const submit = document.getElementById('adminLoginSubmit');
  const toggle = document.getElementById('adminTogglePassword');

  // Return target: a known admin page name only (e.g. "orders.html" or "orders.html#history").
  function returnTarget() {
    const value = new URLSearchParams(location.search).get('return') || '';
    return /^(index|orders|products|banners|sales)\.html(#[a-z0-9_-]+)?$/i.test(value) ? value : 'index.html';
  }

  function setFieldError(input, errorId, text) {
    document.getElementById(errorId).textContent = text;
    if (text) input.setAttribute('aria-invalid', 'true');
    else input.removeAttribute('aria-invalid');
  }

  // Already signed in as admin? Skip the form.
  fetch('../api/admin_auth.php', { credentials: 'same-origin', cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => { if (d && d.ok) location.replace(returnTarget()); })
    .catch(() => { });

  toggle.addEventListener('click', () => {
    const show = password.type === 'password';
    password.type = show ? 'text' : 'password';
    toggle.textContent = show ? 'Hide' : 'Show';
    toggle.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const emailValue = email.value.trim().toLowerCase();
    let valid = true;
    message.textContent = '';
    message.classList.remove('success');
    setFieldError(email, 'adminEmailError', '');
    setFieldError(password, 'adminPasswordError', '');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue) || emailValue.length > 190) {
      setFieldError(email, 'adminEmailError', 'Enter your admin email address.');
      valid = false;
    }
    if (!password.value) {
      setFieldError(password, 'adminPasswordError', 'Password is required.');
      valid = false;
    }
    if (!valid) { (email.getAttribute('aria-invalid') ? email : password).focus(); return; }

    submit.disabled = true;
    submit.textContent = 'Signing in…';
    try {
      const response = await fetch('../api/admin_login.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ email: emailValue, password: password.value }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok || (data.role !== 'owner' && data.role !== 'staff')) {
        throw new Error(data.message || 'Invalid email or password.');
      }
      message.textContent = 'Signed in. Opening the dashboard…';
      message.classList.add('success');
      location.replace(returnTarget());
    } catch (error) {
      message.textContent = error.message || 'Unable to sign in. Please try again.';
      password.value = '';
      password.focus();
      submit.disabled = false;
      submit.textContent = 'Sign in';
    }
  });
})();
