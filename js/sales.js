// ─────────────────────────────────────────
// SALES LOG
// ─────────────────────────────────────────
// ═══════════════════════════════════════════
// STAGE 2: SALES — Scan to Sell + Manual Log
// ═══════════════════════════════════════════

function setSaleMode(mode, el) {
  saleMode = mode;
  document.querySelectorAll('.sale-mode-tab').forEach(t => t.classList.remove('active'));
  if (el) el.classList.add('active');
  document.getElementById('sale-scan-mode').style.display = mode === 'scan' ? 'block' : 'none';
  document.getElementById('sale-manual-mode').style.display = mode === 'manual' ? 'block' : 'none';
  if (mode !== 'scan') stopSellScanner();
}

function populateSaleProductSelect() {
  const sel = document.getElementById('sale-product-select');
  if (!sel) return;
  const current = sel.value;
  sel.innerHTML = '<option value="">-- Select Product --</option>';
  products.filter(p => p.status !== 'pulled' || productHasMarkdown(p.recordId)).forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.recordId;
    opt.textContent = p.name + (p.brand ? ' (' + p.brand + ')' : '');
    sel.appendChild(opt);
  });
  if (current) sel.value = current;
}

function onSaleProductChange() {
  const rid = document.getElementById('sale-product-select').value;
  const picker = document.getElementById('sale-stock-line-picker');
  const list = document.getElementById('sale-stock-line-list');
  if (!rid) { picker.style.display = 'none'; return; }
  const p = products.find(x => x.recordId === rid);
  if (!p) return;

  const lines = stockLines.filter(s => s.productId === rid && (parseInt(s.qty) || 0) > 0 && !s.pulledOut).sort((a, b) => {
    if (!a.exp && !b.exp) return 0;
    if (!a.exp) return 1;
    if (!b.exp) return -1;
    return a.exp.localeCompare(b.exp);
  });

  if (lines.length === 0) {
    list.innerHTML = '<div style="font-size:13px;color:var(--red-600);padding:10px;background:var(--red-50);border-radius:8px">No available stock for this product (all stock lines may be pulled out)</div>';
    picker.style.display = 'block';
    return;
  }

  list.innerHTML = lines.map(s => {
    const sidEsc = esc(s.id);
    const ridEsc = esc(rid);
    const priceUse = s.markdownPrice || p.selling || '';
    const hasMarkdown = !!s.markdownPrice;
    return '<div class="sell-stock-line-pick" id="ssp-' + sidEsc + '" onclick="selectManualStockLine(\'' + sidEsc + '\',\'' + ridEsc + '\')">' +
      '<div class="sell-stock-line-info">' +
        '<div class="sell-stock-line-exp">' + (s.exp ? 'Exp: ' + esc(s.exp) : 'No expiry') + '</div>' +
        '<div class="sell-stock-line-meta">Qty available: ' + s.qty + ' ' + esc(p.unit || 'pcs') + '</div>' +
      '</div>' +
      '<div class="sell-stock-line-price">' +
        (hasMarkdown && p.selling ? '<div class="original">₱' + esc(p.selling) + '</div>' : '') +
        '<div class="' + (hasMarkdown ? 'markdown' : '') + '">₱' + esc(priceUse) + '</div>' +
      '</div>' +
    '</div>';
  }).join('');
  picker.style.display = 'block';
  // Reset selection
  document.getElementById('sale-product-select').dataset.stockLineId = '';
}

function selectManualStockLine(sid, rid) {
  document.querySelectorAll('#sale-stock-line-list .sell-stock-line-pick').forEach(el => el.classList.remove('selected'));
  const picked = document.getElementById('ssp-' + sid);
  if (picked) picked.classList.add('selected');
  const s = stockLines.find(x => x.id === sid);
  const p = products.find(x => x.recordId === rid);
  if (s && p) {
    const priceEl = document.getElementById('sale-price');
    if (priceEl) priceEl.value = s.markdownPrice || p.selling || '';
  }
  document.getElementById('sale-product-select').dataset.stockLineId = sid;
}

// MANUAL SALE CONFIRMATION
function confirmLogSale() {
  const rid = document.getElementById('sale-product-select').value;
  if (!rid) { showToast('Please select a product'); return; }
  const sid = document.getElementById('sale-product-select').dataset.stockLineId;
  if (!sid) { showToast('Please select a stock line by expiry date'); return; }
  const qty = parseInt(document.getElementById('sale-qty').value) || 0;
  if (qty < 1) { showToast('Qty must be at least 1'); return; }
  const price = document.getElementById('sale-price').value.trim();
  const date = document.getElementById('sale-date').value || today();
  const p = products.find(x => x.recordId === rid);
  const s = stockLines.find(x => x.id === sid);
  if (!p || !s) return;

  const isMarkdown = !!s.markdownPrice;
  pendingSale = { productId: rid, stockLineId: sid, qty, price, isMarkdown, date, productName: p.name, brand: p.brand || '', exp: s.exp || '' };

  const currentStockQty = parseInt(s.qty) || 0;
  if (qty > currentStockQty) {
    setEl('oversell-msg', 'Selling ' + qty + ' but only ' + currentStockQty + ' available in this stock line (exp: ' + (s.exp || 'no expiry') + '). Stock will go to ' + (currentStockQty - qty) + '. Continue?');
    openModal('modal-confirm-oversell');
  } else {
    setEl('confirm-sale-msg', 'Record sale: ' + qty + 'x ' + p.name + ' at ₱' + (price || '0') + ' each?');
    openModal('modal-confirm-sale');
  }
}

function doRecordSaleAnyway() {
  closeModal('modal-confirm-oversell');
  if (!pendingSale) return;
  setEl('confirm-sale-msg', 'Proceed with this oversell?');
  openModal('modal-confirm-sale');
}

function doRecordSale() {
  closeModal('modal-confirm-sale');
  if (!pendingSale) return;
  recordSaleInternal(pendingSale);
  pendingSale = null;
}

function recordSaleInternal(sale) {
  const s = stockLines.find(x => x.id === sale.stockLineId);
  const p = products.find(x => x.recordId === sale.productId);
  if (!s || !p) return;

  const oldQty = parseInt(s.qty) || 0;
  s.qty = oldQty - sale.qty;

  sales.unshift({
    id: generateId('SAL'),
    productId: sale.productId,
    productName: sale.productName,
    brand: sale.brand,
    stockLineId: sale.stockLineId,
    exp: sale.exp,
    qtySold: sale.qty,
    price: sale.price,
    isMarkdown: sale.isMarkdown,
    timestamp: new Date().toISOString(),
    date: sale.date,
  });

  // STAGE 3: Log the sale
  const totalAmt = sale.price ? '₱' + (parseFloat(sale.price) * sale.qty).toFixed(2) : '';
  logActivity('sale', sale.productId, sale.productName, 'Sold ' + sale.qty + 'x at ₱' + (sale.price || '0') + ' each (exp: ' + (sale.exp || 'no expiry') + ')' + (sale.isMarkdown ? ' [MARKDOWN]' : '') + (totalAmt ? '. Total: ' + totalAmt : ''));

  checkAutoMarkdownReset(sale.stockLineId);
  checkAutoOutOfStock(sale.productId);
  saveAll();

  // Reset forms
  if (saleMode === 'manual') {
    document.getElementById('sale-product-select').value = '';
    document.getElementById('sale-product-select').dataset.stockLineId = '';
    document.getElementById('sale-stock-line-picker').style.display = 'none';
    document.getElementById('sale-qty').value = '1';
    document.getElementById('sale-price').value = '';
  } else {
    // Scan to Sell - clear results
    document.getElementById('sell-result').style.display = 'none';
    document.getElementById('sell-entry').style.display = 'none';
    setEl('sell-scan-status', 'Sale recorded! Tap Start Camera for next.');
    document.getElementById('sell-scan-status').className = 'scan-status success';
  }
  renderSalesList();
  applyFilters();

  // Show summary
  const total = sale.price ? '₱' + (parseFloat(sale.price) * sale.qty).toFixed(2) : '';
  setEl('summary-name', sale.productName);
  document.getElementById('summary-detail').innerHTML = 'Qty: ' + sale.qty + ' × ₱' + esc(sale.price || '0') + (sale.isMarkdown ? '  <span style="color:#6B3FA0;font-weight:600">[Markdown]</span>' : '') + '<br>Exp: ' + esc(sale.exp || 'no expiry');
  setEl('summary-total', total ? total + ' total' : '—');
  openModal('modal-sale-summary');
  updateCounts();
}

// SCAN TO SELL
async function startSellScanner() {
  try {
    setEl('sell-scan-status', 'Requesting camera access...');
    document.getElementById('sell-scan-status').className = 'scan-status';
    await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    const allDevices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = allDevices.filter(d => d.kind === 'videoinput');
    if (videoDevices.length === 0) throw new Error('No camera found.');
    const backCam = videoDevices.find(d => /back|rear|environment/i.test(d.label)) || videoDevices[videoDevices.length - 1];
    saleScannerReader = new ZXing.BrowserMultiFormatReader();
    setEl('sell-scan-status', 'Point camera at a barcode...');
    saleScannerReader.decodeFromVideoDevice(backCam.deviceId, 'sell-preview', (result) => {
      if (result) onSellBarcodeDetected(result.getText());
    });
    document.getElementById('sell-start-btn').style.display = 'none';
    document.getElementById('sell-stop-btn').style.display = 'block';
  } catch(e) {
    setEl('sell-scan-status', 'Camera error: ' + e.message);
    document.getElementById('sell-scan-status').className = 'scan-status error';
  }
}

function stopSellScanner() {
  if (saleScannerReader) { try { saleScannerReader.reset(); } catch(e) {} saleScannerReader = null; }
  const sb = document.getElementById('sell-start-btn');
  const eb = document.getElementById('sell-stop-btn');
  if (sb) sb.style.display = 'block';
  if (eb) eb.style.display = 'none';
}

function onSellBarcodeDetected(raw) {
  if (!raw || !raw.trim()) return;
  const code = raw.trim();
  if (saleScannerReader) { try { saleScannerReader.reset(); } catch(e) {} saleScannerReader = null; }
  document.getElementById('sell-start-btn').style.display = 'block';
  document.getElementById('sell-stop-btn').style.display = 'none';

  const p = products.find(x => x.barcode === code);
  const resultEl = document.getElementById('sell-result');
  resultEl.style.display = 'block';

  if (!p) {
    resultEl.innerHTML = '<div class="sell-scan-result not-found">' +
      '<div class="sell-found-name not-found">Product not found</div>' +
      '<div class="sell-found-sub">Barcode: ' + esc(code) + '</div>' +
      '<button class="btn btn-secondary btn-sm" style="margin-top:10px" onclick="resetSellScan()">Scan again</button>' +
    '</div>';
    setEl('sell-scan-status', 'Barcode not in inventory');
    document.getElementById('sell-scan-status').className = 'scan-status error';
    return;
  }

  const lines = stockLines.filter(s => s.productId === p.recordId && (parseInt(s.qty) || 0) > 0 && !s.pulledOut).sort((a,b) => {
    if (!a.exp && !b.exp) return 0;
    if (!a.exp) return 1;
    if (!b.exp) return -1;
    return a.exp.localeCompare(b.exp);
  });

  const ridEsc = esc(p.recordId);
  let html = '<div class="sell-scan-result">' +
    '<div class="sell-found-name">✅ ' + esc(p.name) + '</div>' +
    '<div class="sell-found-sub">' + (p.brand ? esc(p.brand) + ' | ' : '') + 'Total: ' + productTotalQty(p.recordId) + ' ' + esc(p.unit || 'pcs') + '</div>';

  if (lines.length === 0) {
    html += '<div style="margin-top:10px;font-size:13px;color:var(--red-600)">No stock available</div>' +
      '<button class="btn btn-secondary btn-sm" style="margin-top:10px" onclick="resetSellScan()">Scan again</button>';
  } else {
    html += '<div style="margin-top:10px;font-size:12px;font-weight:600;color:var(--gray-600)">Select which stock line:</div>';
    lines.forEach(s => {
      const sidEsc = esc(s.id);
      const priceUse = s.markdownPrice || p.selling || '';
      const hasMarkdown = !!s.markdownPrice;
      html += '<div class="sell-stock-line-pick" id="ssl-' + sidEsc + '" onclick="selectSellStockLine(\'' + sidEsc + '\',\'' + ridEsc + '\')">' +
        '<div class="sell-stock-line-info">' +
          '<div class="sell-stock-line-exp">' + (s.exp ? 'Exp: ' + esc(s.exp) : 'No expiry') + '</div>' +
          '<div class="sell-stock-line-meta">Qty: ' + s.qty + ' ' + esc(p.unit || 'pcs') + '</div>' +
        '</div>' +
        '<div class="sell-stock-line-price">' +
          (hasMarkdown && p.selling ? '<div class="original">₱' + esc(p.selling) + '</div>' : '') +
          '<div class="' + (hasMarkdown ? 'markdown' : '') + '">₱' + esc(priceUse) + '</div>' +
        '</div>' +
      '</div>';
    });
    html += '<button class="btn btn-secondary btn-sm" style="margin-top:10px" onclick="resetSellScan()">Cancel / Wrong Item</button>';
  }

  html += '</div>';
  resultEl.innerHTML = html;
  setEl('sell-scan-status', 'Product found — select stock line');
  document.getElementById('sell-scan-status').className = 'scan-status success';
}

function selectSellStockLine(sid, rid) {
  document.querySelectorAll('#sell-result .sell-stock-line-pick').forEach(el => el.classList.remove('selected'));
  const picked = document.getElementById('ssl-' + sid);
  if (picked) picked.classList.add('selected');

  const s = stockLines.find(x => x.id === sid);
  const p = products.find(x => x.recordId === rid);
  if (!s || !p) return;

  document.getElementById('sell-result').dataset.stockLineId = sid;
  document.getElementById('sell-result').dataset.productId = rid;

  document.getElementById('sell-entry').style.display = 'block';
  document.getElementById('sell-qty').value = '1';
  document.getElementById('sell-price').value = s.markdownPrice || p.selling || '';
  document.getElementById('sell-date').value = today();
}

function confirmSellScan() {
  const sid = document.getElementById('sell-result').dataset.stockLineId;
  const rid = document.getElementById('sell-result').dataset.productId;
  if (!sid || !rid) { showToast('Select a stock line'); return; }
  const qty = parseInt(document.getElementById('sell-qty').value) || 0;
  if (qty < 1) { showToast('Qty must be at least 1'); return; }
  const price = document.getElementById('sell-price').value.trim();
  const date = document.getElementById('sell-date').value || today();
  const s = stockLines.find(x => x.id === sid);
  const p = products.find(x => x.recordId === rid);
  if (!s || !p) return;

  const isMarkdown = !!s.markdownPrice;
  pendingSale = { productId: rid, stockLineId: sid, qty, price, isMarkdown, date, productName: p.name, brand: p.brand || '', exp: s.exp || '' };

  const currentStockQty = parseInt(s.qty) || 0;
  if (qty > currentStockQty) {
    setEl('oversell-msg', 'Selling ' + qty + ' but only ' + currentStockQty + ' available. Stock will go to ' + (currentStockQty - qty) + '. Continue?');
    openModal('modal-confirm-oversell');
  } else {
    setEl('confirm-sale-msg', 'Record sale: ' + qty + 'x ' + p.name + ' at ₱' + (price || '0') + ' each?');
    openModal('modal-confirm-sale');
  }
}

function resetSellScan() {
  document.getElementById('sell-result').style.display = 'none';
  document.getElementById('sell-entry').style.display = 'none';
  setEl('sell-scan-status', 'Ready to scan');
  document.getElementById('sell-scan-status').className = 'scan-status';
}

// FIX 12: show all sales with a note when over 50
function renderSalesList() {
  const list = document.getElementById('sales-list');
  if (!list) return;
  if (sales.length === 0) {
    list.innerHTML = '<div class="empty-state"><div class="icon">🧾</div><p>No sales recorded yet.</p></div>';
    return;
  }
  const shown = sales.slice(0, 50);
  list.innerHTML = shown.map(s => {
    const total = s.price ? '₱' + (parseFloat(s.price) * s.qtySold).toFixed(2) : '';
    // FIX L4: detect deleted product
    const productExists = s.productId ? products.some(p => p.recordId === s.productId) : true;
    const deletedTag = !productExists ? ' <span class="sale-log-deleted-tag">Product Removed</span>' : '';
    const markdownTag = s.isMarkdown ? ' <span class="sale-log-deleted-tag" style="background:#F3EEFB;color:#6B3FA0">Markdown</span>' : '';
    return '<div class="sale-log-item">' +
      '<div class="sale-log-name">' + esc(s.productName) + (s.brand ? ' <span style="font-weight:400;color:var(--gray-400)">(' + esc(s.brand) + ')</span>' : '') + deletedTag + markdownTag + '</div>' +
      '<div class="sale-log-meta">Qty: ' + s.qtySold + (s.price ? '  |  ₱' + esc(s.price) + ' each' : '') + '  |  ' + esc(s.date) + '</div>' +
      (s.exp ? '<div class="sale-stock-info">Stock line: exp ' + esc(s.exp) + '</div>' : '') +
      (total ? '<div class="sale-log-price">' + total + ' total</div>' : '') +
    '</div>';
  }).join('') + (sales.length > 50 ? '<div class="sales-note">Showing 50 most recent. Export CSV to see all ' + sales.length + ' sales.</div>' : '');
}

