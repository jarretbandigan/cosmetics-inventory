// ═══════════════════════════════════════════
// STAGE 3: REPORTS TAB
// ═══════════════════════════════════════════
function setReportSection(name, el) {
  activeReportSection = name;
  document.querySelectorAll('.report-section-tab').forEach(t => t.classList.remove('active'));
  if (el) el.classList.add('active');
  document.getElementById('report-activity').style.display = name === 'activity' ? 'block' : 'none';
  document.getElementById('report-sales').style.display = name === 'sales' ? 'block' : 'none';
  document.getElementById('report-check').style.display = name === 'check' ? 'block' : 'none';
  renderReports();
}

function renderReports() {
  if (activeReportSection === 'activity') renderActivityLog();
  if (activeReportSection === 'sales') renderSalesList();
  if (activeReportSection === 'check') renderCheckHistory();
}

function setActivityTypeFilter(val, el) {
  activityTypeFilter = val;
  document.querySelectorAll('#activity-type-filter .filter-chip').forEach(c => c.classList.remove('active'));
  if (el) el.classList.add('active');
  renderActivityLog();
}

function renderActivityLog() {
  const list = document.getElementById('activity-list');
  if (!list) return;
  const searchEl = document.getElementById('activity-search');
  const dateFilterEl = document.getElementById('activity-date-filter');
  const q = (searchEl ? searchEl.value : '').toLowerCase().trim();
  const dateFilter = dateFilterEl ? dateFilterEl.value : 'all';

  const now = new Date(); now.setHours(0,0,0,0);
  const todayStr = today();
  const weekStart = new Date(now.getTime() - 7 * 86400000).toISOString().slice(0,10);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0,10);

  const manualTypes = ['delivery','transfer','damaged','note','other'];

  let filtered = activityLog.filter(a => {
    if (q) {
      const text = ((a.description || '') + ' ' + (a.productName || '') + ' ' + (a.type || '')).toLowerCase();
      if (!text.includes(q)) return false;
    }
    if (activityTypeFilter !== 'all') {
      if (activityTypeFilter === 'manual') {
        if (manualTypes.indexOf(a.type) === -1) return false;
      } else if (activityTypeFilter === 'sale') {
        // group price-change (customer request) with sales filter
        if (a.type !== 'sale' && a.type !== 'price-change') return false;
      } else if (a.type !== activityTypeFilter) return false;
    }
    if (dateFilter === 'today' && a.date !== todayStr) return false;
    if (dateFilter === 'week' && a.date < weekStart) return false;
    if (dateFilter === 'month' && a.date < monthStart) return false;
    return true;
  });

  if (filtered.length === 0) {
    list.innerHTML = '<div class="empty-state"><div class="icon">📋</div><p>No activity entries match your filters.</p></div>';
    return;
  }

  const shown = filtered.slice(0, 200);
  list.innerHTML = shown.map(a => {
    const typeLabel = activityTypeLabel(a.type);
    const typeCls = 'activity-type-' + a.type;
    const aidEsc = esc(a.id);
    const timeStr = a.timestamp ? new Date(a.timestamp).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) : '';
    return '<div class="activity-item">' +
      '<div class="activity-item-top">' +
        '<span class="activity-date">' + esc(a.date || '') + (timeStr ? ' ' + timeStr : '') + '</span>' +
        '<span class="activity-type-badge ' + typeCls + '">' + typeLabel + '</span>' +
      '</div>' +
      '<div class="activity-desc">' + esc(a.description || '') + '</div>' +
      (a.productName ? '<div class="activity-product">📦 ' + esc(a.productName) + '</div>' : '') +
      '<div class="activity-actions">' +
        '<button class="btn btn-secondary btn-sm" onclick="openEditActivity(\'' + aidEsc + '\')">Edit</button>' +
      '</div>' +
    '</div>';
  }).join('') + (filtered.length > 200 ? '<div class="sales-note">Showing 200 most recent of ' + filtered.length + '. Export CSV for full log.</div>' : '');
}

function activityTypeLabel(t) {
  return {
    'add':'Added','update':'Updated','sale':'Sale','price-change':'Price Change',
    'markdown':'Markdown','markdown-removed':'Markdown Off','pulled':'Pulled Out',
    'status':'Status','delivery':'Delivery','transfer':'Transfer','damaged':'Damaged',
    'note':'Note','other':'Other','removed':'Removed','edit':'Edited',
    'check':'Stock Check','discrepancy':'Discrepancy'
  }[t] || t;
}

// ── MANUAL LOG ENTRY ──
function openManualLogModal() {
  document.getElementById('manual-log-type').value = 'note';
  document.getElementById('manual-log-desc').value = '';
  document.getElementById('manual-log-date').value = today();
  // Populate product dropdown
  const sel = document.getElementById('manual-log-product');
  sel.innerHTML = '<option value="">-- None --</option>';
  products.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.recordId;
    opt.textContent = p.name + (p.brand ? ' (' + p.brand + ')' : '');
    sel.appendChild(opt);
  });
  openModal('modal-manual-log');
}

function confirmManualLog() {
  const desc = document.getElementById('manual-log-desc').value.trim();
  if (!desc) { showToast('Description is required'); return; }
  pendingManualLog = {
    type: document.getElementById('manual-log-type').value,
    productId: document.getElementById('manual-log-product').value,
    description: desc,
    date: document.getElementById('manual-log-date').value || today(),
  };
  openModal('modal-confirm-manual-log');
}

function doSaveManualLog() {
  if (!pendingManualLog) return;
  const m = pendingManualLog;
  const p = m.productId ? products.find(x => x.recordId === m.productId) : null;
  activityLog.unshift({
    id: generateId('ACT'),
    type: m.type,
    productId: m.productId || '',
    productName: p ? p.name : '',
    description: m.description,
    timestamp: new Date().toISOString(),
    date: m.date,
  });
  saveAll();
  closeModal('modal-confirm-manual-log');
  closeModal('modal-manual-log');
  renderActivityLog();
  showToast('Log entry saved');
  pendingManualLog = null;
}

// ── EDIT / DELETE ACTIVITY ──
function openEditActivity(aid) {
  const a = activityLog.find(x => x.id === aid);
  if (!a) return;
  editingActivityId = aid;
  document.getElementById('edit-activity-id').value = aid;
  document.getElementById('edit-activity-type').value = a.type;
  document.getElementById('edit-activity-desc').value = a.description || '';
  document.getElementById('edit-activity-product').value = a.productName || '';
  document.getElementById('edit-activity-date').value = a.date || today();
  openModal('modal-edit-activity');
}

function doEditActivity() {
  const a = activityLog.find(x => x.id === editingActivityId);
  if (!a) return;
  a.type = document.getElementById('edit-activity-type').value;
  a.description = document.getElementById('edit-activity-desc').value.trim();
  a.productName = document.getElementById('edit-activity-product').value.trim();
  a.date = document.getElementById('edit-activity-date').value || today();
  saveAll();
  closeModal('modal-edit-activity');
  renderActivityLog();
  showToast('Entry updated');
  editingActivityId = null;
}

function confirmDeleteActivity() {
  deletingActivityId = editingActivityId;
  openModal('modal-confirm-delete-activity');
}

function doDeleteActivity() {
  const backup = activityLog.find(x => x.id === deletingActivityId);
  if (!backup) { closeModal('modal-confirm-delete-activity'); return; }
  const backupCopy = JSON.parse(JSON.stringify(backup));
  activityLog = activityLog.filter(x => x.id !== deletingActivityId);
  saveAll();
  closeModal('modal-confirm-delete-activity');
  closeModal('modal-edit-activity');
  renderActivityLog();
  showUndoToast('Log entry deleted', () => {
    activityLog.unshift(backupCopy);
    saveAll();
    renderActivityLog();
    showToast('Restored!');
  });
  deletingActivityId = null;
  editingActivityId = null;
}

// ═══════════════════════════════════════════
// STAGE 4: INVENTORY CHECK
// ═══════════════════════════════════════════

// Render banner if there is an active check draft
function renderCheckBanner() {
  const area = document.getElementById('check-banner-area');
  if (!area) return;
  if (!activeCheck) { area.innerHTML = ''; return; }
  area.innerHTML =
    '<div class="check-banner">' +
      '<span class="icon">⚠️</span>' +
      '<div class="text"><strong>Unfinished check in progress</strong><br>Started ' + esc(new Date(activeCheck.startedAt).toLocaleString()) + ' (' + esc(activeCheck.mode) + ' mode)</div>' +
      '<div class="check-banner-actions">' +
        '<button class="btn btn-primary btn-sm" onclick="resumeCheck()">Resume</button>' +
      '</div>' +
    '</div>';
}

function renderCheckHistory() {
  renderCheckBanner();
  const list = document.getElementById('check-history-list');
  if (!list) return;
  if (inventoryChecks.length === 0) {
    list.innerHTML = '<div class="empty-state"><div class="icon">✅</div><p>No inventory checks yet.<br>Tap Start above to begin.</p></div>';
    return;
  }
  const sorted = inventoryChecks.slice().sort((a, b) => (b.completedAt || '').localeCompare(a.completedAt || ''));
  list.innerHTML = sorted.map(c => {
    const cidEsc = esc(c.id);
    const discrepancyCount = (c.items || []).filter(i => i.recordedQty != i.actualQty).length;
    const badgeCls = c.status === 'flagged' ? 'flagged' : 'confirmed';
    const badgeText = c.status === 'flagged' ? 'Flagged' : 'Confirmed';
    return '<div class="check-history-item" onclick="viewPastCheck(\'' + cidEsc + '\')">' +
      '<div class="header">' +
        '<div>' +
          '<div class="date">' + esc(new Date(c.completedAt).toLocaleString()) + '</div>' +
          '<div class="meta">' + esc(c.mode) + ' mode | ' + (c.items || []).length + ' items checked' + (discrepancyCount > 0 ? ' | ' + discrepancyCount + ' discrepancies' : '') + '</div>' +
        '</div>' +
        '<span class="badge ' + badgeCls + '">' + badgeText + '</span>' +
      '</div>' +
    '</div>';
  }).join('');
}

function openStartCheckModal() {
  if (activeCheck) {
    showToast('Resume or discard the active check first');
    return;
  }
  openModal('modal-start-check');
}

function startCheck(mode) {
  closeModal('modal-start-check');
  // Build items list from all stock entries with qty > 0 (and active or out products, not pulled out)
  const items = [];
  stockLines.forEach(s => {
    const p = products.find(x => x.recordId === s.productId);
    if (!p || p.status === 'pulled') return;
    items.push({
      stockLineId: s.id,
      productId: s.productId,
      productName: p.name,
      brand: p.brand || '',
      exp: s.exp || '',
      recordedQty: parseInt(s.qty) || 0,
      actualQty: mode === 'scan' ? null : parseInt(s.qty) || 0, // manual pre-fills with recorded
      scanned: false,
      scanCount: 0,
    });
  });
  activeCheck = {
    id: generateId('CHK'),
    mode: mode,
    startedAt: new Date().toISOString(),
    items: items,
  };
  saveAll();
  openActiveCheckModal();
}

function resumeCheck() {
  if (!activeCheck) return;
  openActiveCheckModal();
}

function openActiveCheckModal() {
  if (!activeCheck) return;
  setEl('check-title', activeCheck.mode === 'scan' ? '📷 Scan Mode Check' : '✏️ Manual Count Check');
  document.getElementById('check-scan-area').style.display = activeCheck.mode === 'scan' ? 'block' : 'none';
  renderCheckList();
  openModal('modal-active-check');
}

function renderCheckList() {
  if (!activeCheck) return;
  const list = document.getElementById('check-list');
  const progress = document.getElementById('check-progress');

  if (activeCheck.mode === 'scan') {
    const scannedCount = activeCheck.items.filter(i => i.scanned).length;
    progress.textContent = scannedCount + ' / ' + activeCheck.items.length + ' items scanned';
  } else {
    progress.textContent = activeCheck.items.length + ' stock entries to count';
  }

  // Group by product
  const byProduct = {};
  activeCheck.items.forEach(i => {
    if (!byProduct[i.productId]) byProduct[i.productId] = { name: i.productName, brand: i.brand, items: [] };
    byProduct[i.productId].items.push(i);
  });

  const html = Object.keys(byProduct).map(pid => {
    const grp = byProduct[pid];
    const lines = grp.items.map(i => {
      const sidEsc = esc(i.stockLineId);
      const isChecked = activeCheck.mode === 'scan' && i.scanned;
      const isDiscrepancy = activeCheck.mode === 'manual' && i.actualQty != null && i.actualQty != i.recordedQty;
      const cls = isChecked ? ' checked' : (isDiscrepancy ? ' discrepancy' : '');
      let rightContent = '';
      if (activeCheck.mode === 'scan') {
        rightContent = isChecked ?
          '<div style="text-align:right"><span class="check-icon">✓</span><div style="font-size:11px;color:var(--teal-600)">Scanned ' + (i.scanCount || 1) + '×</div></div>' :
          '<span style="font-size:11px;color:var(--gray-400)">Not scanned</span>';
      } else {
        rightContent = '<input type="number" class="actual-input" id="actual-' + sidEsc + '" value="' + (i.actualQty != null ? i.actualQty : '') + '" min="0" inputmode="numeric" onchange="updateActualQty(\'' + sidEsc + '\',this.value)">';
      }
      return '<div class="check-card-stockline' + cls + '">' +
        '<div class="info">' +
          '<div class="exp">' + (i.exp ? 'Exp: ' + esc(i.exp) : 'No expiry') + '</div>' +
          '<div class="recorded">Recorded: ' + i.recordedQty + '</div>' +
        '</div>' +
        rightContent +
      '</div>';
    }).join('');
    return '<div class="check-card">' +
      '<div class="name">' + esc(grp.name) + '</div>' +
      (grp.brand ? '<div class="sub">' + esc(grp.brand) + '</div>' : '') +
      lines +
    '</div>';
  }).join('');

  list.innerHTML = html || '<div class="empty-state"><p>No stock entries to check.</p></div>';
}

function updateActualQty(sid, val) {
  if (!activeCheck) return;
  const item = activeCheck.items.find(i => i.stockLineId === sid);
  if (!item) return;
  item.actualQty = parseInt(val);
  if (isNaN(item.actualQty)) item.actualQty = null;
  saveAll(); // auto-save draft
  // Update class for discrepancy highlight without full re-render
  const el = document.querySelector('#actual-' + sid);
  if (el && el.parentElement) {
    const parent = el.parentElement;
    parent.classList.remove('discrepancy');
    if (item.actualQty != null && item.actualQty != item.recordedQty) {
      parent.classList.add('discrepancy');
    }
  }
}

// SCAN MODE CAMERA
async function startCheckScanner() {
  try {
    setEl('check-scan-status', 'Requesting camera access...');
    document.getElementById('check-scan-status').className = 'scan-status';
    await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    const allDevices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = allDevices.filter(d => d.kind === 'videoinput');
    if (videoDevices.length === 0) throw new Error('No camera found.');
    const backCam = videoDevices.find(d => /back|rear|environment/i.test(d.label)) || videoDevices[videoDevices.length - 1];
    checkScannerReader = new ZXing.BrowserMultiFormatReader();
    setEl('check-scan-status', 'Point camera at a barcode...');
    checkScannerReader.decodeFromVideoDevice(backCam.deviceId, 'check-preview', (result) => {
      if (result) onCheckBarcodeDetected(result.getText());
    });
    document.getElementById('check-start-btn').style.display = 'none';
    document.getElementById('check-stop-btn').style.display = 'block';
  } catch(e) {
    setEl('check-scan-status', 'Camera error: ' + e.message);
    document.getElementById('check-scan-status').className = 'scan-status error';
  }
}

function stopCheckScanner() {
  if (checkScannerReader) { try { checkScannerReader.reset(); } catch(e) {} checkScannerReader = null; }
  const sb = document.getElementById('check-start-btn');
  const eb = document.getElementById('check-stop-btn');
  if (sb) sb.style.display = 'block';
  if (eb) eb.style.display = 'none';
}

let lastCheckScan = 0;
function onCheckBarcodeDetected(raw) {
  if (!raw || !raw.trim()) return;
  // Debounce - same barcode within 1.5s ignored
  const nowT = Date.now();
  if (nowT - lastCheckScan < 1500) return;
  lastCheckScan = nowT;

  const code = raw.trim();
  if (!activeCheck) return;
  const product = products.find(p => p.barcode === code);
  if (!product) {
    setEl('check-scan-status', 'Not in inventory: ' + code);
    document.getElementById('check-scan-status').className = 'scan-status error';
    setTimeout(() => {
      if (checkScannerReader) {
        setEl('check-scan-status', 'Point camera at a barcode...');
        document.getElementById('check-scan-status').className = 'scan-status';
      }
    }, 2000);
    return;
  }
  // Find all stock entries for this product
  const matchingItems = activeCheck.items.filter(i => i.productId === product.recordId);
  if (matchingItems.length === 0) {
    setEl('check-scan-status', product.name + ' has no stock to check');
    document.getElementById('check-scan-status').className = 'scan-status error';
    return;
  }
  // If any of them are already scanned, show duplicate prompt
  const scannedExisting = matchingItems.find(i => i.scanned);
  if (scannedExisting) {
    pendingDuplicateScan = { productId: product.recordId, productName: product.name };
    setEl('duplicate-scan-msg', product.name + ' was already scanned. Mark again or skip?');
    openModal('modal-duplicate-scan');
    return;
  }
  // Mark the first matching (sorted by exp) as scanned
  const sorted = matchingItems.slice().sort((a, b) => {
    if (!a.exp && !b.exp) return 0;
    if (!a.exp) return 1;
    if (!b.exp) return -1;
    return a.exp.localeCompare(b.exp);
  });
  sorted[0].scanned = true;
  sorted[0].scanCount = (sorted[0].scanCount || 0) + 1;
  sorted[0].actualQty = sorted[0].recordedQty; // assume present means count matches
  saveAll();
  setEl('check-scan-status', '✓ ' + product.name + ' marked');
  document.getElementById('check-scan-status').className = 'scan-status success';
  renderCheckList();
}

function markScannedAgain() {
  closeModal('modal-duplicate-scan');
  if (!pendingDuplicateScan || !activeCheck) return;
  const matchingItems = activeCheck.items.filter(i => i.productId === pendingDuplicateScan.productId && i.scanned);
  if (matchingItems.length > 0) {
    matchingItems[0].scanCount = (matchingItems[0].scanCount || 1) + 1;
    saveAll();
    setEl('check-scan-status', '✓ ' + pendingDuplicateScan.productName + ' marked again');
    document.getElementById('check-scan-status').className = 'scan-status success';
    renderCheckList();
  }
  pendingDuplicateScan = null;
}

function finishCheck() {
  if (!activeCheck) return;
  // Stop scanner if running
  stopCheckScanner();
  // For scan mode, unscanned items have actualQty = 0 (treat as missing)
  if (activeCheck.mode === 'scan') {
    activeCheck.items.forEach(i => {
      if (!i.scanned) i.actualQty = 0;
    });
  }
  closeModal('modal-active-check');
  renderCheckSummary();
  openModal('modal-check-summary');
}

function renderCheckSummary() {
  if (!activeCheck) return;
  const items = activeCheck.items;
  const discrepancies = items.filter(i => i.actualQty != null && i.actualQty != i.recordedQty);
  const ok = items.length - discrepancies.length;

  let html = '<div style="margin-bottom:14px;padding:12px;background:var(--gray-50);border-radius:10px">' +
    '<div style="font-size:14px;font-weight:600;margin-bottom:6px">Summary</div>' +
    '<div style="font-size:12px;color:var(--gray-600);line-height:1.6">' +
      'Items checked: <strong>' + items.length + '</strong><br>' +
      'Matches recorded: <strong style="color:var(--teal-600)">' + ok + '</strong><br>' +
      'Discrepancies: <strong style="color:' + (discrepancies.length > 0 ? 'var(--amber-600)' : 'var(--teal-600)') + '">' + discrepancies.length + '</strong>' +
    '</div></div>';

  if (discrepancies.length > 0) {
    html += '<div style="font-size:12px;font-weight:600;color:var(--gray-600);margin-bottom:6px">Discrepancies:</div>';
    html += discrepancies.map(i => {
      const diff = i.actualQty - i.recordedQty;
      const cls = diff > 0 ? 'positive' : 'negative';
      const sign = diff > 0 ? '+' : '';
      return '<div class="check-summary-item discrepancy">' +
        '<div class="name">' + esc(i.productName) + (i.brand ? ' (' + esc(i.brand) + ')' : '') + '</div>' +
        '<div class="nums">Exp: ' + esc(i.exp || 'no expiry') + ' | Recorded: ' + i.recordedQty + ' | Actual: ' + i.actualQty + '</div>' +
        '<div class="diff ' + cls + '">Difference: ' + sign + diff + '</div>' +
      '</div>';
    }).join('');
  } else {
    html += '<div style="text-align:center;color:var(--teal-600);font-size:13px;font-weight:600;padding:14px">✓ All counts match recorded inventory!</div>';
  }

  setEl('check-summary-content', '');
  document.getElementById('check-summary-content').innerHTML = html;
}

function continueCheck() {
  closeModal('modal-check-summary');
  openActiveCheckModal();
}

function flagDiscrepancies() {
  if (!activeCheck) return;
  const discrepancies = activeCheck.items.filter(i => i.actualQty != null && i.actualQty != i.recordedQty);
  // Log each discrepancy as activity
  discrepancies.forEach(i => {
    const diff = i.actualQty - i.recordedQty;
    const sign = diff > 0 ? '+' : '';
    logActivity('discrepancy', i.productId, i.productName, 'Discrepancy flagged: recorded ' + i.recordedQty + ' but counted ' + i.actualQty + ' (diff: ' + sign + diff + ', exp: ' + (i.exp || 'no expiry') + ')');
  });
  // Save the check as flagged
  const completed = JSON.parse(JSON.stringify(activeCheck));
  completed.completedAt = new Date().toISOString();
  completed.status = 'flagged';
  inventoryChecks.unshift(completed);
  logActivity('check', '', '', 'Inventory check FLAGGED: ' + completed.items.length + ' items, ' + discrepancies.length + ' discrepancies (not applied)');

  activeCheck = null;
  saveAll();
  closeModal('modal-check-summary');
  renderCheckHistory();
  showToast(discrepancies.length + ' discrepancies flagged in log');
}

function confirmCheck() {
  if (!activeCheck) return;
  const items = activeCheck.items;
  const adjustments = items.filter(i => i.actualQty != null && i.actualQty != i.recordedQty);
  // Apply each adjustment
  adjustments.forEach(i => {
    const s = stockLines.find(x => x.id === i.stockLineId);
    if (!s) return;
    s.qty = i.actualQty;
    checkAutoMarkdownReset(s.id);
    checkAutoOutOfStock(s.productId);
  });
  // Save the check as confirmed
  const completed = JSON.parse(JSON.stringify(activeCheck));
  completed.completedAt = new Date().toISOString();
  completed.status = 'confirmed';
  inventoryChecks.unshift(completed);
  logActivity('check', '', '', 'Inventory check CONFIRMED: ' + items.length + ' items, ' + adjustments.length + ' adjustments applied');

  activeCheck = null;
  saveAll();
  closeModal('modal-check-summary');
  renderCheckHistory();
  applyFilters();
  updateCounts();
  showToast('Check confirmed: ' + adjustments.length + ' adjustments applied');
}

function confirmDiscardCheck() {
  openModal('modal-discard-check');
}

function doDiscardCheck() {
  // Silently delete - reminder noted: future admin should log this
  activeCheck = null;
  saveAll();
  closeModal('modal-discard-check');
  closeModal('modal-active-check');
  renderCheckHistory();
  showToast('Check discarded');
}

function viewPastCheck(cid) {
  const c = inventoryChecks.find(x => x.id === cid);
  if (!c) return;
  setEl('past-check-title', new Date(c.completedAt).toLocaleString());
  const items = c.items || [];
  const discrepancies = items.filter(i => i.actualQty != null && i.actualQty != i.recordedQty);
  const badgeCls = c.status === 'flagged' ? 'flagged' : 'confirmed';
  const badgeText = c.status === 'flagged' ? 'Flagged (not applied)' : 'Confirmed (applied)';

  let html =
    '<div style="margin-bottom:14px;padding:12px;background:var(--gray-50);border-radius:10px">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">' +
        '<div style="font-size:14px;font-weight:600">' + esc(c.mode) + ' mode</div>' +
        '<span class="badge ' + badgeCls + '" style="font-size:10px;font-weight:600;padding:3px 8px;border-radius:10px;text-transform:uppercase;background:' + (c.status === 'flagged' ? 'var(--amber-50);color:var(--amber-600)' : 'var(--teal-50);color:var(--teal-600)') + '">' + badgeText + '</span>' +
      '</div>' +
      '<div style="font-size:12px;color:var(--gray-600);line-height:1.6">' +
        'Started: ' + esc(new Date(c.startedAt).toLocaleString()) + '<br>' +
        'Items checked: <strong>' + items.length + '</strong><br>' +
        'Discrepancies: <strong>' + discrepancies.length + '</strong>' +
      '</div></div>';

  if (discrepancies.length > 0) {
    html += '<div style="font-size:12px;font-weight:600;color:var(--gray-600);margin-bottom:6px">Discrepancies:</div>';
    html += discrepancies.map(i => {
      const diff = i.actualQty - i.recordedQty;
      const cls = diff > 0 ? 'positive' : 'negative';
      const sign = diff > 0 ? '+' : '';
      return '<div class="check-summary-item discrepancy">' +
        '<div class="name">' + esc(i.productName) + '</div>' +
        '<div class="nums">Exp: ' + esc(i.exp || 'no expiry') + ' | Recorded: ' + i.recordedQty + ' | Actual: ' + i.actualQty + '</div>' +
        '<div class="diff ' + cls + '">Difference: ' + sign + diff + '</div>' +
      '</div>';
    }).join('');
  } else {
    html += '<div style="text-align:center;color:var(--teal-600);font-size:13px;font-weight:600;padding:14px">✓ All counts matched.</div>';
  }

  document.getElementById('past-check-body').innerHTML = html;
  openModal('modal-past-check');
}

