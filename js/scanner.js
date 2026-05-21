// ─────────────────────────────────────────
// CAMERA
// ─────────────────────────────────────────
async function startScanner() {
  try {
    document.getElementById('scan-status').textContent = 'Requesting camera access...';
    document.getElementById('scan-status').className = 'scan-status';
    await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    const allDevices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = allDevices.filter(d => d.kind === 'videoinput');
    if (videoDevices.length === 0) throw new Error('No camera found.');
    const sel = document.getElementById('camera-select');
    sel.innerHTML = '';
    videoDevices.forEach((d, i) => {
      const opt = document.createElement('option');
      opt.value = d.deviceId;
      opt.textContent = d.label || 'Camera ' + (i + 1);
      sel.appendChild(opt);
    });
    if (videoDevices.length > 1) sel.style.display = 'block';
    const backCam = videoDevices.find(d => /back|rear|environment/i.test(d.label)) || videoDevices[videoDevices.length - 1];
    sel.value = backCam.deviceId;
    codeReader = new ZXing.BrowserMultiFormatReader();
    beginDecode(backCam.deviceId);
    document.getElementById('start-btn').style.display = 'none';
    document.getElementById('stop-btn').style.display = 'block';
  } catch(e) {
    document.getElementById('scan-status').textContent = 'Camera error: ' + e.message;
    document.getElementById('scan-status').className = 'scan-status error';
  }
}

function beginDecode(deviceId) {
  document.getElementById('scan-status').textContent = 'Point camera at a barcode...';
  document.getElementById('scan-status').className = 'scan-status';
  codeReader.decodeFromVideoDevice(deviceId, 'preview', (result) => {
    if (result) onBarcodeDetected(result.getText());
  });
}

function switchCamera() {
  const id = document.getElementById('camera-select').value;
  if (!id || !codeReader) return;
  codeReader.reset();
  beginDecode(id);
}

function stopScanner() {
  if (codeReader) { try { codeReader.reset(); } catch(e) {} codeReader = null; }
  document.getElementById('start-btn').style.display = 'block';
  document.getElementById('stop-btn').style.display = 'none';
  document.getElementById('camera-select').style.display = 'none';
  document.getElementById('scan-status').textContent = 'Camera stopped';
  document.getElementById('scan-status').className = 'scan-status';
}

function onBarcodeDetected(raw) {
  if (!raw || !raw.trim()) return;
  const code = raw.trim();
  if (codeReader) { try { codeReader.reset(); } catch(e) {} codeReader = null; }
  document.getElementById('start-btn').style.display = 'block';
  document.getElementById('stop-btn').style.display = 'none';
  document.getElementById('camera-select').style.display = 'none';
  document.getElementById('scan-status').textContent = 'Barcode detected: ' + code;
  document.getElementById('scan-status').className = 'scan-status success';
  handleBarcode(code);
}

function handleBarcode(code) {
  const existing = products.find(p => p.barcode === code);
  if (existing) {
    showExistingProductModal(existing);
  } else {
    currentBarcode = code;
    openNewProductForm(code);
  }
}

// ─────────────────────────────────────────
// MANUAL ENTRY
// ─────────────────────────────────────────
function toggleManualEntry() {
  const el = document.getElementById('manual-entry');
  el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

function useManualBarcode() {
  const code = document.getElementById('manual-barcode').value.trim();
  if (!code) { showToast('Please enter a barcode number'); return; }
  document.getElementById('manual-entry').style.display = 'none';
  document.getElementById('manual-barcode').value = '';
  handleBarcode(code);
}

function useNoBarcode() {
  const existing = products.filter(p => /^NOBC-\d+$/.test(p.barcode));
  const nums = existing.map(p => parseInt(p.barcode.replace('NOBC-', ''), 10));
  const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
  const code = 'NOBC-' + String(next).padStart(3, '0');
  currentBarcode = code;
  document.getElementById('manual-entry').style.display = 'none';
  document.getElementById('manual-barcode').value = '';
  openNewProductForm(code);
}

// ─────────────────────────────────────────
// EXISTING BARCODE MODAL
// ─────────────────────────────────────────
function showExistingProductModal(product) {
  existingBarcodeProductId = product.recordId;
  const totalQty = productTotalQty(product.recordId);
  document.getElementById('existing-name').textContent = product.name;
  document.getElementById('existing-sub').textContent = (product.brand || '') + (product.category ? ' | ' + product.category : '');
  document.getElementById('existing-qty').textContent = 'Current total stock: ' + totalQty + ' ' + (product.unit || 'pcs');
  document.getElementById('existing-exp-input').value = '';
  document.getElementById('existing-qty-input').value = '1';
  openModal('modal-existing');
}

function confirmAddToExisting() {
  const exp = document.getElementById('existing-exp-input').value;
  const qtyToAdd = parseInt(document.getElementById('existing-qty-input').value) || 0;
  if (qtyToAdd < 1) { showToast('Please enter a valid quantity (at least 1)'); return; }

  const product = products.find(p => p.recordId === existingBarcodeProductId);
  if (!product) return;

  const existingLine = stockLines.find(s => s.productId === existingBarcodeProductId && s.exp === exp);
  if (existingLine) {
    const oldQty = parseInt(existingLine.qty) || 0;
    existingLine.qty = oldQty + qtyToAdd;
    logActivity('update', product.recordId, product.name, 'Stock added: +' + qtyToAdd + ' to existing entry (exp: ' + (exp || 'no expiry') + '). ' + oldQty + ' → ' + existingLine.qty);
    showToast(qtyToAdd + ' unit(s) added to existing stock entry.');
  } else {
    stockLines.push({
      id: generateId('STK'),
      productId: existingBarcodeProductId,
      exp,
      qty: qtyToAdd,
      dateAdded: today(),
      markdownPrice: '',
      pulledOut: false,
    });
    logActivity('add', product.recordId, product.name, 'New stock entry: ' + qtyToAdd + ' units (exp: ' + (exp || 'no expiry') + ')');
    showToast('New stock entry added' + (exp ? ' for exp: ' + exp : '') + '.');
  }

  closeModal('modal-existing');
  checkAutoOutOfStock(existingBarcodeProductId);
  saveAll();
  existingBarcodeProductId = null;
  updateCounts();
}

