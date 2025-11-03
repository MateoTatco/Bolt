## Tatco Construction CRM

Modern CRM for Tatco Construction with real‑time data, attachments, activities, and a polished UX built on React, Tailwind and Firebase.

## Tech Stack

- React (Vite) + React Router
- Tailwind CSS
- Zustand
- Firebase (Auth, Firestore, Storage)
- Axios

## Recent Highlights (What’s shipped)

- Attachments (Leads & Clients)
  - Grid/List views, multi-file upload (≤ 50MB), drag & drop
  - Firebase Storage for files, Firestore for metadata
  - Secure downloads, folder ZIP download, rename, delete
  - Nested folders (up to 5 levels) with breadcrumb modal
  - Real‑time listeners; list view crash fixed (timestamp formatting)
- Activities Timeline
  - Entity-scoped timeline using `Timeline` UI
  - Grouped by day, first-of-day without connector
  - Rich messages with metadata (diffs for updates)
- Tasks & Sections
  - Removed task drag-and-drop (kept for sections)
  - Section deletion with recursive Firestore cleanup
- Data & Lists
  - Bulk delete now works for clients (not only leads)
  - Clicking “Company Name” or “Client Name” opens Settings tab
  - Settings headers show compact context (lead: company/contact/email; client: name)
  - Save/Cancel alerts fixed: success only on save; cancel banner only on cancel
- Auth & Identity
  - “Anonymous/Unknown User” display fixed; resilient actor names in Activities
  - Anonymous sign‑in gated behind `VITE_ENABLE_ANON_SIGNIN`

## Setup

### 1) Install

```bash
npm install
npm run dev
```

### 2) Environment variables (.env)

Required Firebase vars (Vercel/Local):

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=tatco-crm
VITE_FIREBASE_STORAGE_BUCKET=tATco-crm.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_ENABLE_ANON_SIGNIN=false
```

Notes:
- `storageBucket` must use the `.firebasestorage.app` domain (not `.appspot.com`).
- Firestore uses long‑polling to avoid QUIC issues (configured in `src/configs/firebase.config.js`).
- Ensure Firebase Auth “Authorized domains” include your deployment (e.g., `mybolt.pro`).
- Configure GCS CORS for Storage to allow your origins.

## Firebase Configuration Tips

- Firestore rules: allow authenticated access to leads/clients and their subcollections as needed.
- Storage rules: allow authenticated writes to `leads/**` and `clients/**`, limit file size ≤ 50MB.
- CORS: set allowed origins (localhost and production), methods (GET, POST, PUT, OPTIONS), and headers.

## Scripts

- `npm run dev` – Start dev server
- `npm run build` – Production build
- `npm run preview` – Preview production build

## Project Structure (high level)

```
src/
  auth/           # Auth context/hooks
  components/     # UI, shared, templates, feature modules
  configs/        # App, firebase, routes
  services/       # Firebase/HTTP services
  store/          # Zustand stores
  views/          # Pages (Home, LeadDetail, ClientDetail, etc.)
```

## Feature Details

### Attachments
- Real‑time folders/files, grid/list view, upload dialog with progress
- Rename, delete (folders recursive), secure download, ZIP for folders
- Anonymous uploads prevented on production unless enabled by env flag

### Activities
- Writes to `{entity}/:id/activities` with `actor`, `type`, `message`, `metadata`, `createdAt`
- Actor derived from `userName → displayName → email username → 'User'`

### Lists & Bulk Actions
- Bulk delete supports leads and clients
- Name click navigates to `?tab=settings`

### Settings UX
- Headers show compact read‑only context next to “Settings”
- Alerts: success banner on save; discard banner only on cancel

## Current Data Model (simplified)

Leads
- companyName, leadContact, tatcoContact, title, email, phone
- methodOfContact, projectMarket, status, responded
- notes, favorite, clientIds[], createdAt, updatedAt

Clients
- clientName, clientType, address, city, state, zip, tags
- notes, favorite, leadIds[], createdAt, updatedAt

Attachments (per entity)
- folders: id, name, path, parentId, depth, createdAt, updatedAt
- files: id, name, type, size, path, storagePath, url (token), createdAt, updatedAt

Activities (per entity)
- type, message, metadata, actor, createdAt

## Roadmap (This week)

Build “Master Tracker” with the following columns:

ProjectNumber, address, city, CompletionDate, CreatedAt, EstimatedValue, ProjectName, StartDate, State, EstimatedCostAtCompletion, ClientReferenceId, ProjectRevisedContractAmount, Notes, ProjectProbability, ProjectManager, CommunicatedStartDate, CommunicatedFinishDate, ProjectedFinishDate, EstStart, EstFinish, EstDuration, ActualFinishDate, ActualDuration, SuperId, Superintendent, BidDueDate, ProjectReviewDate, ProjectConceptionYear, BidType, Market, ProjectStatus, ProjectStyle, EstimatedProjectProfit, ProfitCenterYear, SquareFeet, Archived, zip

Implementation plan:
- Data model + Firestore collections/indexes
- List view with filters/sorts, import/export
- Detail view with activities logging
- Permissions and archival workflow

## License

Proprietary software for Tatco Construction. All rights reserved.