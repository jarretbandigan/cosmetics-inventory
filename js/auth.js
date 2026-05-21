// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// STAGE 5: LOGIN / AUTH SYSTEM
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// NOTE: Client-side SHA-256 is a SOFT GATE, not real security.
// Real auth comes in Phase 2.5 with Supabase. This is for casual prevention only.

const VALID_USERNAME = 'admin';
// SHA-256 of "amaya0827"
const VALID_PASSWORD_HASH = 'fba447b7c72af7dbd2482b4bc07352abbb8292df3b28956d91692e65eaafde2e';
const AUTO_LOGOUT_MS = 30 * 60 * 1000; // 30 minutes
const AUTH_KEY = 'ci_auth_token';

// SHA-256 implementation using SubtleCrypto (built into browsers)
async function sha256(str) {
  const buf = new TextEncoder().encode(str);
  const hashBuf = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hashBuf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function isAuthValid() {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (!raw) return false;
    const token = JSON.parse(raw);
    if (!token || !token.expiresAt) return false;
    if (Date.now() > token.expiresAt) return false;
    return true;
  } catch(e) { return false; }
}

function setAuthToken() {
  try {
    localStorage.setItem(AUTH_KEY, JSON.stringify({
      user: VALID_USERNAME,
      issuedAt: Date.now(),
      expiresAt: Date.now() + AUTO_LOGOUT_MS,
    }));
  } catch(e) {}
}

function clearAuthToken() {
  try { localStorage.removeItem(AUTH_KEY); } catch(e) {}
}

function refreshAuthToken() {
  // Extend expiry on user activity
  if (!isAuthValid()) return;
  setAuthToken();
}

async function doLogin() {
  const u = (document.getElementById('login-username').value || '').trim();
  const p = document.getElementById('login-password').value || '';
  const errEl = document.getElementById('login-error');
  if (!u || !p) {
    errEl.textContent = 'Please enter username and password';
    errEl.classList.add('visible');
    return;
  }
  try {
    const ph = await sha256(p);
    if (u === VALID_USERNAME && ph === VALID_PASSWORD_HASH) {
      setAuthToken();
      document.getElementById('login-password').value = '';
      errEl.classList.remove('visible');
      showApp();
    } else {
      errEl.textContent = 'Incorrect username or password';
      errEl.classList.add('visible');
      document.getElementById('login-password').value = '';
    }
  } catch(e) {
    errEl.textContent = 'Login error: ' + e.message;
    errEl.classList.add('visible');
  }
}

function doLogout(focusField = true) {
  clearAuthToken();
  // Make sure user is on home page when logging out
  document.getElementById('page-home').classList.add('active');
  document.getElementById('page-app').classList.remove('active');
  // Stop any cameras
  try { if (codeReader) { codeReader.reset(); codeReader = null; } } catch(e) {}
  try { if (typeof saleScannerReader !== 'undefined' && saleScannerReader) { saleScannerReader.reset(); saleScannerReader = null; } } catch(e) {}
  try { if (typeof checkScannerReader !== 'undefined' && checkScannerReader) { checkScannerReader.reset(); checkScannerReader = null; } } catch(e) {}
  showLogin(focusField);
}

// focusField: true for intentional visits (app load, manual logout),
// false for auto-logout redirects so the keyboard doesn't slam up mid-browse
function showLogin(focusField = true) {
  document.getElementById('login-page').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  if (focusField) {
    setTimeout(() => {
      const u = document.getElementById('login-username');
      if (u && !u.value) u.focus();
    }, 100);
  }
}

function showApp() {
  document.getElementById('login-page').classList.add('hidden');
  document.body.style.overflow = '';
  // Refresh UI
  if (typeof updateCounts === 'function') updateCounts();
  if (typeof initWhatsNew === 'function') initWhatsNew();
}

// Activity tracker - extends auth token on user interaction
let lastActivityTs = Date.now();
function trackActivity() {
  if (!isAuthValid()) return;
  const now = Date.now();
  // Only refresh token if more than 1 minute since last refresh (avoid excessive writes)
  if (now - lastActivityTs > 60000) {
    refreshAuthToken();
    lastActivityTs = now;
  }
}

// Auto-logout checker - runs every minute
function checkAuthExpiry() {
  // Only act if currently logged in (token not yet expired)
  // BUT: we need to detect when token EXPIRES and force show login
  const loginVisible = !document.getElementById('login-page').classList.contains('hidden');
  if (loginVisible) return; // already on login screen
  if (!isAuthValid()) {
    // Token expired
    showToast('Session expired. Please sign in again.');
    doLogout(false); // don't auto-focus — keyboard shouldn't slam up mid-browse
  }
}

// Stored so the interval can be cleared if needed (e.g. future Supabase auth swap)
let authExpiryIntervalId = null;

// Attach activity listeners (will be set after DOM ready in init)
function setupAuthListeners() {
  ['click','keydown','touchstart','scroll'].forEach(evt => {
    document.addEventListener(evt, trackActivity, { passive: true });
  });
  // Check expiry every 60 seconds
  authExpiryIntervalId = setInterval(checkAuthExpiry, 60000);
}

