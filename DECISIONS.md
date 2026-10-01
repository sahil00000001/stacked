# Decisions

Every place where the spec (BUILD_PROMPT.md and docs/india-health-insurance-market-2026.md) was silent, ambiguous or couldn't be followed as written, with the choice made. Newest sections are at the bottom of each group.

## Process and repo

| # | Spec gap | Decision |
|---|---|---|
| P1 | The kickoff refers to `docs/india-health-insurance-market-2026.md`, but the file was at the repo root. | Moved it to `docs/`. No content changes. |
| P2 | The repo was not a git repository. | `git init`. Nothing committed; commits happen only when you ask. |
| P3 | pnpm is not installed on this machine. | npm workspaces (`packages/*`, `apps/*`). |
| P4 | Tokens and components were to be approved before UI code. | Wrote `/design/tokens.css` and `/design/components.md` and stopped before UI. The engine (no UI) was built while waiting. On 2026-10-01 you said "continue … and complete my product", which I took as approval. |
| P5 | Postgres + Prisma + NextAuth are the specified backend, but this machine has no running Postgres (a leftover `C:\Program Files\PostgreSQL\18` folder holds no binaries) and no Docker. | The Prisma schema (PostgreSQL) and seed script are written and validated with `prisma validate`. Reference data is served from Postgres when `DATABASE_URL` is set, otherwise from the generated seed JSON. User data (policies, saved plans) lives on the device in a persisted Zustand store for Phase 1. See W1–W3. |

## Design tokens and components

| # | Spec gap | Decision |
|---|---|---|
| D1 | `--edge` on `--graphite` is 1.36:1, below WCAG 1.4.11's 3:1 for input boundaries. | Inputs keep the 1px `--edge` outline and add a 1px `--ash` underline (`--field-rule`, 6.47:1). Buttons are identified by their label text, so the plinth border is not required to meet 3:1. |
| D2 | A spacing scale, radii for chips, z-index layers and the grain recipe were not given. | 4px spacing base; chips 2px radius like buttons; grain is an inline SVG `feTurbulence` at 5% opacity; layers are tab bar 10, sheet 20, toast 30. |
| D3 | Section 4.4 says "nothing else needs a custom component", but 4.1 needs a bottom tab bar and 4.6 needs a source line and footer on every metric and result. | Four app-shell primitives (TabBar, SourceNote, Disclaimer, Money), listed in components.md so nothing else is invented. |
| D4 | Confidence levels and labels were not defined. | Five levels from the engine value: Very high ≥ 0.90, High ≥ 0.80, Moderate ≥ 0.70, Low ≥ 0.60, else Very low; plus "Insufficient history". |
| D5 | ICR plain-language readings were given only by example. | Over 100%: premium-hike risk. 85–100%: watch renewals. 55–85% (Ditto's healthy band): healthy. Under 55%: may be strict on claims. |
| D6 | Under reduced motion, should the vault tilt go? | Tilt stays because it is static, not motion. Only durations go to 0, and press feedback becomes a colour change. |

## Data model (Zod schemas mirror §6.1; all extensions optional)

| # | Spec gap | Decision |
|---|---|---|
| M1 | Permanent exclusions are in the eligibility rule but not in the `Policy` schema. | `permanent_exclusions: ScenarioCategory[]`. |
| M2 | "Specific-disease wait" needs to know whether the admission is for a listed condition. | `ClaimScenario.is_specific_disease`, which defaults to true for S1 (joints and cataract, Table C rates it 3) and false otherwise. |
| M3 | Sub-limits have a `procedure` string but the scenario has no procedure. | `ClaimScenario.procedure`. A sub-limit applies when its `procedure` equals the scenario's procedure or its category id (for example "S4"), case-insensitive. |
| M4 | Arogya Sanjeevani is "2% of SI, max ₹5,000/day"; `room_rent` has only one value. | `room_rent.max_per_day` and `icu_max_per_day`. |
| M5 | ICU caps need an ICU rate. | `ClaimScenario.icu_rate_per_day`. Without it the ICU cap is skipped with a warning. |
| M6 | The `age_at_entry` co-pay has no threshold, and `zone` has no policy zone. | Copay entries get `age_threshold` (default 61, the most common in Table B1) and `zone`. Without a zone, the policy is assumed priced for tier 2, so only a metro hospital triggers it. |
| M7 | The super top-up aggregate deductible may be partly used by earlier claims in the year. | `Policy.deductible_met_this_year`. |
| M8 | The claimant is a string but members have only name and dob. | `members[].member_id`. The claimant matches by id, then by name (case-insensitive). An empty member list is treated as "not entered yet" and covers the claimant. |
| M9 | Sentences need a policy name, which the schema doesn't have. | `Policy.label`. Without one, the name comes from the relationship ("employer policy", "own policy", "parents' floater") or the type ("super top-up"). Duplicates get the insurer appended. |
| M10 | Nursing appears in TC1 but is not a `bill_items.head`. | `head: "other"` with `room_linked: true` and the new optional `label: "Nursing"`. |
| M11 | `Deduction` is `{reason, amount}` only. | Adds `code` and `params` so the UI can re-render a reason in another language. `reason` stays as the English text. |
| M12 | Planned or emergency, C-section, length of stay and fixed-benefit events are needed but missing. | `admission_type`, `delivery_type`, `length_of_stay_days` and `fixed_benefit_events` on `ClaimScenario`; `fixed_benefits[].per_day` for hospital cash. |
| M13 | `Product.product_type` "enum" was not listed. | Reuses the `Policy.policy_type` enum. |
| M14 | Table A has no repudiation ratio. | `InsurerMetrics.repudiation_ratio` is optional and not seeded. Only two insurers have one, both FY24 from IBAI, a different period and source from the FY24–26 NL-37 figures. Mixing them would break the "every figure shows its period" rule, so the engine uses 1 − CSR as the spec allows. |

## Engine (packages/claim-engine)

| # | Spec gap | Decision |
|---|---|---|
| E1 | Order of reductions. | Per item (room proportionate, ICU cap, consumables, pre/post) → sub-limit or maternity cap → co-pay → deductible → available SI. TC1 confirms co-pay comes after the room cut and consumables. |
| E2 | `min(available_SI, …) − deductible` read literally under-pays a super top-up when the bill is over SI + deductible. | `min(available_SI, max(0, admissible − remaining_deductible))`. TC5 gives the same ₹4L either way. |
| E3 | How a later policy re-assesses the balance. | Item by item: the later policy pays `min(still unpaid, what its own terms would admit on that item)`, then applies its own sub-limit, co-pay, deductible and SI. A later policy that doesn't cover consumables never pays the consumables the first one left. |
| E4 | Super top-up deductible in a cascade. | The deductible is met by the year's admissible spend, whoever paid it (§5.1 rule 6). Liability is the policy's own sole-basis admissible amount minus the remaining deductible. Top-ups and super top-ups are claimed after all base policies. |
| E5 | **Ranking by plan.** A greedy rank by stand-alone `payout × conf` would put the ₹10L own policy ahead of the ₹5L group policy in TC3, spending your own cover when the group cover would have absorbed it. | Every cascade order of the eligible base policies is simulated (exhaustively up to 7, greedy above that), with top-ups after them. Each plan is valued at `Σ(payout × conf) − λ·Σcost`. Plans within **3% of the best value** (`tie_tolerance`) count as equal. Without that, a 0.35% confidence edge (ICICI Lombard 0.823 vs Niva Bupa 0.826) flipped the employer-first order, against the doc's point that terms matter more than a few points of settlement ratio; HDFC ERGO vs Star (16%) still decides the order, as in TC8. Equal plans are broken by (1) more rupees paid, (2) default order: employer → own → spouse → other → parents' floater → top-up → super top-up, (3) fewer claims, (4) higher value, (5) the order the policies were added. Each tie-break that decided the result adds its own "why" sentence. `tie_tolerance: 0` ranks purely by score. |
| E6 | "CSR/complaints terms scaled by csr_weight". | `w_csr` and `w_complaints` are multiplied by the Table C `csr_weight`, then all four weights are renormalised so confidence stays in 0–1. |
| E7 | Normalising complaints per 10k. | `min(1, complaints_3yr / 100)`. A cap of 100 keeps Navi's 220 from squashing everyone else to near zero. Missing 3-year average → FY26 figure → industry mean 29.35. |
| E8 | Cashless availability when the network is unknown. | 0.5 in the confidence formula, and a warning. Primary mode is cashless unless the hospital is known to be out of network. Later policies are always reimbursement (§5.1 rule 5). |
| E9 | "New insurers → confidence capped at Insufficient history". | Fewer than 3 FY of CSR or no 3-yr average → level "Insufficient history", value capped at 0.5 for ranking. An insurer missing from Table A is treated the same way. |
| E10 | NCB loss value. | Cover lost = the bonus cut (one year's accrual, capped at what has accrued) plus next year's accrual forgone (if below the cap). Value = cover lost × 0.15, the chance the extra cover is needed. Zero when the bonus doesn't reduce on claim, and for unlimited SI. |
| E11 | Floater and group cost constants. | Floater shared with others: 0.15 × payout; parents' floater: 0.30 × payout (higher-risk members). Group renewal externality: 0 by default. Any positive value pushes group behind an equal own policy and contradicts the doc's default order (group first). It stays configurable. |
| E12 | Restoration. | Restores to base SI only when SI was used earlier this year. It is never applied within the same claim. A restoration that doesn't cover the same illness triggers a warning. |
| E13 | Pre/post-hospitalisation timing isn't known. | Assumed inside the policy's window when its pre/post days are above 0. |
| E14 | Fixed-benefit matching. | An event matches if it's listed in `fixed_benefit_events`, equals the category id, or contains a category keyword (S2 fracture or accidental hospitalisation, S4 heart or cardiac, S5 cancer). Hospital cash ("hospitalisation") matches any admission. Fixed benefits never count against the bill. |
| E15 | Several co-pays at once. | Added together (each a separate ledger line) and capped at 100% in total. |
| E16 | Rounding. | Whole rupees. Rounding drift goes on the largest deduction, so every ledger satisfies presented − payout = Σ deductions exactly. |
| E17 | Compact money format thresholds. | "₹38k" under ₹99,500; "₹1.2L" (one decimal, ".0" dropped) under ₹99.95L; "₹1.5Cr" above. |
| E18 | Default bill split for total-only entry. | The generic shape is the TC1 bill. Per-scenario shapes lean on Table C. With a room rate and nights, the room line is rate × nights and the rest is split by weight. |

## Seed data (packages/seed-data)

| # | Spec gap | Decision |
|---|---|---|
| S1 | BUILD_PROMPT §7 says "B2/name-only (`name_only`)", but the doc labels Table B2 itself `partial`. | Table B2 rows are `partial` (they list known features). Only the "Found by name only" list is `name_only`. |
| S2 | Table A has 31 rows, not 30. | All 31 are loaded. |
| S3 | Free-text cells list several variants ("36 m (SI ≤ ₹5L) / 24 m (≥ ₹7.5L)"). | The longest wait is taken as the conservative reading. PED waits are capped at 36 months, the IRDAI maximum since April 2024, which turns New India's CIS figure of 48 m into 36. |
| S4 | Bonus text has to be read as "reduces on claim" or not. | "Guaranteed", "regardless", "claims or not" and "every year" → doesn't reduce; "reduces" → reduces; anything else (for example ReAssure's Booster+) → unknown. Stored as the extension `Product.bonus_reduces_on_claim`. |
| S5 | Room rules that depend on SI or variant are written in prose. | Hand-coded for the three products that have them. Star Health Assure: 1% under ₹10L, any room except suite under ₹50L, no limit above. Bajaj My Health Care: single AC up to ₹10L, actuals above. Bajaj Health Guard: Silver's 1% is assumed and the field is marked unknown. |
| S6 | Products sold by every insurer (Arogya Sanjeevani). | `insurer_id: "*"` in JSON (NULL plus `all_insurers = true` in Postgres). The preset asks you to choose the insurer. |
| S7 | `data/*.json` could drift from the doc. | A test re-parses the doc and fails if the JSON differs. Another test checks that the engine's `csr_weight` table equals Table C. |

## Presets and policy entry

| # | Spec gap | Decision |
|---|---|---|
| R1 | A preset can't know every Policy field. | Unknown fields get a conservative default and are listed in `Policy.unknown_fields`, and the UI shows "Not known" for them. Defaults: specific-disease wait 24 m, PED wait 36 m, pre/post 30/60 days, consumables not covered, bonus reduces on claim, no restoration. Sub-limits are never in the data, so they are always unknown. Initial wait is 30 days (IRDAI standard). |
| R2 | Add-on features ("Add-on (Claim Shield)", "Parenthood add-on"). | Treated as not bought until you switch them on. |
| R3 | "Edited fields become `user_verified`" needs per-field provenance. | `Policy.field_status[path] = "user_verified"` on every edit, and the field drops out of `unknown_fields`. Policy-level `data_status` stays `aggregator` until you tick "I've checked every term against my policy schedule", which sets `user_verified`, records `verified_by_user_at` and clears `unknown_fields`. |
| R4 | Employer quick form. | No initial or disease waits. PED from day 1 unless you say otherwise. Maternity, if covered, from day 1. ICU cap 2× the room % (the common group pattern). Consumables "Not sure" → not covered and unknown. Sub-limits, pre/post and restoration are marked unknown. "Not sure" for insurer → `insurer_id: "unknown"`, rated "Insufficient history". |
| R5 | Critical-illness presets. | Fixed benefits of Cancer, Heart attack and Stroke at the sum insured. Cancer-only or heart-only products by name. Survival days come from the features text. |

## Web app (apps/web)

| # | Spec gap | Decision |
|---|---|---|
| W1 | NextAuth email/OTP needs a database and an email provider, and neither exists here. | Deferred. Phase 1 is single-user: policies, saved plans and settings are stored on the device (Zustand `persist`, key `stacked-v1`). The Prisma `User`, `FamilyGroup`, `Policy` and `ClaimPlan` tables are ready for when auth lands. "Delete all my data" under You wipes everything. |
| W2 | TanStack Query for server data. | Reference data (insurers, products, scenarios) comes from `/api/*` route handlers, read from Postgres when `DATABASE_URL` is set, otherwise from `@stacked/seed-data`. Insurer pages are server-rendered from the same source. |
| W3 | Where the engine runs. | In the browser, so no medical detail leaves the device. Saved plans keep the scenario, a policy snapshot and the engine version. |
| W4 | Policy table shape. | The full Zod-validated `Policy` is stored as JSON, with key fields (insurer, product, relationship, type, provenance) as columns. |
| W5 | "Cards stack like a wallet: 12px vertical offset, ±2° tilt". Overlapping the cards would hide the chips the spec requires on each card. | Cards sit 12px apart with alternating ±2° tilt. Expanding a card straightens it and animates to the full terms sheet (Motion `layout`, 180ms). |
| W6 | The split bar needs separate "deducted" and "out-of-pocket" segments. | `--partial` = deductions no later policy recovered; `--risk` hatched = amount above all cover. Together they equal `out_of_pocket`. |
| W7 | "Changing room rate updates the result". | The plan screen has a room-rate field that re-runs the engine 250ms after you stop typing. In total-only mode the room line becomes rate × nights. |
| W8 | Default values. | Room rate by city: metro ₹8,000, tier 2 ₹5,000, tier 3 ₹3,000. Typical bill totals per scenario (for example S4 ₹4L, S11 ₹9L). The usual room rate for gap checks is ₹8,000 and can be changed under You. |
| W9 | The claim-day checklist PDF export is listed under both §3.3 and Phase 2. | Phase 1 has "Print checklist" (the browser can save it as PDF) with print styles. A generated PDF is Phase 2. |
| W10 | i18n scope. | UI strings are in `apps/web/lib/i18n/en.ts`, and engine sentences in `packages/claim-engine/src/messages.en.ts` (re-renderable via `explainPlan(plan, names, catalogue)`). Plain-language field readings in `lib/describe.ts` carry English grammar and will need a per-language twin. |
| W11 | The coverage-gap banner can list many gaps. | It is a `<details>` element, open when there are 3 or fewer gaps. |
| W12 | Next.js resolving the engine's ESM `.js` specifiers. | `webpack.resolve.extensionAlias` maps `.js` → `.ts`. |
| W13 | Lighthouse ≥ 95. | Not run here (no Lighthouse install). axe (WCAG 2.1 A/AA) is clean on every route at 360 and 1280 in Playwright, with focus visibility and no-horizontal-scroll checks. |

## Installable app

| # | Spec gap | Decision |
|---|---|---|
| A1 | You asked to "use this as an app too", which the spec doesn't cover. | A Progressive Web App on the same codebase: manifest (`app/manifest.ts`), icons, a service worker (`public/sw.js`) and an install card under You. It installs on Android, iOS and desktop with no app-store build. A native wrapper (for example Capacitor) for the Play Store or App Store is a later option; it would need Android Studio or Xcode. |
| A2 | Offline behaviour. | Pages are network-first and fall back to the last copy. Content-hashed assets are cache-first. Reference data is stale-while-revalidate. Policies and plans are already in localStorage, and the engine runs on the device, so simulating works offline. React Server Component requests are not cached; offline they fall back to a full page load from cache. |
| A3 | Service worker in development. | Registered only in production builds, so `npm run dev` never serves stale files. `sw.js` is sent with `no-cache` so updates are picked up. |
| A4 | Icon. | Three stacked cards on `--ink` (the vault metaphor), with the front card on a plinth. PNGs are rendered from `app/icon.svg`; the maskable version keeps the art inside the 80% safe zone. |
| A5 | iOS notch and home indicator in standalone mode. | `viewport-fit=cover` and a `black-translucent` status bar. The header pads with `env(safe-area-inset-top)`, and the tab bar already pads with the bottom inset. |

## Publishing

| # | Question | Decision |
|---|---|---|
| G1 | What goes into the public repo. | Everything except `BUILD_PROMPT.md`, which stays local (gitignored). It is the only file that names the design inspiration, and spec §12 says the codebase must carry no such references. Add it with `git add -f BUILD_PROMPT.md` if you want it public. |
| G2 | Hosting. | Vercel, root directory `apps/web`, linked to GitHub so `main` deploys to production. The first deployment was built from the GitHub commit, not uploaded from this machine. |

## Database (Supabase) and sample data

| # | Question | Decision |
|---|---|---|
| DB1 | Supabase's direct host (`db.<ref>.supabase.co`) is IPv6-only, and neither this machine nor Vercel can reach it. | Supavisor pooler in Mumbai (`aws-1-ap-south-1`): transaction mode (6543, `pgbouncer=true&connection_limit=1`) as `DATABASE_URL` for the app, session mode (5432) as `DIRECT_URL` for migrations. |
| DB2 | The database is shared: `public` already holds about 56 tables from other projects, including `products` and `users`. | Stacked lives in its own **`stacked`** schema (`?schema=stacked`, and the migration pins `SET search_path`). Only `prisma migrate deploy` is used, never `migrate dev`, which can offer to reset a database. Verified afterwards: 9 tables in `stacked`, nothing added to `public`. |
| DB3 | What happens if the database is down? | Every read falls back to the built-in seed rows, so the app never breaks because of the database. |
| DB4 | Secrets. | The DB URLs live only in `apps/web/.env` (gitignored) and in Vercel as encrypted variables. The Supabase API keys aren't needed (Prisma connects directly) and are stored nowhere. |
| DB5 | "Add some dummy data". | A fictional demo user, Asha Rao (`demo@stacked.app`), with the Rao family group, four policies (employer group, ReAssure 2.0, parents' Mediclaim, CritiCare) and one saved claim plan in the database. `/api/demo` serves them. *Try with sample policies* loads them into the on-device vault with their claim plan, and a banner shows sample mode. Adding your own policy replaces the samples. |

## UI updates (requested 2026-10-01)

| # | Request | Decision |
|---|---|---|
| U1 | An eye-catching intro when someone opens the app. | First visit (empty vault) and `/welcome` show an intro: name, slogan ("Three covers. One clear claim."), the policies dealing in like cards, a hospital bill dropping on them, the split bar filling in claim order with counters, then three benefit points. It plays once, has *Replay*, and shows its final state under reduced motion. This overrides §4.5's "exactly one orchestrated animation", at your request. The numbers are the engine's real result for the sample vault, and a test fails if they drift. |
| U2 | Option buttons "down" on mobile and professional, not funky. | Radio options are a stacked full-width list with standard radio dots on phones and a single row from 640px. Two-option groups (Yes/No) sit side by side. This replaces chips that inverted to a bright fill when selected. |
| U3 | Same request, for action buttons. | Action rows stack full width on phones (`.actions`) and sit inline from 640px. The plinth button style stays as the approved design system. |
| U4 | Same request, for navigation. | The bottom tab bar gets line icons over labels (standard app navigation) and is fixed at the bottom on phones, safe-area aware. This amends components.md's "text-only labels". |
| U5 | The full e2e suite became flaky once every test's fresh browser installed the offline service worker. | Service workers are blocked in tests except `pwa.spec.ts`. |
