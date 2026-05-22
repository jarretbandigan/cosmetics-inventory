// ─────────────────────────────────────────
// FIX 1: Define all utility functions FIRST
// before any code that calls them
// ─────────────────────────────────────────
const APP_VERSION = '2.7.0';
const EXPIRY_WARNING_DAYS = 30;

function esc(str) {
  // FIX L3: Properly escape all XSS-prone chars including single quote
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show';
  if (t._tid) clearTimeout(t._tid);
  t._tid = setTimeout(() => t.classList.remove('show'), 2800);
}

// FIX H1: Undo system for destructive actions
let undoTimer = null;
function showUndoToast(msg, undoFn) {
  const t = document.getElementById('toast');
  t.innerHTML = '<span>' + esc(msg) + '</span><button id="undo-btn">UNDO</button>';
  t.className = 'toast toast-undo show';
  const btn = document.getElementById('undo-btn');
  if (btn) {
    btn.onclick = function() {
      try { undoFn(); } catch(e) { console.error(e); }
      t.classList.remove('show');
      if (undoTimer) { clearTimeout(undoTimer); undoTimer = null; }
    };
  }
  if (undoTimer) clearTimeout(undoTimer);
  undoTimer = setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => { t.textContent = ''; t.className = 'toast'; }, 300);
    undoTimer = null;
  }, 6000);
}

function openModal(id) { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }

// State vars
let currentBarcode = '';
let editingProductId = null;
let deletingProductId = null;
let removingStockId = null;
let removingExpStockId = null;
let existingBarcodeProductId = null;
let activeStatusFilter = 'all';
let activeExpFilter = 30;
let codeReader = null;
let openDetailsPanelId = null;
// FIX Issue 1: Save and Scan Next flag
let saveAndScanNext = false;
// FIX Issue 3: Edit stock line state
let editingStockId = null;
// STAGE 2: Sales + markdown state
let activeSaleFilter = 'all';
let saleMode = 'scan';
let saleScannerReader = null;
let pendingSale = null;
// STAGE 3: Activity log + reports state
let activeReportSection = 'activity';
let activityTypeFilter = 'all';
let editingActivityId = null;
let deletingActivityId = null;
let pendingManualLog = null;
// STAGE 4: Inventory check state
let checkScannerReader = null;
let pendingDuplicateScan = null;
// v2.8.0 Item 4: Partial pull out state
let pendingPullOutStockId = null;
// v2.8.0 Item 1: Mode selector state
let modeSelectorFromLogin = false;
// v2.8.0 Item 2: Sales price change tracking
let originalSalePrice = '';

// STAGE 3: Log activity helper (used by all actions)
function logActivity(type, productId, productName, description) {
  activityLog.unshift({
    id: generateId('ACT'),
    type: type,
    productId: productId || '',
    productName: productName || '',
    description: description,
    timestamp: new Date().toISOString(),
    date: today(),
  });
  // Cap at 5000 entries to prevent storage bloat
  if (activityLog.length > 5000) activityLog = activityLog.slice(0, 5000);
}

// STAGE 3: Calculate inventory values for home stats
function calcInventoryValue() {
  let cost = 0, sell = 0;
  products.forEach(p => {
    if (p.status === 'pulled') return;
    const lines = stockLines.filter(s => s.productId === p.recordId);
    lines.forEach(s => {
      const qty = parseInt(s.qty) || 0;
      if (qty <= 0) return;
      const costPrice = parseFloat(p.cost) || 0;
      const sellPrice = parseFloat(s.markdownPrice || p.selling) || 0;
      cost += qty * costPrice;
      sell += qty * sellPrice;
    });
  });
  return { cost, sell };
}

function formatMoney(n) {
  if (!n) return '₱0';
  if (n >= 1000000) return '₱' + (n/1000000).toFixed(1) + 'M';
  if (n >= 10000) return '₱' + (n/1000).toFixed(0) + 'K';
  if (n >= 1000) return '₱' + n.toLocaleString(undefined, {maximumFractionDigits:0});
  return '₱' + n.toFixed(n % 1 === 0 ? 0 : 2);
}

// FIX Issue 4: Auto out of stock when qty hits zero
function checkAutoOutOfStock(productId) {
  const p = products.find(x => x.recordId === productId);
  if (!p) return;
  if (p.status === 'pulled') return; // don't override pulled out (full product)
  // STAGE 5: only count stock that is not pulled out
  const total = stockLines.filter(s => s.productId === productId && !s.pulledOut).reduce((sum, s) => sum + (parseInt(s.qty) || 0), 0);
  if (total <= 0 && p.status === 'active') {
    p.status = 'out';
    return true;
  }
  if (total > 0 && p.status === 'out') {
    p.status = 'active';
    return true;
  }
  return false;
}

// STAGE 2: Product has any markdown stock line (excluding pulled out)
function productHasMarkdown(productId) {
  return stockLines.some(s => s.productId === productId && s.markdownPrice && (parseInt(s.qty) || 0) > 0 && !s.pulledOut);
}

// STAGE 2: Auto-reset markdown when stock line hits zero
function checkAutoMarkdownReset(stockLineId) {
  const s = stockLines.find(x => x.id === stockLineId);
  if (!s || !s.markdownPrice) return false;
  if ((parseInt(s.qty) || 0) <= 0) {
    s.markdownPrice = '';
    return true;
  }
  return false;
}

// STAGE 5: Pull out state helpers
function stockLinesForProduct(rid) {
  return stockLines.filter(s => s.productId === rid);
}
function pulledOutCount(rid) {
  return stockLines.filter(s => s.productId === rid && s.pulledOut).length;
}
function isFullyPulledOut(rid) {
  const lines = stockLinesForProduct(rid);
  if (lines.length === 0) return false;
  return lines.every(s => s.pulledOut);
}
function isPartiallyPulledOut(rid) {
  const lines = stockLinesForProduct(rid);
  if (lines.length === 0) return false;
  const pulled = lines.filter(s => s.pulledOut).length;
  return pulled > 0 && pulled < lines.length;
}

// STAGE 5: Auto-sync product status with stock line pull out state
function syncProductStatusFromStockLines(rid) {
  const p = products.find(x => x.recordId === rid);
  if (!p) return false;
  const lines = stockLinesForProduct(rid);
  if (lines.length === 0) return false;
  const fullyPulled = isFullyPulledOut(rid);
  if (fullyPulled && p.status !== 'pulled') {
    const oldStatus = p.status;
    p.status = 'pulled';
    logActivity('status', rid, p.name, 'Auto status change: ' + oldStatus + ' → Pulled Out (all stock lines pulled out)');
    return true;
  }
  if (!fullyPulled && p.status === 'pulled') {
    // Was Pulled Out at product level, but not all stock lines are pulled now
    // Check qty to decide active vs out
    const total = productTotalQty(rid);
    const newStatus = total > 0 ? 'active' : 'out';
    p.status = newStatus;
    logActivity('status', rid, p.name, 'Auto status change: Pulled Out → ' + (newStatus === 'active' ? 'Active' : 'Out of Stock'));
    return true;
  }
  return false;
}

function productTotalQty(productId) {
  return stockLines.filter(s => s.productId === productId).reduce((sum, s) => sum + (parseInt(s.qty) || 0), 0);
}

// ─────────────────────────────────────────
// COUNTS — FIX 3: safe element access
// ─────────────────────────────────────────
function updateCounts() {
  const activeProds = products.filter(p => p.status === 'active').length;
  const totalUnits = stockLines.reduce((s, l) => s + (parseInt(l.qty) || 0), 0);
  const now = new Date(); now.setHours(0,0,0,0);
  const in30 = new Date(now.getTime() + EXPIRY_WARNING_DAYS * 86400000);
  const expiring = stockLines.filter(s => {
    if (!s.exp || (parseInt(s.qty) || 0) <= 0) return false;
    const d = new Date(s.exp);
    return d >= now && d <= in30;
  }).length;

  setEl('home-active', activeProds);
  setEl('home-total', totalUnits);
  setEl('home-expiring', expiring);
  setEl('stat-products', products.filter(p => activeStatusFilter === 'all' || p.status === activeStatusFilter).length);
  setEl('stat-expiring', expiring);
  // STAGE 3: Cost and selling value
  const val = calcInventoryValue();
  setEl('home-cost-value', formatMoney(val.cost));
  setEl('home-selling-value', formatMoney(val.sell));
}

// ─────────────────────────────────────────
// NAVIGATION
// ─────────────────────────────────────────
function goHome() {
  document.getElementById('page-home').classList.add('active');
  document.getElementById('page-app').classList.remove('active');
  if (codeReader) { try { codeReader.reset(); } catch(e) {} codeReader = null; }
  stopSellScanner();
  stopCheckScanner();
  updateCounts();
}

function goToApp(tab) {
  document.getElementById('page-home').classList.remove('active');
  document.getElementById('page-app').classList.add('active');
  switchTab(tab, document.getElementById('bnav-' + tab));
  updateCounts();
}

function switchTab(name, el) {
  // Stop scanners when leaving their tabs
  if (name !== 'scan') stopScanner();
  if (name !== 'sales') stopSellScanner();

  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.bnav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-' + name).classList.add('active');
  if (el) el.classList.add('active');
  const titles = { scan:'Scan Item', inventory:'Inventory', sales:'Sales', reports:'Reports', export:'Data and Export' };
  document.getElementById('app-header-title').textContent = titles[name] || name;
  if (name === 'inventory') applyFilters();
  if (name === 'sales') {
    populateSaleProductSelect();
    const dateEl = document.getElementById('sale-date');
    if (dateEl) dateEl.value = today();
    const sellDateEl = document.getElementById('sell-date');
    if (sellDateEl) sellDateEl.value = today();
  }
  if (name === 'reports') renderReports();
}

// ─────────────────────────────────────────
// WHAT'S NEW — FIX 4: safe storage check
// ─────────────────────────────────────────
function closeWhatsNew() {
  closeModal('modal-whatsnew');
  try { localStorage.setItem('ci_seen_version', APP_VERSION); } catch(e) {}
}

function initWhatsNew() {
  let seen = '';
  try { seen = localStorage.getItem('ci_seen_version') || ''; } catch(e) {}
  if (seen !== APP_VERSION) {
    openModal('modal-whatsnew');
  }
}

// Close modal on backdrop tap (not whatsnew; mode-selector and pullout handled separately below)
document.querySelectorAll('.modal-backdrop').forEach(b => {
  b.addEventListener('click', function(e) {
    if (e.target === b && b.id !== 'modal-whatsnew' && b.id !== 'modal-mode-selector' && b.id !== 'modal-confirm-pullout') {
      b.classList.remove('active');
    }
  });
});

// v2.8.0 Item 1: Mode selector backdrop — only dismiss when not from login
document.getElementById('modal-mode-selector').addEventListener('click', function(e) {
  if (e.target === this && !modeSelectorFromLogin) closeModeSelector();
});

// v2.8.0 Item 4: Pull out modal backdrop — dismiss and clear state
document.getElementById('modal-confirm-pullout').addEventListener('click', function(e) {
  if (e.target === this) { closeModal('modal-confirm-pullout'); pendingPullOutStockId = null; }
});

// v2.8.0 Item 1: Android back button via History API
window.addEventListener('popstate', function() {
  const modeModal = document.getElementById('modal-mode-selector');
  if (modeModal && modeModal.classList.contains('active')) {
    if (modeSelectorFromLogin) {
      history.pushState({ modeSelectorOpen: true }, ''); // re-push so back works again
      openModal('modal-mode-logout-confirm');
    } else {
      closeModeSelector();
    }
    return;
  }
  const logoutConfirm = document.getElementById('modal-mode-logout-confirm');
  if (logoutConfirm && logoutConfirm.classList.contains('active')) {
    hideModeLogoutConfirm();
    if (modeSelectorFromLogin) history.pushState({ modeSelectorOpen: true }, '');
    return;
  }
});

// ─────────────────────────────────────────
// CHANGELOG DROPDOWN
// ─────────────────────────────────────────
function toggleChangelog(btn) {
  const body = document.getElementById('changelog-body');
  const arrow = document.getElementById('changelog-arrow');
  const open = body.classList.toggle('open');
  arrow.classList.toggle('open', open);
}

// ─────────────────────────────────────────
// NEW PRODUCT FORM
// ─────────────────────────────────────────
function openNewProductForm(barcode) {
  const newId = generateId('REC');
  document.getElementById('item-form').style.display = 'block';
  document.getElementById('form-record-id').textContent = 'Record ID: ' + newId;
  document.getElementById('form-record-id').dataset.rid = newId;
  document.getElementById('form-barcode').textContent = barcode;
  ['f-name','f-brand','f-desc','f-cost','f-selling','f-loc','f-stock-notes'].forEach(id => { document.getElementById(id).value = ''; });
  document.getElementById('f-category').value = '';
  document.getElementById('f-status').value = 'active';
  document.getElementById('f-qty').value = '1';
  document.getElementById('f-unit').value = 'pcs';
  document.getElementById('f-exp').value = '';
  setTimeout(() => document.getElementById('f-name').focus(), 100);
}

function cancelForm() {
  document.getElementById('item-form').style.display = 'none';
  currentBarcode = '';
  document.getElementById('scan-status').textContent = 'Ready to scan';
  document.getElementById('scan-status').className = 'scan-status';
}

function confirmSaveProduct(scanNext) {
  const name = document.getElementById('f-name').value.trim();
  if (!name) { showToast('Product name is required'); document.getElementById('f-name').focus(); return; }
  saveAndScanNext = !!scanNext;
  openModal('modal-confirm-save');
}

function doSaveProduct() {
  closeModal('modal-confirm-save');
  const recordId = document.getElementById('form-record-id').dataset.rid;
  const barcode = document.getElementById('form-barcode').textContent;
  const qty = parseInt(document.getElementById('f-qty').value) || 1;

  products.push({
    recordId,
    barcode,
    name: document.getElementById('f-name').value.trim(),
    brand: document.getElementById('f-brand').value.trim(),
    category: document.getElementById('f-category').value,
    desc: document.getElementById('f-desc').value.trim(),
    cost: document.getElementById('f-cost').value.trim(),
    selling: document.getElementById('f-selling').value.trim(),
    status: document.getElementById('f-status').value,
    unit: document.getElementById('f-unit').value,
    location: document.getElementById('f-loc').value.trim(),
    dateAdded: today(),
  });

  stockLines.push({
    id: generateId('STK'),
    productId: recordId,
    exp: document.getElementById('f-exp').value,
    qty,
    dateAdded: today(),
    markdownPrice: '',
    pulledOut: false,
    notes: document.getElementById('f-stock-notes').value.trim(),
  });

  checkAutoOutOfStock(recordId);
  logActivity('add', recordId, document.getElementById('f-name').value.trim(), 'New product added: ' + document.getElementById('f-name').value.trim() + ', initial qty: ' + qty + (document.getElementById('f-exp').value ? ', exp: ' + document.getElementById('f-exp').value : ''));
  saveAll();
  cancelForm();
  showToast('Product saved!');
  updateCounts();

  // FIX Issue 1: Save and Scan Next
  if (saveAndScanNext) {
    saveAndScanNext = false;
    setEl('scan-status', 'Ready to scan next item');
    setTimeout(() => startScanner(), 300);
  }
}

// ─────────────────────────────────────────
// v2.8.0 Item 1: MODE SELECTOR
// ─────────────────────────────────────────
function showModeSelector(fromLogin) {
  modeSelectorFromLogin = !!fromLogin;
  const closeBtn = document.getElementById('mode-selector-close');
  if (closeBtn) closeBtn.style.display = fromLogin ? 'none' : 'flex';
  openModal('modal-mode-selector');
  if (fromLogin) {
    history.pushState({ modeSelectorOpen: true }, '');
  }
}

function closeModeSelector() {
  closeModal('modal-mode-selector');
}

function selectManageBusiness() {
  closeModeSelector();
}

function showModeLogoutConfirm() {
  openModal('modal-mode-logout-confirm');
}

function hideModeLogoutConfirm() {
  closeModal('modal-mode-logout-confirm');
}

// ─────────────────────────────────────────
// INIT — runs last, after all functions defined
// ─────────────────────────────────────────
updateCounts();
updateBackupDisplay();
updateStorageMeter();
applyFilters();

// STAGE 5: Auth check - show login if not authenticated, else app
setupAuthListeners();
if (isAuthValid()) {
  showApp();
} else {
  showLogin();
}
