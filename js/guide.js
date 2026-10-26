/* SEVEN Coffee & Tea — Quick Guide: a short step-by-step "how to order" modal.
   Opens from any [data-open-guide] element; adds "Guide" links to the header nav and footer.
   Auto-opens once per session on Home/Menu unless the customer chose "Don't show again". */
(function () {
  'use strict';

  const DISMISS_KEY = 'seven_guide_dismissed';   // localStorage: never auto-open again
  const SESSION_KEY = 'seven_guide_auto_shown';  // sessionStorage: auto-opened this visit

  // Static content only; rendered with textContent, never as HTML.
  const STEPS = [
    { title: 'Browse the menu', text: 'Open the Menu, pick a category or search for a drink, then tap "Customize & Add".', link: { href: 'menu.html', label: 'Open the menu' }, icon: '<path d="M7 3h2v8a2 2 0 0 1-2 2v8H5v-8a2 2 0 0 1-2-2V3h2v6h1V3h1Zm9 0h2v5h2v2h-2v11h-2V10a4 4 0 0 1-4-4V3h2v5a2 2 0 0 1 2 2V3Z"/>' },
    { title: 'Customize your drink', text: 'Choose the cup size, sweetness and any add-ons. The item total updates as you go.', icon: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>' },
    { title: 'Review your cart', text: 'Tap the cart icon to change quantities or remove items, then choose "Proceed to Checkout".', icon: '<path d="M4 5h2l1.6 9.2a2 2 0 0 0 2 1.8h7.8a2 2 0 0 0 2-1.7L21 8H7"/><circle cx="10" cy="20" r="1.2"/><circle cx="18" cy="20" r="1.2"/>' },
    { title: 'Log in or sign up', text: 'Checkout needs a customer account so your order is linked to you. New here? Create an account and verify your email.', link: { href: 'register.html', label: 'Create an account' }, icon: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>' },
    { title: 'Confirm pickup details', text: 'Check your name and contact number. Orders are for pickup and are prepared as soon as payment is verified.', icon: '<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11Z"/><circle cx="12" cy="10" r="2.5"/>' },
    { title: 'Pay with GCash', text: 'Send the exact amount by GCash, upload a screenshot of the payment, and enter the 13-digit reference number.', icon: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10h18M7 15h4"/>' },
    { title: 'Track your order', text: 'Use "Track Order" to follow Payment Verified → Preparing → Ready for Pick-Up, then collect your drink at the counter.', icon: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>' },
  ];

  const store = {
    get(area, key) { try { return window[area].getItem(key); } catch (_) { return null; } },
    set(area, key, value) { try { window[area].setItem(key, value); } catch (_) { /* storage blocked: ignore */ } },
    remove(area, key) { try { window[area].removeItem(key); } catch (_) { /* ignore */ } },
  };

  let modal = null;
  let index = 0;
  let lastFocus = null;

  function build() {
    modal = document.createElement('div');
    modal.className = 'guide-modal';
    modal.hidden = true;
    modal.innerHTML =
      '<div class="guide-backdrop" data-guide-close></div>' +
      '<section class="guide-card" role="dialog" aria-modal="true" aria-labelledby="guideTitle" aria-describedby="guideText">' +
        '<header class="guide-head"><span class="guide-kicker">Quick Guide · How to order</span>' +
        '<button class="guide-close" type="button" data-guide-close aria-label="Close guide">×</button></header>' +
        '<div class="guide-progress" aria-hidden="true"></div>' +
        '<div class="guide-body">' +
          '<svg class="guide-icon" viewBox="0 0 24 24" aria-hidden="true"></svg>' +
          '<p class="guide-step-count" aria-live="polite"></p>' +
          '<h2 id="guideTitle" class="guide-title"></h2>' +
          '<p id="guideText" class="guide-text"></p>' +
          '<a class="guide-link" hidden></a>' +
        '</div>' +
        '<footer class="guide-foot">' +
          '<label class="guide-dismiss"><input type="checkbox" id="guideDismiss"> Don\'t show again</label>' +
          '<div class="guide-actions"><button class="guide-btn ghost" type="button" data-guide-prev>Back</button>' +
          '<button class="guide-btn primary" type="button" data-guide-next>Next</button></div>' +
        '</footer>' +
      '</section>';
    document.body.appendChild(modal);

    const progress = modal.querySelector('.guide-progress');
    progress.innerHTML = STEPS.map(() => '<span></span>').join('');

    modal.addEventListener('click', (e) => {
      if (e.target.closest('[data-guide-close]')) close();
      else if (e.target.closest('[data-guide-prev]')) go(index - 1);
      else if (e.target.closest('[data-guide-next]')) { if (index >= STEPS.length - 1) close(); else go(index + 1); }
    });
    modal.querySelector('#guideDismiss').addEventListener('change', (e) => {
      if (e.target.checked) store.set('localStorage', DISMISS_KEY, '1');
      else store.remove('localStorage', DISMISS_KEY);
    });
    modal.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); close(); return; }
      if (e.key === 'ArrowRight' && !e.target.matches('input')) go(index + 1);
      if (e.key === 'ArrowLeft' && !e.target.matches('input')) go(index - 1);
      if (e.key === 'Tab') trapFocus(e);
    });
  }

  function trapFocus(e) {
    const focusable = [...modal.querySelectorAll('button, a[href]:not([hidden]), input')].filter((el) => !el.disabled && el.offsetParent !== null);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  function go(next) {
    index = Math.max(0, Math.min(STEPS.length - 1, next));
    const step = STEPS[index];
    modal.querySelector('.guide-icon').innerHTML = step.icon; // trusted static SVG paths
    modal.querySelector('.guide-step-count').textContent = 'Step ' + (index + 1) + ' of ' + STEPS.length;
    modal.querySelector('.guide-title').textContent = step.title;
    modal.querySelector('.guide-text').textContent = step.text;
    const link = modal.querySelector('.guide-link');
    link.hidden = !step.link;
    if (step.link) { link.href = step.link.href; link.textContent = step.link.label + ' →'; }
    modal.querySelectorAll('.guide-progress span').forEach((dot, i) => {
      dot.classList.toggle('done', i < index);
      dot.classList.toggle('current', i === index);
    });
    modal.querySelector('[data-guide-prev]').disabled = index === 0;
    modal.querySelector('[data-guide-next]').textContent = index === STEPS.length - 1 ? 'Got it' : 'Next';
  }

  function open(startAt) {
    if (!modal) build();
    lastFocus = document.activeElement;
    modal.querySelector('#guideDismiss').checked = store.get('localStorage', DISMISS_KEY) === '1';
    go(Number(startAt) || 0);
    modal.hidden = false;
    document.body.classList.add('guide-open');
    modal.querySelector('[data-guide-next]').focus();
  }

  function close() {
    if (!modal || modal.hidden) return;
    modal.hidden = true;
    document.body.classList.remove('guide-open');
    if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus();
  }

  function addLinks() {
    // Footer "Explore" column only (kept out of the header nav).
    const explore = [...document.querySelectorAll('.site-footer .footer-title')]
      .find((h) => h.textContent.trim() === 'Explore')?.nextElementSibling;
    if (explore && explore.classList.contains('footer-links') && !explore.querySelector('[data-open-guide]')) {
      const a = document.createElement('a');
      a.href = '#quick-guide';
      a.textContent = 'Quick Guide';
      a.setAttribute('data-open-guide', '');
      explore.appendChild(a);
    }
  }

  function init() {
    addLinks();
    document.addEventListener('click', (e) => {
      const trigger = e.target.closest('[data-open-guide]');
      if (!trigger) return;
      e.preventDefault();
      open(0);
    });
    if (location.hash === '#quick-guide') { open(0); return; }

    const autoPage = document.body.classList.contains('page-home') || document.body.classList.contains('page-menu');
    const dismissed = store.get('localStorage', DISMISS_KEY) === '1';
    const shownThisVisit = store.get('sessionStorage', SESSION_KEY) === '1';
    const deepLinked = /[?&](order|track|checkout|category)=/.test(location.search);
    if (autoPage && !dismissed && !shownThisVisit && !deepLinked) {
      store.set('sessionStorage', SESSION_KEY, '1');
      setTimeout(() => open(0), 600);
    }
  }

  window.SevenGuide = { open: open, close: close };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
