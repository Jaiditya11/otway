# Otway — 2-Week Build Plan

A day-by-day plan to build **Otway**, a macOS menu-bar app that tracks orders from
"ordered" to "in your hands," derived from [Otway-PRD.md](Otway-PRD.md).

**Pace:** ~10 working days (2 weeks), comfortable with buffer.
**Approach:** Ship a fully usable *manual* tracker by end of Week 1, then layer Gmail +
Gemini automation and packaging in Week 2 (per PRD guardrail #5 — live on the manual
version before automating).

---

## Tech stack

| Concern | Choice |
|---------|--------|
| Shell | Electron |
| UI | React + Vite |
| Menu bar | Electron `Tray` + popover window |
| Storage | Local JSON in `~/Library/Application Support/Otway/orders.json` |
| Email | Gmail API (OAuth, read-only, Purchases label) |
| Interpretation | Gemini 2.5 Flash-Lite, batched, only-on-new-mail |
| Packaging | electron-builder → `.dmg` |
| Version control | Public GitHub repo, commit per phase |
| Platform | macOS only (v1) |

---

## Milestones

- **End of Week 1 (Day 5):** A fully usable manual tracker living in the menu bar — add,
  edit, delete, advance orders; Active vs Picked-up tabs; polished glance UI. Use it daily.
- **End of Week 2 (Day 10):** Gmail auto-updates stages 1–3, Gemini interprets emails,
  background polling keeps it fresh, and it's packaged as an installable `.dmg`.

---

## Week 1 — Foundation & manual tracker

### Day 1 — Project setup + version control  *(PRD Phase 0)*
**Goal:** an empty Electron + React app that launches, under version control.

- [ ] Scaffold Electron + React + Vite project in the `otway` root.
- [ ] Get a blank window to open on `npm start`.
- [ ] Configure `electron-builder` early (so packaging isn't a surprise on Day 10).
- [ ] `git init`; add `.gitignore` for `node_modules/`, `dist/`, `*.dmg`, `.env`, token/cache files.
- [ ] Initial commit; create and push to a **new public GitHub repo**.
- [ ] Establish the habit: commit at the end of each phase below.

**Done when:** `npm start` opens a window and the repo is live on GitHub with secrets ignored.

### Day 2 — Menu bar presence  *(PRD Phase 1)*
**Goal:** Otway lives in the menu bar, not as a normal window.

- [ ] Add a `Tray` icon (template icon so it adapts to light/dark).
- [ ] Clicking the tray icon opens a small popover-style window positioned under the icon.
- [ ] Clicking away closes it.
- [ ] Hide the Dock icon (menu-bar-only app for v1).
- [ ] App quits cleanly from a menu item / right-click on the tray.

**Done when:** the icon sits in the top bar and toggles a panel.

### Day 3 — Data layer  *(PRD Phase 2a)*
**Goal:** solid local persistence and the forward-only status engine.

- [ ] Implement the `Order` model (PRD §4): `id, title, source, status, statusRank,
      orderNumber?, trackingNumber?, orderedDate, expectedDate?, lastUpdated, notes?, sourceEmailId?`.
- [ ] Read/write `orders.json` on disk (load on launch, save on every change).
- [ ] Implement forward-only `statusRank` logic (1–5): a signal applies only if its rank
      is higher than the order's current rank.
- [ ] Persist `lastProcessedEmailTimestamp` (used later in Week 2).

**Done when:** orders survive quit/reopen and status can only ever advance.

### Day 4 — Manual CRUD UI  *(PRD Phase 2b)*
**Goal:** manage orders entirely by hand.

- [ ] **Add order** form: title + source (minimum), optional expected date + notes.
- [ ] **Order list** grouped by status stage.
- [ ] **Advance status** button on each order (one stage forward, forward-only).
- [ ] **Edit** an order (rename, fix source, etc.).
- [ ] **Delete** an order.

**Done when:** you can create and move orders through all five stages by hand.

### Day 5 — Views + glance polish  *(PRD Phase 2c + Phase 3)* → **Week 1 milestone**
**Goal:** two views and a panel that's genuinely nice to glance at.

- [ ] **Active** tab (stages 1–4) and **Picked up** tab (stage 5).
- [ ] Compact, scannable layout — status groups with clear headers.
- [ ] Count badge (tray icon or in-panel): how many are waiting at the office ("2 to pick up").
- [ ] Empty states ("Nothing on the way — you're all caught up").
- [ ] Light/dark mode following macOS.
- [ ] Per-stage visual distinction (icon or color dot).
- [ ] **Manage data** control (in-panel section or tray right-click menu):
  - [ ] **Clear picked-up orders** — deletes only stage-5 orders (the archive that grows over time), keeping active orders.
  - [ ] **Reset all data** — wipes everything, behind a confirm dialog.
  - [ ] Both go through the Day 3 save path (rewrite/delete `orders.json`); ensure load treats a missing/empty file as an empty state, never a crash.

**Done when:** one glance tells you what's where, and a user can clear the archive or reset all data without leaving the app. **Ship to yourself and use it for a few days.**

---

## Week 2 — Automation & packaging

### Day 6 — Gmail OAuth  *(PRD Phase 4a)*
**Goal:** the app can authenticate with Gmail (read-only).

- [ ] Create a Google Cloud project + OAuth consent screen (Gmail API, **read-only** scope).
- [ ] Implement the OAuth flow inside Electron (open Google login, capture token).
- [ ] Store tokens securely via macOS Keychain / Electron `safeStorage` — **never in the repo.**

**Done when:** the app completes Google sign-in and holds a valid read-only token.

### Day 7 — Fetch Purchases email  *(PRD Phase 4b + spike)*
**Goal:** prove we can read the right mail, as clean plain text.

- [ ] **Spike first:** confirm the **Purchases** category/label is queryable via the Gmail
      API for your account, and that plain text can be extracted. Do this before building Phase 5.
- [ ] Fetch emails under the **Purchases** label only.
- [ ] Fetch **only** emails newer than `lastProcessedEmailTimestamp` (incremental).
- [ ] Extract each email's **plain-text** body (strip HTML).
- [ ] Log fetched emails to console to verify.

**Done when:** the app prints your recent order emails to the console.

### Day 8 — Gemini interpretation  *(PRD Phase 5a)*
**Goal:** turn each new email into structured data.

- [ ] Only call Gemini **if there are new emails** (skip entirely if the fetch returned nothing).
- [ ] Use **Gemini 2.5 Flash-Lite**; batch all new emails into **one** call where possible.
- [ ] Send plain text; request per-email JSON:
      `{ orderNumber, trackingNumber, productName, source, detectedStatus }`.
- [ ] Store the Gemini API key securely (Keychain/`safeStorage`, not hardcoded, not committed).

**Done when:** new emails come back as clean structured JSON.

### Day 9 — Matching + background refresh  *(PRD Phase 5b + Phase 6)*
**Goal:** emails automatically move the right orders; the app refreshes itself.

- [ ] **Match** result to an existing order: order number → tracking number → (fallback) source + recent time window.
- [ ] If matched: advance status (forward-only).
- [ ] If unmatched and status is "Ordered": **auto-create** a new order.
- [ ] Update `lastProcessedEmailTimestamp` after processing.
- [ ] Poll Gmail on a timer (every 10–15 min) while the app runs.
- [ ] Manual **"Refresh now"** button; show **"last checked"** time.
- [ ] Handle offline / auth-expired gracefully (re-connect prompt).

**Done when:** a new shipping email auto-moves the right order to "On the way" with a correct name, and the panel is up to date when you open it.

### Day 10 — Packaging to DMG + buffer  *(PRD Phase 7)*
**Goal:** a real, installable app.

- [ ] Configure `electron-builder` for a macOS `.dmg` target.
- [ ] App icon (`.icns`) + tray icon assets.
- [ ] Build the `.dmg`; decide signing (unsigned is fine for personal use — right-click → Open once).
- [ ] Test the `.dmg` on a clean spot (drag-to-Applications, launch, menu bar appears).
- [ ] Buffer for spillover; smoke-test against the Definition of Done below.

**Public-repo notes:**
- Repo visibility does **not** affect the `.dmg` build — it's produced locally.
- The `.dmg` is git-ignored, **not committed**. To share it, attach it to a GitHub Release.
- Verify **no secret is bundled** into the app: the Gemini key and OAuth tokens live in
  Keychain/`safeStorage` at runtime, never embedded at build time — so a public repo or
  release leaks nothing.

**Done when:** double-clicking the `.dmg` installs a working Otway.

---

## Risks & buffer

- **Gmail Purchases label** may not be queryable exactly as expected — de-risked by the Day 7 spike *before* building Phase 5.
- **OAuth-in-Electron** flow can be fiddly (redirect handling, token storage) — allotted a full day (Day 6).
- **Gemini prompt tuning** may need iteration to get reliable structured output — buffer on Day 9/10.
- **Unsigned-app Gatekeeper** friction on first launch — documented workaround (right-click → Open).
- Half-day of buffer is folded into Day 10 for any spillover.

---

## Guardrails (PRD §8)

1. **Forward-only status** — never move a status backward.
2. **Email is source of truth for stages 1–3; you are for 4–5.**
3. **Only call the paid API when there's genuinely new mail** — poll Gmail (free) first, gate Gemini behind "new emails exist."
4. **Strip emails to plain text** before sending anywhere.
5. **Ship the manual version (Week 1) and live on it** before building automation.
6. **Keep secrets out of the repo** — doubly important since the repo is public. Use Keychain/`safeStorage`; never commit `.env` or tokens.

---

## Definition of done (PRD §9)

- [ ] Otway sits in the menu bar and opens a panel on click.
- [ ] Orders auto-appear and auto-advance through stages 1–3 from Gmail.
- [ ] You can tap to move an order to "At office" and "With me."
- [ ] Picked-up orders live in their own section.
- [ ] Data survives quitting and reopening the app.
- [ ] It's installable from a `.dmg`.
- [ ] Running cost is effectively zero.
