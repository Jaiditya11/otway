# Otway — Product Requirements Document

**A macOS menu-bar app that tracks your orders from "ordered" to "in your hands."**

Version 1.0 · Platform: macOS · Framework: Electron · Deliverable: signed/unsigned `.dmg`

---

## 1. Overview

### 1.1 The problem
You order things from many different places (Amazon, local stores, etc.) and lose track of what's been ordered, what's on the way, what's been delivered to your building, and what you've actually picked up. There's no single place that answers *"where is all my stuff right now?"*

### 1.2 The solution
**Otway** lives in your macOS menu bar. Click the icon and a small panel drops down showing every order grouped by its current stage. Most status changes happen automatically by reading your Gmail "Purchases" label; the only manual step is the final tap when you physically pick a package up from your building office.

### 1.3 Why the name
"Otway" = **OTW** (on the way) — the exact state you keep losing track of.

### 1.4 Scope for v1
- **In scope:** macOS only, Electron app, menu-bar UI, manual order management, Gmail-based auto-updates, local storage, `.dmg` output.
- **Out of scope (later):** Windows/Linux, iOS/Android, multi-account, cloud sync, courier API integrations, notifications beyond basic.

---

## 2. Goals & non-goals

### Goals
1. Answer "where is everything?" in one glance from the menu bar.
2. Require near-zero manual data entry — email drives the pipeline.
3. Cleanly separate active orders from a "picked up / done" archive.
4. Ship as a double-clickable `.dmg`.

### Non-goals
- Not a shopping app, not a budgeting app, not a universal package tracker for other people.
- Not trying to support every email provider in v1 — Gmail first.

---

## 3. Core concepts

### 3.1 The status pipeline
Every order moves forward through these stages. Status can only ever advance, never move backward.

| Rank | Status | Set by | Meaning |
|------|--------|--------|---------|
| 1 | **Ordered** | Email (auto) | Confirmation received |
| 2 | **On the way** | Email (auto) | Shipped / out for delivery |
| 3 | **Delivered** | Email (auto) | Delivered to building |
| 4 | **At office** | Manual | Sitting at building office, not yet collected |
| 5 | **With me** | Manual | You physically have it |

- Stages **1–3 are automated** from Gmail.
- Stages **4–5 are manual taps** (no email exists for physical pickup).
- **Forward-only rule:** a new signal only applies if its rank is higher than the order's current rank. This single rule neutralizes duplicate emails, out-of-order emails, and promo noise.

### 3.2 The two views
- **Active** — orders in stages 1–4 (anything not yet with you).
- **Picked up** — orders in stage 5 (archive of completed orders).

---

## 4. Data model

A single `Order` object, stored locally as JSON on disk.

```
Order {
  id: string              // internal unique id
  title: string           // product name (from email or manual)
  source: string          // retailer / sender ("Amazon")
  status: enum            // Ordered | OnTheWay | Delivered | AtOffice | WithMe
  statusRank: number      // 1–5, for forward-only logic
  orderNumber: string?    // extracted from email, used for matching
  trackingNumber: string? // extracted from email, used for matching
  orderedDate: date
  expectedDate: date?     // optional
  lastUpdated: date
  notes: string?
  sourceEmailId: string?  // Gmail message id that last updated it
}
```

Storage file example: `~/Library/Application Support/Otway/orders.json`
Also stored: `lastProcessedEmailTimestamp` (or last message id) so we only fetch new mail.

---

## 5. Feature breakdown — build order

This is the recommended sequence. Each phase is shippable on its own; don't start a phase until the previous one works.

---

### PHASE 0 — Project setup
**Goal:** an empty Electron app that launches.

- [ ] Initialize project in root directory `Otway`.
- [ ] Install Electron + React (or plain HTML/JS if you prefer lighter).
- [ ] Get a blank window to open on `npm start`.
- [ ] Set up the build tooling (`electron-builder`) early so packaging isn't a surprise later.

**Done when:** `npm start` opens a window.

---

### PHASE 1 — Menu bar presence
**Goal:** Otway lives in the menu bar, not as a normal window.

- [ ] Add a `Tray` icon in the macOS menu bar (template icon so it adapts to light/dark).
- [ ] Clicking the tray icon opens a small popover-style window positioned under the icon.
- [ ] Clicking away closes it.
- [ ] Hide the Dock icon (menu-bar-only app) — decide: menu-bar-only, or menu-bar + optional main window. **Recommendation: menu-bar-only for v1.**
- [ ] App quits cleanly from a menu item or right-click on the tray.

**Done when:** icon sits in the top bar and toggles a panel.

---

### PHASE 2 — Local data + manual orders (no email yet)
**Goal:** a fully working manual tracker. This is your foundation — get it solid before touching Gmail.

- [ ] Read/write `orders.json` on disk (load on launch, save on every change).
- [ ] **Add order** form: title + source (minimum), optional expected date + notes.
- [ ] **Order list** grouped by status stage.
- [ ] **Advance status** button on each order (moves it one stage forward, respects forward-only rule).
- [ ] **Edit** an order (rename, fix source, etc.).
- [ ] **Delete** an order.
- [ ] **Two tabs/sections:** "Active" (stages 1–4) and "Picked up" (stage 5).

**Done when:** you can run your whole life through it by hand. Ship this to yourself and use it for a few days.

---

### PHASE 3 — UI polish for the glance experience
**Goal:** make it genuinely nice to look at in a tiny panel.

- [ ] Compact, scannable layout — status groups with clear headers.
- [ ] A **count badge** on the tray icon or in-panel: how many items are waiting at the office ("2 to pick up").
- [ ] Empty states ("Nothing on the way — you're all caught up").
- [ ] Light/dark mode following macOS.
- [ ] Subtle visual distinction per stage (icon or color dot).

**Done when:** one glance tells you what's where without reading carefully.

---

### PHASE 4 — Gmail connection (read-only)
**Goal:** the app can fetch your Purchases emails. No interpretation yet — just prove you can read mail.

- [ ] Set up a Google Cloud project + OAuth consent screen (Gmail API, read-only scope).
- [ ] Implement OAuth flow inside Electron (open Google login, capture token, store securely).
- [ ] Fetch emails under the **Purchases** category/label only.
- [ ] Fetch **only emails newer than** `lastProcessedEmailTimestamp` (incremental, not full inbox).
- [ ] Extract each email's **plain-text** body (strip HTML to keep it clean and small).
- [ ] Log fetched emails to console to verify.

**Caution to verify during build:** confirm the Purchases category is queryable via the Gmail API for your account, and that you can pull plain text. Do this spike before building Phase 5 on top of it.

**Done when:** app prints your recent order emails to the console.

---

### PHASE 5 — Email interpretation (Gemini)
**Goal:** turn each new email into {product name, status, order number} and update the pipeline.

- [ ] Only call Gemini **if there are new emails** (skip entirely if the fetch returned nothing).
- [ ] Use **Gemini 2.5 Flash-Lite** (cheapest tier, ideal for classification/extraction).
- [ ] Batch all new emails into **one** call where possible.
- [ ] Send plain-text email(s); ask for structured JSON back per email:
  `{ orderNumber, trackingNumber, productName, source, detectedStatus }`
- [ ] **Match** the result to an existing order by order number → tracking number → (fallback) source + recent time window.
- [ ] If matched: advance status (forward-only).
- [ ] If unmatched and status is "Ordered": **auto-create** a new order.
- [ ] Store the Gemini API key securely (not hardcoded in the repo).
- [ ] Update `lastProcessedEmailTimestamp` after processing.

**Cost note:** at ~10 order emails/day this runs at roughly ten cents a month or less, and likely fits Gemini's free tier. Always strip to plain text — full HTML can inflate token cost 5–10×.

**Done when:** a new shipping email automatically moves the right order to "On the way" with a correct product name.

---

### PHASE 6 — Polling / background refresh
**Goal:** it updates itself without you asking.

- [ ] Poll Gmail on a timer (e.g. every 10–15 min) while the app runs.
- [ ] Manual **"Refresh now"** button in the panel.
- [ ] Show "last checked" time.
- [ ] Handle offline / auth-expired gracefully (show a re-connect prompt).

**Done when:** you open the panel and things are already up to date.

---

### PHASE 7 — Packaging to DMG
**Goal:** a real, installable app.

- [ ] Configure `electron-builder` for a macOS `.dmg` target.
- [ ] App icon (`.icns`) + tray icon assets.
- [ ] Build the `.dmg`.
- [ ] Decide on signing:
  - **Unsigned** (fine for personal use — you'll right-click → Open to bypass Gatekeeper once).
  - **Signed/notarized** (needs an Apple Developer account, $99/yr — only if you want to share it cleanly).
- [ ] Test the `.dmg` on a clean spot (drag-to-Applications, launch, menu bar appears).

**Done when:** double-clicking the `.dmg` installs a working Otway.

---

## 6. Nice-to-haves (post-v1 backlog)
- Native macOS notifications ("Package delivered — waiting at office").
- Expected-delivery reminders.
- Search / filter across orders.
- Support other email providers via IMAP.
- Rules-based fallback so it works even without Gemini.
- Manual "quick add from clipboard" (paste an order confirmation).
- Optional main window (bigger view) alongside the menu bar.

---

## 7. Technical stack summary

| Concern | Choice |
|---------|--------|
| Shell | Electron |
| UI | React (or plain HTML/JS) |
| Menu bar | Electron `Tray` + popover window |
| Storage | Local JSON file in App Support dir |
| Email | Gmail API (OAuth, read-only, Purchases label) |
| Interpretation | Gemini 2.5 Flash-Lite, batched, only-on-new-mail |
| Packaging | electron-builder → `.dmg` |
| Platform | macOS only (v1) |

---

## 8. Key design principles (guardrails while building)
1. **Forward-only status** — never let anything move a status backward. This one rule prevents most messiness.
2. **Email is source of truth for stages 1–3; you are for 4–5.**
3. **Only call the paid API when there's genuinely new mail.** Poll Gmail (free) first, gate Gemini behind "new emails exist."
4. **Strip emails to plain text** before sending anywhere.
5. **Ship Phase 2 (manual) and live on it** before building automation — don't do both at once.
6. **Keep secrets (Gemini key, OAuth tokens) out of the repo.**

---

## 9. Success criteria for v1
- [ ] Otway sits in the menu bar and opens a panel on click.
- [ ] Orders auto-appear and auto-advance through stages 1–3 from Gmail.
- [ ] You can tap to move an order to "At office" and "With me."
- [ ] Picked-up orders live in their own section.
- [ ] Data survives quitting and reopening the app.
- [ ] It's installable from a `.dmg`.
- [ ] Running cost is effectively zero.
