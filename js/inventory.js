// Helper for safe DOM updates (used in counts)
function setEl(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// INVENTORY LIST
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function setStatusFilter(val, el) {
  activeStatusFilter = val;
  document.querySelectorAll('#filter-availability .filter-chip').forEach(c => c.classList.remove('active'));
  if (el) el.classList.add('active');
  applyFilters();
}

// STAGE 2: Sales status filter
function setSaleFilter(val, el) {
  activeSaleFilter = val;
  document.querySelectorAll('#filter-sale .filter-chip').forEach(c => {
    c.classList.remove('active'); c.classList.remove('sale-active');
  });
  if (el) {
    if (val === 'onsale') el.classList.add('sale-active');
    else el.classList.add('active');
  }
  applyFilters();
}

function onSearch(input) {
  document.getElementById('search-clear').style.display = input.value ? 'flex' : 'none';
  applyFilters();
}

function clearSearch() {
  document.getElementById('search-input').value = '';
  document.getElementById('search-clear').style.display = 'none';
  applyFilters();
}

function applyFilters() {
  const searchEl = document.getElementById('search-input');
  const sortEl = document.getElementById('sort-select');
  if (!searchEl || !sortEl) return;
  const q = (searchEl.value || '').toLowerCase().trim();
  const sort = sortEl.value;

  let filtered = products.filter(p => {
    const matchSearch = !q || (p.name || '').toLowerCase().includes(q) || (p.barcode || '').toLowerCase().includes(q);
    const matchStatus = activeStatusFilter === 'all' || p.status === activeStatusFilter;
    const matchSale = activeSaleFilter === 'all' || (activeSaleFilter === 'onsale' && productHasMarkdown(p.recordId));
    return matchSearch && matchStatus && matchSale;
  });

  filtered.sort((a, b) => {
    if (sort === 'name') return (a.name || '').localeCompare(b.name || '');
    if (sort === 'barcode') return (a.barcode || '').localeCompare(b.barcode || '');
    if (!a.dateAdded && !b.dateAdded) return 0;
    if (!a.dateAdded) return 1;
    if (!b.dateAdded) return -1;
    return b.dateAdded.localeCompare(a.dateAdded);
  });

  renderList(filtered, q);
  updateCounts();
}

function renderList(filtered, q) {
  const list = document.getElementById('inventory-list');
  if (filtered.length === 0) {
    list.innerHTML = '<div class="empty-state"><div class="icon">&#x1F4E6;</div><p>' +
      (products.length === 0 ? 'No products yet.<br>Go to Scan to add your first product.' : 'No results found.') +
      '</p></div>';
    return;
  }

  list.innerHTML = filtered.map(p => {
    const totalQty = productTotalQty(p.recordId);
    const statusLabel = { active:'Active', out:'Out of Stock', pulled:'Pulled Out' }[p.status] || 'Active';
    const statusCls = { active:'status-active', out:'status-out', pulled:'status-pulled' }[p.status] || 'status-active';
    const onSale = productHasMarkdown(p.recordId);
    const rid = p.recordId;
    const ridEsc = esc(rid);

    const lines = stockLines.filter(s => s.productId === rid).sort((a, b) => {
      if (!a.exp && !b.exp) return 0;
      if (!a.exp) return 1;
      if (!b.exp) return -1;
      return a.exp.localeCompare(b.exp);
    });

    const stockHTML = lines.map(s => {
      const sid = s.id;
      const sidEsc = esc(sid);
      const expLabel = getExpLabel(s.exp);
      const expCls = getExpCls(s.exp);
      const origQty = parseInt(s.qty) || 0;
      const hasMarkdown = !!s.markdownPrice;
      const isPulled = !!s.pulledOut;
      const pulledTag = isPulled ? '<span class="stock-pulled-tag">Pulled Out</span>' : '';
      return '<div class="stock-line' + (hasMarkdown ? ' has-markdown' : '') + (isPulled ? ' pulled-out' : '') + '" id="sl-' + sidEsc + '" data-orig-qty="' + origQty + '">' +
        '<div class="stock-line-top">' +
          '<div>' +
            '<div class="stock-exp-label">Expiry' + pulledTag + '</div>' +
            '<div class="stock-exp ' + expCls + '">' + (s.exp ? esc(s.exp) + expLabel : 'No expiry set') + '</div>' +
            (hasMarkdown ? '<div class="stock-markdown-info">ðŸ’° Marked down: â‚±' + esc(s.markdownPrice) + '</div>' : '') +
          '</div>' +
          '<div class="qty-control">' +
            '<button class="qty-ctrl-btn minus" onclick="changeStockQty(\'' + sidEsc + '\',-1)">âˆ’</button>' +
            '<div class="qty-val" id="qv-' + sidEsc + '">' + origQty + '</div>' +
            '<button class="qty-ctrl-btn plus" onclick="changeStockQty(\'' + sidEsc + '\',1)">+</button>' +
          '</div>' +
        '</div>' +
        '<div class="stock-save-row" id="ssr-' + sidEsc + '">' +
          '<span class="stock-was" id="sw-' + sidEsc + '">was ' + origQty + '</span>' +
          '<button class="stock-cancel-btn" onclick="cancelStockQty(\'' + sidEsc + '\')">Cancel</button>' +
          '<button class="stock-save-btn" onclick="saveStockQty(\'' + sidEsc + '\',\'' + ridEsc + '\')">Save</button>' +
        '</div>' +
        '<div class="stock-actions">' +
          '<button class="btn btn-secondary btn-sm" onclick="openEditStock(\'' + sidEsc + '\')">Edit</button>' +
          (isPulled ?
            '<button class="btn btn-teal-outline btn-sm" onclick="restoreStockLine(\'' + sidEsc + '\')">Restore</button>' :
            '<button class="btn btn-amber-outline btn-sm" onclick="pullOutStockLine(\'' + sidEsc + '\')">Pull Out</button>'
          ) +
          '<button class="btn btn-danger-outline btn-sm" onclick="confirmRemoveStock(\'' + sidEsc + '\')">Remove</button>' +
        '</div>' +
      '</div>';
    }).join('');

    const isOpen = openDetailsPanelId === rid;

    const detailsHTML =
      '<div class="product-details' + (isOpen ? ' open' : '') + '" id="pd-' + ridEsc + '">' +
        '<div class="detail-row"><span class="detail-label">Barcode</span><span class="detail-value" style="font-family:monospace">' + esc(p.barcode) + '</span></div>' +
        (p.category ? '<div class="detail-row"><span class="detail-label">Category</span><span class="detail-value">' + esc(p.category) + '</span></div>' : '') +
        (p.desc ? '<div class="detail-row"><span class="detail-label">Description</span><span class="detail-value">' + esc(p.desc) + '</span></div>' : '') +
        (p.cost || p.selling ? '<div class="detail-row"><span class="detail-label">Price</span><span class="detail-value">' + (p.cost ? 'Cost: â‚±' + esc(p.cost) : '') + (p.cost && p.selling ? '  |  ' : '') + (p.selling ? 'Selling: â‚±' + esc(p.selling) : '') + '</span></div>' : '') +
        (p.notes ? '<div class="detail-row"><span class="detail-label">Notes</span><span class="detail-value">' + esc(p.notes) + '</span></div>' : '') +
        '<div class="stock-lines">' +
          '<div class="stock-lines-title">Stock Entries (' + lines.length + ')</div>' +
          (stockHTML || '<div style="font-size:13px;color:var(--gray-400);text-align:center;padding:8px">No stock entries</div>') +
        '</div>' +
        '<div class="product-actions">' +
          '<button class="btn btn-secondary btn-sm" onclick="openEditProduct(\'' + ridEsc + '\')">Edit Product</button>' +
          '<button class="btn btn-secondary btn-sm" onclick="openAddStock(\'' + ridEsc + '\')">Add Stock</button>' +
          '<button class="btn btn-danger-outline btn-sm" onclick="confirmDeleteProduct(\'' + ridEsc + '\')">Delete Product</button>' +
        '</div>' +
      '</div>';

    const partialPulled = isPartiallyPulledOut(rid);
    const pulledLineCount = pulledOutCount(rid);
    const totalLineCount = lines.length;

    return '<div class="product-card">' +
      '<div class="product-card-main">' +
        '<div class="product-card-left">' +
          '<div class="product-name">' + esc(p.name) + '</div>' +
          (p.brand ? '<div class="product-brand">' + esc(p.brand) + '</div>' : '') +
          '<div class="product-meta"><span class="product-qty">Total: ' + totalQty + ' ' + esc(p.unit || 'pcs') + '</span></div>' +
          (partialPulled ? '<div class="partial-pullout-info">âš  ' + pulledLineCount + ' of ' + totalLineCount + ' stock lines pulled out</div>' : '') +
        '</div>' +
        '<div class="product-badges">' +
          '<span class="status-badge ' + statusCls + '">' + statusLabel + '</span>' +
          (onSale ? '<span class="status-badge status-sale">ðŸ’° On Sale</span>' : '') +
          (partialPulled ? '<span class="status-badge status-partial">Partial Pull</span>' : '') +
        '</div>' +
      '</div>' +
      '<button class="more-details-btn" onclick="toggleDetails(\'' + ridEsc + '\',this)">' +
        '<span id="mdb-icon-' + ridEsc + '">' + (isOpen ? 'â–¾' : 'â–¸') + '</span> More Details' +
      '</button>' +
      detailsHTML +
    '</div>';
  }).join('');
}

function toggleDetails(rid, btn) {
  const el = document.getElementById('pd-' + rid);
  const icon = document.getElementById('mdb-icon-' + rid);
  const open = el.classList.toggle('open');
  icon.textContent = open ? 'â–¾' : 'â–¸';
  openDetailsPanelId = open ? rid : null;
}

function getExpLabel(exp) {
  if (!exp) return '';
  const now = new Date(); now.setHours(0,0,0,0);
  const diff = Math.ceil((new Date(exp) - now) / 86400000);
  if (diff < 0) return ' (Expired)';
  if (diff <= 30) return ' (Expiring soon)';
  return '';
}

function getExpCls(exp) {
  if (!exp) return '';
  const now = new Date(); now.setHours(0,0,0,0);
  const diff = Math.ceil((new Date(exp) - now) / 86400000);
  if (diff < 0) return 'expired';
  if (diff <= 30) return 'warning';
  return '';
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// STOCK QTY CONTROLS â€” FIX 10: use data attr
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function changeStockQty(sid, delta) {
  const valEl = document.getElementById('qv-' + sid);
  const saveRow = document.getElementById('ssr-' + sid);
  const wasEl = document.getElementById('sw-' + sid);
  const slEl = document.getElementById('sl-' + sid);

  const current = parseInt(valEl.textContent) || 0;
  const newVal = Math.max(0, current + delta);
  valEl.textContent = newVal;

  if (!saveRow.classList.contains('visible')) {
    const origQty = parseInt(slEl.dataset.origQty) || 0;
    wasEl.textContent = 'was ' + origQty;
    saveRow.classList.add('visible');
  }
}

// FIX 10: Cancel reads original qty from data attribute
function cancelStockQty(sid) {
  const slEl = document.getElementById('sl-' + sid);
  const origQty = parseInt(slEl.dataset.origQty) || 0;
  document.getElementById('qv-' + sid).textContent = origQty;
  document.getElementById('ssr-' + sid).classList.remove('visible');
}

// FIX 13: After saving qty, re-render to keep panel open
function saveStockQty(sid, rid) {
  const stock = stockLines.find(s => s.id === sid);
  if (!stock) return;
  const product = products.find(p => p.recordId === rid);
  const oldQty = parseInt(stock.qty) || 0;
  const newQty = parseInt(document.getElementById('qv-' + sid).textContent) || 0;
  stock.qty = newQty;
  const slEl = document.getElementById('sl-' + sid);
  if (slEl) slEl.dataset.origQty = newQty;
  document.getElementById('ssr-' + sid).classList.remove('visible');
  document.getElementById('sw-' + sid).textContent = 'was ' + newQty;
  openDetailsPanelId = rid;
  if (product) logActivity('update', rid, product.name, 'Qty manually adjusted (exp: ' + (stock.exp || 'no expiry') + '): ' + oldQty + ' â†’ ' + newQty);
  checkAutoMarkdownReset(sid);
  checkAutoOutOfStock(rid);
  saveAll();
  showToast('Quantity updated!');
  updateCounts();
  applyFilters();
}

function confirmRemoveStock(sid) {
  removingStockId = sid;
  openModal('modal-confirm-remove-stock');
}

// FIX Issue 3: Edit individual stock line
function openEditStock(sid) {
  const s = stockLines.find(x => x.id === sid);
  if (!s) return;
  editingStockId = sid;
  document.getElementById('edit-stock-id').value = sid;
  document.getElementById('edit-stock-exp').value = s.exp || '';
  document.getElementById('edit-stock-qty').value = s.qty || 0;
  openModal('modal-edit-stock');
}

function confirmEditStock() {
  openModal('modal-confirm-edit-stock');
}

function doEditStock() {
  const s = stockLines.find(x => x.id === editingStockId);
  if (!s) return;
  const product = products.find(p => p.recordId === s.productId);
  const oldExp = s.exp, oldQty = s.qty;
  s.exp = document.getElementById('edit-stock-exp').value;
  s.qty = parseInt(document.getElementById('edit-stock-qty').value) || 0;
  if (product) {
    const changes = [];
    if (oldExp !== s.exp) changes.push('expiry: ' + (oldExp || 'none') + ' â†’ ' + (s.exp || 'none'));
    if (oldQty != s.qty) changes.push('qty: ' + oldQty + ' â†’ ' + s.qty);
    if (changes.length) logActivity('edit', product.recordId, product.name, 'Stock entry edited: ' + changes.join(', '));
  }
  openDetailsPanelId = s.productId;
  checkAutoMarkdownReset(s.id);
  checkAutoOutOfStock(s.productId);
  saveAll();
  closeModal('modal-confirm-edit-stock');
  closeModal('modal-edit-stock');
  applyFilters();
  showToast('Stock entry updated');
  editingStockId = null;
}

function doRemoveStock() {
  const backup = stockLines.find(s => s.id === removingStockId);
  if (!backup) { closeModal('modal-confirm-remove-stock'); return; }
  const stockBackup = JSON.parse(JSON.stringify(backup));
  const rid = backup.productId;
  const product = products.find(p => p.recordId === rid);
  stockLines = stockLines.filter(s => s.id !== removingStockId);
  if (product) logActivity('removed', rid, product.name, 'Stock entry removed (exp: ' + (stockBackup.exp || 'no expiry') + ', qty was: ' + stockBackup.qty + ')');
  checkAutoOutOfStock(rid);
  saveAll();
  closeModal('modal-confirm-remove-stock');
  applyFilters();
  showUndoToast('Stock entry removed', () => {
    stockLines.push(stockBackup);
    if (product) logActivity('edit', rid, product.name, 'Stock entry restore (undo)');
    checkAutoOutOfStock(rid);
    saveAll();
    applyFilters();
    showToast('Restored!');
  });
  removingStockId = null;
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// EDIT PRODUCT
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function openEditProduct(rid) {
  const p = products.find(x => x.recordId === rid);
  if (!p) return;
  editingProductId = rid;
  document.getElementById('edit-record-id').value = rid;
  document.getElementById('edit-name').value = p.name || '';
  document.getElementById('edit-brand').value = p.brand || '';
  document.getElementById('edit-category').value = p.category || '';
  document.getElementById('edit-desc').value = p.desc || '';
  document.getElementById('edit-notes').value = p.notes || '';
  document.getElementById('edit-cost').value = p.cost || '';
  document.getElementById('edit-selling').value = p.selling || '';
  document.getElementById('edit-status').value = p.status || 'active';
  openModal('modal-edit-product');
}

function confirmEditProduct() {
  if (!document.getElementById('edit-name').value.trim()) { showToast('Product name is required'); return; }
  openModal('modal-confirm-edit');
}

function doEditProduct() {
  const p = products.find(x => x.recordId === editingProductId);
  if (!p) return;
  const oldStatus = p.status;
  p.name = document.getElementById('edit-name').value.trim();
  p.brand = document.getElementById('edit-brand').value.trim();
  p.category = document.getElementById('edit-category').value;
  p.desc = document.getElementById('edit-desc').value.trim();
  p.notes = document.getElementById('edit-notes').value.trim();
  p.cost = document.getElementById('edit-cost').value.trim();
  p.selling = document.getElementById('edit-selling').value.trim();
  p.status = document.getElementById('edit-status').value;
  openDetailsPanelId = editingProductId;
  logActivity('edit', p.recordId, p.name, 'Product edited' + (oldStatus !== p.status ? ' (status: ' + oldStatus + ' â†’ ' + p.status + ')' : ''));
  saveAll();
  closeModal('modal-confirm-edit');
  closeModal('modal-edit-product');
  applyFilters();
  showToast('Product updated!');
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// DELETE PRODUCT
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function confirmDeleteProduct(rid) {
  deletingProductId = rid;
  openModal('modal-confirm-delete');
}

function doDeleteProduct() {
  const p = products.find(x => x.recordId === deletingProductId);
  if (!p) { closeModal('modal-confirm-delete'); return; }
  const productBackup = JSON.parse(JSON.stringify(p));
  const stockBackup = stockLines.filter(s => s.productId === deletingProductId).map(s => JSON.parse(JSON.stringify(s)));

  products = products.filter(x => x.recordId !== deletingProductId);
  stockLines = stockLines.filter(s => s.productId !== deletingProductId);
  if (openDetailsPanelId === deletingProductId) openDetailsPanelId = null;
  logActivity('removed', productBackup.recordId, productBackup.name, 'Product deleted: ' + productBackup.name);
  saveAll();
  closeModal('modal-confirm-delete');
  applyFilters();
  showUndoToast('Product deleted', () => {
    products.push(productBackup);
    stockBackup.forEach(s => stockLines.push(s));
    logActivity('add', productBackup.recordId, productBackup.name, 'Product delete undone');
    saveAll();
    applyFilters();
    showToast('Restored!');
  });
  deletingProductId = null;
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// ADD STOCK â€” FIX 13: keep panel open after
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function openAddStock(rid) {
  const p = products.find(x => x.recordId === rid);
  if (!p) return;
  document.getElementById('add-stock-record-id').value = rid;
  document.getElementById('add-stock-product-name').textContent = 'Adding stock to: ' + p.name;
  document.getElementById('add-stock-exp').value = '';
  document.getElementById('add-stock-qty').value = '1';
  document.getElementById('add-stock-unit').value = p.unit || 'pcs';
  document.getElementById('add-stock-loc').value = p.location || '';
  openModal('modal-add-stock');
}

function doAddStock() {
  const rid = document.getElementById('add-stock-record-id').value;
  const exp = document.getElementById('add-stock-exp').value;
  const qty = parseInt(document.getElementById('add-stock-qty').value) || 0;
  if (qty < 1) { showToast('Please enter a quantity of at least 1'); return; }
  const p = products.find(x => x.recordId === rid);

  const existingLine = stockLines.find(s => s.productId === rid && s.exp === exp);
  if (existingLine) {
    const oldQty = parseInt(existingLine.qty) || 0;
    existingLine.qty = oldQty + qty;
    if (p) logActivity('update', rid, p.name, 'Stock added: +' + qty + ' to existing entry (exp: ' + (exp || 'no expiry') + '). ' + oldQty + ' â†’ ' + existingLine.qty);
    showToast(qty + ' unit(s) added to existing stock entry.');
  } else {
    stockLines.push({ id: generateId('STK'), productId: rid, exp, qty, dateAdded: today(), markdownPrice: '', pulledOut: false });
    if (p) logActivity('add', rid, p.name, 'New stock entry: ' + qty + ' units (exp: ' + (exp || 'no expiry') + ')');
    showToast('New stock entry added.');
  }

  openDetailsPanelId = rid;
  checkAutoOutOfStock(rid);
  saveAll();
  closeModal('modal-add-stock');
  applyFilters();
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// EXPIRY MODAL â€” FIX 11: proper confirm modal
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function openExpModal() {
  activeExpFilter = 30;
  document.querySelectorAll('#modal-exp .filter-chip').forEach((c, i) => c.classList.toggle('active', i === 0));
  renderExpList();
  openModal('modal-exp');
}

function setExpFilter(days, el) {
  activeExpFilter = days;
  document.querySelectorAll('#modal-exp .filter-chip').forEach(c => c.classList.remove('active'));
  if (el) el.classList.add('active');
  renderExpList();
}

function renderExpList() {
  const now = new Date(); now.setHours(0,0,0,0);
  const cutoff = new Date(now.getTime() + activeExpFilter * 86400000);
  const items = stockLines
    .filter(s => s.exp && new Date(s.exp) <= cutoff && (parseInt(s.qty) || 0) > 0 && !s.pulledOut)
    .sort((a, b) => a.exp.localeCompare(b.exp));

  const list = document.getElementById('exp-modal-list');
  if (items.length === 0) {
    list.innerHTML = '<div class="empty-state" style="padding:24px"><div class="icon">âœ…</div><p>No items expiring within this period.</p></div>';
    return;
  }

  list.innerHTML = items.map(s => {
    const p = products.find(x => x.recordId === s.productId);
    if (!p) return '';
    const d = new Date(s.exp);
    const diff = Math.ceil((d - now) / 86400000);
    const isCritical = diff <= 30;
    const daysLabel = diff < 0 ? 'Expired ' + Math.abs(diff) + ' day(s) ago' :
      diff === 0 ? 'Expires today!' : 'Expires in ' + diff + ' day(s)';
    const sidEsc = esc(s.id);
    const ridEsc = esc(p.recordId);
    return '<div class="exp-item' + (isCritical ? ' critical' : '') + '">' +
      '<div class="exp-name">' + esc(p.name) + '</div>' +
      '<div class="exp-sub">' + esc(p.barcode) + (p.brand ? ' | ' + esc(p.brand) : '') + ' | Qty: ' + s.qty + ' ' + esc(p.unit || 'pcs') + '</div>' +
      '<div class="exp-days">' + daysLabel + ' (' + esc(s.exp) + ')</div>' +
      '<div class="exp-item-prices">' +
        (p.selling ? 'Selling: â‚±' + esc(p.selling) : '') +
        (s.markdownPrice ? ' <span class="markdown-price">| Marked down: â‚±' + esc(s.markdownPrice) + '</span>' : '') +
      '</div>' +
      '<div class="exp-item-actions">' +
        '<button class="btn btn-purple-outline btn-sm" onclick="openMarkdownInput(\'' + sidEsc + '\')">ðŸ’° ' + (s.markdownPrice ? 'Edit Markdown' : 'Mark Down') + '</button>' +
        '<button class="btn btn-amber-outline btn-sm" onclick="pullOutStockLine(\'' + sidEsc + '\')">Pull Out</button>' +
        '<button class="btn btn-danger-outline btn-sm" onclick="confirmRemoveStockFromExp(\'' + sidEsc + '\')">Remove</button>' +
      '</div>' +
      '<div class="markdown-input-row" id="mir-' + sidEsc + '">' +
        '<div class="field" style="margin-top:8px"><label>New Markdown Price (â‚±)</label><div class="price-wrap"><span class="price-symbol">â‚±</span><input type="number" id="mip-' + sidEsc + '" placeholder="0.00" min="0" step="0.01" inputmode="decimal" value="' + esc(s.markdownPrice || '') + '"></div></div>' +
        '<div class="btn-row" style="margin-bottom:0">' +
          '<button class="btn btn-secondary btn-sm" onclick="cancelMarkdownInput(\'' + sidEsc + '\')">Cancel</button>' +
          (s.markdownPrice ? '<button class="btn btn-danger-outline btn-sm" onclick="removeMarkdown(\'' + sidEsc + '\')">Remove</button>' : '') +
          '<button class="btn btn-primary btn-sm" onclick="confirmMarkdown(\'' + sidEsc + '\')">Apply</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  }).join('');
}

// STAGE 2: Markdown input UI
function openMarkdownInput(sid) {
  document.querySelectorAll('.markdown-input-row').forEach(r => r.classList.remove('visible'));
  const row = document.getElementById('mir-' + sid);
  if (row) row.classList.add('visible');
}

function cancelMarkdownInput(sid) {
  const row = document.getElementById('mir-' + sid);
  if (row) row.classList.remove('visible');
}

// STAGE 5: Markdown applies directly without separate modal
function confirmMarkdown(sid) {
  const inp = document.getElementById('mip-' + sid);
  const price = inp.value.trim();
  if (!price || parseFloat(price) <= 0) { showToast('Enter a valid price'); return; }
  const s = stockLines.find(x => x.id === sid);
  if (!s) return;
  const p = products.find(x => x.recordId === s.productId);
  const oldPrice = s.markdownPrice;
  s.markdownPrice = price;
  if (p) {
    const verb = oldPrice ? 'updated from â‚±' + oldPrice + ' to' : 'set to';
    logActivity('markdown', p.recordId, p.name, 'Price markdown ' + verb + ' â‚±' + price + ' (exp: ' + (s.exp || 'no expiry') + ')');
  }
  saveAll();
  renderExpList();
  applyFilters();
  showToast('Markdown applied');
  updateCounts();
}

// Kept for compatibility but no longer used since modal removed
function doApplyMarkdown() {
  if (!pendingMarkdown) return;
  const s = stockLines.find(x => x.id === pendingMarkdown.sid);
  if (!s) return;
  const p = products.find(x => x.recordId === s.productId);
  const oldPrice = s.markdownPrice;
  s.markdownPrice = pendingMarkdown.price;
  if (p) {
    const verb = oldPrice ? 'updated from â‚±' + oldPrice + ' to' : 'set to';
    logActivity('markdown', p.recordId, p.name, 'Price markdown ' + verb + ' â‚±' + pendingMarkdown.price + ' (exp: ' + (s.exp || 'no expiry') + ')');
  }
  saveAll();
  closeModal('modal-confirm-markdown');
  pendingMarkdown = null;
  renderExpList();
  applyFilters();
  showToast('Markdown applied');
  updateCounts();
}

function removeMarkdown(sid) {
  const s = stockLines.find(x => x.id === sid);
  if (!s) return;
  const p = products.find(x => x.recordId === s.productId);
  const old = s.markdownPrice;
  s.markdownPrice = '';
  if (p) logActivity('markdown-removed', p.recordId, p.name, 'Markdown removed (was â‚±' + old + ', exp: ' + (s.exp || 'no expiry') + ')');
  saveAll();
  renderExpList();
  applyFilters();
  showToast('Markdown removed');
  updateCounts();
}

// STAGE 5: Pull out a specific stock line (not the whole product)
function pullOutStockLine(sid) {
  const s = stockLines.find(x => x.id === sid);
  if (!s) return;
  const p = products.find(x => x.recordId === s.productId);
  if (!p) return;
  if (s.pulledOut) {
    showToast('Already pulled out');
    return;
  }
  s.pulledOut = true;
  logActivity('pulled', p.recordId, p.name, 'Stock line pulled out (exp: ' + (s.exp || 'no expiry') + ', qty: ' + s.qty + ')');
  // Auto-sync product status if all lines are pulled out
  syncProductStatusFromStockLines(p.recordId);
  saveAll();
  renderExpList();
  applyFilters();
  showToast('Stock line pulled out');
}

// STAGE 5: Restore a pulled-out stock line back to available
function restoreStockLine(sid) {
  const s = stockLines.find(x => x.id === sid);
  if (!s) return;
  const p = products.find(x => x.recordId === s.productId);
  if (!p) return;
  if (!s.pulledOut) return;
  s.pulledOut = false;
  logActivity('edit', p.recordId, p.name, 'Stock line restored from pulled out (exp: ' + (s.exp || 'no expiry') + ', qty: ' + s.qty + ')');
  syncProductStatusFromStockLines(p.recordId);
  checkAutoOutOfStock(p.recordId);
  saveAll();
  applyFilters();
  showToast('Stock line restored');
}

// Old function kept for backward compatibility but now pulls only the specific line
function pullOutFromExp(sid) {
  pullOutStockLine(sid);
}

// FIX 11: use modal instead of confirm()
function confirmRemoveStockFromExp(sid) {
  removingExpStockId = sid;
  openModal('modal-confirm-remove-exp');
}

function doRemoveStockFromExp() {
  const backup = stockLines.find(s => s.id === removingExpStockId);
  if (!backup) { closeModal('modal-confirm-remove-exp'); return; }
  const stockBackup = JSON.parse(JSON.stringify(backup));
  const rid = backup.productId;
  const product = products.find(p => p.recordId === rid);
  stockLines = stockLines.filter(s => s.id !== removingExpStockId);
  if (product) logActivity('removed', rid, product.name, 'Stock entry removed from expiry list (exp: ' + (stockBackup.exp || 'no expiry') + ', qty: ' + stockBackup.qty + ')');
  checkAutoOutOfStock(rid);
  saveAll();
  closeModal('modal-confirm-remove-exp');
  renderExpList();
  applyFilters();
  showUndoToast('Stock entry removed', () => {
    stockLines.push(stockBackup);
    if (product) logActivity('edit', rid, product.name, 'Stock entry restore from expiry (undo)');
    checkAutoOutOfStock(rid);
    saveAll();
    renderExpList();
    applyFilters();
    showToast('Restored!');
  });
  removingExpStockId = null;
}

