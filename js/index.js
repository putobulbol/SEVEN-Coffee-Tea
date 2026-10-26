/* Homepage carousel/signature drinks; requires js/global.js first. */

/* ===== Home carousel =====
   Two stacked layers: the incoming banner slides in from the right while fading in, the outgoing one
   slides out to the left while fading out (mirrored when going back). Driven by the 8 s timer, dots
   and swipe, so it works with any number of banners, including a single banner cycling every 8 s. Only transform
   and opacity are animated; prefers-reduced-motion gets a plain cross-fade (see css/index.css). */
(() => {
   const root = $('homeCarousel'); if (!root) return;
   let banners = [];
   const INTERVAL_MS = 8000, SLIDE_MS = 900;
   let i = 0, timer = null, updateDotsFn = null, animating = false, pending = null, front = 0;
   function esc(v) { return String(v == null ? '' : v).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", "&#039;") }
   function bgUrl(src) { return 'url("' + String(src).replace(/([\\\"'])/g, '\\$1') + '")' }

   root.innerHTML = '<div class="hero-bg hero-slide is-current" role="img"></div><div class="hero-bg hero-slide" role="img" aria-hidden="true"></div><div class="overlay"></div><a class="hero-link" href="#" hidden></a><div class="hero-content"></div>';
   const layers = [...root.querySelectorAll('.hero-slide')];
   const content = root.querySelector('.hero-content'), link = root.querySelector('.hero-link'), hero = root.closest('.hero') || root;

   function paintLayer(layer, x) { layer.style.backgroundImage = bgUrl(x.image); layer.setAttribute('aria-label', x.alt || x.title || 'SEVEN Coffee & Tea banner') }
   function setContent(x, animate) {
      content.innerHTML = (x.title || x.description) ? (x.title ? '<h1>' + esc(x.title) + '</h1>' : '') + (x.description ? '<p>' + esc(x.description) + '</p>' : '') : '';
      content.hidden = !(x.title || x.description);
      if (x.targetLink) { link.href = x.targetLink; link.textContent = x.ctaLabel || 'Learn More'; link.hidden = false } else link.hidden = true;
      if (animate && !content.hidden) { content.classList.remove('is-entering'); void content.offsetWidth; content.classList.add('is-entering') }
   }
   function renderEmpty() {
      stop();
      pending = null; animating = false; front = 0; i = 0;
      hero.classList.add('hero-empty'); hero.classList.remove('hero-single');
      link.hidden = true; link.removeAttribute('href'); link.textContent = '';
      content.classList.remove('is-entering');
      content.innerHTML = '<h1>SEVEN Coffee &amp; Tea</h1><p>Handcrafted coffee and tea, ready for pickup.</p><a class="hero-empty-cta" href="menu.html">Order Now</a>';
      content.hidden = false;
      layers.forEach(function (layer) { layer.style.backgroundImage = 'none'; layer.className = 'hero-bg hero-slide is-staged'; layer.setAttribute('aria-hidden', 'true'); layer.removeAttribute('aria-label') });
      hero.querySelector('.hero-dots')?.remove();
      updateDotsFn = null;
   }
   /* dir: 1 = forward (enter from right), -1 = back (enter from left), 0 = no animation. */
   function show(idx, dir) {
      const x = banners[idx]; if (!x) return;
      if (!dir) { paintLayer(layers[front], x); i = idx; setContent(x, false); if (updateDotsFn) updateDotsFn(i); return }
      if (animating) { pending = { idx: idx, dir: dir }; return } // keep only the latest request while a slide is moving
      animating = true;
      const current = layers[front], incoming = layers[1 - front];
      paintLayer(incoming, x);
      incoming.className = 'hero-bg hero-slide is-staged ' + (dir > 0 ? 'enter-from-right' : 'enter-from-left'); // parked off-stage, no transition
      void incoming.offsetWidth; // commit the starting position before animating
      incoming.className = 'hero-bg hero-slide is-current';
      incoming.removeAttribute('aria-hidden');
      current.className = 'hero-bg hero-slide ' + (dir > 0 ? 'leave-to-left' : 'leave-to-right');
      current.setAttribute('aria-hidden', 'true');
      i = idx; setContent(x, true); if (updateDotsFn) updateDotsFn(i);
      setTimeout(function () {
         current.className = 'hero-bg hero-slide is-staged'; front = 1 - front; animating = false; // park the hidden layer instantly
         if (pending) { const p = pending; pending = null; if (p.idx !== i) show(p.idx, p.dir) }
      }, SLIDE_MS);
   }
   function next() { if (banners.length > 0) show((i + 1) % banners.length, 1) }
   function goTo(idx) { if (idx === i || banners.length < 2) return; show(idx, idx > i ? 1 : -1); start() }
   function stop() { clearInterval(timer); timer = null }
   function start() { stop(); if (banners.length > 0 && !document.hidden && !hero.matches(':hover') && !hero.contains(document.activeElement)) timer = setInterval(next, INTERVAL_MS) }

   hero.addEventListener('mouseenter', stop); hero.addEventListener('mouseleave', start);
   hero.addEventListener('focusin', stop); hero.addEventListener('focusout', function () { setTimeout(start, 0) });
   let touchX = null;
   hero.addEventListener('touchstart', function (e) { touchX = e.touches[0].clientX; stop() }, { passive: true });
   hero.addEventListener('touchend', function (e) { if (touchX == null) return; const dx = e.changedTouches[0].clientX - touchX; touchX = null; if (Math.abs(dx) > 40 && banners.length > 1) show((i + (dx < 0 ? 1 : -1) + banners.length) % banners.length, dx < 0 ? 1 : -1); start() }, { passive: true });
   document.addEventListener('visibilitychange', function () { document.hidden ? stop() : start() });

   function imageLoads(src) { return new Promise(function (resolve) { if (!src) return resolve(false); const img = new Image(); img.onload = function () { resolve(true) }; img.onerror = function () { resolve(false) }; img.src = src }) }
   async function loadBanners() {
      try {
         const r = await fetch('api/banners.php', { cache: 'no-store' }), d = await r.json();
         if (r.ok && d.ok && Array.isArray(d.banners)) {
            const loaded = d.banners.filter(function (x) { return x && x.image && x.active !== false }).map(function (x) { return { image: x.image, alt: x.title || 'SEVEN Coffee & Tea banner', title: x.title || '', description: x.description || '', ctaLabel: x.ctaLabel || '', targetLink: x.targetLink || '', active: true, order: x.order || 0 } });
            const checks = await Promise.all(loaded.map(function (x) { return imageLoads(x.image) }));
            banners = loaded.filter(function (x, n) { return checks[n] });
         } else banners = [];
      } catch (_) { banners = [] }
      banners = banners.filter(function (x) { return x && x.image && x.active !== false }).sort(function (a, c) { return Number(a.order || 0) - Number(c.order || 0) });
      if (!banners.length) { renderEmpty(); return }
      hero.classList.remove('hero-empty', 'hero-single');
      show(0, 0); // first banner paints immediately (eager)
      // Warm the cache for the rest so the first slide-in never shows a blank layer.
      banners.slice(1).forEach(function (x) { const img = new Image(); img.decoding = 'async'; img.src = x.image });
      if (typeof window.sevenEnhanceDots === 'function') updateDotsFn = window.sevenEnhanceDots('homeCarousel', banners.length, function () { return i }, goTo);
      start();
   }
   loadBanners();
})();

/* ===== Signature drinks ===== */
(() => { function render() { const root = $('signatureDrinks'); if (!root) return; const esc = v => String(v ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", "&#039;"); const d = products.filter(function (x) { return x && x.status === 'active' && x.available !== false && x.isSignature }).slice(0, 3); if (!d.length) { root.innerHTML = '<div class="signature-empty">No signature drinks selected yet.</div>'; return } root.innerHTML = d.map(function (x, i) { const price = Number(x.prices?.medium ?? Object.values(x.prices || {})[0] ?? 0); const image = x.image || x.images?.[0] || MENU_IMAGE; return '<a class="signature-menu" href="menu.html"><img src="' + image + '" alt="' + esc(x.name) + '" onerror="this.onerror=null;this.src=\'' + MENU_IMAGE + '\'"><div class="promo-overlay"><span>' + esc(x.name) + '</span><p>' + esc(x.desc || x.category || 'SEVEN Coffee & Tea') + '</p><strong class="signature-overlay-price">' + (price > 0 ? '₱' + price.toLocaleString('en-PH') : 'Price TBA') + '</strong><small class="signature-overlay-badge">' + esc(i === 0 ? 'Featured Pick' : x.category || 'Menu Item') + '</small></div></a>' }).join('') } window.sevenSignatureDrinks = { render: render }; window.addEventListener('seven:products-loaded', render); render(); })();
