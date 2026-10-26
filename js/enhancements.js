/* =====================================================================
   SEVEN Coffee & Tea — UI/UX Enhancement JavaScript v2.0
   Implements scroll-reveal, hero dots, GCash copy, password strength,
   elapsed timers, receipt lightbox, and drag-and-drop upload UX.
   ===================================================================== */

(function () {
  'use strict';

  /* -----------------------------------------------------------------------
     1. Scroll-reveal using IntersectionObserver
     ----------------------------------------------------------------------- */
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    );

    // Apply reveal to major sections automatically
    const revealSelectors = [
      '.signature-menu',
      '.menu-card.product',
      '.reason-card',
      '.story-block',
      '.testimonial-card',
      '.featured-side',
      '.footer-brand',
    ];

    document.addEventListener('DOMContentLoaded', () => {
      revealSelectors.forEach((sel) => {
        document.querySelectorAll(sel).forEach((el) => {
          if (!el.classList.contains('reveal')) {
            el.classList.add('reveal');
          }
          observer.observe(el);
        });
      });

      // Also wire up any existing .reveal elements
      document.querySelectorAll('.reveal, .reveal-stagger').forEach((el) => {
        observer.observe(el);
      });
    });

    // Re-run when products are loaded dynamically
    window.addEventListener('seven:products-loaded', () => {
      setTimeout(() => {
        document.querySelectorAll('.menu-card.product:not(.reveal)').forEach((el) => {
          el.classList.add('reveal');
          observer.observe(el);
        });
        document.querySelectorAll('.signature-menu:not(.reveal)').forEach((el) => {
          el.classList.add('reveal');
          observer.observe(el);
        });
      }, 100);
    });
  }

  /* -----------------------------------------------------------------------
     2. Hero carousel pagination dots
     ----------------------------------------------------------------------- */
  window.sevenEnhanceDots = function (containerId, count, getCurrent, goTo) {
    const hero = document.getElementById(containerId);
    if (!hero) return;

    // Remove any existing dots container
    hero.querySelector('.hero-dots')?.remove();

    if (count <= 1) return;

    const dotsWrap = document.createElement('div');
    dotsWrap.className = 'hero-dots';
    dotsWrap.setAttribute('role', 'group');
    dotsWrap.setAttribute('aria-label', 'Banner navigation');

    for (let i = 0; i < count; i++) {
      const dot = document.createElement('button');
      dot.className = 'hero-dot' + (i === 0 ? ' active' : '');
      dot.type = 'button';
      dot.setAttribute('aria-label', `Go to slide ${i + 1}`);
      dot.addEventListener('click', () => goTo(i));
      dotsWrap.appendChild(dot);
    }
    hero.appendChild(dotsWrap);

    const updateDots = function (activeIndex) {
      dotsWrap.querySelectorAll('.hero-dot').forEach((d, i) => {
        d.classList.toggle('active', i === activeIndex);
        if (i === activeIndex) d.setAttribute('aria-current', 'true');
        else d.removeAttribute('aria-current');
      });
    };
    updateDots(0);
    return updateDots;
  };

  /* -----------------------------------------------------------------------
     3. Header badge pulses (cart count + notification dot)
     Observes the DOM so it fires for every update, whoever renders it.
     ----------------------------------------------------------------------- */
  function replayAnimation(el, cls) {
    el.classList.remove(cls);
    void el.offsetWidth; // force reflow so the animation restarts
    el.classList.add(cls);
  }

  const cartCountEl = document.getElementById('cartCount');
  if (cartCountEl) {
    let lastCount = cartCountEl.textContent;
    new MutationObserver(() => {
      const now = cartCountEl.textContent;
      if (now !== lastCount && parseInt(now || '0', 10) > 0) replayAnimation(cartCountEl, 'updated');
      lastCount = now;
    }).observe(cartCountEl, { childList: true, characterData: true, subtree: true });
    cartCountEl.addEventListener('animationend', () => cartCountEl.classList.remove('updated'));
  }

  document.querySelectorAll('#globalNotificationBtn').forEach((btn) => {
    new MutationObserver((records) => {
      const changed = records.some((r) => r.oldValue !== btn.getAttribute('data-unread'));
      if (changed && btn.dataset.unread) replayAnimation(btn, 'badge-bump');
    }).observe(btn, { attributes: true, attributeFilter: ['data-unread'], attributeOldValue: true });
    btn.addEventListener('animationend', () => btn.classList.remove('badge-bump'));
  });

  /* -----------------------------------------------------------------------
     3b. Header glass state on scroll + mobile drawer dismissal
     ----------------------------------------------------------------------- */
  const siteHeader = document.querySelector('.site-header');
  if (siteHeader) {
    let ticking = false;
    const syncHeader = () => {
      siteHeader.classList.toggle('is-scrolled', window.scrollY > 8);
      ticking = false;
    };
    window.addEventListener('scroll', () => {
      if (!ticking) { ticking = true; requestAnimationFrame(syncHeader); }
    }, { passive: true });
    syncHeader();

    const closeMobileNav = () => {
      const nav = siteHeader.querySelector('.links.is-open');
      if (!nav) return false;
      nav.classList.remove('is-open');
      const toggle = siteHeader.querySelector('.mobile-nav-toggle');
      toggle?.setAttribute('aria-expanded', 'false');
      toggle?.setAttribute('aria-label', 'Open navigation');
      return true;
    };
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.site-header .links, .site-header .mobile-nav-toggle')) closeMobileNav();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && closeMobileNav()) siteHeader.querySelector('.mobile-nav-toggle')?.focus();
    });
  }

  /* -----------------------------------------------------------------------
     4. GCash copy button enhancement
     ----------------------------------------------------------------------- */
  document.addEventListener('DOMContentLoaded', () => {
    // Find the GCash number small text and enhance it with a copy button
    document.querySelectorAll('.gcash-fields p small, #gcashFields p small').forEach((el) => {
      const text = el.innerHTML;
      // Extract GCash number (09XX format)
      const match = text.match(/09\d{2}\s?\d{3}\s?\d{4}/);
      if (!match) return;
      const rawNumber = match[0].replace(/\s/g, '');

      // Replace the GCash number line with enhanced display
      const numberLine = el.innerHTML.split('<br>')[0];
      const rest = el.innerHTML.split('<br>').slice(1).join('<br>');

      el.innerHTML =
        `<span class="gcash-number-label" style="font-size:10px;font-weight:800;color:#5a6f6b;letter-spacing:.1em;text-transform:uppercase">GCash Number</span><br>` +
        `<span class="gcash-number-display" style="display:flex;align-items:center;gap:10px;background:#fff;border:1.5px solid rgba(201,151,60,.3);border-radius:12px;padding:10px 14px;margin:6px 0 10px">` +
        `<span class="gcash-number-text" style="font-size:16px;font-weight:800;letter-spacing:.1em;color:#082f2c;flex:1">${rawNumber}</span>` +
        `<button class="gcash-copy-btn" type="button" data-copy="${rawNumber}">📋 Copy</button>` +
        `</span>` +
        `<br>` + rest;

      // Wire up copy button
      el.querySelector('.gcash-copy-btn')?.addEventListener('click', function () {
        navigator.clipboard.writeText(this.dataset.copy).then(() => {
          const prev = this.textContent;
          this.textContent = '✓ Copied!';
          this.classList.add('copied');
          setTimeout(() => {
            this.textContent = prev;
            this.classList.remove('copied');
          }, 2000);
        }).catch(() => {
          // Fallback
          const ta = document.createElement('textarea');
          ta.value = this.dataset.copy;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
          const prev = this.textContent;
          this.textContent = '✓ Copied!';
          this.classList.add('copied');
          setTimeout(() => {
            this.textContent = prev;
            this.classList.remove('copied');
          }, 2000);
        });
      });
    });

    /* -----------------------------------------------------------------------
       5. GCash screenshot drag-and-drop enhancement
       ----------------------------------------------------------------------- */
    // Limits mirror api/orders.php (5 MB; JPG, PNG, WebP).
    const MAX_PROOF_BYTES = 5 * 1024 * 1024;
    const PROOF_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
    const formatBytes = (n) => (n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB');

    document.querySelectorAll('#gcashScreenshot').forEach((fileInput) => {
      const field = fileInput.closest('.field');
      if (!field) return;
      fileInput.setAttribute('accept', PROOF_TYPES.join(','));
      field.classList.add('proof-field');

      const dropzone = document.createElement('div');
      dropzone.className = 'screenshot-dropzone';
      dropzone.setAttribute('role', 'button');
      dropzone.tabIndex = 0;
      dropzone.setAttribute('aria-label', 'Upload GCash payment screenshot');
      dropzone.innerHTML =
        '<svg class="dropzone-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="m21 16-5-5-7 7"/></svg>' +
        '<p><strong>Drag &amp; drop</strong> your GCash screenshot, or <u>browse</u></p>' +
        '<p class="dropzone-hint">JPG, PNG or WebP · max 5 MB</p>';

      const previewCard = document.createElement('div');
      previewCard.className = 'proof-preview';
      previewCard.hidden = true;
      previewCard.innerHTML =
        '<img class="screenshot-preview" src="data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=" alt="Payment screenshot preview">' +
        '<div class="proof-meta"><strong class="proof-name"></strong><small class="proof-size"></small>' +
        '<div class="proof-actions"><button type="button" class="proof-change">Change</button><button type="button" class="proof-remove">Remove</button></div></div>';

      const error = document.createElement('p');
      error.className = 'proof-error';
      error.setAttribute('role', 'alert');

      field.insertBefore(dropzone, fileInput);
      field.insertBefore(previewCard, fileInput);
      field.insertBefore(error, fileInput);
      // Visually hidden rather than display:none, so the browser's "required" prompt can still appear.
      fileInput.classList.add('visually-hidden-input');
      fileInput.tabIndex = -1;

      let previewUrl = '';
      const reset = () => {
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        previewUrl = '';
        fileInput.value = '';
        previewCard.hidden = true;
        dropzone.hidden = false;
      };
      const accept = (file) => {
        error.textContent = '';
        if (!PROOF_TYPES.includes(file.type)) { error.textContent = 'Please choose a JPG, PNG or WebP image.'; reset(); return false; }
        if (file.size > MAX_PROOF_BYTES) { error.textContent = `That image is ${formatBytes(file.size)}. The limit is 5 MB.`; reset(); return false; }
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        previewUrl = URL.createObjectURL(file);
        previewCard.querySelector('img').src = previewUrl;
        previewCard.querySelector('.proof-name').textContent = file.name;
        previewCard.querySelector('.proof-size').textContent = formatBytes(file.size);
        previewCard.hidden = false;
        dropzone.hidden = true;
        return true;
      };

      dropzone.addEventListener('click', () => fileInput.click());
      dropzone.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); }
      });
      dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('drag-over'); });
      dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag-over'));
      dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('drag-over');
        const file = e.dataTransfer.files[0];
        if (!file || !accept(file)) return;
        const dt = new DataTransfer();
        dt.items.add(file);
        fileInput.files = dt.files;
      });
      fileInput.addEventListener('change', () => {
        const file = fileInput.files[0];
        if (file) accept(file);
      });
      fileInput.addEventListener('invalid', () => {
        error.textContent = 'Please attach your GCash payment screenshot.';
        dropzone.focus();
      });
      previewCard.querySelector('.proof-change').addEventListener('click', () => fileInput.click());
      previewCard.querySelector('.proof-remove').addEventListener('click', () => { reset(); dropzone.focus(); });
    });

    /* 5b. GCash reference: digits only, live 13-digit counter */
    document.querySelectorAll('#gcashReference').forEach((ref) => {
      ref.setAttribute('autocomplete', 'off');
      const counter = document.createElement('small');
      counter.className = 'ref-counter';
      counter.setAttribute('aria-live', 'polite');
      ref.insertAdjacentElement('afterend', counter);
      const sync = () => {
        const digits = ref.value.replace(/\D/g, '').slice(0, 13);
        if (digits !== ref.value) ref.value = digits;
        counter.textContent = digits.length === 13 ? '✓ 13 of 13 digits' : `${digits.length} of 13 digits`;
        counter.classList.toggle('complete', digits.length === 13);
      };
      ref.addEventListener('input', sync);
      sync();
    });
  });

  /* -----------------------------------------------------------------------
     6. Password strength meter (register page)
     ----------------------------------------------------------------------- */
  // Register page (#password/#confirmPassword) and profile page (#newPassword/#confirmNewPassword).
  function attachPasswordFeedback(passwordInput, confirmInput, minLength) {
    const field = passwordInput.closest('.register-field, .login-field, .profile-field');
    if (!field || field.querySelector('.password-strength-bar')) return;

    const bar = document.createElement('div');
    bar.className = 'password-strength-bar';
    bar.setAttribute('aria-hidden', 'true');
    bar.innerHTML = '<div class="password-strength-fill"></div>';
    const label = document.createElement('small');
    label.className = 'password-strength-label';
    label.setAttribute('aria-live', 'polite');
    (passwordInput.closest('.password-wrap') || passwordInput).insertAdjacentElement('afterend', bar);
    bar.insertAdjacentElement('afterend', label);
    const fill = bar.firstElementChild;

    let matchNote = null;
    if (confirmInput) {
      matchNote = document.createElement('small');
      matchNote.className = 'confirm-match-note';
      matchNote.setAttribute('aria-live', 'polite');
      (confirmInput.closest('.password-wrap') || confirmInput).insertAdjacentElement('afterend', matchNote);
    }

    const syncMatch = () => {
      if (!confirmInput) return;
      const wrap = confirmInput.closest('.register-field, .login-field, .profile-field') || confirmInput.parentElement;
      const filled = confirmInput.value.length > 0;
      const match = filled && confirmInput.value === passwordInput.value;
      wrap.classList.toggle('confirm-match-ok', match);
      wrap.classList.toggle('confirm-match-fail', filled && !match);
      matchNote.textContent = !filled ? '' : match ? '✓ Passwords match' : 'Passwords do not match yet';
    };

    const syncStrength = () => {
      const val = passwordInput.value;
      if (!val) { fill.className = 'password-strength-fill'; label.textContent = ''; label.className = 'password-strength-label'; syncMatch(); return; }
      let score = 0;
      if (val.length >= 8) score++;
      if (/[A-Z]/.test(val)) score++;
      if (/[0-9]/.test(val)) score++;
      if (/[^A-Za-z0-9]/.test(val)) score++;
      const level = val.length < minLength ? 'weak' : score <= 1 ? 'weak' : score <= 2 ? 'medium' : 'strong';
      fill.className = 'password-strength-fill ' + level;
      label.className = 'password-strength-label ' + level;
      label.textContent = val.length < minLength
        ? `Too short — ${minLength - val.length} more character${minLength - val.length === 1 ? '' : 's'}`
        : { weak: 'Weak — add numbers, capitals or symbols', medium: 'Fair password', strong: 'Strong password' }[level];
      syncMatch();
    };

    // Where the rule checklist (js/password-policy.js) is shown, it replaces the strength meter.
    if (field.querySelector('.pw-meter')) {
      bar.remove();
      label.remove();
      passwordInput.addEventListener('input', syncMatch);
    } else {
      passwordInput.addEventListener('input', syncStrength);
    }
    confirmInput?.addEventListener('input', syncMatch);
  }

  document.addEventListener('DOMContentLoaded', () => {
    const pairs = [['password', 'confirmPassword'], ['newPassword', 'confirmNewPassword']];
    pairs.forEach(([pw, confirm]) => {
      const input = document.getElementById(pw);
      // The login page also has #password but no confirm field; skip it.
      if (!input || !document.getElementById(confirm)) return;
      attachPasswordFeedback(input, document.getElementById(confirm), Number(input.getAttribute('minlength')) || 6);
    });
  });

  /* -----------------------------------------------------------------------
     7. Floating labels on login/register fields
     (The resend-code countdown lives in js/account.js, which owns that button.)
     ----------------------------------------------------------------------- */
  document.addEventListener('DOMContentLoaded', () => {
    const fields = document.querySelectorAll('.login-field, .register-field');
    fields.forEach((field) => {
      if (field.classList.contains('terms-consent') || field.closest('.email-verification-step')) return;
      const label = field.querySelector(':scope > label');
      const input = field.querySelector('input[type="text"], input[type="email"], input[type="tel"], input[type="password"], input:not([type])');
      if (!label || !input) return;
      field.classList.add('float-field');
      const sync = () => field.classList.toggle('is-filled', input.value !== '');
      ['input', 'change', 'blur'].forEach((evt) => input.addEventListener(evt, sync));
      input.addEventListener('focus', () => field.classList.add('is-focused'));
      input.addEventListener('blur', () => field.classList.remove('is-focused'));
      // Browser autofill does not always fire input events; a CSS animation on :-webkit-autofill signals it.
      input.addEventListener('animationstart', (e) => { if (e.animationName === 'sevenAutofill') field.classList.add('is-filled'); });
      sync();
    });
  });

  /* -----------------------------------------------------------------------
     8. Receipt lightbox for admin orders
     ----------------------------------------------------------------------- */
  function setupReceiptLightbox() {
    // Create lightbox if not exists
    let lb = document.getElementById('receiptLightbox');
    if (!lb) {
      lb = document.createElement('div');
      lb.className = 'receipt-lightbox';
      lb.id = 'receiptLightbox';
      lb.innerHTML =
        '<img id="receiptLightboxImg" src="" alt="Payment receipt">' +
        '<div class="receipt-lightbox-controls">' +
        '<button class="receipt-lightbox-btn" id="receiptLightboxClose" type="button" aria-label="Close receipt">✕</button>' +
        '</div>';
      document.body.appendChild(lb);

      lb.querySelector('#receiptLightboxClose').addEventListener('click', closeLightbox);
      lb.addEventListener('click', (e) => { if (e.target === lb || e.target.id === 'receiptLightboxImg') closeLightbox(); });
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeLightbox(); });
    }

    function closeLightbox() {
      lb.classList.remove('open');
    }

    // Wire up all receipt thumbs
    document.querySelectorAll('.receipt-thumb').forEach((thumb) => {
      thumb.addEventListener('click', () => {
        const img = document.getElementById('receiptLightboxImg');
        if (img) img.src = thumb.src;
        lb.classList.add('open');
      });
    });
  }

  // For admin pages
  if (document.querySelector('.receipt-thumb')) {
    setupReceiptLightbox();
  }

  // Also wire up future-loaded thumbs via MutationObserver
  const adminMain = document.querySelector('main');
  if (adminMain) {
    const mo = new MutationObserver(() => {
      const newThumbs = document.querySelectorAll('.receipt-thumb:not([data-lb])');
      if (newThumbs.length > 0) {
        newThumbs.forEach((t) => t.setAttribute('data-lb', '1'));
        setupReceiptLightbox();
      }
    });
    mo.observe(adminMain, { childList: true, subtree: true });
  }

  /* -----------------------------------------------------------------------
     9. Elapsed timer updater for admin KDS
     ----------------------------------------------------------------------- */
  window.sevenElapsedTimer = function (el, startIso) {
    function updateTimer() {
      const start = new Date(String(startIso).replace(' ', 'T'));
      const diff = Math.floor((Date.now() - start.getTime()) / 1000);
      if (!Number.isFinite(diff) || diff < 0) return;

      const h = Math.floor(diff / 3600);
      const m = Math.floor((diff % 3600) / 60);
      const s = diff % 60;
      const display = h > 0
        ? `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
        : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

      el.textContent = display;

      // Color code by urgency
      el.classList.remove('green', 'orange', 'red');
      if (diff < 300) el.classList.add('green');         // < 5 min
      else if (diff < 600) el.classList.add('orange');   // < 10 min
      else el.classList.add('red');                       // >= 10 min
    }

    updateTimer();
    return setInterval(updateTimer, 1000);
  };

  /* -----------------------------------------------------------------------
     10. Upload dropzone enhancement for admin CMS
     ----------------------------------------------------------------------- */
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.upload-dropzone[data-input]').forEach((zone) => {
      const inputId = zone.dataset.input;
      const input = document.getElementById(inputId);
      if (!input) return;

      zone.addEventListener('click', () => input.click());
      zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('drag-over'); });
      zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
      zone.addEventListener('drop', (e) => {
        e.preventDefault();
        zone.classList.remove('drag-over');
        const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'));
        if (files.length) {
          const dt = new DataTransfer();
          files.forEach((f) => dt.items.add(f));
          input.files = dt.files;
          input.dispatchEvent(new Event('change'));
        }
      });
    });
  });

  /* -----------------------------------------------------------------------
     11. Drag-to-reorder table rows
     ----------------------------------------------------------------------- */
  window.sevenDragReorder = function (tbody, onReorder) {
    let draggingRow = null;

    tbody.querySelectorAll('tr').forEach((row) => {
      const handle = row.querySelector('.drag-handle');
      if (!handle) return;

      handle.setAttribute('draggable', 'true');

      handle.addEventListener('dragstart', (e) => {
        draggingRow = row;
        row.classList.add('dragging-row');
        e.dataTransfer.effectAllowed = 'move';
      });

      handle.addEventListener('dragend', () => {
        draggingRow = null;
        row.classList.remove('dragging-row');
      });
    });

    tbody.addEventListener('dragover', (e) => {
      e.preventDefault();
      const target = e.target.closest('tr');
      if (target && target !== draggingRow && draggingRow) {
        const rect = target.getBoundingClientRect();
        const mid = rect.top + rect.height / 2;
        if (e.clientY < mid) tbody.insertBefore(draggingRow, target);
        else tbody.insertBefore(draggingRow, target.nextSibling);
        if (typeof onReorder === 'function') onReorder(tbody);
      }
    });
  };

  /* -----------------------------------------------------------------------
     12. Smooth section headings and "More reasons" card grid
     ----------------------------------------------------------------------- */
  document.addEventListener('DOMContentLoaded', () => {
    const reasonsSection = document.querySelector('.reasons-section');
    if (!reasonsSection) return;

    const existingContent = reasonsSection.querySelector('.center-title');
    if (!existingContent) return;

    // Only build the grid if there are no existing reason cards
    if (reasonsSection.querySelector('.reason-cards-grid')) return;

    const svg = (paths) => `<svg viewBox="0 0 24 24" aria-hidden="true">${paths}</svg>`;
    const reasons = [
      { icon: svg('<path d="M4 9h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V9Z"/><path d="M17 11h1.5a2.5 2.5 0 0 1 0 5H17"/><path d="M8 3c0 1.5 1 1.5 1 3M12 3c0 1.5 1 1.5 1 3"/>'), title: 'Handcrafted Drinks', desc: 'Every cup is made with care using premium ingredients and time-honored recipes.' },
      { icon: svg('<path d="M5 8h14l-1.2 11.1a2 2 0 0 1-2 1.9H8.2a2 2 0 0 1-2-1.9L5 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/><path d="m9.5 14 1.8 1.8L15 12"/>'), title: 'Easy Pickup', desc: 'Order ahead, pay via GCash, and pick up your drink when it\'s ready — no waiting in long lines.' },
      { icon: svg('<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>'), title: 'Fully Customizable', desc: 'Adjust size, sweetness, temperature, and choose from dozens of add-ons to make it yours.' },
      { icon: svg('<path d="M5 19c0-8 5-13 14-14-1 9-6 14-14 14Z"/><path d="M5 19 13 11"/>'), title: 'Quality Ingredients', desc: 'We source the finest teas, coffees, and fresh milk to deliver a consistently great taste.' },
    ];

    const grid = document.createElement('div');
    grid.className = 'reason-cards-grid wrap reveal-stagger';

    reasons.forEach(({ icon, title, desc }) => {
      const card = document.createElement('div');
      card.className = 'reason-card';
      card.innerHTML =
        `<div class="reason-icon">${icon}</div>` +
        `<h3>${title}</h3>` +
        `<p>${desc}</p>`;
      grid.appendChild(card);
    });

    reasonsSection.appendChild(grid);

    // Wire scroll-reveal to the new cards
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const obs = new IntersectionObserver(
        (entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target); } }),
        { threshold: 0.15 }
      );
      obs.observe(grid);
    } else {
      grid.classList.add('visible');
    }
  });

})();
