# Stacked — the wallet-stack of covers

**Live app: https://stacked-rose.vercel.app** (open it on your phone and install it from the You tab).

For people in India covered by more than one health policy. Tell it every policy you're on and a real or likely hospital stay, and it says which policy to claim from first, what each one pays and deducts, what you pay, and how reliable each insurer's claim record is.

Data and rules: [docs/india-health-insurance-market-2026.md](docs/india-health-insurance-market-2026.md). Every place the spec was silent: [DECISIONS.md](DECISIONS.md).

## Run it

Requires Node 20+ (built on Node 24, npm 10).

```sh
npm install
npm run dev          # http://localhost:3000
```

No database is needed. Reference data comes from `@stacked/seed-data` unless `DATABASE_URL` is set; your policies stay in your browser.

### With Postgres (Supabase)

The live app reads from Supabase, where everything sits in its own `stacked` schema so it never touches other tables in the same database.

```sh
cp apps/web/.env.example apps/web/.env        # set DATABASE_URL (pooler, 6543) and DIRECT_URL (5432)
npx prisma migrate deploy --schema apps/web/prisma/schema.prisma   # creates the tables; never resets
npm run db:seed -w @stacked/web               # Table A, B1/B2, C + the sample user and policies
```

If the database can't be reached, the app falls back to the same rows built in.

## Use it

0. **Just looking?** Press *Try with sample policies* on the first screen. It loads four sample policies and opens their claim plan.
1. **Add your policies** (Vault → *Add a policy*). Start with your employer cover; it's usually the one to claim from.
   - *Employer group policy*: answer the five questions on your HR e-card (insurer, sum insured, room limit, co-pay, maternity, pre-existing diseases from day 1).
   - *Pick a product*: search the list (for example "Care Supreme" or "Arogya Sanjeevani"), enter your sum insured, members and start date, then check the terms filled from product data.
   - *Enter every term*: for anything not in the list.
   Tap a card to see every term in plain language. "Not known" means the data didn't say; edit the policy and tick *I've checked every term* once it matches your schedule.
2. **Simulate a claim** (Simulate). Choose who is admitted, the kind of admission, the city, the room rate and the expected bill (a total is fine; it's split the usual way). Then press *Show claim order*.
3. **Read the claim plan.** The headline says which policy to claim first. The bar shows who pays what, each policy's ledger shows every deduction, and the meters show how reliable each insurer's claim record is. *Why this order* explains the choice. Change the room rate to see how a room cap moves the plan.
4. **Save it and get the checklist.** *Save claim plan* keeps it under You. *Show claim-day checklist* gives the steps in order (pre-auth, 1-hour decision, 3-hour discharge, second-insurer filing), which you can print.
5. **Compare insurers** (Insurers). Settlement record, complaints and claim ratio for 31 insurers, each with its period and source.

## Install it as an app

Stacked is an installable web app (PWA). It gets its own icon, opens full screen and works offline after the first visit. Your data stays on the device.

| Device | How |
|---|---|
| Android (Chrome) | Open the app → You → *Install the app*, or Chrome menu → *Install app*. |
| iPhone / iPad (Safari) | Share → *Add to Home Screen*. |
| Windows / Mac (Chrome, Edge) | The install icon in the address bar, or You → *Install the app*. |

Installing needs a secure address: the live https link above, or `http://localhost` on the same computer. On your Wi-Fi, `npm run build && npm run start:lan` serves `http://<this-PC's-IP>:3000`, but phones only offer *Install* over https.

## Deployment

Vercel project `stacked` (root directory `apps/web`, framework Next.js), linked to this repo. Every push to `main` deploys to production, and other branches get preview URLs. No environment variables are needed; set `DATABASE_URL` in Vercel to serve reference data from Postgres.

To test a deployment with the e2e suite: `BASE_URL=https://stacked-rose.vercel.app npm run e2e`.

## Check it

```sh
npm test                 # engine (93), seed data (18), web helpers (9)
npm run coverage         # engine at 100% statements/branches/functions/lines
npm run typecheck
npm run lint
npm run build
npx playwright install chromium   # once
npm run e2e              # core flow, screens, axe, offline/install — at 360px and 1280px
```

## Layout

| Path | What |
|---|---|
| `design/tokens.css`, `design/components.md` | Design tokens and the component list. `/design` in the app shows every component in every state. |
| `packages/claim-engine` | `allocateClaim(policies, scenario, insurers, weights?)`. Pure TypeScript and Zod, no framework. TC1–TC8 are in `test/section8.test.ts`. |
| `packages/seed-data` | `scripts/extract.ts` parses Table A (CSV), B1, B2, the name-only list and Table C from the research doc into `data/*.json`. `presetFromProduct` turns a product into a Policy. |
| `apps/web` | Next.js 15 app: Vault, Add a policy, Simulate, Claim plan and checklist, Insurers, You. Prisma schema and seed are in `prisma/`; Playwright specs are in `e2e/`. |

Regenerate seed data after editing the research doc with `npm run seed:extract`. A test fails if the JSON and the doc disagree.

Not insurance advice. Figures are insurer-level from IRDAI disclosures (FY24–26). Your policy wording overrides this app.
