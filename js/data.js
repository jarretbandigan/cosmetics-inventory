// ─────────────────────────────────────────
// DATA — storage meter, data load, migrations, save, export/import
// generateId and today defined here: needed by migrations at parse time,
// and data.js loads before the inline script so they are globally available.
// ─────────────────────────────────────────

function generateId(prefix) {
  return prefix + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8).toUpperCase();
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

// FIX H5: Storage size monitoring
function getStorageInfo() {
  let totalSize = 0;
  try {
    ['ci_products','ci_stocks','ci_sales','ci_activity','ci_checks','ci_active_check','cosmetics_inv'].forEach(k => {
      const v = localStorage.getItem(k);
      if (v) totalSize += v.length;
    });
  } catch(e) {}
  const approxLimit = 5 * 1024 * 1024;
  const pct = Math.min(100, Math.round((totalSize / approxLimit) * 100));
  return { used: totalSize, pct };
}

function updateStorageMeter() {
  const meter = document.getElementById('storage-meter');
  if (!meter) return;
  const info = getStorageInfo();
  const cls = info.pct > 85 ? 'danger' : info.pct > 65 ? 'warning' : '';
  meter.innerHTML =
    '<div>Storage: <strong>' + (info.used / 1024).toFixed(1) + ' KB</strong> used (~' + info.pct + '%)</div>' +
    '<div class="storage-meter-bar"><div class="storage-meter-fill ' + cls + '" style="width:' + Math.min(100, info.pct) + '%"></div></div>' +
    (info.pct > 85 ? '<div style="color:var(--red-600);margin-top:6px">âš ï¸ Storage almost full. Export backup and clear old data.</div>' : '');
}

// Update last backup display
function updateBackupDisplay() {
  const el = document.getElementById('home-backup-time');
  if (!el) return;
  let lastBackup = null;
  try { lastBackup = localStorage.getItem('ci_last_backup'); } catch(e) {}
  if (lastBackup) {
    const d = new Date(lastBackup);
    el.textContent = 'Last backup: ' + d.toLocaleDateString() + ' at ' + d.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
  } else {
    el.textContent = 'No backup yet. Export one now.';
  }
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// DATA â€” load from storage
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
let products = [];
let stockLines = [];
let sales = [];
// STAGE 3: Activity log
let activityLog = [];
// STAGE 4: Inventory checks
let inventoryChecks = [];
let activeCheck = null;

try { products = JSON.parse(localStorage.getItem('ci_products') || '[]'); } catch(e) {}
try { stockLines = JSON.parse(localStorage.getItem('ci_stocks') || '[]'); } catch(e) {}
try { sales = JSON.parse(localStorage.getItem('ci_sales') || '[]'); } catch(e) {}
try { activityLog = JSON.parse(localStorage.getItem('ci_activity') || '[]'); } catch(e) {}
try { inventoryChecks = JSON.parse(localStorage.getItem('ci_checks') || '[]'); } catch(e) {}
try {
  const ac = localStorage.getItem('ci_active_check');
  if (ac) activeCheck = JSON.parse(ac);
} catch(e) { activeCheck = null; }

// FIX 2: Migration now runs AFTER utility functions are defined
const oldData = localStorage.getItem('cosmetics_inv');
if (oldData && products.length === 0) {
  try {
    const old = JSON.parse(oldData);
    old.forEach(item => {
      const pid = item.recordId || generateId('REC');
      products.push({
        recordId: pid,
        barcode: item.barcode || '',
        name: item.name || '',
        brand: item.brand || '',
        category: item.category || '',
        desc: item.desc || '',
        notes: item.notes || '',
        cost: item.cost || item.price || '',
        selling: item.selling || item.price || '',
        status: item.status || 'active',
        unit: item.unit || 'pcs',
        location: item.location || '',
        dateAdded: item.dateAdded || today(),
      });
      stockLines.push({
        id: generateId('STK'),
        productId: pid,
        exp: item.exp || '',
        qty: parseInt(item.qty) || 1,
        dateAdded: item.dateAdded || today(),
        markdownPrice: '',
        pulledOut: false,
      });
    });
  } catch(e) {}
}

// STAGE 2: Migrate stock lines to add markdownPrice field
(function migrateStage2() {
  let needsSave = false;
  stockLines.forEach(s => {
    if (s.markdownPrice === undefined) { s.markdownPrice = ''; needsSave = true; }
  });
  if (needsSave) {
    try { localStorage.setItem('ci_stocks', JSON.stringify(stockLines)); } catch(e) {}
  }
})();

// STAGE 5: Migrate stock lines to add pulledOut field
(function migrateStage5() {
  let needsSave = false;
  stockLines.forEach(s => {
    if (s.pulledOut === undefined) { s.pulledOut = false; needsSave = true; }
  });
  if (needsSave) {
    try { localStorage.setItem('ci_stocks', JSON.stringify(stockLines)); } catch(e) {}
  }
})();

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// SAVE
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function saveAll() {
  // FIX C1: Validate arrays before writing to prevent data corruption
  if (!Array.isArray(products)) products = [];
  if (!Array.isArray(stockLines)) stockLines = [];
  if (!Array.isArray(sales)) sales = [];
  if (!Array.isArray(activityLog)) activityLog = [];
  if (!Array.isArray(inventoryChecks)) inventoryChecks = [];
  let storageError = false;
  try { localStorage.setItem('ci_products', JSON.stringify(products)); } catch(e) { storageError = true; }
  try { localStorage.setItem('ci_stocks', JSON.stringify(stockLines)); } catch(e) { storageError = true; }
  try { localStorage.setItem('ci_sales', JSON.stringify(sales)); } catch(e) { storageError = true; }
  try { localStorage.setItem('ci_activity', JSON.stringify(activityLog)); } catch(e) { storageError = true; }
  try { localStorage.setItem('ci_checks', JSON.stringify(inventoryChecks)); } catch(e) { storageError = true; }
  try {
    if (activeCheck) localStorage.setItem('ci_active_check', JSON.stringify(activeCheck));
    else localStorage.removeItem('ci_active_check');
  } catch(e) { storageError = true; }
  if (storageError) {
    showToast('âš ï¸ Storage error! Export backup now.');
  }
  updateStorageMeter();
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// EXPORT / IMPORT â€” FIX 5: include sales
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function exportCSV() {
  if (products.length === 0 && sales.length === 0) { showToast('No data to export'); return; }

  let csv = '';

  // Products + stock sheet (STAGE 2: markdownPrice, STAGE 5: pulledOut)
  if (products.length > 0) {
    const prodHeaders = ['Record ID','Barcode','Name','Brand','Category','Description','Notes','Cost Price','Selling Price','Status','Unit','Location','Date Added','Stock ID','Expiry','Qty','Stock Date Added','Markdown Price','Pulled Out'];
    const prodRows = [];
    products.forEach(p => {
      const lines = stockLines.filter(s => s.productId === p.recordId);
      if (lines.length === 0) {
        prodRows.push([p.recordId,p.barcode,p.name,p.brand,p.category,p.desc,p.notes,p.cost,p.selling,p.status,p.unit,p.location,p.dateAdded,'','','','','',''].map(csvCell));
      } else {
        lines.forEach(s => {
          prodRows.push([p.recordId,p.barcode,p.name,p.brand,p.category,p.desc,p.notes,p.cost,p.selling,p.status,p.unit,p.location,p.dateAdded,s.id,s.exp,s.qty,s.dateAdded,s.markdownPrice||'',s.pulledOut?'yes':''].map(csvCell));
        });
      }
    });
    csv += '## INVENTORY\n' + prodHeaders.join(',') + '\n' + prodRows.map(r => r.join(',')).join('\n');
  }

  // Sales sheet (STAGE 2: includes productId, stockLineId, exp, isMarkdown)
  if (sales.length > 0) {
    const salesHeaders = ['Sale ID','Product ID','Product Name','Brand','Stock Line ID','Expiry','Qty Sold','Price','Is Markdown','Date','Timestamp'];
    const salesRows = sales.map(s => [s.id, s.productId||'', s.productName, s.brand, s.stockLineId||'', s.exp||'', s.qtySold, s.price, s.isMarkdown?'yes':'', s.date, s.timestamp||''].map(csvCell));
    csv += '\n\n## SALES\n' + salesHeaders.join(',') + '\n' + salesRows.map(r => r.join(',')).join('\n');
  }

  // STAGE 3: Activity log sheet
  if (activityLog.length > 0) {
    const actHeaders = ['Activity ID','Type','Product ID','Product Name','Description','Date','Timestamp'];
    const actRows = activityLog.map(a => [a.id, a.type, a.productId||'', a.productName||'', a.description||'', a.date||'', a.timestamp||''].map(csvCell));
    csv += '\n\n## ACTIVITY\n' + actHeaders.join(',') + '\n' + actRows.map(r => r.join(',')).join('\n');
  }

  // STAGE 4: Inventory checks sheet (one row per item per check)
  if (inventoryChecks.length > 0) {
    const checkHeaders = ['Check ID','Mode','Status','Started At','Completed At','Stock Line ID','Product ID','Product Name','Expiry','Recorded Qty','Actual Qty','Scanned'];
    const checkRows = [];
    inventoryChecks.forEach(c => {
      (c.items || []).forEach(i => {
        checkRows.push([c.id, c.mode, c.status, c.startedAt, c.completedAt, i.stockLineId, i.productId, i.productName, i.exp || '', i.recordedQty, i.actualQty != null ? i.actualQty : '', i.scanned ? 'yes' : ''].map(csvCell));
      });
    });
    csv += '\n\n## CHECKS\n' + checkHeaders.join(',') + '\n' + checkRows.map(r => r.join(',')).join('\n');
  }

  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'cosmetics_inventory_' + today() + '.csv';
  a.click();
  URL.revokeObjectURL(url);
  try { localStorage.setItem('ci_last_backup', new Date().toISOString()); } catch(e) {}
  updateBackupDisplay();
  showToast('CSV downloaded!');
}

function csvCell(v) { return '"' + String(v || '').replace(/"/g, '""') + '"'; }

// FIX 4 (import): handles new format, old flat format, and section headers
function importCSV(input) {
  const file = input.files[0];
  if (!file) return;
  // FIX Issue 16: Specific error messages
  if (file.size === 0) {
    showImportResult('File is empty.', 'error');
    input.value = '';
    return;
  }
  if (file.size > 10 * 1024 * 1024) {
    showImportResult('File too large (over 10MB). This may not be a valid CSV.', 'error');
    input.value = '';
    return;
  }
  const reader = new FileReader();
  reader.onerror = function() {
    showImportResult('Could not read the file. Try again.', 'error');
    input.value = '';
  };
  reader.onload = function(e) {
    const text = e.target.result;
    if (!text || text.length < 10) { showImportResult('File appears empty or corrupted.', 'error'); input.value = ''; return; }
    if (!text.includes(',')) { showImportResult('This does not appear to be a valid CSV file (no commas found).', 'error'); input.value = ''; return; }

    // Split into sections if ## headers present
    const inventorySection = extractSection(text, 'INVENTORY');
    const salesSection = extractSection(text, 'SALES');
    const activitySection = extractSection(text, 'ACTIVITY');
    const checksSection = extractSection(text, 'CHECKS');

    let addedProducts = 0, addedStocks = 0, addedSales = 0, addedActivity = 0, addedChecks = 0, skipped = 0;

    // Import inventory
    const invLines = (inventorySection || text).split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('##'));
    if (invLines.length < 2) {
      showImportResult('Inventory section has no data rows.', 'error');
      input.value = '';
      return;
    }
    const header = invLines[0].toLowerCase();
    const isNewFormat = header.includes('stock id');

    if (!header.includes('barcode') && !header.includes('record id')) {
      showImportResult('Header row does not match expected format. Make sure this is an exported CSV from this app.', 'error');
      input.value = '';
      return;
    }

    invLines.slice(1).forEach(line => {
      const c = parseCSVLine(line);
      if (isNewFormat) {
        const rid = (c[0] || '').trim();
        if (!rid) { skipped++; return; }
        if (!products.find(p => p.recordId === rid)) {
          products.push({ recordId:rid, barcode:c[1]||'', name:c[2]||'', brand:c[3]||'', category:c[4]||'', desc:c[5]||'', notes:c[6]||'', cost:c[7]||'', selling:c[8]||'', status:c[9]||'active', unit:c[10]||'pcs', location:c[11]||'', dateAdded:c[12]||'' });
          addedProducts++;
        }
        const sid = (c[13] || '').trim();
        if (sid && !stockLines.find(s => s.id === sid)) {
          // STAGE 2: c[17] is markdownPrice (new column)
          stockLines.push({ id:sid, productId:rid, exp:c[14]||'', qty:parseInt(c[15])||1, dateAdded:c[16]||'', markdownPrice:c[17]||'', pulledOut:(c[18]||'').toLowerCase()==='yes' });
          addedStocks++;
        }
      } else {
        const barcode = (c[0] || '').trim();
        if (!barcode) { skipped++; return; }
        const rid = generateId('REC');
        products.push({ recordId:rid, barcode, name:c[1]||'', brand:c[2]||'', category:c[3]||'', desc:c[4]||'', notes:'', cost:'', selling:'', status:'active', unit:c[6]||'pcs', location:c[9]||'', dateAdded:c[8]||'' });
        stockLines.push({ id:generateId('STK'), productId:rid, exp:c[7]||'', qty:parseInt(c[5])||1, dateAdded:c[8]||'', markdownPrice:'', pulledOut:false });
        addedProducts++;
      }
    });

    // Import sales â€” auto-detect format by column count
    if (salesSection) {
      const sLines = salesSection.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('##'));
      if (sLines.length >= 2) {
        const salesHeader = sLines[0].toLowerCase();
        const newSaleFormat = salesHeader.includes('product id') || salesHeader.includes('stock line id');
        sLines.slice(1).forEach(line => {
          const c = parseCSVLine(line);
          const sid = (c[0] || '').trim();
          if (!sid || sales.find(s => s.id === sid)) return;
          if (newSaleFormat) {
            // New: Sale ID, Product ID, Product Name, Brand, Stock Line ID, Expiry, Qty, Price, Is Markdown, Date, Timestamp
            sales.push({
              id:sid, productId:c[1]||'', productName:c[2]||'', brand:c[3]||'',
              stockLineId:c[4]||'', exp:c[5]||'', qtySold:parseInt(c[6])||1,
              price:c[7]||'', isMarkdown:(c[8]||'').toLowerCase()==='yes',
              date:c[9]||'', timestamp:c[10]||''
            });
          } else {
            // Old: Sale ID, Product Name, Brand, Qty, Price, Date
            sales.push({ id:sid, productName:c[1]||'', brand:c[2]||'', qtySold:parseInt(c[3])||1, price:c[4]||'', date:c[5]||'' });
          }
          addedSales++;
        });
      }
    }

    // STAGE 3: Import activity log
    if (activitySection) {
      const aLines = activitySection.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('##'));
      if (aLines.length >= 2) {
        aLines.slice(1).forEach(line => {
          const c = parseCSVLine(line);
          const aid = (c[0] || '').trim();
          if (!aid || activityLog.find(a => a.id === aid)) return;
          activityLog.push({
            id: aid, type: c[1] || 'note', productId: c[2] || '',
            productName: c[3] || '', description: c[4] || '',
            date: c[5] || '', timestamp: c[6] || ''
          });
          addedActivity++;
        });
        // Re-sort activity by timestamp descending
        activityLog.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
      }
    }

    // STAGE 4: Import inventory checks (rows grouped by Check ID)
    if (checksSection) {
      const ckLines = checksSection.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('##'));
      if (ckLines.length >= 2) {
        const byCheckId = {};
        ckLines.slice(1).forEach(line => {
          const c = parseCSVLine(line);
          const cid = (c[0] || '').trim();
          if (!cid) return;
          if (inventoryChecks.find(x => x.id === cid)) return; // skip dupes
          if (!byCheckId[cid]) {
            byCheckId[cid] = {
              id: cid, mode: c[1] || 'manual', status: c[2] || 'confirmed',
              startedAt: c[3] || '', completedAt: c[4] || '',
              items: []
            };
          }
          byCheckId[cid].items.push({
            stockLineId: c[5] || '', productId: c[6] || '',
            productName: c[7] || '', exp: c[8] || '',
            recordedQty: parseInt(c[9]) || 0,
            actualQty: c[10] === '' ? null : parseInt(c[10]) || 0,
            scanned: c[11] === 'yes',
          });
        });
        Object.keys(byCheckId).forEach(k => {
          inventoryChecks.push(byCheckId[k]);
          addedChecks++;
        });
      }
    }

    saveAll();
    input.value = '';
    let msg = addedProducts + ' product(s)';
    if (addedStocks) msg += ', ' + addedStocks + ' stock entries';
    if (addedSales) msg += ', ' + addedSales + ' sale(s)';
    if (addedActivity) msg += ', ' + addedActivity + ' activity entries';
    if (addedChecks) msg += ', ' + addedChecks + ' check(s)';
    msg += ' imported';
    if (skipped) msg += ', ' + skipped + ' skipped (duplicate or missing ID)';
    msg += '.';
    showImportResult(msg, (addedProducts + addedSales + addedActivity + addedChecks) > 0 ? 'success' : 'info');
    updateCounts();
    applyFilters();
  };
  try { reader.readAsText(file); } catch(e) {
    showImportResult('Failed to read file: ' + e.message, 'error');
    input.value = '';
  }
}

function extractSection(text, sectionName) {
  const marker = '## ' + sectionName;
  const start = text.indexOf(marker);
  if (start === -1) return null;
  const afterMarker = text.indexOf('\n', start) + 1;
  const nextSection = text.indexOf('\n##', afterMarker);
  return nextSection === -1 ? text.slice(afterMarker) : text.slice(afterMarker, nextSection);
}

function parseCSVLine(line) {
  const result = []; let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { if (inQ && line[i+1] === '"') { cur += '"'; i++; } else inQ = !inQ; }
    else if (ch === ',' && !inQ) { result.push(cur); cur = ''; }
    else cur += ch;
  }
  result.push(cur);
  return result;
}

function showImportResult(msg, type) {
  const el = document.getElementById('import-result');
  el.textContent = msg;
  el.className = 'import-result ' + type;
  el.style.display = 'block';
  setTimeout(() => el.style.display = 'none', 6000);
}

function doClearAll() {
  products = []; stockLines = []; sales = [];
  activityLog = []; inventoryChecks = []; activeCheck = null;
  openDetailsPanelId = null;
  saveAll();
  closeModal('modal-confirm-clear');
  applyFilters();
  showToast('All data cleared');
}
