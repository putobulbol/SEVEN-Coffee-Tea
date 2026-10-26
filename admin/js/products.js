/* Page logic extracted from admin/products.html. */
var API = '../api/admin_products.php';
var products = [], page = 1, perPage = 10, editId = 0, newFiles = [], selectedIds = new Set();
function $(id) { return document.getElementById(id) } function esc(v) { return String(v == null ? '' : v).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", "&#039;") }
function notice(t, bad) { $('message').innerHTML = t ? '<div class="' + (bad ? 'error' : 'notice') + '">' + esc(t) + '</div>' : ''; if (t) setTimeout(function () { $('message').innerHTML = '' }, 2200) }
/* Category key: trimmed, single-spaced, case-insensitive (matches api/admin_products.php normalization). */
function catKey(v) { return String(v == null ? '' : v).trim().replace(/\s+/g, ' ').toLowerCase() }
/* Rebuilds #catFilter and #categorySuggestions (deduped case-insensitively) and keeps the current filter selected. Runs after every load, so saves and bulk updates stay in sync. */
function setupCats() { var seen = new Map(); products.forEach(function (p) { var label = String(p.category || '').trim().replace(/\s+/g, ' '); if (label && !seen.has(catKey(label))) seen.set(catKey(label), label) }); var cats = [...seen.values()].sort(function (a, b) { return a.localeCompare(b, undefined, { sensitivity: 'base' }) }); var current = $('catFilter').value; $('categorySuggestions').innerHTML = cats.map(function (c) { return '<option value="' + esc(c) + '"></option>' }).join(''); $('catFilter').innerHTML = '<option value="all">All categories</option>' + cats.map(function (c) { return '<option value="' + esc(c) + '">' + esc(c) + '</option>' }).join(''); var keep = cats.find(function (c) { return catKey(c) === catKey(current) }); $('catFilter').value = current && current !== 'all' && keep ? keep : 'all' }
function filtered() { var q = $('search').value.trim().toLowerCase(), c = $('catFilter').value, s = $('statusFilter').value; return products.filter(function (p) { return (!q || [p.name, p.description, p.category].join(' ').toLowerCase().indexOf(q) >= 0) && (c === 'all' || catKey(p.category) === catKey(c)) && (s === 'all' || p.status === s) }) }
function renderStats() { var active = products.filter(function (p) { return p.status === 'active' }).length, out = products.filter(function (p) { return p.status === 'out_of_stock' }).length, hidden = products.filter(function (p) { return p.status === 'hidden' }).length; $('statAll').textContent = products.length; $('statActive').textContent = active; $('statOut').textContent = out; $('statHidden').textContent = hidden }
function imageMarkup(path) { return path ? '<img src="../' + esc(path) + '" alt="" onerror="this.style.display=\'none\';this.parentElement.classList.add(\'image-fallback\')">' : '' }
function filtered() { var q = $('search').value.trim().toLowerCase(), c = $('catFilter').value, s = $('statusFilter').value; return products.filter(function (p) { return (!q || [p.name, p.description, p.category].join(' ').toLowerCase().indexOf(q) >= 0) && (c === 'all' || catKey(p.category) === catKey(c)) && (s === 'all' || p.status === s) }) }
function displayStatus(s) { return s === 'active' ? 'Available' : s === 'out_of_stock' ? 'Out of Stock' : 'Hidden' }
function statusBadge(s) { return s === 'active' ? 'active' : s === 'out_of_stock' ? 'out_of_stock' : 'hidden' }
function render() { renderStats(); var list = filtered(), pages = Math.max(1, Math.ceil(list.length / perPage)); if (page > pages) page = pages; var slice = list.slice((page - 1) * perPage, page * perPage); $('count').textContent = list.length + ' product' + (list.length === 1 ? '' : 's'); $('pageInfo').textContent = 'Page ' + page + ' of ' + pages; $('prev').disabled = page <= 1; $('next').disabled = page >= pages; var body = $('rows'); if (!slice.length) { body.innerHTML = ''; $('empty').textContent = products.length ? 'No products match your filters.' : 'No products yet.' } else { $('empty').textContent = ''; body.innerHTML = slice.map(function (p) { var checked = selectedIds.has(String(p.id)) ? ' checked' : ''; var img = p.images && p.images[0] ? imageMarkup(p.images[0].image_path) : ''; return '<tr><td class="check-col"><input class="row-check" type="checkbox" data-select="' + p.id + '"' + checked + ' aria-label="Select ' + esc(p.name || 'product') + '"></td><td><div class="product"><div class="thumb' + (img ? '' : ' image-fallback') + '">' + img + '</div><div><div class="name">' + esc(p.name || 'Unnamed Product') + '</div><span class="sub">' + esc((p.description || '').trim() || '—') + '</span><div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:5px">' + (Number(p.is_bestseller) ? '<span class="badge active">Best Seller</span>' : '') + (Number(p.is_signature) ? '<span class="badge out_of_stock">Signature</span>' : '') + '</div></div></div></td><td>' + esc(p.category || 'Uncategorized') + '</td><td class="money">₱' + Number(p.price || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 }) + (p.large_price != null ? ' / ₱' + Number(p.large_price).toLocaleString('en-PH', { minimumFractionDigits: 2 }) : '') + '</td><td><span class="badge ' + statusBadge(p.status) + '">' + displayStatus(p.status) + '</span></td><td><div class="row-actions"><button class="btn small" data-edit="' + p.id + '">Edit</button><button class="btn small danger" data-delete="' + p.id + '">Delete</button></div></td></tr>' }).join('') } $('selectAll').checked = !!slice.length && slice.every(function (p) { return selectedIds.has(String(p.id)) }); $('selectAll').indeterminate = !!slice.length && !$('selectAll').checked && slice.some(function (p) { return selectedIds.has(String(p.id)) }); updateBatchToolbar() }
function updateBatchToolbar() { var n = selectedIds.size; $('batchToolbar').hidden = n === 0; $('batchCount').textContent = n + ' Selected' }
function openProductModal() { document.body.classList.add('modal-open'); $('productModal').hidden = false; markClean() } function closeProductModal() { document.body.classList.remove('modal-open'); $('productModal').hidden = true } function reset() { editId = 0; newFiles = []; $('id').value = ''; $('formTitle').textContent = 'Add Product'; $('name').value = ''; $('description').value = ''; $('price').value = ''; $('largePrice').value = ''; $('category').value = ''; $('status').value = 'active'; $('isBestseller').checked = false; $('isSignature').checked = false; $('images').value = ''; $('imageBox').innerHTML = ''; $('updatedAt').textContent = '' } function show(p) { editId = p.id; $('id').value = p.id; $('formTitle').textContent = 'Edit Product'; $('name').value = p.name; $('description').value = p.description || ''; $('price').value = p.price; $('largePrice').value = p.large_price == null ? '' : p.large_price; $('category').value = p.category; $('status').value = p.status; $('isBestseller').checked = Number(p.is_bestseller) === 1; $('isSignature').checked = Number(p.is_signature) === 1; $('updatedAt').textContent = p.updated_at ? 'Last updated ' + new Date(String(p.updated_at).replace(' ', 'T')).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : ''; $('images').value = ''; newFiles = []; drawImages(p.images || []) }
function drawImages(images) { $('imageBox').innerHTML = (images || []).map(function (x) { return '<div class="image"><img src="../' + esc(x.image_path) + '" alt=""><button type="button" data-rm="' + x.id + '">Remove</button></div>' }).join('') }
function drawNew() { var old = $('imageBox').querySelectorAll('[data-rm]'); var base = ''; old.forEach(function (x) { base += x.closest('.image').outerHTML }); $('imageBox').innerHTML = base; drawNew.urls.forEach(function (u) { URL.revokeObjectURL(u) }); drawNew.urls = []; newFiles.forEach(function (f, i) { var size = f.size >= 1048576 ? (f.size / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(f.size / 1024)) + ' KB'; $('imageBox').insertAdjacentHTML('beforeend', '<div class="image is-new"><span class="image-new-badge">New</span><img data-new="' + i + '" alt=""><span class="image-caption" title="' + esc(f.name) + '">' + esc(f.name) + ' · ' + size + '</span><button type="button" data-new-rm="' + i + '">Remove</button></div>'); var url = URL.createObjectURL(f); drawNew.urls.push(url); $('imageBox').querySelector('[data-new="' + i + '"]').src = url }) }
drawNew.urls = [];
async function load() { try { var r = await fetch(API, { credentials: 'same-origin' }); var d = await r.json(); if (!r.ok || !d.ok) throw Error(d.message || 'Could not load products. Refresh the page and try again.'); products = d.products || []; setupCats(); render() } catch (e) { notice(e.message, true); products = []; render() } }
/* New picks are added to the queue (not replacing it); limits mirror api/admin_products.php. */
var IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'], IMAGE_MAX_BYTES = 50 * 1024 * 1024, IMAGE_MAX_COUNT = 100;
function fileKey(f) { return f.name + '|' + f.size + '|' + f.lastModified }
function addImageFiles(list) { var incoming = Array.from(list || []), skipped = [], known = new Set(newFiles.map(fileKey)); incoming.forEach(function (f) { if (IMAGE_TYPES.indexOf(f.type) < 0) { skipped.push(f.name + ' (not JPG, PNG or WebP)'); return } if (f.size > IMAGE_MAX_BYTES) { skipped.push(f.name + ' (over 50 MB)'); return } if (known.has(fileKey(f))) return; if (newFiles.length >= IMAGE_MAX_COUNT) { skipped.push(f.name + ' (100 image limit)'); return } known.add(fileKey(f)); newFiles.push(f) }); if (skipped.length) notice('Skipped: ' + skipped.join(', '), true); drawNew() }
$('images').addEventListener('change', function (e) { addImageFiles(e.target.files); e.target.value = '' }); $('productDrop').addEventListener('dragover', function (e) { e.preventDefault(); this.classList.add('dragging') }); $('productDrop').addEventListener('dragleave', function () { this.classList.remove('dragging') }); $('productDrop').addEventListener('drop', function (e) { e.preventDefault(); this.classList.remove('dragging'); if (e.dataTransfer.files.length) addImageFiles(e.dataTransfer.files) });
$('form').addEventListener('submit', async function (e) { e.preventDefault(); var fd = new FormData(); fd.append('action', editId ? 'update' : 'create'); if (editId) fd.append('id', editId); fd.append('name', $('name').value.trim()); fd.append('description', $('description').value.trim()); fd.append('price', $('price').value); fd.append('large_price', $('largePrice').value); fd.append('category', $('category').value); fd.append('status', $('status').value); fd.append('is_bestseller', '0'); fd.append('is_signature', $('isSignature').checked ? '1' : '0'); newFiles.forEach(function (f) { fd.append('images[]', f) }); try { var r = await fetch(API, { method: 'POST', credentials: 'same-origin', body: fd }), d = await r.json(); if (!r.ok || !d.ok) throw Error(d.message || 'Could not save the product. Check the details and try again.'); notice(d.message); if (stepQueue) { await afterStepSave(!!(e.submitter && e.submitter.id === 'saveNext')); return } closeProductModal(); reset(); await load() } catch (err) { notice(err.message, true) } });
$('rows').addEventListener('click', async function (e) { var edit = e.target.closest('[data-edit]'), del = e.target.closest('[data-delete]'); if (edit) { var p = products.find(function (x) { return x.id == edit.dataset.edit }); if (p) { exitSteps(); show(p); openProductModal() } return } if (del) { if (!confirm('Delete this product?')) return; var fd = new FormData(); fd.append('action', 'delete'); fd.append('id', del.dataset.delete); var r = await fetch(API, { method: 'POST', credentials: 'same-origin', body: fd }), d = await r.json(); if (!r.ok || !d.ok) notice(d.message || 'Delete failed.', true); else { notice(d.message); load() } return } });
$('imageBox').addEventListener('click', async function (e) { var rm = e.target.closest('[data-rm]'), newRm = e.target.closest('[data-new-rm]'); if (newRm) { newFiles.splice(Number(newRm.dataset.newRm), 1); drawNew(); return } if (rm) { if (!confirm('Remove this image?')) return; var fd = new FormData(); fd.append('action', 'remove_image'); fd.append('image_id', rm.dataset.rm); var r = await fetch(API, { method: 'POST', credentials: 'same-origin', body: fd }), d = await r.json(); if (!r.ok || !d.ok) notice(d.message || 'Could not remove this photo. Try again.', true); else { notice(d.message); var p = products.find(function (x) { return x.id === editId }); if (p) { p.images = p.images.filter(function (i) { return i.id != rm.dataset.rm }); drawImages(p.images) } } } });
$('search').addEventListener('input', function () { page = 1; render() }); $('catFilter').addEventListener('change', function () { page = 1; render() }); $('statusFilter').addEventListener('change', function () { page = 1; render() }); $('prev').addEventListener('click', function () { page--; render() }); $('next').addEventListener('click', function () { page++; render() }); $('newProduct').addEventListener('click', function () { exitSteps(); reset(); openProductModal() }); $('clear').addEventListener('click', requestClose); $('closeProductModal').addEventListener('click', requestClose); $('productModal').addEventListener('click', function (e) { if (e.target.matches('[data-close-product-modal]')) requestClose() }); document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !$('productModal').hidden) requestClose() }); const navBackdrop = $('sidebarBackdrop'), app = document.querySelector('.app'), side = $('side'), mobileToggle = $('mobile');
function syncNavigationButton() { const mobile = window.innerWidth <= 760; const expanded = mobile ? side.classList.contains('open') : !app.classList.contains('sidebar-hidden'); const label = mobile ? (expanded ? 'Close navigation menu' : 'Open navigation menu') : (expanded ? 'Collapse navigation' : 'Expand navigation'); mobileToggle.setAttribute('aria-expanded', String(expanded)); mobileToggle.setAttribute('aria-label', label); mobileToggle.title = label }
function setDrawerOpen(open) { side.classList.toggle('open', open); navBackdrop.hidden = !open; syncNavigationButton() }
function toggleDesktopSidebar() { app.classList.toggle('sidebar-hidden'); localStorage.setItem('seven_admin_sidebar_hidden', app.classList.contains('sidebar-hidden') ? '1' : '0'); syncNavigationButton() }
mobileToggle.addEventListener('click', function () { if (window.innerWidth <= 760) setDrawerOpen(!side.classList.contains('open')); else toggleDesktopSidebar() });
navBackdrop.addEventListener('click', function () { setDrawerOpen(false) });
function closeSidebar() { if (window.innerWidth <= 760) setDrawerOpen(false); else side.classList.remove('open') }
document.addEventListener('keydown', function (event) { if (event.key === 'Escape' && window.innerWidth <= 760 && side.classList.contains('open')) setDrawerOpen(false) });
window.addEventListener('resize', function () { if (window.innerWidth > 760) setDrawerOpen(false); syncNavigationButton() });
syncNavigationButton();
function initAdminNav() {
  const links = [...document.querySelectorAll('.nav a')];
  const page = (location.pathname.split('/').pop() || 'index.html').toLowerCase();

  function activate(link) {
    links.forEach(item => item.classList.remove('active'));
    if (link) link.classList.add('active');
  }

  let target = null;
  if (page === 'index.html') {
    const hash = location.hash || '#dashboard';
    target = links.find(link => link.getAttribute('href') === hash);
  } else if (page === 'products.html') {
    target = links.find(link => link.getAttribute('href') === 'products.html');
  } else if (page === 'banners.html') {
    target = links.find(link => link.getAttribute('href') === 'banners.html');
  }

  activate(target);

  links.forEach(link => {
    link.addEventListener('click', () => {
      activate(link);
      if (window.innerWidth <= 760) closeSidebar();
    });
  });
}
$('rows').addEventListener('change', function (e) { var cb = e.target.closest('[data-select]'); if (!cb) return; if (cb.checked) selectedIds.add(String(cb.dataset.select)); else selectedIds.delete(String(cb.dataset.select)); render() }); $('selectAll').addEventListener('change', function () { var list = filtered().slice((page - 1) * perPage, page * perPage); list.forEach(function (p) { if ($('selectAll').checked) selectedIds.add(String(p.id)); else selectedIds.delete(String(p.id)) }); render() }); $('clearSelection').addEventListener('click', function () { selectedIds.clear(); render() }); function openBulkModal() { $('bulkModal').hidden = false; document.body.classList.add('modal-open') } function closeBulkModal() { $('bulkModal').hidden = true; document.body.classList.remove('modal-open') } $('batchEdit').addEventListener('click', startSteps); $('batchBulk').addEventListener('click', function () { $('bulkSubtitle').textContent = 'Update ' + selectedIds.size + ' selected products.'; $('bulkCategory').value = ''; $('bulkStatus').value = ''; openBulkModal() }); $('cancelBulk').addEventListener('click', closeBulkModal); $('closeBulkModal').addEventListener('click', closeBulkModal); $('bulkModal').addEventListener('click', function (e) { if (e.target.matches('[data-close-bulk-modal]')) closeBulkModal() }); $('batchDelete').addEventListener('click', async function () { if (!selectedIds.size || !confirm('Delete ' + selectedIds.size + ' selected product' + (selectedIds.size === 1 ? '' : 's') + '?')) return; try { var fd = new FormData(); fd.append('action', 'bulk_delete'); fd.append('ids', JSON.stringify([...selectedIds])); var r = await fetch(API, { method: 'POST', credentials: 'same-origin', body: fd }), d = await r.json(); if (!r.ok || !d.ok) throw Error(d.message || 'Bulk delete failed.'); selectedIds.clear(); notice(d.message); load() } catch (e) { notice(e.message, true) } }); $('bulkForm').addEventListener('submit', async function (e) { e.preventDefault(); var cat = $('bulkCategory').value.trim(), status = $('bulkStatus').value; if (!cat && !status) { closeBulkModal(); return } try { var fd = new FormData(); fd.append('action', 'bulk_update'); fd.append('ids', JSON.stringify([...selectedIds])); if (cat) fd.append('category', cat); if (status) fd.append('status', status); var r = await fetch(API, { method: 'POST', credentials: 'same-origin', body: fd }), d = await r.json(); if (!r.ok || !d.ok) throw Error(d.message || 'Bulk update failed.'); selectedIds.clear(); closeBulkModal(); notice(d.message); load() } catch (e) { notice(e.message, true) } });
if (localStorage.getItem('seven_admin_sidebar_hidden') === '1' && window.innerWidth > 760) document.querySelector('.app').classList.add('sidebar-hidden');
syncNavigationButton();
initAdminNav();
/* Edit selected: step through the selected products one by one in the full edit form. */
var stepQueue = null, stepIndex = 0, formSnapshot = '';
function formState() { return JSON.stringify([$('name').value, $('description').value, $('price').value, $('category').value, $('status').value, $('isBestseller').checked, $('isSignature').checked, newFiles.length]) }
function markClean() { formSnapshot = formState() }
function isDirty() { return formState() !== formSnapshot }
function confirmDiscard() { return !isDirty() || confirm('Discard unsaved changes to "' + ($('name').value.trim() || 'this product') + '"?') }
function syncStepUI() {
  var on = !!stepQueue; $('stepNav').hidden = !on; $('saveNext').hidden = !on;
  $('saveProduct').textContent = on ? 'Save' : 'Save Product';
  if (!on) return;
  var last = stepIndex >= stepQueue.length - 1;
  $('stepLabel').textContent = 'Editing ' + (stepIndex + 1) + ' of ' + stepQueue.length;
  $('stepPrev').disabled = stepIndex <= 0; $('stepNext').disabled = last;
  $('saveNext').textContent = last ? 'Save & finish' : 'Save & next';
}
function exitSteps() { stepQueue = null; syncStepUI() }
function goStep(i) {
  // Drop products that were deleted after being selected.
  while (i < stepQueue.length && !products.some(function (x) { return String(x.id) === stepQueue[i] })) stepQueue.splice(i, 1);
  if (!stepQueue.length) { finishSteps(); return }
  stepIndex = Math.max(0, Math.min(i, stepQueue.length - 1));
  show(products.find(function (x) { return String(x.id) === stepQueue[stepIndex] }));
  markClean(); syncStepUI();
  var card = $('productModal').querySelector('.admin-modal-card'); if (card) card.scrollTop = 0;
}
function startSteps() {
  // Same order as the product list, not the order the boxes were ticked.
  var ids = products.filter(function (p) { return selectedIds.has(String(p.id)) }).map(function (p) { return String(p.id) });
  if (!ids.length) return;
  stepQueue = ids; goStep(0); openProductModal();
}
function finishSteps() { var n = stepQueue ? stepQueue.length : 0; exitSteps(); selectedIds.clear(); closeProductModal(); reset(); render(); if (n) notice('Finished editing ' + n + ' product' + (n === 1 ? '' : 's') + '.') }
async function afterStepSave(advance) {
  await load();
  if (advance && stepIndex >= stepQueue.length - 1) { finishSteps(); return }
  goStep(advance ? stepIndex + 1 : stepIndex);
}
function requestClose() { if (!confirmDiscard()) return; exitSteps(); reset(); closeProductModal() }
$('stepPrev').addEventListener('click', function () { if (confirmDiscard()) goStep(stepIndex - 1) });
$('stepNext').addEventListener('click', function () { if (confirmDiscard()) goStep(stepIndex + 1) });
reset(); load();
