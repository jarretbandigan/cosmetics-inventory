# Cosmetics Inventory App — Claude Context

## What This Is
A mobile-first cosmetics inventory management app for a small Philippine boutique. Runs in any phone browser, deployed on GitHub Pages. Long-term goal: release on Google Play and App Store as a free alternative to tools like BoxHero.

**Live app:** https://jarretbandigan.github.io/cosmetics-inventory/

---

## Current File Structure (as of post-QA cleanup)
- `index.html` — HTML structure only, 990 lines
- `css/style.css` — all styling, 839 lines
- `js/auth.js` — login, logout, auto-logout timer, 149 lines
- `js/scanner.js` — ZXing barcode scanning, camera, 154 lines
- `js/inventory.js` — inventory list, render, search, filter, sort, stock controls, 612 lines
- `js/sales.js` — scan to sell, manual sale log, oversell, 350 lines
- `js/reports.js` — activity log, reports tab, inventory check, 616 lines
- `js/data.js` — CSV export, import, storage meter, migrations, saveAll, 434 lines
- `js/app.js` — app init, navigation, utilities, What's New, product form, 393 lines

Script load order: `auth.js` → `scanner.js` → `inventory.js` → `sales.js` → `reports.js` → `data.js` → `app.js`

---

## Tech Stack
- Vanilla HTML/CSS/JavaScript — no frameworks, no build step
- Barcode scanning: ZXing pinned to v0.21.0 (CDN)
- Storage: localStorage + CSV export/import
- Hosting: GitHub Pages
- Future backend: Supabase (Phase 2.5)
- Future packaging: Capacitor for Android and iOS (Phase 3)

---

## Current Version: v2.6.0
All Phase 1 stages complete. Phase 2 (Go Mobile-Ready) is next.

| Stage | Version | What changed |
|-------|---------|-------------|
| 5 | v2.6.0 | Login screen, SHA-256 auth, auto-logout 30 min, pull out per stock line |
| 4 | v2.5.0 | Inventory Check, manual + scan mode, discrepancy summary, check history |
| 3 | v2.4.0 | Activity Log, Reports tab, home cost and selling value stats |
| 2 | v2.3.0 | Sales overhaul, Scan to Sell, price markdown, dual status, oversell warning |
| 1 | v2.2.0 | Foundation fixes, ZXing pinned, data protection, undo on delete, storage meter |

---

## Data Model (localStorage keys)
| Key | Contents |
|-----|----------|
| `ci_products` | Record ID, barcode, name, brand, category, desc, notes, cost, selling, status, unit, location, dateAdded |
| `ci_stocks` | Stock lines — id, productId, exp, qty, dateAdded, markdownPrice, pulledOut |
| `ci_sales` | Sale records linked to product + stock line |
| `ci_activity` | Auto-logged and manual activity log entries |
| `ci_checks` | Completed inventory check sessions |
| `ci_active_check` | In-progress check draft (cleared on confirm/discard) |
| `ci_auth_token` | Session token with expiry timestamp |
| `ci_last_backup` | Timestamp of last CSV export |
| `ci_seen_version` | Last version the user saw the What's New modal for |

Default login: username `admin`, password `amaya0827`

---

## Rules for Every Session
1. **Never delete or overwrite user data.** Any schema change needs a migration. Never wipe a localStorage key.
2. **Single file until explicitly told to split.** All CSS, HTML, and JS stays in the organized file structure above — do not add new files without being asked.
3. **Everything must be free or have a free tier.** Flag anything that costs money before using it.
4. **Every update gets a version bump and a What's New entry** inside the app. Increment `APP_VERSION` in `js/app.js` and add a bullet to the What's New modal in `index.html`.
5. **If a feature causes instability, remove it and ship clean.** A broken app is worse than a missing feature.
6. **Always test syntax balance** (braces, brackets, parens) before delivering. No build step means a syntax error breaks everything.
7. **Do not start the next phase until confirmed complete and tested on a real phone.**

---

## Roadmap
- Phase 1: Polish and Stabilize — COMPLETE
- Phase 2: Go Mobile-Ready — NEXT — layout fixes, real phone testing, no new features
- Phase 2.5: Backend and Database (Supabase) — PENDING
- Phase 3: Package as Mobile App (Capacitor) — PENDING
- Phase 3.5: PH Market Features — PENDING
- Phase 4: Test and Prepare for Launch — PENDING
- Phase 5: Launch to App Stores — PENDING
- Phase 6: AI Features (Claude API) — PENDING
- Phase 7: International Expansion — PENDING

---

## PH Market Features Planned (Phase 3.5)
- GCash and Maya payment method field on sales log
- Low stock alerts with minimum qty per product
- Supplier tracking field per product
- Profit summary dashboard
- Bundle or package deal pricing
- Staff mode with limited access
- Manual Shopee and Lazada stock deduction

---

## AI Features Planned (Phase 6)
- AI assistant using Claude API for plain language inventory queries
- Smart restock suggestions from sales patterns
- Sales insights summary in plain language
- Expiry management advice
- Auto-categorization on product add
- Goal: present to Connectt.io as portfolio piece

---

## Notes
- Assistant Claude for this project is named Amaya
- App targets Philippine boutiques and small cosmetics resellers
- Free alternative to BoxHero which costs $18 to $49 per month
- Future Shop mode is customer-facing store locator and product browser
