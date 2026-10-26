/* Menu page behavior; requires js/global.js first. */

let activeCategory = 'All', searchQuery = '', currentProduct = null;

const menuGrid = $('menuGrid'), categoryBar = $('categoryBar'), customModal = $('customModal');

function formatPrice(p) { if (!p || !p.prices) return 'Price TBA'; const v = Object.values(p.prices); return v.length === 1 ? money(v[0]) : 'From ' + money(Math.min.apply(null, v)) }
function escapeMenuText(value) { return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch] }) }
/* Icon for a category chip. Names are normalized first (lowercase, hyphens -> spaces, "ice" -> "iced",
   single spaces), then matched word-by-word, most specific rule first. */
function categoryIconPath(category) {
  const name = ' ' + String(category || '').toLowerCase().replace(/[-_/·]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/\bice\b/g, 'iced') + ' ';
  const has = function (word) { return name.indexOf(' ' + word + ' ') !== -1 };
  const dir = 'assets/categories/';
  if (name.trim() === 'all') return dir + 'all.svg';
  if (has('promo') || has('promos') || name.includes(' special series ')) return dir + 'promos.svg';
  if (has('frappe') || has('frappes') || has('blended')) return dir + 'frappe.svg';
  if (name.includes(' salty cream ') || name.includes(' sea salt ')) return dir + 'salty-cream.svg';
  if (has('cheesecake') || has('creamcheese') || name.includes(' cream cheese ')) return dir + 'cheesecake-milktea.svg';
  if (has('milktea') || name.includes(' milk tea ')) return dir + 'milktea.svg';
  if (has('lemonade')) return dir + 'lemonade.svg';
  if (has('refresher') || has('refreshers') || name.includes(' fruit tea ') || has('yakult') || has('soda')) return dir + 'refresher.svg';
  if (has('hot')) return dir + 'hot-beverages.svg';
  // "non coffee" drinks (e.g. "Iced Non-Coffee") vs. "non iced coffee" (coffee that is not iced = hot coffee).
  if (name.includes(' non coffee ')) return dir + 'iced-non-coffee.svg';
  if (name.includes(' non iced coffee ')) return dir + 'hot-beverages.svg';
  if (has('coffee') && has('special') && has('iced')) return dir + 'special-iced-coffee.svg';
  if (has('coffee') && has('iced')) return dir + 'iced-coffee.svg';
  if (has('coffee') || has('espresso') || has('latte')) return dir + 'hot-beverages.svg';
  return dir + 'cup.svg';
}
function searchTerm() { return searchQuery.trim().toLowerCase() }
function matchesSearch(p, q) { return !q || [p.name, p.category, p.desc].join(' ').toLowerCase().includes(q) }
// Exact match on the top-level category (part before " · "), ignoring case and extra spaces,
// so a chip like "Iced" no longer matches "Iced Coffee" or "Iced Non-Coffee".
function inCategory(p, c) { return c === 'All' || categoryKey(p.category || 'Uncategorized') === categoryKey(c) }
/* Escapes text and wraps case-insensitive matches of q in <mark>. Works on raw text so entities are never split. */
function highlightText(text, q) {
  text = String(text == null ? '' : text);
  if (!q) return escapeMenuText(text);
  const lower = text.toLowerCase(); let out = '', from = 0, at;
  while ((at = lower.indexOf(q, from)) !== -1) { out += escapeMenuText(text.slice(from, at)) + '<mark class="search-hit">' + escapeMenuText(text.slice(at, at + q.length)) + '</mark>'; from = at + q.length }
  return out + escapeMenuText(text.slice(from));
}
function renderCategories() {
  if (!categoryBar) return;
  const q = searchTerm(), matching = (products || []).filter(function (p) { return matchesSearch(p, q) });
  const items = ['All'].concat(categories || []);
  categoryBar.innerHTML = items.map(function (c) {
    const label = escapeMenuText(c);
    const icon = categoryIconPath(c);
    const count = matching.filter(function (p) { return inCategory(p, c) }).length;
    return '<button class="chip ' + (c === activeCategory ? 'active' : '') + (count ? '' : ' is-empty') + '" type="button" data-cat="' + label + '" aria-pressed="' + String(c === activeCategory) + '" aria-label="' + label + ', ' + count + ' drink' + (count === 1 ? '' : 's') + '"><img class="category-icon" src="' + icon + '" alt="" loading="lazy"><span class="category-label">' + label + '</span><span class="chip-count" aria-hidden="true">' + count + '</span></button>';
  }).join('');
}
function scrollActiveChipIntoView() { categoryBar?.querySelector('.chip.active')?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }) }
function renderMenu() {
  if (!menuGrid) return;
  const q = searchTerm();
  const list = products.filter(function (p) { return inCategory(p, activeCategory) && matchesSearch(p, q) });
  const countEl = $('menuSearchCount');
  if (countEl) countEl.textContent = q ? list.length + ' result' + (list.length === 1 ? '' : 's') : '';
  menuGrid.innerHTML = list.length ? list.map(function (p) { return '<article class="menu-card product"><div class="menu-image"><img src="' + escapeMenuText(p.image || MENU_IMAGE) + '" alt="' + escapeMenuText(p.name) + '" loading="lazy"></div><div class="menu-category">' + highlightText(p.category, q) + '</div><h3>' + highlightText(p.name, q) + '</h3><p>' + highlightText(p.desc, q) + '</p><div class="price">' + formatPrice(p) + '</div><button class="btn" data-custom="' + escapeMenuText(p.id) + '" ' + (!p.prices || !p.available ? 'disabled' : '') + '>' + (!p.available ? 'Out of Stock' : (p.prices ? 'Customize & Add' : 'Price TBA')) + '</button></article>' }).join('') : (q ? '<div class="empty">No drinks match “' + escapeMenuText(searchQuery.trim()) + '”' + (activeCategory === 'All' ? '' : ' in ' + escapeMenuText(activeCategory)) + '. <button class="btn menu-search-clear" type="button" data-clear-search>Clear search</button></div>' : '<div class="empty">No drinks found.</div>')
}
/* Add-on price table. Must match customization_extra() in api/orders.php. */
const ADDON_GROUPS = [
  { name: 'milk', title: 'Milk Choice', icon: '<path d="M8 3h8v3l2 3v12H6V9l2-3V3Z"/><path d="M6 13h12"/>', opts: [['None', 0], ['Oat Milk', 40]] },
  { name: 'drizzle', title: 'Drizzle', icon: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11Z"/>', opts: [['None', 0], ['Chocolate Drizzle', 10], ['Caramel Drizzle', 10], ['Strawberry Drizzle', 10]] },
  { name: 'syrup', title: 'Syrup', icon: '<path d="M10 2h4v4l2 3v12H8V9l2-3V2Z"/><path d="M8 14h8"/>', opts: [['None', 0], ['Flavored Syrup', 10]] },
  { name: 'sinker', title: 'Sinkers', icon: '<circle cx="8" cy="15" r="2.5"/><circle cx="15" cy="16" r="2.5"/><circle cx="12" cy="9" r="2.5"/>', opts: [['None', 0], ['Pearls', 10], ['Nata', 10], ['Crushed Oreo', 10], ['Coffee Jelly', 15], ['Popping Boba SB', 15]] },
  { name: 'topping', title: 'Toppings', icon: '<path d="M5 15a4 4 0 0 1 2-7.5 5 5 0 0 1 9.5-.5A4 4 0 0 1 19 15Z"/><path d="M6 15h12l-1 5H7l-1-5Z"/>', opts: [['None', 0], ['Cream Cheese', 15], ['Whipping Cream', 15], ['Salty Cream', 15], ['Sea Salt Cream', 15], ['Fresh Jam', 15]] },
  { name: 'coffeeAddon', title: 'Coffee Add-on', icon: '<ellipse cx="12" cy="12" rx="6" ry="8.5" transform="rotate(35 12 12)"/><path d="M8.5 17.5c2-3 5-8 7-11"/>', opts: [['None', 0], ['Espresso Shot', 10]], when: function (p, hot) { return p.category.includes('Coffee') || hot || p.category.includes('Salty Cream') } }
];
const SWEETNESS_LEVELS = ['0%', '25%', '50%', '75%', '100%'];
function czIcon(paths) { return '<svg class="cz-icon" viewBox="0 0 24 24" aria-hidden="true">' + paths + '</svg>' }
function czCup(scale) { return '<svg class="cz-cup" viewBox="0 0 24 24" aria-hidden="true" style="--cup-scale:' + scale + '"><path d="M6 7h12l-1.4 13a1.5 1.5 0 0 1-1.5 1.3H8.9a1.5 1.5 0 0 1-1.5-1.3L6 7Z"/><path d="M5 7h14M9 3.5h6l.8 3.5H8.2L9 3.5Z"/></svg>' }
function addonGroupMarkup(g) {
  return '<fieldset class="cz-group"><legend class="cz-head">' + czIcon(g.icon) + '<strong>' + g.title + '</strong><small>Optional</small></legend><div class="cz-chips">' + g.opts.map(function (o, i) {
    return '<label class="cz-chip"><input type="radio" name="' + g.name + '" value="' + escapeMenuText(o[0]) + '"' + (i === 0 ? ' checked' : '') + '><span><b>' + escapeMenuText(o[0]) + '</b>' + (o[1] ? '<em>+' + money(o[1]) + '</em>' : '') + '</span></label>';
  }).join('') + '</div></fieldset>';
}
function openCustom(id) {
  currentProduct = products.find(p => p.id === id);
  if (!currentProduct || !customModal || !currentProduct.prices) return;
  const p = currentProduct, hot = p.category === 'Hot Beverages', temp = hot ? 'Hot' : 'Iced';
  $('customTitle').textContent = p.name;
  $('customBase').innerHTML = '<span class="cz-temp cz-temp-' + temp.toLowerCase() + '">' + temp + ' only</span> ' + escapeMenuText(p.category);
  let h = '<input type="radio" name="temperature" value="' + temp + '" checked hidden>';
  if (p.prices.large != null && p.prices.medium != null) {
    const extra = Number(p.prices.large) - Number(p.prices.medium);
    h += '<fieldset class="cz-group"><legend class="cz-head"><strong>Cup Size</strong></legend><div class="cz-sizes">' +
      '<label class="cz-size"><input type="radio" name="size" value="Medium" checked><span>' + czCup(.8) + '<b>Medium</b><em>' + money(p.prices.medium) + '</em></span></label>' +
      '<label class="cz-size"><input type="radio" name="size" value="Large"><span>' + czCup(1) + '<b>Large</b><em>' + money(p.prices.large) + '</em>' + (extra > 0 ? '<small>+' + money(extra) + '</small>' : '') + '</span></label>' +
      '</div></fieldset>';
  }
  if (/Coffee|Milktea|Cream Cheese|Cheesecake/.test(p.category)) {
    h += '<fieldset class="cz-group"><legend class="cz-head"><strong>Sweetness</strong><small>Default 100%</small></legend><div class="cz-segmented">' + SWEETNESS_LEVELS.map(function (level) {
      return '<label><input type="radio" name="sweetness" value="' + level + '"' + (level === '100%' ? ' checked required' : '') + '><span>' + level + '</span></label>';
    }).join('') + '</div></fieldset>';
  }
  h += ADDON_GROUPS.filter(function (g) { return !g.when || g.when(p, hot) }).map(addonGroupMarkup).join('');
  $('customOptions').innerHTML = h;
  $('customQty').value = 1;
  updateCustomTotal();
  customModal.classList.add('open');
  customModal.querySelector('.modal-card')?.scrollTo(0, 0);
}
function addonPrice(name, value) { const g = ADDON_GROUPS.find(function (x) { return x.name === name }); const o = g && g.opts.find(function (x) { return x[0] === value }); return o ? o[1] : 0 }
/* size stays null for Medium, exactly as the old checkbox sent it, so cart keys and the order payload are unchanged. */
function customization() { const f = new FormData($('customForm')), v = { temperature: f.get('temperature'), size: f.get('size') === 'Large' ? 'Large' : null, sweetness: f.get('sweetness') || 'N/A', milk: f.get('milk') || 'None', drizzle: f.get('drizzle') || 'None', syrup: f.get('syrup') || 'None', sinker: f.get('sinker') || 'None', topping: f.get('topping') || 'None', coffeeAddon: f.get('coffeeAddon') || 'None' }; const extra = ADDON_GROUPS.reduce(function (sum, g) { return sum + addonPrice(g.name, v[g.name]) }, 0); const basePrice = selectedBasePrice(currentProduct, v.size); const qty = Math.max(1, Math.min(20, Number($('customQty')?.value || 1))); if ($('customQty')) $('customQty').value = qty; return { ...v, basePrice, extra, qty, unitPrice: basePrice + extra } }
function updateCustomTotal() { if (currentProduct && $('customTotal')) { const c = customization(); $('customTotal').textContent = money(c.unitPrice * c.qty); const f = $('customForm'), dec = f?.querySelector('[data-qty-step="-1"]'), inc = f?.querySelector('[data-qty-step="1"]'); if (dec) dec.disabled = c.qty <= 1; if (inc) inc.disabled = c.qty >= 20 } } function closeCustom() { customModal?.classList.remove('open') } function addCart(p, c) { const key = [p.id, c.temperature, c.size, c.sweetness, c.milk, c.drizzle, c.syrup, c.sinker, c.topping, c.coffeeAddon].join('|'), existing = cart.find(x => x.key === key); if (existing) existing.qty = Math.min(99, Number(existing.qty || 0) + Number(c.qty || 1)); else cart.push({ key, id: p.id, name: p.name, category: p.category, image: p.image || MENU_IMAGE, ...c, qty: Math.min(99, Math.max(1, Number(c.qty || 1))) }); saveCart(); renderCart(); toastMsg(`${p.name} added to cart`) }

categoryBar?.addEventListener('click', e => { const b = e.target.closest('[data-cat]'); if (b) { activeCategory = b.dataset.cat; renderCategories(); renderMenu(); scrollActiveChipIntoView() } }); menuGrid?.addEventListener('click', e => { if (e.target.closest('[data-clear-search]')) { const s = $('menuSearch'); if (s) { s.value = ''; s.focus() } searchQuery = ''; renderCategories(); renderMenu(); return } const b = e.target.closest('[data-custom]'); if (b && !b.disabled) openCustom(b.dataset.custom) }); $('menuSearch')?.addEventListener('input', e => { searchQuery = e.target.value; renderCategories(); renderMenu() }); $('menuSearch')?.addEventListener('keydown', e => { if (e.key === 'Escape' && e.target.value) { e.stopPropagation(); e.target.value = ''; searchQuery = ''; renderCategories(); renderMenu() } }); $('customForm')?.addEventListener('input', updateCustomTotal); $('customForm')?.addEventListener('click', e => { const b = e.target.closest('[data-qty-step]'); if (!b) return; const q = $('customQty'); q.value = Math.max(1, Math.min(20, Number(q.value || 1) + Number(b.dataset.qtyStep))); updateCustomTotal() }); $('customForm')?.addEventListener('submit', e => { e.preventDefault(); addCart(currentProduct, customization()); closeCustom(); openCart() }); $('closeCustom')?.addEventListener('click', closeCustom);

window.sevenMenu = { renderCategories: renderCategories, renderMenu: renderMenu, closeCustom: closeCustom };

window.addEventListener('seven:products-loaded', function () { renderCategories(); renderMenu() });

renderCategories(); renderMenu();

/* ===== Live sales-ranked Best Seller feature ===== */
(() => {
  let currentIndex = 0, rotationTimer = null, refreshTimer = null, bound = false, actions = null;
  function normalize(p) {
    return { id: p.id, name: p.name, category: p.category, prices: p.prices, desc: p.description || p.desc || 'SEVEN Coffee & Tea menu item.', image: p.image || MENU_IMAGE, images: p.images || [], available: p.available !== false, status: p.status || 'active', isBestseller: Number(p.is_bestseller ?? p.isBestseller) === 1, isSignature: Number(p.is_signature ?? p.isSignature) === 1, totalSold: Number(p.total_sold ?? p.totalSold) || 0, lastSaleAt: p.last_sale_at || p.lastSaleAt || '' };
  }
  function listNow() {
    const source = Array.isArray(window.sevenBestSellerProducts) ? window.sevenBestSellerProducts : products.filter(function (p) { return p && p.status === "active" && p.available !== false && Number(p.totalSold) > 0 });
    return source.filter(function (p) { return p && p.status === "active" && p.available !== false }).slice(0, 5);
  }
  function render() {
    const root = $("featuredCarousel"); if (!root) return;
    const list = listNow();
    // Never replace the carousel's markup: the first render runs before products load,
    // and wiping it left the arrows/cards gone for good once data arrived.
    let status = root.parentElement.querySelector(".featured-status");
    if (!list.length) {
      const loading = !Array.isArray(window.sevenBestSellerProducts) && !products.length;
      if (!status) { status = document.createElement("div"); status.className = "empty featured-status"; status.setAttribute("role", "status"); root.insertAdjacentElement("afterend", status) }
      status.textContent = loading ? "Loading best sellers…" : "Best sellers will appear after qualifying sales. Only products with qualifying sales are shown.";
      root.style.display = "none"; clearInterval(rotationTimer); return;
    }
    if (status) status.remove();
    root.style.display = "";
    currentIndex = Math.min(Math.max(0, currentIndex), list.length - 1);
    const els = { l: $("featuredLeftName"), ld: $("featuredLeftDesc"), c: $("featuredCenterName"), cd: $("featuredCenterDesc"), cp: $("featuredCenterPrice"), r: $("featuredRightName"), rd: $("featuredRightDesc") };
    const label = p => p.category + " · " + (p.prices && p.prices.medium != null ? "Medium " + money(p.prices.medium) : "Price TBA");
    const price = p => p.prices && p.prices.medium != null ? "Medium · " + money(p.prices.medium) : "Price TBA";
    function paint(direction) {
      const center = list[currentIndex], left = list[(currentIndex - 1 + list.length) % list.length], right = list[(currentIndex + 1) % list.length];
      if (els.l) els.l.textContent = left.name; if (els.ld) els.ld.textContent = label(left);
      if (els.c) els.c.textContent = center.name; if (els.cd) els.cd.textContent = label(center); if (els.cp) els.cp.textContent = price(center);
      if (els.r) els.r.textContent = right.name; if (els.rd) els.rd.textContent = label(right);
      if (direction) { root.classList.remove("slide-next", "slide-prev"); void root.offsetWidth; root.classList.add(direction > 0 ? "slide-next" : "slide-prev") }
    }
    function next() { currentIndex = (currentIndex + 1) % list.length; paint(1) }
    function previous() { currentIndex = (currentIndex - 1 + list.length) % list.length; paint(-1) }
    function stopRotation() { clearInterval(rotationTimer) }
    function startRotation() { stopRotation(); if (list.length > 1 && !root.matches(":hover") && !root.querySelector(":focus-visible")) rotationTimer = setInterval(next, 4000) }
    /* Listeners are bound once, so they call through `actions` to reach the latest render's list. */
    actions = { next: next, previous: previous, start: startRotation, stop: stopRotation };
    if (!bound) {
      let touchX = null;
      $("featuredPrev")?.addEventListener("click", function () { actions.previous() });
      $("featuredNext")?.addEventListener("click", function () { actions.next() });
      root.addEventListener("mouseenter", function () { actions.stop() });
      root.addEventListener("mouseleave", function () { actions.start() });
      root.addEventListener("focusin", function (e) { if (e.target.matches(":focus-visible")) actions.stop() });
      root.addEventListener("focusout", function () { setTimeout(function () { actions.start() }, 0) });
      root.addEventListener("keydown", function (e) { if (e.key === "ArrowLeft") { e.preventDefault(); actions.previous() } else if (e.key === "ArrowRight") { e.preventDefault(); actions.next() } });
      root.addEventListener("touchstart", function (e) { touchX = e.touches[0].clientX; actions.stop() }, { passive: true });
      root.addEventListener("touchend", function (e) { if (touchX == null) return; const dx = e.changedTouches[0].clientX - touchX; touchX = null; if (Math.abs(dx) > 40) (dx < 0 ? actions.next : actions.previous)(); actions.start() }, { passive: true });
      document.addEventListener("visibilitychange", function () { document.hidden ? actions.stop() : actions.start() });
      bound = true;
    }
    paint(); startRotation();
  }
  async function refresh() {
    try {
      const response = await fetch("api/products.php?best_sellers=1", { cache: "no-store", credentials: "same-origin" });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.message || "Unable to refresh best sellers.");
      window.sevenBestSellerProducts = (data.best_sellers || []).map(normalize);
      render();
    } catch (_) { render() }
  }
  window.sevenBestSeller = { render: render, refresh: refresh };
  window.addEventListener("seven:products-loaded", render);
  function init() { render(); refresh(); refreshTimer = setInterval(refresh, 3 * 60 * 1000) }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();

function initMenuPage() { if (!document.body.classList.contains("page-menu")) return; const q = new URLSearchParams(location.search), cat = q.get("category"); if (cat) { const b = [...document.querySelectorAll("[data-cat]")].find(x => x.dataset.cat.toLowerCase() === cat.toLowerCase()); b?.click() } if (q.get("checkout") === "1") setTimeout(() => { openCart(); setTimeout(openCheckout, 80) }, 0) }

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initMenuPage); else initMenuPage();
