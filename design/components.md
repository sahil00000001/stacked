# Stacked — component list (v1)

Every custom component the app needs, with its anatomy, states, tokens and accessibility contract. If a screen needs something that isn't here, it gets built from these pieces and plain semantic HTML. It does not get a new component.

All values come from [tokens.css](tokens.css). Component code uses the role aliases (`--surface-card`, `--text-secondary` and so on), never raw hex.

The `/design` route renders every component below in every listed state, using the seed data.

---

## Signature components (section 4.4)

### 1. PlinthButton

A flat face on a hard offset shadow. It is the only pressable surface with depth.

| Prop | Type | Notes |
|---|---|---|
| `variant` | `"primary" \| "secondary"` | |
| `size` | `"md" \| "lg"` | md = 44px min height, lg = 52px (claim-plan CTA) |
| `disabled` | `boolean` | |
| `busy` | `boolean` | keeps its width; text changes to a present-participle verb ("Saving claim plan") |
| `as` | `"button" \| "a"` | renders a link with button styling when it navigates |

**Anatomy:** face (`--radius-button` 2px), label (16px, weight 500, sentence case), plinth (`--plinth`).

| State | Face | Text | Border | Plinth |
|---|---|---|---|---|
| Primary rest | `--bone` | `--ink` | none | `4px 4px 0 0 --edge` |
| Secondary rest | `--graphite` | `--bone` | 1px `--edge` | same |
| `:active` | unchanged | unchanged | unchanged | none, face `translate(4px, 4px)` over `--duration-press` (90ms) |
| `:focus-visible` | unchanged | unchanged | + 2px `--mint` ring, offset 2px | unchanged |
| Disabled | `--slate` | `--ash` | none | none |
| Reduced motion `:active` | primary face shifts to `--ash`, secondary to `--slate` (colour-only feedback, no translate) | | | |

**Rules:** the label states what happens ("Add a policy", "Simulate a claim", "Show claim order", "Save claim plan"). No trailing arrows, no icons-only buttons. The same verb is reused in the matching toast.

**A11y:** native `<button>`; `aria-disabled` plus a reason in adjacent text when disabled for a validation reason; `aria-busy` when busy.

---

### 2. PolicyCard

One policy, shown the way a card sits in a wallet.

| Prop | Type | Notes |
|---|---|---|
| `policy` | `Policy` | |
| `insurer` | `InsurerMetrics` | for the eyebrow name only. A card never shows CSR. |
| `availableSI` | `number \| "unlimited"` | from the engine helper |
| `chips` | derived | three most important terms (below) |
| `expanded` | `boolean` | |
| `stackIndex` | `number` | for offset and tilt in the vault stack |

**Anatomy:**
- **Top row:** insurer eyebrow (11px, uppercase, tracking `0.08em`, `--ash`; this is the only uppercase text in the app) and a relationship tag (`Employer`, `Yours`, `Parents' floater`, `Super top-up`, `Fixed benefit`). The tag is a 1px `--edge` chip with `--bone` text.
- **Middle:** sum insured as the hero figure (28px collapsed, 40px expanded, weight 500, tabular), with "available this year" beneath in `--ash` 14px/500.
- **Bottom:** three term chips, chosen in this order of what matters most:
  1. room rent (for example "Room rent: 1% of SI a day" or "No room cap")
  2. co-pay ("No co-pay", "Co-pay 20%")
  3. waiting status ("PED wait ends Mar 2027", "All waits served")
- **Expanded (terms sheet):** every field of the `Policy` schema as a `FieldRow` in plain language, grouped as Cover, Room and co-pay, Waiting periods, Limits, Bonus and restoration, and Data source. Null shows "Not known". The data source line reads "From the product preset (aggregator data, Sept 2026). Your policy wording overrides this." until fields are user-verified.

**Surface:** `--graphite` with `--grain` at 5%, 1px `--edge`, `--radius-card` 6px. No shadow; the grain and border are the depth.

| State | Behaviour |
|---|---|
| In stack | translateY(`stackIndex × 12px`), rotate alternates `+2deg / −2deg`, overlapping |
| Expanded | layout animation (Motion `layout`) to full width and height, tilt to 0, over `--duration-base` 180ms ease-out. Other cards stay put. |
| Focus | 2px `--mint` ring. Enter or Space toggles. |
| Reduced motion | expand is instant; tilt stays (it is static, not motion) |
| `data_status = name_only` | middle figure shows "Sum insured not known" and chips show "Not known" |

**A11y:** the card is a `<button aria-expanded>` wrapping its summary. The terms sheet is a region labelled by the product name. The visual stack order matches DOM order.

---

### 3. ClaimSplitBar (signature element)

The whole bill as one bar, split by who pays it.

| Prop | Type | Notes |
|---|---|---|
| `plan` | `ClaimPlan` | engine output, used verbatim |
| `animate` | `boolean` | true on first render of a result |

**Anatomy:** a full-width bar, 20px tall, 2px radius on the outer ends only. Segments run in cascade order:
1. one `--covered` segment per paying policy, separated by a 1px `--edge` divider
2. one `--partial` segment for deductions that are not recovered by a later policy (this segment only appears when it is non-zero)
3. one `--risk` segment with `--hatch-risk` diagonal hatch for out of pocket

Beneath each segment sits a label: policy name (14px/500 `--bone`) and amount (14px tabular `--ash`). A segment narrower than 15% gets its label in a leader list under the bar instead of directly beneath it. No label is ever clipped.

**Motion:** the app's one orchestrated animation. Segments fill left to right in cascade order. Total 500ms (`--duration-split-fill`), each segment's share of the time proportional to its width, ease-out. It runs once per result and never loops. Under reduced motion it fills instantly.

**A11y:** `role="img"` with an `aria-label` sentence built from the plan ("Employer group pays ₹5,00,000, your ReAssure pays ₹4,00,000, you pay ₹0 of ₹9,00,000"). The visible labels carry the same information, so colour is never the only signal (the hatch also marks out of pocket).

---

### 4. DeductionLedger

Why a policy pays less than the bill, one line per reason.

| Prop | Type |
|---|---|
| `allocation` | one `Allocation` from the plan (its deductions, presented amount, payout) |
| `showYouPay` | `boolean` (on the last ledger, or on a combined ledger) |

**Anatomy:** a `<table>` with two columns, reason and amount, right-aligned, tabular, full Indian grouping ("₹60,000"):
- first row: "Bill presented to this policy" with the amount
- one row per deduction, with the reason text from the engine's reason code ("Room rent above 1% cap — proportionate cut", "Co-pay 5%", "Consumables not covered", "Above sum insured"). The amount is in `--partial` with a leading minus.
- running total row: "This policy pays" in `--covered`
- final row (when `showYouPay`): "You pay" in `--risk`, weight 700, separated by a 1px `--edge` rule

There are no icons. The colour always has a text label next to it.

**A11y:** a real table with `<th scope>`. Amounts carry an `aria-label` in words where a minus sign could be misread ("deducted ₹60,000").

---

### 5. ConfidenceMeter

How likely an insurer is to settle without friction. It is always a sentence, never a bare percentage.

| Prop | Type |
|---|---|
| `confidence` | `{ value, level, insurer, csr_3yr, complaints_3yr, period, source }` from the engine |

**Anatomy:** five 6px-tall segments with 2px gaps. Filled segments are `--covered` (levels 4–5), `--partial` (3) or `--risk` (1–2); unfilled ones are `--slate`. Beside or under the meter, a sentence:
> "High confidence. HDFC ERGO settled 97.6% of claims (FY24–26) with 8.9 complaints per 10,000 claims."

followed by a small source line: "Insurer claim record (FY24–26 average, NL-37). Source: Ditto Data Lab compilation of IRDAI disclosures, 7 Sept 2026."

**Levels:** 5 Very high, 4 High, 3 Moderate, 2 Low, 1 Very low, plus a separate **Insufficient history** state. That state has no segments filled, a 1px dashed `--edge` outline, and text that reads "Insufficient history. Galaxy Health has fewer than three years of claim data."

**A11y:** `role="meter"` with `aria-valuemin=0`, `aria-valuemax=5`, `aria-valuenow`, and `aria-valuetext` set to the sentence.

---

### 6. InsurerScorecard

One insurer's record, always labelled as insurer-level.

| Prop | Type |
|---|---|
| `insurer` | `InsurerMetrics` |
| `variant` | `"row" \| "detail"` (list row compact, detail full) |

**Anatomy (detail):**
- name (20px/500) and type in plain language ("Standalone health insurer", "Public-sector general insurer", "Private general insurer")
- **Insurer claim record (FY24–26 average, NL-37):** the 3-yr CSR figure (28px), with a 3-point sparkline (FY24, FY25, FY26) drawn as an inline SVG 1.5px `--bone` polyline with `--ash` point labels. There is no fill and no gradient.
- **Complaints per 10,000 claims:** the FY26 figure and the 3-yr average, read against the benchmark ("Below the 40 benchmark for health insurers")
- **ICR:** the FY25 figure plus one plain-language reading, generated from thresholds:
  - over 100%: "Pays out more than it earns; premium-hike risk."
  - 85–100%: "Pays out most of what it earns; watch renewals."
  - 55–85%: "Within the healthy range."
  - under 55%: "Pays out little of what it earns; may be strict on claims."
- **Network:** "16,000+ hospitals (insurer-stated)"
- **Flags:** a plain list
- **Footer:** source, as-of date, metric definition and the section 4.6 disclaimer

| State | Behaviour |
|---|---|
| Fewer than 3 FY of CSR | sparkline shows the points that exist; headline reads "Insufficient history" and the CSR is not shown as a 3-yr figure |
| Value > 100% (methodology artefact) | shows the figure with the note "Over 100% is a reporting artefact of the NL-37 method" |
| `NA` | "Not reported" |

---

### 7. Stepper

The claim-day timeline. It is numbered because the steps happen in a real sequence.

| Prop | Type |
|---|---|
| `steps` | `{ id, title, detail, timing?, status: "todo" \| "current" \| "done" }[]` |

**Anatomy:** an ordered list. Each step has a 28px number square (2px radius, 1px `--edge`) joined by a 1px `--edge` vertical rule, a title (16px/500) and detail (14px `--ash`). An optional timing line ("Insurer must decide within 1 hour") sits in `--bone`. The current step's number square is filled `--bone` with `--ink` text, and a done step shows its number in `--covered`.

Default steps: cashless pre-auth from the primary insurer, the 1-hour decision, discharge within 3 hours, collecting the settlement letter and attested bills, then filing with the second insurer inside its reimbursement window.

**A11y:** `<ol>`; `aria-current="step"` on the current step.

---

## Standard components

### 8. Sheet / Drawer
A bottom sheet on mobile and a right-side drawer at 720px and up. It uses `--graphite` with grain, a 1px `--edge` top or left border, and opens over `--duration-base`. A scrim (`--ink` at 70%) sits behind it. It traps focus, closes on Esc, and returns focus to its trigger. It holds the add-policy forms and the expanded terms sheet on mobile.

### 9. Toast
A single line in the past tense that reuses the action's verb ("Claim plan saved", "Policy added"). It sits bottom-centre above the tab bar, on `--slate` with a 1px `--edge` border, and disappears after 4s or on tap. It uses `role="status"`, holds one toast at a time, and has no icons.

### 10. EmptyState
A title (20px/500), one sentence (16px `--ash`) and one PlinthButton. It has no illustration. Vault copy: "No policies yet. Add your employer cover first — it's usually the one to claim from." Button: "Add a policy".

### 11. FieldRow
Two uses, sharing a single layout of a label column and a value column (stacked below 390px):
- **Read mode** (terms sheet): plain-language label and value, with null shown as "Not known" in `--ash`, and an optional source note.
- **Edit mode** (forms): `<label>`, input on `--slate`, a 1px `--edge` outline plus a 1px `--field-rule` bottom underline (meets 3:1), a hint (14px `--ash`) and an error line in `--risk`. Errors say what is wrong and what to do ("Room rate is missing. Enter the per-day room charge so we can check the room-rent cap."). Focus shows the 2px `--mint` ring. It has `aria-describedby` for the hint and error and `aria-invalid` on error.

---

## App-shell primitives (not components in the sense above; listed so nothing is invented later)

| Primitive | Why it exists |
|---|---|
| **TabBar** | Section 4.1 requires a bottom tab bar on mobile (Vault, Simulate, Insurers, You). It is fixed and safe-area aware, `--ink` with a 1px `--edge` top rule, with a 22px line icon over each label (DECISIONS U4). The active tab shows `--mint` text and a 2px `--mint` bar. At 768px and up it becomes a top nav row inside the column. |
| **Intro** | First-visit explainer (DECISIONS U1): name, slogan, animated sample (cards deal in, bill drops, split bar fills, counters run), benefit points and the two ways in. Plays once, can be replayed, and is static under reduced motion. |
| **SourceNote** | Every metric carries its period and source in small text (12px `--ash`, the only 12px use). It is one primitive so the wording never drifts. |
| **Disclaimer** | The fixed footer on every result and scorecard: "Not insurance advice. Figures are insurer-level from IRDAI disclosures (FY24–26). Your policy wording overrides this app." |
| **Money** | A `<span>` wrapper applying `tabular-nums` and the engine's `formatINR` (full "₹1,20,000" in ledgers, compact "₹1.2L" in bars and cards). |

## Not built (by rule)
Cards with soft shadows, gradients, glassmorphism, emoji, trailing "→" on buttons, middle-dot meta strings, monospace data labels, hover lifts, section entrance animations, looping animation.
