# Inventory System

A mobile-first cosmetics inventory management app built for small boutique stores and resellers. Built as a single HTML file, runs in any phone browser, and is deployed on GitHub Pages for free.

Originally built for personal use. Long term goal is to release publicly on Google Play and the Apple App Store as a free alternative to expensive inventory software.

---

## Live App

[Open the app](https://jarretbandigan.github.io/inventory) <!-- Update this link to match your actual GitHub Pages URL -->

---

## What It Does

- Scan product barcodes using your phone camera
- Track inventory grouped by product, with multiple stock lines per product (different expiry dates, batches)
- Log sales and automatically deduct stock
- Monitor expiring items with 30, 90, and 180 day filters
- Run inventory checks with manual or scan mode
- View full activity log of everything that happened in your store
- Export and import all data as CSV for backup and multi-phone use

---

## Features

**Inventory Management**
- Barcode scanning via phone camera (ZXing v0.21.0)
- Products and Stock Lines are separate. One product can have multiple stock entries by expiry date.
- Product fields: Record ID, Barcode, Name, Brand, Category, Description, Cost Price, Selling Price, Notes, Status
- Stock line fields: Expiry Date, Qty, Unit, Date Added, Storage Location, Batch Number, Markdown Price
- Dual status system: Availability (Active, Out of Stock, Pulled Out) and Sales Status (None, On Sale)
- Pull out individual stock lines with partial pull distinction

**Sales**
- Scan to Sell mode: scan a barcode, pick which stock line to sell from, confirm
- Manual Sale Log: pick product and stock line, enter qty and price
- Automatic stock deduction on every sale
- Oversell warning with override option
- Price Markdown per stock line with auto-removal when stock hits zero

**Reporting**
- Activity Log with auto-logging for all app actions and manual entry support
- Reports tab showing Sales Log and Activity Log
- Inventory Check feature with manual count and scan mode
- Discrepancy summary with Continue, Flag, or Confirm options
- Check history stored and viewable

**Data and Backup**
- All data stored in browser localStorage
- Full CSV export and import covering products, stock lines, sales, activity log, and check history
- Storage usage meter with warnings
- Undo on delete with a 6 second window

**App**
- Login screen with username and password (SHA-256, placeholder until Supabase auth in a later phase)
- Auto-logout after 30 minutes of inactivity
- What's New modal on first open after each update
- Version History page
- App Mode selector on home: Manage Business (active) and Shop (coming soon)

---

## Tech Stack

| What | How |
|------|-----|
| Frontend | Vanilla HTML, CSS, JavaScript. No frameworks. |
| Barcode Scanning | ZXing library pinned to v0.21.0 |
| Storage | localStorage + CSV export and import |
| Hosting | GitHub Pages (free) |
| Future Backend | Supabase (planned for Phase 2.5) |
| Future Packaging | Capacitor for Android and iOS (planned for Phase 3) |

---

## How to Use

**Opening the app**
Open the GitHub Pages link on your phone browser. No installation needed.

**Default login**
- Username: `admin`
- Password: `amaya0827`

**Adding a product**
1. Tap the Scan tab
2. Point your camera at a barcode
3. Fill in the product details and tap Save

**Logging a sale**
1. Tap the Sales tab
2. Choose Scan to Sell or Manual Log
3. Select the product and stock line (by expiry date)
4. Enter qty and confirm

**Backing up your data**
1. Tap the Data tab
2. Tap Export CSV
3. Save the file to your phone or cloud storage

**Restoring data**
1. Tap the Data tab
2. Tap Import CSV
3. Pick your backup file

---

## Project Roadmap

| Phase | Name | Status |
|-------|------|--------|
| 1 | Polish and Stabilize | In Progress |
| 2 | Go Mobile-Ready | Pending |
| 2.5 | Backend and Database (Supabase) | Pending |
| 3 | Package as Mobile App (Capacitor) | Pending |
| 4 | Test and Prepare for Launch | Pending |
| 5 | Launch to Google Play and App Store | Pending |

See `CHANGELOG.md` for the full version history.

---

## Version

Current version: **v2.6.0**

See [CHANGELOG.md](./CHANGELOG.md) for what changed in each version.

---

## Notes

- This app is designed for Philippine boutiques and small cosmetics resellers
- The login system is a soft gate for now. Real authentication comes in Phase 2.5 with Supabase.
- Data lives in the browser. If the browser cache is cleared without a CSV backup, data is lost. Always export regularly.
- The Shop mode on the home screen is a placeholder for a future customer-facing feature.
