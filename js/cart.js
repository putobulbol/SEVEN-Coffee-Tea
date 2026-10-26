/* Cart-only rendering; requires js/global.js first. */

function initCartPage() {
    if (!document.body.classList.contains("page-cart")) return;
    const rows = $("cartRows"), table = $("cartTable"), empty = $("cartEmpty"), sub = $("subtotal");
    if (!rows || !table || !empty || !sub) return;
    const scroll = table.closest(".cart-table-scroll"), actions = document.querySelector(".cart-actions"), summary = document.querySelector(".cart-summary");
    const cur = v => `₱${Number(v).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;
    empty.innerHTML = '<div class="cart-empty">' + CART_EMPTY_ART + '<strong>Your cart is empty</strong><p>Find a drink you love and make it yours.</p><a class="cart-explore" href="menu.html">Explore Drinks</a></div>';
    function load() {
        const c = Array.isArray(cart) ? cart : [];
        const isEmpty = !c.length;
        table.hidden = isEmpty; empty.hidden = !isEmpty;
        [scroll, actions, summary].forEach(el => { if (el) el.hidden = isEmpty });
        if (isEmpty) { sub.textContent = cur(0); return }
        let t = 0;
        rows.innerHTML = c.map((x, i) => {
            const line = Number(x.unitPrice || 0) * Number(x.qty || 0); t += line;
            const name = escapeCartText(x.name);
            return `<tr><td><div class="cart-product"><img class="cart-thumb" src="${escapeCartText(x.image || MENU_IMAGE)}" alt="" loading="lazy" onerror="this.onerror=null;this.src='${MENU_IMAGE}'"><div><div class="cart-product-name">${name}</div><div class="cart-badges">${cartBadges(x)}</div><button class="cart-remove-link" type="button" data-cart-remove="${i}" aria-label="Remove ${name} from cart">Remove</button></div></div></td><td>${cur(x.unitPrice)}</td><td class="cart-qty"><button type="button" data-cart-dec="${i}" aria-label="Decrease quantity">−</button><span aria-live="polite">${x.qty}</span><button type="button" data-cart-inc="${i}" aria-label="Increase quantity" ${x.qty >= 99 ? 'disabled' : ''}>+</button></td><td class="cart-total">${cur(line)}</td></tr>`;
        }).join("");
        sub.textContent = cur(t);
    }
    rows.addEventListener("click", function (e) {
        const inc = e.target.closest("[data-cart-inc]"), dec = e.target.closest("[data-cart-dec]"), rm = e.target.closest("[data-cart-remove]");
        if (inc) { const i = +inc.dataset.cartInc; if (cart[i]) cart[i].qty = Math.min(99, Number(cart[i].qty || 0) + 1) }
        if (dec) { const i = +dec.dataset.cartDec; if (cart[i]) { cart[i].qty = Number(cart[i].qty || 0) - 1; if (cart[i].qty <= 0) cart.splice(i, 1) } }
        if (rm) { const i = +rm.dataset.cartRemove; if (cart[i]) { const n = cart[i].name; cart.splice(i, 1); toastMsg(n + " removed") } }
        saveCart(); load();
    });
    load();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initCartPage); else initCartPage();
