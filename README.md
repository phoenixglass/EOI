# Care Snapshot

Config-driven intake summary tool for small healthcare facilities. Walks staff
through a short form and produces a staff summary plus a plain-language
patient explanation.

## Develop

```bash
npm install
npm run dev          # opens http://localhost:5173
npm test             # vitest
npm run build        # type-check + production build
```

## Tenant configs

`/public/config/<tenant>.json` is loaded based on the `?tenant=` query string
(falls back to `default.json`). Two example configs ship in this repo:

- `default.json` — generic urgent care
- `bh-clinic.json` — behavioral-health clinic

Configs are validated with Zod (`src/config/schema.ts`); invalid configs render
an error screen listing the first issues. No PHI is persisted by default.
