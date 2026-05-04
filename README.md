# EVDS Diamond — Monorepo

| App | URL | Purpose |
|-----|-----|---------|
| Nexus | nexus.evdsdiamond.com | Customer portal |
| Dashboard | dashboard.evdsdiamond.com | Internal EVDS staff |
| API | api.evdsdiamond.com | Backend |

## Structure

```
evds/
├── apps/
│   ├── nexus/       Vite + React + TS  (port 5173)
│   ├── dashboard/   Vite + React + TS  (port 5174)
│   └── api/         Express + TS       (port 3000)
└── packages/
    └── shared/      Shared types, enums, validators
```

## Dev setup

```bash
# API
cd apps/api && cp ../../.env.example .env && npm install && npm run dev

# Nexus
cd apps/nexus && npm install && npm run dev

# Dashboard
cd apps/dashboard && npm install && npm run dev
```
