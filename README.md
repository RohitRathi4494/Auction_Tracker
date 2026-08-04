# SARDA Corporate Cricket League — Auction Dashboard

A full-featured auction dashboard for SCCL Season 6, built with **Next.js + Firebase (free tier)**.

---

## Quick Start — 4 Steps

### Step 1 — Create a Free Firebase Project

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Click **Add project** → name it (e.g. `sccl-auction`) → Disable Google Analytics → Create
3. In the left sidebar:
   - **Firestore Database** → Create database → Start in **test mode** → Choose your region → Enable
   - *(Test mode lets all reads/writes work without auth rules — fine for an internal app)*

### Step 2 — Get Your Firebase Keys

**Client keys (for the browser):**
1. Click the gear icon → **Project settings**
2. Scroll to "Your apps" → **Web app** (click `</>`) → Register app
3. Copy the `firebaseConfig` object values into `.env.local`

**Admin keys (for the server-side API routes):**
1. In Project settings → **Service accounts** tab
2. Click **Generate new private key** → Download the JSON file
3. Copy values from the JSON into `.env.local`:
   - `project_id` → `FIREBASE_ADMIN_PROJECT_ID`
   - `client_email` → `FIREBASE_ADMIN_CLIENT_EMAIL`
   - `private_key` → `FIREBASE_ADMIN_PRIVATE_KEY` (paste with the `\n` newlines intact)

### Step 3 — Set Up Your .env.local

```bash
# Copy the template
copy .env.local.example .env.local
# Then fill in the values from Steps 1 & 2
```

Also set `ADMIN_PASSWORD` to whatever password you want for the auction console.

### Step 4 — Run the App

```bash
npm run dev
# Open http://localhost:3000
```

---

## First Use — Import Your Data

1. Open [http://localhost:3000/admin/import](http://localhost:3000/admin/import)
2. Upload **sarda.xlsx** as the Players file
3. Upload **SSCL 6 Registrations - 4th Aug 1800 hrs.xlsx** as the Teams file
4. Click **Start Import**
5. Done — 615 players and 24 teams will be seeded into Firestore!

---

## Screens

| URL | Screen | Access |
|---|---|---|
| `/directory` | Player Directory | Public |
| `/auction` | Auction Console | Admin (password) |
| `/teams/[teamId]` | Live Team View | Anyone with link |
| `/admin/import` | Import Data | Admin |
| `/api/export` | Download Excel | Admin |

### Getting Team Links for Owners

Each team's live view URL is:
```
https://your-domain/teams/[team-name-slug]
```

The team ID is derived from the team name (lowercase, spaces replaced with `_`). For example:
- ACCI → `/teams/acci`
- Bengal Tigers → `/teams/bengal_tigers`
- Goa Monks → `/teams/goa_monks`
- Gurugram Spartans → `/teams/gurugram_spartans`
- Jaipur Royals → `/teams/jaipur_royals`
- Japani Tsunami → `/teams/japani_tsunami`
- Punjab Royals → `/teams/punjab_royals`
- UP Warriors → `/teams/up_warriors`
- Bharat Hunters → `/teams/bharat_hunters`
- Chennai Thalaivas → `/teams/chennai_thalaivas`
- Delhi Knights → `/teams/delhi_knights`
- NCR Turbo Chargers → `/teams/ncr_turbo_chargers`
- Patna Panthers → `/teams/patna_panthers`
- Uttarakhand Yoddhas → `/teams/uttarakhand_yoddhas`
- Chandigarh Lions → `/teams/chandigarh_lions`
- Haryana Titans → `/teams/haryana_titans`
- Mumbai Titans → `/teams/mumbai_titans`
- Srinagar Sultans → `/teams/srinagar_sultans`

---

## Auction Rules (Auto-Enforced)

| Rule | Detail |
|---|---|
| Base price | Category A = ₹15,000 · Category B = ₹5,000 |
| Max bid | ₹50,000 per player (tie-breaker can go to ₹1L) |
| Bid increment | Cat A = ₹5,000 · Cat B & Legends = ₹2,000 |
| Squad size | Min 16, max 20 players |
| Age 30–35 cap | Max 3 per squad (hard block at 4th) |
| Category A cap | Warn at 6 (soft, for Playing 13 planning) |
| Tie-breaker | Sealed tender ₹50K–₹1L |

---

## Setting Purse Amounts

After import, go to the Auction Console → each team card shows current purse (default ₹2,00,000). To update:

```
POST /api/auction/action
{ "action": "update_purse", "teamId": "team_id_here", "purse": 250000 }
```

Or we can add a UI for this — just ask!

---

## Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Add env vars in Vercel dashboard → Settings → Environment Variables
# Paste all values from .env.local
```

---

## When You Have the Legends/Owners/Retained List

Upload the new Excel using the import page — it will merge (upsert) without deleting existing data.

To mark individual players as legend/owner/retained, the admin can call:
```
POST /api/auction/action
{ "action": "update_flags", "playerId": "...", "flags": { "isLegend": true } }
```

A UI for this is on the roadmap.
