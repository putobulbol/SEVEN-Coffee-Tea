(() => {
  // Customer-only return URLs. Admin pages have their own sign-in at admin/login.html.
  function getReturnUrl() {
    const params = new URLSearchParams(window.location.search);
    const value = params.get('return') || '';
    const safeLocalPath = value &&
      !value.startsWith('/') &&
      !value.split('/').includes('..') &&
      !/^[a-z][a-z0-9+.-]*:/i.test(value) &&
      /^[a-z0-9_./?=&%-]+$/i.test(value);

    return safeLocalPath && !value.startsWith('admin/') ? value : 'index.html';
  }

  function setError(id, message) {
    const el = document.getElementById(id);
    if (el) el.textContent = message || '';
  }

  function togglePassword(inputId, buttonId) {
    document.getElementById(buttonId)?.addEventListener('click', () => {
      const input = document.getElementById(inputId);
      const button = document.getElementById(buttonId);
      if (!input || !button) return;
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      button.textContent = show ? 'Hide' : 'Show';
      button.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
    });
  }

  togglePassword('password', 'togglePassword');
  togglePassword('confirmPassword', 'toggleConfirmPassword');

  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');

  // Register: live password checklist; "Create Account" stays disabled until every rule
  // passes and the confirmation matches. The server re-checks the same rules.
  if (registerForm && window.SevenPasswordPolicy) {
    const passwordInput = document.getElementById('password');
    const confirmInput = document.getElementById('confirmPassword');
    const submitButton = registerForm.querySelector('button[type="submit"]');
    const syncSubmit = () => {
      if (!submitButton) return;
      const ready = window.SevenPasswordPolicy.isValid(passwordInput.value) && confirmInput.value === passwordInput.value;
      submitButton.disabled = !ready;
      submitButton.title = ready ? '' : 'Meet every password requirement and confirm your password first.';
    };
    if (passwordInput) window.SevenPasswordPolicy.mountChecklist(passwordInput, syncSubmit);
    confirmInput?.addEventListener('input', syncSubmit);
    syncSubmit();
  }

  // Register draft: keep what the customer typed (never passwords or the terms box) in this tab's
  // sessionStorage, so a trip to the Terms page or a reload does not lose it.
  const DRAFT_KEY = 'seven_register_draft';
  const DRAFT_FIELDS = ['fullName', 'email', 'contactNumber', 'username'];
  const draftStore = {
    read() { try { return JSON.parse(sessionStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch (_) { return {}; } },
    write(value) { try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify(value)); } catch (_) { /* storage blocked */ } },
    clear() { try { sessionStorage.removeItem(DRAFT_KEY); } catch (_) { /* storage blocked */ } },
  };
  if (registerForm) {
    const saved = draftStore.read();
    DRAFT_FIELDS.forEach((id) => {
      const input = document.getElementById(id);
      if (!input) return;
      if (typeof saved[id] === 'string' && !input.value) input.value = saved[id].slice(0, 190);
      input.addEventListener('input', () => {
        const draft = draftStore.read();
        draft[id] = input.value;
        draftStore.write(draft);
      });
    });
  }

  // Terms page "Back": return to wherever the customer came from.
  const termsBack = document.getElementById('termsBack');
  if (termsBack) {
    const params = new URLSearchParams(window.location.search);
    let referrer = null;
    try { referrer = document.referrer ? new URL(document.referrer) : null; } catch (_) { referrer = null; }
    const sameOriginReferrer = Boolean(referrer && referrer.origin === window.location.origin);
    const fromRegister = params.get('from') === 'register' || Boolean(sameOriginReferrer && /\/register\.html$/i.test(referrer.pathname));
    const canGoBack = sameOriginReferrer && window.history.length > 1;

    if (canGoBack) {
      termsBack.textContent = fromRegister ? 'Back to Create Account' : 'Back';
      termsBack.href = referrer.pathname.split('/').pop() + referrer.search; // no-JS-style fallback target
    } else {
      // Opened in a new tab (register.html uses target="_blank") or typed directly: no history to return to.
      termsBack.textContent = 'Back to Create Account';
      termsBack.href = 'register.html';
    }
    termsBack.addEventListener('click', (event) => {
      if (canGoBack) {
        event.preventDefault();
        window.history.back();
        return;
      }
      if (fromRegister) {
        // The register form is still open in the tab that opened this one; closing returns there.
        event.preventDefault();
        window.close();
        // Browsers ignore close() for tabs they did not let scripts open; fall back to the link.
        setTimeout(() => { window.location.href = 'register.html'; }, 250);
      }
    });
  }

  // Preserve the checkout destination when a guest chooses customer registration.
  const signupAnchor = document.querySelector('.account-link a[href="register.html"]');
  if (loginForm && signupAnchor) {
    const returnTo = new URLSearchParams(window.location.search).get('return');
    if (returnTo) signupAnchor.href = 'register.html?return=' + encodeURIComponent(returnTo);
  }

  // Keep the original destination if the user switches from registration back to login.
  const registrationLoginAnchor = document.querySelector('.account-link a[href="login.html"]');
  if (registerForm && registrationLoginAnchor) {
    const returnTo = new URLSearchParams(window.location.search).get('return');
    if (returnTo) registrationLoginAnchor.href = 'login.html?return=' + encodeURIComponent(returnTo);
  }

  loginForm?.addEventListener('submit', async event => {
    event.preventDefault();

    const email = document.getElementById('email')?.value.trim().toLowerCase() || '';
    const password = document.getElementById('password')?.value || '';
    const message = document.getElementById('loginMessage');

    setError('emailError', '');
    setError('passwordError', '');
    if (message) {
      message.textContent = '';
      message.classList.remove('success');
    }

    let valid = true;
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('emailError', 'Enter your registered email address.');
      valid = false;
    }
    if (!password) { setError('passwordError', 'Password is required.'); valid = false; }
    if (!valid) return;

    try {
      const response = await fetch('api/auth.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ action: 'login', email, password })
      });
      const data = await response.json();

      if (data.requires_verification) {
        const returnTo = new URLSearchParams(window.location.search).get('return');
        const verificationUrl = new URL('register.html', window.location.href);
        verificationUrl.searchParams.set('verify', '1');
        if (returnTo) verificationUrl.searchParams.set('return', returnTo);
        window.location.href = verificationUrl.href;
        return;
      }
      if (!response.ok || !data.ok) throw new Error(data.message || 'Unable to log in.');
      // The server only signs in customers here; never follow a non-customer role from this page.
      if (data.role !== 'customer') throw new Error('Invalid email or password.');

      if (message) {
        message.textContent = 'Login successful. Redirecting...';
        message.classList.add('success');
      }
      setTimeout(() => { window.location.href = getReturnUrl(); }, 250);
    } catch (error) {
      if (message) message.textContent = error.message || 'Unable to log in.';
    }
  });

  const verificationStep = document.getElementById('emailVerificationStep');
  const verificationForm = document.getElementById('emailVerificationForm');
  let pendingVerificationEmail = '';

  function showVerificationStep(email, messageText, verified = false, isError = false) {
    pendingVerificationEmail = String(email || pendingVerificationEmail || '');
    if (registerForm) registerForm.hidden = true;
    if (verificationStep) verificationStep.hidden = false;
    const emailText = document.getElementById('verificationEmailText');
    if (emailText) emailText.textContent = pendingVerificationEmail
      ? 'Enter the six-digit code sent to ' + pendingVerificationEmail + '.'
      : 'Enter or resend the six-digit code for your pending account.';
    const status = document.getElementById('verificationMessage');
    if (status) {
      status.textContent = messageText || '';
      status.classList.toggle('success', Boolean(verified && !isError));
      status.classList.toggle('error', Boolean(isError));
    }
    if (verificationForm) verificationForm.hidden = Boolean(verified);
    const resend = document.getElementById('resendVerificationCode');
    if (resend) resend.hidden = Boolean(verified);
    const continueLink = document.getElementById('verificationContinue');
    if (continueLink) continueLink.hidden = !verified;
  }

  async function verificationRequest(action, payload = {}) {
    const response = await fetch('api/email_verification.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      cache: 'no-store',
      body: JSON.stringify(Object.assign({ action: action }, payload))
    });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.message || 'Unable to verify your email.');
    return data;
  }

  verificationForm?.addEventListener('submit', async event => {
    event.preventDefault();
    const codeInput = document.getElementById('verificationCode');
    const code = codeInput.value.trim();
    const errorElement = document.getElementById('verificationCodeError');
    if (!/^[0-9]{6}$/.test(code)) {
      if (errorElement) errorElement.textContent = 'Enter the six-digit code from your email.';
      codeInput.focus();
      return;
    }
    if (errorElement) errorElement.textContent = '';
    const button = verificationForm.querySelector('button[type="submit"]');
    button.disabled = true;
    button.textContent = 'Verifying…';
    try {
      const data = await verificationRequest('verify', { code: code });
      showVerificationStep(pendingVerificationEmail, data.message || 'Email verified. You can now log in.', true);
    } catch (error) {
      showVerificationStep(pendingVerificationEmail, error.message || 'Unable to verify your email.', false, true);
    } finally {
      button.disabled = false;
      button.textContent = 'Verify email';
    }
  });

  // After a successful resend the button stays locked for 60s so codes are not requested back-to-back.
  let resendTimer = null;
  function startResendCooldown(button, seconds) {
    clearInterval(resendTimer);
    const tick = () => {
      if (seconds <= 0) {
        clearInterval(resendTimer);
        button.disabled = false;
        button.textContent = 'Resend code';
        return;
      }
      button.textContent = `Resend code in ${seconds}s`;
      seconds--;
    };
    button.disabled = true;
    tick();
    resendTimer = setInterval(tick, 1000);
  }

  document.getElementById('resendVerificationCode')?.addEventListener('click', async () => {
    const button = document.getElementById('resendVerificationCode');
    button.disabled = true;
    button.textContent = 'Sending…';
    try {
      const data = await verificationRequest('resend');
      showVerificationStep(pendingVerificationEmail, data.message || 'A new code was sent to your email.');
      startResendCooldown(button, 60);
    } catch (error) {
      showVerificationStep(pendingVerificationEmail, error.message || 'Unable to resend your code.', false, true);
      button.disabled = false;
      button.textContent = 'Resend code';
    }
  });

  if (registerForm && new URLSearchParams(window.location.search).get('verify') === '1') {
    showVerificationStep('', 'Checking your pending verification…');
    fetch('api/email_verification.php', { credentials: 'same-origin', cache: 'no-store' })
      .then(async response => {
        const data = await response.json();
        if (!response.ok || !data.ok) throw new Error(data.message || 'No pending verification was found.');
        pendingVerificationEmail = data.email || '';
        const emailText = document.getElementById('verificationEmailText');
        if (emailText) emailText.textContent = 'Enter the six-digit code sent to ' + pendingVerificationEmail + '.';
        const status = document.getElementById('verificationMessage');
        if (status) status.textContent = '';
      })
      .catch(error => showVerificationStep('', error.message || 'Start registration or sign in again to request a code.', false, true));
  }

  registerForm?.addEventListener('submit', async event => {
    event.preventDefault();

    const name = document.getElementById('fullName')?.value.trim() || '';
    const email = document.getElementById('email')?.value.trim() || '';
    const contact_number = document.getElementById('contactNumber')?.value.trim() || '';
    const username = document.getElementById('username')?.value.trim() || '';
    const password = document.getElementById('password')?.value || '';
    const confirmPassword = document.getElementById('confirmPassword')?.value || '';
    const terms_accepted = Boolean(document.getElementById('termsAccepted')?.checked);
    const message = document.getElementById('registerMessage');

    ['fullNameError', 'emailError', 'contactNumberError', 'usernameError', 'passwordError', 'confirmPasswordError', 'termsAcceptedError'].forEach(id => setError(id, ''));
    if (message) {
      message.textContent = '';
      message.classList.remove('success');
    }

    let valid = true;
    if (name.length < 2 || name.length > 120) {
      setError('fullNameError', 'Enter your full name (2–120 characters).');
      valid = false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 190) {
      setError('emailError', 'Enter a valid email address.');
      valid = false;
    }
    if (!/^[0-9+().\s-]{7,40}$/.test(contact_number)) {
      setError('contactNumberError', 'Enter a valid contact number.');
      valid = false;
    }
    if (!username) {
      setError('usernameError', 'Username is required.');
      valid = false;
    } else if (username.length < 3 || username.length > 15) {
      setError('usernameError', 'Username must be 3–15 characters.');
      valid = false;
    } else if (!/^[a-zA-Z0-9._-]+$/.test(username)) {
      setError('usernameError', 'Use letters, numbers, dot, underscore, or hyphen only.');
      valid = false;
    }

    if (!password) {
      setError('passwordError', 'Password is required.');
      valid = false;
    } else if (window.SevenPasswordPolicy && !window.SevenPasswordPolicy.isValid(password)) {
      setError('passwordError', window.SevenPasswordPolicy.MESSAGE);
      valid = false;
    }
    if (password !== confirmPassword) {
      setError('confirmPasswordError', 'Passwords do not match.');
      valid = false;
    }
    if (!terms_accepted) {
      setError('termsAcceptedError', 'You must agree to the Terms and Conditions.');
      valid = false;
    }
    if (!valid) return;

    try {
      const response = await fetch('api/customer_auth.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ action: 'register', name, email, contact_number, username, password, terms_accepted })
      });
      const data = await response.json();
      if (data.requires_verification || data.verification_required) {
        draftStore.clear(); // the account exists now; the draft is no longer needed
        showVerificationStep(data.email || email, data.message || 'Check your email for the verification code.', false, !data.ok);
        return;
      }
      if (!response.ok || !data.ok) {
        const fieldMap = { fullName: 'fullNameError', email: 'emailError', contactNumber: 'contactNumberError', username: 'usernameError', password: 'passwordError', termsAccepted: 'termsAcceptedError' };
        if (data.field && fieldMap[data.field]) setError(fieldMap[data.field], data.message || 'Please check this field.');
        throw new Error(data.message || 'Unable to create account.');
      }

      draftStore.clear();
      showVerificationStep(data.email || email, data.message || 'Check your email for the verification code.');
    } catch (error) {
      if (message && !message.classList.contains('success')) message.textContent = error.message || 'Unable to create account.';
    }
  });
})();