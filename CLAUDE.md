# INVENTORY SYSTEM - Claude Code Instructions
App Version: v2.6.0 | Updated: May 2026

---

## TIER 1: RULES - READ FIRST EVERY SESSION

These are non-negotiable. Follow them before touching any file.

### Before Every Task
1. Is the task unambiguous? Is it trivial? (under 3 steps, single file, no architectural decisions)
2. If YES to both - proceed directly.
3. If NO to either - state your plan first and wait for confirmation before coding.

### Hard Rules
- Never delete or overwrite user data. Data must always migrate safely.
- Never push directly to main for new features. Create a branch first.
- Everything must be free or have a free tier. Flag anything that costs money.
- Every update gets a version number bump and a What's New entry inside the app.
- If a feature causes instability, remove it and ship clean. Add it back next update.
- Always test syntax balance after any code change before delivering.
- Do not start the next phase until confirmed complete and tested on a real phone.
- Single file structure is now split. Never merge files back together.

### Data Protection - CRITICAL
There are now real beta users on this app. Data lives in localStorage only.
There is no backend or backup system yet. If data is lost it cannot be recovered.

Before any update that touches data structures:
1. List every localStorage key that will be affected
2. Write a migration that carries old data forward to the new structure
3. Test the migration with existing data before touching anything else
4. Never rename, remove, or restructure a localStorage key without a migration
5. Never clear, reset, or overwrite localStorage except through the explicit user-facing Clear Data button
6. If unsure whether a change is safe for existing data, stop and ask first

---

## TIER 2: PROJECT CONTEXT

### About
A mobile cosmetics inventory management app deployed on GitHub Pages. Built for personal use by the project owner's girlfriend to manage a small cosmetics store. Long term goal is Google Play and App Store release, targeting Philippine boutiques and small resellers as a free alternative to BoxHero ($18 to $49/month). Currently has 3 real beta users. Data lives in localStorage only with no backend yet.

### Repo
https://github.com/jarretbandigan/cosmetics-inventory

### Tech Stack
- Frontend: Vanilla HTML, CSS, JavaScript. No frameworks.
- Barcode Scanning: ZXing pinned to v0.21.0
- Storage now: localStorage + CSV export and import
- Storage future: Supabase free tier
- Hosting: GitHub Pages
- Mobile Packaging future: Capacitor for Android and iOS

---

## TIER 3: FILE STRUCTURE

- index.html - HTML structure only, 990 lines
- css/style.css - all styling, 839 lines
- js/auth.js - login, logout, auto-logout timer, 149 lines
- js/scanner.js - ZXing barcode scanning, camera, 154 lines
- js/inventory.js - inventory list, render, search, filter, sort, stock controls, 612 lines
- js/sales.js - scan to sell, manual sale log, oversell, 350 lines
- js/reports.js - activity log, reports tab, inventory check, 616 lines
- js/data.js - CSV export, import, storage meter, migrations, saveAll, 434 lines
- js/app.js - app init, navigation, utilities, What's New, product form, 393 lines

Script load order: auth.js, scanner.js, inventory.js, sales.js, reports.js, data.js, app.js

---

## TIER 4: CURRENT APP STATE - v2.6.0

Default login: username admin, password amaya0827

What is working:
- Barcode scanning via phone camera (ZXing v0.21.0)
- Grouped inventory: Products and Stock Lines separate. One product, multiple stock lines by expiry date.
- Product fields: Record ID, Barcode, Name, Brand, Category, Description, Cost Price, Selling Price, Notes, Status
- Stock line fields: Expiry Date, Qty, Unit, Date Added, Storage Location, Batch Number, Markdown Price
- Dual status: Availability (Active, Out of Stock, Pulled Out) and Sales Status (None, On Sale)
- Scan to Sell: scan barcode, select stock line, confirm, deducts qty
- Manual Sale Log: pick product and stock line, enter qty and price, confirm
- Oversell warning with override option
- Price Markdown per stock line with auto-removal on zero stock
- Expiring Soon popup with 30, 90, 180 day filters
- Pull out per individual stock line with partial pull badge and restore
- Login with SHA-256 hashing and auto-logout after 30 minutes
- App Mode selector: Shop (Coming Soon) and Manage Business
- What's New modal on first open after update
- Version History under Data tab
- Activity Log with auto-logging and manual entries
- Reports tab with Sales and Activity Log
- Inventory Check with manual and scan mode, discrepancy summary, check history
- CSV export and import covers all data
- Data protection: undo on delete (6 seconds), storage meter, saveAll validates before writing
- Bottom nav: Scan, Inventory, Sales, Reports, Data

---

## TIER 5: DATA MODEL

Five localStorage keys:
- products - product records
- stockLines - stock entries per product
- sales - sale records
- activityLog - all app actions logged
- inventoryChecks - inventory check sessions

---

## TIER 6: ROADMAP

- Phase 1: Polish and Stabilize - COMPLETE
- Phase 2: Go Mobile-Ready - NEXT - layout fixes on real phone, no new features
- Phase 2.5: Backend and Database (Supabase) - PENDING
- Phase 3: Package as Mobile App (Capacitor) - PENDING
- Phase 3.5: PH Market Features - PENDING
- Phase 4: Test and Prepare for Launch - PENDING
- Phase 5: Launch to App Stores - PENDING
- Phase 6: AI Features (Claude API) - PENDING
- Phase 7: International Expansion - PENDING

### PH Market Features (Phase 3.5)
- GCash and Maya payment method field on sales log
- Low stock alerts with minimum qty per product
- Supplier tracking field per product
- Profit summary dashboard
- Bundle or package deal pricing
- Staff mode with limited access
- Manual Shopee and Lazada stock deduction

### AI Features (Phase 6)
- AI assistant using Claude API for plain language inventory queries
- Smart restock suggestions from sales patterns
- Sales insights in plain language
- Expiry management advice
- Auto-categorization on product add
- Goal: present to Connectt.io as portfolio piece

### International Expansion (Phase 7)
- Multi-currency support
- TikTok Shop integration
- Language toggle including Filipino
- Tax calculation per sale
- Shopee and Lazada API integration for real-time stock sync

---

## TIER 7: VERSION HISTORY

- v2.6.0 - QA cleanup, post-split audit, EXPIRY_WARNING_DAYS constant, dead code removed, auth improvements
- v2.6.0 - Login screen, SHA-256 auth, auto-logout 30 mins, pull out per stock line, partial pull badge
- v2.5.0 - Inventory Check, manual and scan mode, draft auto-save, discrepancy summary, check history
- v2.4.0 - Activity Log, auto-logging, manual entries, Reports tab, home stats
- v2.3.0 - Sales overhaul, Scan to Sell, Manual Sale Log, price markdown, dual status, oversell warning
- v2.2.0 - Foundation fixes, ZXing pinned, data protection, undo on delete, storage meter
- v2.1.0 - Grouped inventory, Cost Price, Selling Price, Notes, Sales Log, App Mode selector, What's New
- v2.0.0 - Major rebuild. Record IDs, Home page, status system, duplicate barcode flow, bottom nav
- v1.0.0 - Initial MVP. Barcode scanning, product form, CSV export and import

---

## NOTES
- Assistant Claude for this project is named Amaya
- Next version is v2.7.0
- App targets Philippine boutiques and small cosmetics resellers
- There are 3 real beta users. Treat data safety as the highest priority.
- Future Shop mode is a customer-facing store locator and product browser
- Present to Connectt.io as portfolio piece when AI features are built
