# India Retail Health Insurance — Market Knowledge Base (Snapshot: September 2026)

> **Purpose:** Reference data and rules for a multi-policy health-insurance comparison and claim-selection app.
> **Scope:** Health insurance only, Indian market (IRDAI-regulated insurers).
> **Use in product:** Table A → `insurers` seed data · Table B1/B2 → `products` seed data · Table C → `scenarios` config · Part 4 → claim-allocation engine rules · JSON schemas → app data model.
> **Data-status legend used in this doc:** `verified` (primary source read), `partial` (aggregator data, some fields missing), `name_only` (product exists, features not confirmed).
> **Hard rule for the UI:** Claim settlement ratio (CSR) is published **per insurer, never per product**. Always label it "Insurer claim record (FYxx–xx, NL-37)".

---

## 0. Summary

For a person holding several policies (e.g., an employer group policy + a parents' family floater they are covered under + their own individual policy), the right claim under IRDAI's 2024 Master Circular is the one that pays the most after deductions and keeps the other covers intact. The policyholder picks the order of claims (fixed-benefit covers pay regardless), and the next policies pay the balance.

No official source gives a claim settlement ratio for each product. IRDAI and insurers publish these figures only at the insurer level, so the app has to carry insurer metrics over to each product and score them alongside product terms (room-rent caps, co-pays, sub-limits, waiting periods). Those terms usually change the payout more than a gap of a few points in settlement ratio.

### TL;DR

- **Claim reliability is an insurer-level metric, and insurers differ widely** (IRDAI Form NL-37 disclosures compiled by Ditto; 3-year averages FY24–FY26):
  - CSR ranges from about 80% (Navi) to 99% (Digit). New India 98.0%, HDFC ERGO 97.6%, Aditya Birla Health 96.3%, Care 95.5%. Star Health, the largest retail health insurer, averages 88.6%.
  - Complaints per 10,000 claims range from 3.85 (Bajaj General) to 54 (Star) among the major insurers.
  - Market-wide (IRDAI Annual Report 2024-25): 87% of 3.26 crore health claims settled, 8% repudiated, 5% pending.
- **Product terms decide most of the payout.** Flagship modern plans have no room-rent cap, no co-pay, consumables cover (built in or add-on), unlimited restoration and a 3-year PED wait: HDFC ERGO Optima Secure/Secure+, Care Supreme, Niva Bupa ReAssure 2.0/3.0, Aditya Birla Activ One MAX, ICICI Lombard Elevate, SBI Super Health, ManipalCigna Sarvah. Legacy PSU mediclaim, Arogya Sanjeevani and senior plans can lose 20–40% of a claim to room-rent caps (1–2% of SI/day), 5–30% co-pays and disease sub-limits.
- **Default claim order for a multi-policy user:**
  1. Employer group policy first — usually no waiting periods, PED covered from day 1, no personal no-claim bonus (NCB) to lose.
  2. Own individual policy next — for the balance or anything the group policy disallowed.
  3. Parents' floater last — a claim there uses up the family's shared cover and bonus.
  4. Super top-ups kick in once the deductible is used up; critical-illness / fixed-benefit plans are claimed in parallel regardless.

  Change the order when one policy has an unserved waiting period, a room or disease cap, a smaller network, or when claiming would reset a large bonus the others don't offer.

---

## 1. Key Findings

1. **No product-level CSR exists in any official source.** CSR, incurred claim ratio (ICR), repudiation, pendency and complaint figures are all published per insurer: IRDAI Annual Report, insurers' quarterly public disclosures (NL-37 claims, NL-45 grievances, NL-4 premium), and the IBAI Claim Insights handbook. In a Lok Sabha reply on 24 July, MoS Health Prataprao Jadhav said IRDAI "collects data only on overall claim repudiation rates, not the reasons behind individual denials". **The app must inherit insurer metrics onto products and never present them as product CSR.**
2. **CSR, ICR and repudiation measure different things:**
   - Care Health: 95.45% average CSR but 58.68% average ICR.
   - Oriental Insurance: ICR averages 111.54% — pays out more in claims than it earns in premium (financial strain / repricing risk, not generosity).
   - Star Health FY24 repudiation ratio 18.64%, the highest among SAHIs (IBAI). Aditya Birla Health lowest at 3.99%.
3. **Claims are settled by number far more often than by amount.** FY24 (IRDAI AR 2023-24): insurers paid ₹83,493 crore (71.29%) of ₹1.17 lakh crore claimed; disallowed ₹15,100 crore (12.9%), repudiated ₹10,937 crore (9.34%), left ₹7,585 crore (6.48%) outstanding — even though 82.46% of claims by number were settled. IRDAI Chairperson Ajay Seth (BimaLokpal Day, Nov 2025) said that "while the number of claims settled is high, the amount settled, especially in full, is sometimes lower than expected". **That gap is the deductions the app has to model:** proportionate room-rent deductions, co-pays, sub-limits, non-payable items, "reasonable and customary" cuts.
4. **The 2024 rules are the base for claims.** Master Circular on Health Insurance Business (29 May 2024) consolidated 55 earlier circulars:
   - Cashless request decided within 1 hour.
   - Final discharge authorised within 3 hours; extra hospital charges from delay beyond that are paid from the insurer's shareholder funds.
   - Moratorium is 60 months: after five years of continuous cover, a claim cannot be contested for non-disclosure except for proven fraud.
   - No repudiation without approval from the insurer's Claims Review Committee.
   - Portability data shared within 72 hours; new insurer must decide within 5 days.
   - With multiple policies, the primary insurer must coordinate settlement of the balance with the others.

   Separately: the age-65 entry cap was removed; maximum PED wait is 36 months. Under IRDAI/HLT/CIR/MISC/27/1/2025 (30 Jan 2025), premiums on indemnity-based individual products for people aged 60+ cannot rise more than 10%/year without prior consultation with IRDAI.
5. **Several 2026 changes are still in progress:**
   - Cashless Everywhere (General Insurance Council, Jan 2024) lets you *request* cashless at non-network hospitals; those hospitals can still refuse.
   - NHCX (National Health Claims Exchange) live since June 2024; hospital adoption uneven (IRDAI sub-committee still discussing onboarding incentives on 28 Aug 2026).
   - Public insurer/hospital scorecards were planned from June 2026; publication unconfirmed.

---

## 2. Part 1 — Insurer-Level Data

### 2.1 Metric definitions (encode these in the app)

| Metric | Formula / meaning | Source form | Use in app |
|---|---|---|---|
| Claim Settlement Ratio (CSR, by number) | Claims paid ÷ (opening outstanding + reported − closed without payment − closing outstanding) × 100 (Ditto's NL-37 method) | Insurer public disclosure NL-37 (quarterly; Q4 = full year) | Main "will my claim get paid" signal; use 3-yr average |
| Claim settlement within 3 months | Claims settled within 3 months ÷ claims available for processing | IBAI handbook (NL-37 ageing buckets) | Speed signal; matters most for reimbursement |
| Claims Repudiation Ratio | Claims repudiated ÷ claims available for processing | IBAI; IRDAI Annual Report (aggregate) | Rejection risk (lower is better) |
| Claims Pendency / Outstanding Ratio | Claims pending at year-end ÷ claims available | IBAI; NL-37 | Delay risk |
| Incurred Claims Ratio (ICR) | Net claims incurred ÷ net earned premium | IRDAI Annual Report (company-wise) | Sustainability signal. Ideal ~55–85% (Ditto). Below → tight claim handling; persistently >100% → premium-hike risk |
| Complaints per 10,000 claims | Grievances ÷ claims × 10,000 | NL-45; Bima Bharosa | Friction signal. Benchmark: <20 general insurers, <40 SAHIs (Ditto) |
| Solvency ratio | Available ÷ required solvency margin | NL-34 / IRDAI | Must be ≥ 1.5 |

### 2.2 Market-level context

| Metric | Value | Year | Source |
|---|---|---|---|
| Health claims handled | 3.26 crore | FY2024-25 | IRDAI Annual Report 2024-25 |
| Amount paid | ₹94,247–94,248 crore | FY2024-25 | IRDAI AR 2024-25 |
| Settled / repudiated / pending (by number) | ~87% / ~8% / ~5% | FY2024-25 | IRDAI AR 2024-25 (via Insurance Business, Onsurity) |
| Settled by number / cashless share | 82.46% / 66.16% | FY2023-24 | IRDAI AR 2023-24 |
| Claimed / paid / disallowed / repudiated / outstanding (amount) | ₹1.17 lakh cr / ₹83,493 cr (71.29%) / ₹15,100 cr (12.9%) / ₹10,937 cr (9.34%) / ₹7,585 cr (6.48%) | FY2023-24 | IRDAI AR 2023-24 |
| Non-life industry ICR | 82.88% (vs 82.52%) | FY2024-25 | IRDAI AR 2024-25 |
| ICR: private general / SAHI | 77.50% / 68.06% | FY2024-25 | IRDAI AR 2024-25 |
| ICR: public-sector general insurers | 97.30% (AR text) vs 99.84% "combined" (Business Standard) | FY2024-25 | Conflict; likely different bases |
| Share of health-insured lives in group policies | ~47% (27.51 crore lives) vs 10% individual | FY2024-25 | Onsurity citing IRDAI AR |
| Bima Bharosa complaints | 2,57,790 (vs 2,15,569); ~69% of general/health complaints about claims | FY2024-25 | Insurance Business (IRDAI data) |

### 2.3 Table A — Insurer metrics dataset

**Schema:** `insurer_id (string)`, `insurer_name (string)`, `insurer_type (enum: PSU_GI | PVT_GI | SAHI)`, `csr_fy24 / csr_fy25 / csr_fy26 (float %)`, `csr_3yr_avg (float %)`, `icr_fy23 / icr_fy24 / icr_fy25 (float %)`, `health_gwp_fy26_cr (int, ₹ crore)`, `complaints_per_10k_fy26 (float)`, `complaints_3yr_avg (float)`, `network_hospitals_min (int)`, `flags (string)`.

Source: Ditto Data Lab compilation of IRDAI annual reports, NL-37 (CSR), NL-4 (health GWP), NL-45 (complaints), updated 7 Sept 2026. CSR for general insurers blends all health business (retail + group + government schemes).

| Insurer | Type | CSR FY24 | CSR FY25 | CSR FY26 | CSR 3-yr avg | ICR FY23 | ICR FY24 | ICR FY25 | Health GWP FY26 (₹ cr) | Complaints/10k FY26 | Complaints 3-yr avg | Network | Flags |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Star Health & Allied | SAHI | 86.49 | 88.34 | 91.05 | 88.63 | 65.00 | 66.47 | 70.30 | 18,606 | 54.02 | 54.04 | 14,000+ | Highest SAHI repudiation FY24 (18.64%, IBAI); IRDAI show-cause notice 4 Nov 2024; ₹3.39 cr cyber-security penalty 2025 |
| Care Health | SAHI | 92.61 | 96.74 | 96.99 | 95.45 | 53.82 | 57.69 | 64.53 | 10,031 | 42 | 42.67 | 11,400+ | Low ICR; complaints above SAHI benchmark |
| Niva Bupa | SAHI | 91.93 | 92.39 | 94.44 | 92.92 | 54.05 | 59.02 | 61.22 | 8,586 | 29.19 | 37.13 | 10,000+ | Listed (NSE: NIVABUPA) |
| Aditya Birla Health | SAHI | 95.61 | 95.88 | 97.27 | 96.25 | 64.68 | 68.31 | 71.50 | 6,238 | 18 | 18.67 | 16,500+ | Lowest SAHI repudiation FY24 (3.99%, IBAI) |
| ManipalCigna | SAHI | 88.54 | 93.70 | 95.84 | 92.69 | 64.66 | 63.78 | 74.81 | 2,213 | 45.4 | 32.17 | 14,000+ | Complaints rising |
| Galaxy Health & Allied | SAHI (new) | NA | 79.37 | 90.18 | 84.78 (2-yr) | NA | NA | NA | 148 | 25.9 | NA | 9,400+ | Too little data yet |
| Narayana Health Insurance | SAHI (new) | NA | 100.00 | 103.24 | NA | NA | NA | NA | 2 | 9 | NA | 20+ | Tiny volume; closed hospital network |
| New India Assurance | PSU GI | 98.44 | 98.38 | 97.18 | 98.00 | 103.33 | 105.87 | 100.98 | 22,434 | 6.62 | 5.66 | 2,000+ | Largest health GWP; ICR over 100% |
| Oriental Insurance | PSU GI | 94.21 | 93.38 | 89.95 | 92.51 | 130.09 | 101.96 | 102.58 | 12,565 | 7.1 | 8.7 | 12,000+ | Persistent ICR over 100% |
| National Insurance | PSU GI | 94.68 | 93.56 | 93.04 | 93.76 | 102.35 | 90.83 | 96.05 | 8,806 | 49.81 | 39.13 | 5,300+ | Complaints jumped in FY26 |
| United India | PSU GI | 92.72 | 95.92 | 96.46 | 95.03 | 89.57 | 109.23 | 97.51 | 8,496 | 18.31 | 15.74 | 4,000+ | — |
| HDFC ERGO | PVT GI | 97.19 | 97.45 | 98.19 | 97.61 | 79.04 | 80.98 | 84.85 | 7,152 | 4.99 | 8.87 | 16,000+ | Top-tier CSR and complaints |
| ICICI Lombard | PVT GI | 84.83 | 83.65 | 91.96 | 86.81 | 77.33 | 78.85 | 82.24 | 9,076 | 20.64 | 15.05 | 11,000+ | CSR improving |
| Bajaj General (formerly Bajaj Allianz) | PVT GI | 96.16 | 97.32 | 93.40 | 95.63 | 74.27 | 84.96 | 87.31 | 8,717 | 5.25 | 3.85 | 12,600+ | Lowest complaints; FY26 CSR dip |
| Tata AIG | PVT GI | 90.88 | 86.63 | 89.30 | 88.94 | 78.33 | 77.94 | 76.24 | 4,603 | 12.56 | 11.47 | 12,000+ | — |
| SBI General | PVT GI | 98.08 | 96.13 | 93.62 | 95.94 | 73.92 | 87.86 | 82.19 | 6,194 | 4.17 | 14.04 | 18,000+ | Falling CSR trend |
| Go Digit | PVT GI | 98.83 | 98.98 | 99.21 | 99.01 | 71.87 | 93.87 | 83.78 | 1,767 | 21.69 | 19.08 | 9,000+ | Highest 3-yr CSR |
| Acko | PVT GI | 96.31 | 95.75 | 94.86 | 95.64 | 83.88 | 56.91 | 57.82 | 1,248 | 13.32 | 18.74 | 11,500+ | Digital-only |
| IndusInd General (formerly Reliance General) | PVT GI | 86.32 | 86.38 | 86.68 | 86.46 | 86.31 | 89.42 | 87.34 | 2,831 | 4.59 | 4.21 | 10,000+ | Renamed 2025 |
| Generali Central (formerly Future Generali) | PVT GI | 92.15 | 94.54 | 93.80 | 93.50 | 79.18 | 84.62 | 95.29 | 1,621 | 13.56 | 11.68 | 10,000+ | Renamed 2025 |
| Cholamandalam MS | PVT GI | 82.74 | 83.28 | 86.45 | 84.16 | 67.88 | 66.67 | 73.04 | 1,125 | 51.84 | 26.55 | 13,500+ | Low CSR; FY26 complaint spike |
| Royal Sundaram | PVT GI | 95.06 | 89.23 | 89.16 | 91.15 | 83.36 | 92.06 | 95.56 | 1,054 | 32.72 | 21.26 | 12,500+ | — |
| IFFCO Tokio | PVT GI | 93.20 | 85.64 | 83.02 | 87.29 | 111.18 | 107.46 | 83.74 | 984 | 63.88 | 39.2 | 8,000+ | Worsening CSR and complaints |
| Universal Sompo | PVT GI | 93.39 | 89.21 | 84.12 | 88.91 | 82.84 | 105.76 | 97.12 | 1,355 | 4.6 | 5.19 | 15,000+ | Falling CSR |
| Magma General (Magma HDI) | PVT GI | 88.04 | 90.83 | 89.64 | 89.50 | 72.10 | 87.46 | 85.54 | 964 | 24 | 17.67 | 11,500+ | — |
| Zurich Kotak | PVT GI | 88.51 | 92.05 | 93.33 | 91.30 | 56.01 | 59.06 | 70.69 | 712 | 33.33 | 26.21 | 24,500+ | Largest stated network |
| Liberty General | PVT GI | 91.62 | 90.84 | 109.59 | 97.35 | 74.17 | 79.92 | 92.99 | 487 | 16.88 | 14.65 | 6,000+ | FY26 CSR over 100% is a methodology artefact |
| Zuno (formerly Edelweiss) | PVT GI | 89.72 | 86.43 | 92.86 | 89.67 | 89.59 | 88.45 | 90.12 | 378 | 24.92 | 21.45 | 10,000+ | — |
| Raheja QBE | PVT GI | 88.43 | 89.70 | 86.00 | 88.04 | 138.67 | 106.27 | 105.12 | 142 | 53.14 | 67.87 | 5,000+ | Small, high ICR |
| Navi General | PVT GI | 63.49 | 80.39 | 95.58 | 79.82 | 59.28 | 59.40 | 101.89 | 41 | 42.56 | 220.47 | 12,000+ | Extreme complaint history |
| Shriram General | PVT GI | 93.93 | 94.26 | 94.25 | 94.15 | 51.53 | 47.47 | 74.55 | 157 | 29.92 | 29.77 | NA | Mainly personal accident, not retail health |

**Industry benchmarks (Ditto, 3-yr averages):** mean CSR 92.02% (median 92.69%), mean ICR 81.88%, mean complaints 29.35 per 10,000 claims. Kshema General (agri specialist) has no retail health data and is excluded.

**Solvency ratios (secondary sources conflict):** March 2025 figures cited from IRDAI data: Star 2.21, Aditya Birla Health 1.98, Niva Bupa 3.03, Care 1.68, ManipalCigna 1.96. Another aggregator lists Aditya Birla 1.67, Care 1.74, Niva Bupa 2.55, Star 2.05, Digit 3.85 (probably different quarters). Pull NL-34 directly from each insurer's latest disclosure. All listed insurers exceed the 1.5 minimum.

**Headline figures that don't match NL-37 data:** some aggregators cite Star Health FY25 CSR as 99.06% and 99.93–100% for SAHIs, against 88.34% for Star in the NL-37 series — different measure. **Use the NL-37 method consistently and store the definition with each figure.**

**Older IBAI amount-based data (FY23):** HDFC ERGO paid 71.35% and ICICI Lombard 63.98% of the amount claimed, while New India paid ~95–99%. Bajaj had a 21.66% outstanding ratio by number. Shows how much a count-based CSR can hide.

#### Table A as CSV (seed file)

```csv
insurer_id,insurer_name,insurer_type,csr_fy24,csr_fy25,csr_fy26,csr_3yr_avg,icr_fy23,icr_fy24,icr_fy25,health_gwp_fy26_cr,complaints_per_10k_fy26,complaints_3yr_avg,network_hospitals_min,flags
star-health,Star Health & Allied Insurance,SAHI,86.49,88.34,91.05,88.63,65.00,66.47,70.30,18606,54.02,54.04,14000,"Highest SAHI repudiation FY24 (18.64%, IBAI); IRDAI show-cause notice Nov 2024; cyber-security penalty 2025"
care-health,Care Health Insurance,SAHI,92.61,96.74,96.99,95.45,53.82,57.69,64.53,10031,42,42.67,11400,"Low ICR; complaints above SAHI benchmark"
niva-bupa,Niva Bupa Health Insurance,SAHI,91.93,92.39,94.44,92.92,54.05,59.02,61.22,8586,29.19,37.13,10000,"Listed (NSE: NIVABUPA)"
aditya-birla-health,Aditya Birla Health Insurance,SAHI,95.61,95.88,97.27,96.25,64.68,68.31,71.50,6238,18,18.67,16500,"Lowest SAHI repudiation FY24 (3.99%, IBAI)"
manipalcigna,ManipalCigna Health Insurance,SAHI,88.54,93.70,95.84,92.69,64.66,63.78,74.81,2213,45.4,32.17,14000,"Complaints rising"
galaxy-health,Galaxy Health & Allied Insurance,SAHI,NA,79.37,90.18,84.78,NA,NA,NA,148,25.9,NA,9400,"New insurer; 2-yr avg only"
narayana-health,Narayana Health Insurance,SAHI,NA,100.00,103.24,NA,NA,NA,NA,2,9,NA,20,"Tiny volume; closed hospital network"
new-india,The New India Assurance,PSU_GI,98.44,98.38,97.18,98.00,103.33,105.87,100.98,22434,6.62,5.66,2000,"Largest health GWP; ICR over 100%"
oriental,The Oriental Insurance Company,PSU_GI,94.21,93.38,89.95,92.51,130.09,101.96,102.58,12565,7.1,8.7,12000,"Persistent ICR over 100%"
national,National Insurance Company,PSU_GI,94.68,93.56,93.04,93.76,102.35,90.83,96.05,8806,49.81,39.13,5300,"Complaints jumped in FY26"
united-india,United India Insurance,PSU_GI,92.72,95.92,96.46,95.03,89.57,109.23,97.51,8496,18.31,15.74,4000,""
hdfc-ergo,HDFC ERGO General Insurance,PVT_GI,97.19,97.45,98.19,97.61,79.04,80.98,84.85,7152,4.99,8.87,16000,"Top-tier CSR and complaints"
icici-lombard,ICICI Lombard General Insurance,PVT_GI,84.83,83.65,91.96,86.81,77.33,78.85,82.24,9076,20.64,15.05,11000,"CSR improving"
bajaj-general,Bajaj General Insurance (formerly Bajaj Allianz),PVT_GI,96.16,97.32,93.40,95.63,74.27,84.96,87.31,8717,5.25,3.85,12600,"Lowest complaints; FY26 CSR dip"
tata-aig,Tata AIG General Insurance,PVT_GI,90.88,86.63,89.30,88.94,78.33,77.94,76.24,4603,12.56,11.47,12000,""
sbi-general,SBI General Insurance,PVT_GI,98.08,96.13,93.62,95.94,73.92,87.86,82.19,6194,4.17,14.04,18000,"Falling CSR trend"
go-digit,Go Digit General Insurance,PVT_GI,98.83,98.98,99.21,99.01,71.87,93.87,83.78,1767,21.69,19.08,9000,"Highest 3-yr CSR"
acko,Acko General Insurance,PVT_GI,96.31,95.75,94.86,95.64,83.88,56.91,57.82,1248,13.32,18.74,11500,"Digital-only"
indusind-general,IndusInd General Insurance (formerly Reliance General),PVT_GI,86.32,86.38,86.68,86.46,86.31,89.42,87.34,2831,4.59,4.21,10000,"Renamed 2025"
generali-central,Generali Central Insurance (formerly Future Generali),PVT_GI,92.15,94.54,93.80,93.50,79.18,84.62,95.29,1621,13.56,11.68,10000,"Renamed 2025"
chola-ms,Cholamandalam MS General Insurance,PVT_GI,82.74,83.28,86.45,84.16,67.88,66.67,73.04,1125,51.84,26.55,13500,"Low CSR; FY26 complaint spike"
royal-sundaram,Royal Sundaram General Insurance,PVT_GI,95.06,89.23,89.16,91.15,83.36,92.06,95.56,1054,32.72,21.26,12500,""
iffco-tokio,IFFCO Tokio General Insurance,PVT_GI,93.20,85.64,83.02,87.29,111.18,107.46,83.74,984,63.88,39.2,8000,"Worsening CSR and complaints"
universal-sompo,Universal Sompo General Insurance,PVT_GI,93.39,89.21,84.12,88.91,82.84,105.76,97.12,1355,4.6,5.19,15000,"Falling CSR"
magma-general,Magma General Insurance (Magma HDI),PVT_GI,88.04,90.83,89.64,89.50,72.10,87.46,85.54,964,24,17.67,11500,""
zurich-kotak,Zurich Kotak General Insurance,PVT_GI,88.51,92.05,93.33,91.30,56.01,59.06,70.69,712,33.33,26.21,24500,"Largest stated network"
liberty-general,Liberty General Insurance,PVT_GI,91.62,90.84,109.59,97.35,74.17,79.92,92.99,487,16.88,14.65,6000,"FY26 CSR over 100% is a methodology artefact"
zuno,Zuno General Insurance (formerly Edelweiss),PVT_GI,89.72,86.43,92.86,89.67,89.59,88.45,90.12,378,24.92,21.45,10000,""
raheja-qbe,Raheja QBE General Insurance,PVT_GI,88.43,89.70,86.00,88.04,138.67,106.27,105.12,142,53.14,67.87,5000,"Small; high ICR"
navi-general,Navi General Insurance,PVT_GI,63.49,80.39,95.58,79.82,59.28,59.40,101.89,41,42.56,220.47,12000,"Extreme complaint history"
shriram-general,Shriram General Insurance,PVT_GI,93.93,94.26,94.25,94.15,51.53,47.47,74.55,157,29.92,29.77,NA,"Mainly personal accident; not retail health"
```

---

## 3. Part 2 — Product-Level Data

### 3.1 How the retail market is structured (2026)

Six tiers:

1. **Modern comprehensive plans** (default recommendation): no room-rent cap, no co-pay, unlimited restoration, large/guaranteed bonuses, consumables cover — Optima Secure/Secure+, Care Supreme, ReAssure 2.0/3.0, Activ One MAX/NXT, Elevate, SBI Super Health, Sarvah, MediCare Premier.
2. **Mid-generation plans**: single private AC room limits, 2–3-year waits, 25–50% bonuses — Star Comprehensive, Health AdvantEdge, Bajaj My Health Care/Health Guard, ProHealth Prime, Optima Restore.
3. **Legacy/PSU mediclaim and standard products**: room rent capped at 1% of SI/day (ICU 2%) with sub-limits and proportionate deductions — New India Floater Mediclaim, Arogya Sanjeevani (mandatory for every insurer).
4. **Senior plans**: 20–30% mandatory co-pay, disease sub-limits, sometimes shorter PED wait (Star Red Carpet: 12 months).
5. **Top-ups and super top-ups**: deductible per hospitalisation (top-up) or on the year's total (super top-up).
6. **Fixed-benefit plans** (critical illness, cancer, cardiac, hospital cash): lump sum on diagnosis regardless of other cover.

### 3.2 Table B1 — Flagship product detail

**Schema:** `product_id`, `insurer_id`, `product_name`, `variant`, `product_type (enum)`, `uin (string|null)`, `si_min / si_max (₹; "unlimited" allowed)`, `room_rent_rule (enum: NO_CAP | SINGLE_PVT_AC | ANY_EXCEPT_SUITE | PCT_SI | CATEGORY)`, `room_rent_value`, `copay_rule`, `ped_wait_months (int)`, `specific_wait_months (int)`, `restoration`, `bonus_pct_per_year / bonus_max_pct`, `pre_days / post_days (int)`, `consumables (enum: BUILT_IN | ADDON | NO)`, `maternity (string)`, `indicative_premium (string, profile stated)`, `sources`.

| Insurer | Product (variant) | UIN (latest found) | SI range | Room rent | Co-pay | PED wait | Specific-disease wait | Restoration | Bonus (per yr / max) | Pre/Post days | Consumables | Maternity | Indicative premium | Source |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| HDFC ERGO | my:Optima Secure | Not found | ₹5L–2Cr | No cap | None | 3 yrs | Not found | Automatic 100% restore of base SI; Unlimited Restore add-on | Secure Benefit gives 2× cover from day 1; Plus Benefit adds +50% after yr 1 and +100% after yr 2, claims or not | Not found | Built-in (Protect Benefit) | Not in base (Parenthood add-on on Secure+) | ~₹11,000–13,800 (₹10L, aggregator examples) | HDFC ERGO; Ditto; Policybazaar |
| HDFC ERGO | Optima Secure+ | Not found | Not found | Actuals (any room) | None; no geography-based co-pay | Not found | Not found | Unlimited automatic restore, built-in | Secure 2× + "Infinite Benefit": +100% of base SI every year, no cap | Extended | Built-in | Parenthood add-on | ₹22,616 (2-member floater, ages 35/30, ₹10L, with discounts) | HDFC ERGO; thodu.in |
| HDFC ERGO | Optima Restore | Not found | ₹3L–50L | No cap (Beshak) | Not found | Not found | Not found | 100% restoration on partial exhaustion | Not found | Not found | Covered (Beshak) | Not found | Not found | Onsurity; Beshak |
| Care Health | Care Supreme | CHIHLIP27061V032627 | ₹5L–1Cr | No cap | None | 3 yrs (reducible by add-on to 1–2) | 2 yrs | Unlimited automatic recharge, same or different illness | 50% guaranteed / 100%; Cumulative Bonus Super add-on 100% / 500% | 60/180 | Add-on (Claim Shield) | Not available | ₹15,111 (age 25, ₹15L, Delhi, 5 add-ons) | Ditto; Care brochure/wording |
| Niva Bupa | ReAssure 2.0 (Bronze+/Platinum+/Titanium+) | Not found | ₹5L–1Cr | No cap | None | 3 yrs (one source: 48 m for Bronze+) | 2 yrs | "ReAssure Forever": unlimited, any illness, any member | Booster+ carries forward unused SI up to 3×/5×/10× by variant | 60/180 | Add-on (Safeguard+) | Not available | ₹12,601 (Titanium+, age 25, ₹15L, Delhi) | Ditto; Beshak |
| Niva Bupa | ReAssure 3.0 (Classic/Select/Elite/Black) | NBHHLIP26047V012526 | ₹5L, ₹10L, Unlimited | Classic: general ward; Select: twin sharing; Elite: all except deluxe/suite; Black: any | Room-category co-pay if you upgrade (Classic/Select/Elite); voluntary 10–50% | 3 yrs (reducible; day-1 PED add-on) | 2 yrs (reducible to 1) | Unlimited, lifelong, after first paid claim (not on Unlimited SI) | Booster+ up to 10× base | 60/180 | Add-on (Black may include it) | Not found | ₹9,262–14,250 (Unlimited SI, age 25, with add-ons) | Ditto; Niva prospectus |
| Aditya Birla Health | Activ One MAX (NXT) | ADIHLIP24097V012324 | ₹5L–2Cr | No cap | None | 3 yrs (Chronic Care add-on: day 1 for 7 conditions) | 2 yrs | Super Reload: unlimited from 2nd claim (NXT: from day 1) | Super Credit +100%/yr regardless of claims, max 500% (cap ₹3Cr); NXT: add-on | 90/180 | Built-in on MAX; add-on on NXT | VIP variants only (₹1L after 2 yrs) | ₹10,149 (age 25, ₹15L, Delhi) | Ditto; Beshak |
| ICICI Lombard | Elevate | ICIHLIP27057V062627 | ₹5L–Unlimited | Single private AC (Room Modifier add-on: any room) | None | 3 yrs (reducible; Jumpstart gives chronic conditions from day 31) | 2 yrs (diabetes, hypertension, cardiac: 90 days) | "Reset" 100% unlimited (not for first claim) | Loyalty 20%, max 100%; Power Booster add-on +100%, no cap | 90/180 | Add-on (Claim Protector) | Add-on, 2-yr wait | ₹12,400 (age 25, ₹15L, Delhi, add-ons) | Ditto; ICICI |
| Star Health | Star Health Assure | SHAHLIP26048V032526 | ₹5L–2Cr | 1% of SI/day at ₹5L; any room except suite at ₹10–25L; no limit from ₹50L | 10% if entry age ≥61 | 36 m (30 m on a 3-yr term) | 24 m | Unlimited 100%, same or different illness | 25% / 100% | 60/180 | Built-in | Delivery up to 10% of SI after 24 m; newborn from day 1 | ₹11,714 (age 25, ₹15L, Delhi) | Ditto; Star prospectus |
| Star Health | Star Comprehensive | SHAHLIP22028V072122 (may be outdated) | Up to ₹1Cr | Single private AC | Not found | 36 m (buy-back add-on: 12) | 24 m | Automatic, related and unrelated illness | 50% (₹5L) or 100% (₹7.5L+) / 100% | Not found | Not found | Delivery + newborn after 24 m; limits vary by SI | Not found | Star brochure |
| Star Health | Senior Citizens Red Carpet | SHAHLIP26041V082526 | ₹1L–25L | Not found | 30% on all claims | 12 m | Not found | Not found | No NCB | 30/60 | Not found | Not covered | Not found | Star Health; Policybazaar |
| Bajaj General | My Health Care | Not found | ₹3L–5Cr | Single private AC (₹3–10L); actuals above ₹10L | Not found | 3 yrs | 2 yrs | Unlimited reinstatement | 50% (₹5L+) or 25% / 100%; reduces on claim | Not found | Not found | Built-in, 3-yr wait | Not found | Bajaj wording; Policybazaar |
| Bajaj General | Health Guard (Silver/Gold/Platinum) | BAJHLIP25035V072425 | ₹1.5L–50L | Silver: 1% of SI; Gold/Platinum: single private AC up to ₹7.5L, any room ₹10L+ | 20% at entry age 61+ (weak source) | 36 m | 24–36 m | Yes (once-in-lifetime for cancer/dialysis per Beshak) | Silver/Gold 10% / 100%; Platinum 50% / 150% | Not found | Not found | Gold/Platinum only, 72-month wait | Not found | Bajaj brochure; Beshak |
| Tata AIG | MediCare Premier | TATHLIP26052V052526 | ₹5L–3Cr | No cap | Not found | 24 m | 24 m (one source: 36) | Restores once a year after SI + bonus exhausted | 50% / 100%; reduces 50% on claim | 60/90 (post 200 days above ₹50L) | Specified consumables covered | ₹50k (₹60k for a girl child); 48-m wait | Not found | Tata AIG wording |
| SBI General | Super Health (Prime/Elite/Premier/Platinum/Platinum Infinite) | SBIHLIP23050V012223 | ₹3L–2Cr by variant | Actuals | None (voluntary 10/20%) | 24 m | 24 m | Unlimited ReInsure, same illness included | 50% / 100% (reduces unless Safeguard add-on) | 60/90 | Claims Shield | Premier/Platinum: ₹25k normal / ₹50k C-section | ₹15,039 (Premier ₹10L, age 25) | Ditto; SBI brochure |
| ManipalCigna | Sarvah Param (Pratham/Uttam) | MCIHLIP27040V032627 (launched 15 May 2026) | ₹5L–3Cr | Single private AC (modifier add-on) | 0% (voluntary 10–30%) | 0 on Param "Tatkal" (underwriting may impose up to 36 m); Pratham/Uttam 36 m | 0 (optional 24 m for a discount) | Unlimited in-year, not on first claim | "Gullak" 100% guaranteed / 1,500% (older wording 1,000%) | 90/180 | Add-on | Add-on in Uttam/Param, 36-m wait | Not found | ManipalCigna T&C; Ditto |
| ManipalCigna | ProHealth Prime (Protect/Advantage/Active) | Active: MCIHLIP22224V012122 | ₹7.5L–1Cr (Protect) | Single private AC; any-room add-on | Not found | 36 m (SI ≤₹5L) / 24 m (≥₹7.5L) | 24 m | 100% after partial exhaustion | 25% / 200% (Protect/Advantage); Active 10% / 100% | Not found | Not found | Protect/Advantage only | Not found | ManipalCigna wording |
| New India Assurance | Floater Mediclaim | NIAHLIP25039V082425 (1-yr) / NIAHLIP25009V072425 (long-term) | Not found | 1% of SI/day; ICU 2%; proportionate deduction | Proportionate deduction | 48 m (customer information sheet) vs 36 m (Ditto) | 90 days (diabetes, BP, cardiac); 24 m; 36 m (joints, mental illness) | Not found | 25% / 50%; reduces on claim | Not found | Not found | Not found | Not found | New India CIS |
| All insurers (standard) | Arogya Sanjeevani | Different for each insurer | ₹50k–10L (varies) | 2% of SI, max ₹5,000/day; ICU 5%, max ₹10,000 | 5% on all claims | 36 m | 24 m | None | 5% / 50% | 30/60 | Not found | Not covered | Not found | New India, IFFCO, ManipalCigna pages |

### 3.3 Table B2 — Broader product inventory (`data_status = partial`)

Names from comparison sites and insurer pages (Beshak, Ditto, PolicyX, Policybazaar, Coverfox, Onsurity), current in 2025–2026. Fill remaining fields from each insurer's brochure, prospectus and policy wording, keyed by UIN.

| Insurer | Product | Type | Known features (source) |
|---|---|---|---|
| Niva Bupa | Aspire (Titanium+) | Individual/floater | No room-rent limit; all day-care; premium fixed until a claim (Beshak); newborn cover (Ditto) |
| Niva Bupa | Health Companion | Individual/floater | No room-rent limit; health check-up from day 1 (Beshak) |
| Niva Bupa | Health Recharge | Super top-up | SI ₹3L–1Cr; deductible ₹10k–10L; deductible waiver after 5 yrs |
| Niva Bupa | CritiCare | Critical illness (fixed) | 20 illnesses; ₹3L–2Cr; entry 18–65; 90-day wait; 30-day survival |
| Care Health | Care Supreme Enhance | Super top-up | SI ₹45L–95L; aggregate deductible ₹5–15L; unlimited restoration; +10% bonus/yr up to 100% |
| Care Health | Care (classic) | Individual/floater | Single private AC room; 541 day-care procedures; consumables (Beshak) |
| Care Health | Care Freedom | Diabetes/PED plan | Twin-sharing room (Beshak) |
| Care Health | Care Senior / Senior Health Advantage | Senior | 20% co-pay; sub-limits for cataract, knee, hernia, hysterectomy, BPH, kidney stones, cancer, heart, stroke; 30/60 days; no upper entry age (Forbes) |
| Care Health | Care Supreme Senior | Senior | Entry 61+; ₹5–25L; 36-m PED; 20% co-pay (secondary) |
| Care Health | Care Critical Mediclaim; Care Heart | Critical illness / cardiac | 32 illnesses; ₹10L–2Cr; 90-day wait (PolicyX) |
| Aditya Birla Health | Activ Health Platinum (Enhanced / Premier) | Individual/floater | No room-rent limit; 586 day-care procedures; Premier covers some PED management costs from day 1 |
| Aditya Birla Health | Activ Assure Diamond | Individual/floater | No room-rent limit; 586 day-care; consumables |
| Aditya Birla Health | Activ Fit (Plus / Preferred) | Young/fitness plan | No room-rent limit; consumables |
| HDFC ERGO | my:Health Medisure Super Top-up | Super top-up | SI ₹5–20/25L; deductible ₹2–5L; no room-rent cap |
| HDFC ERGO | Critical Illness (Silver/Platinum) | Critical illness | Up to 15 illnesses; up to ₹50L; entry 5–65 |
| ICICI Lombard | Activate Booster | Super top-up | SI ₹10L–3Cr; deductible ₹3–20L; deductible waiver after 5 yrs |
| ICICI Lombard | Health Booster | Super top-up | SI up to ₹50L; deductible ₹1–5L; restoration |
| ICICI Lombard | Critical Care | Fixed benefit | 9 critical illnesses + accidental death/permanent total disability |
| ICICI Lombard | Health AdvantEdge (Apex Plus) | Individual/floater | No room-type limit, no disease sub-limits; bariatric capped at 50% of SI/₹10L; weak NCB/restore (Mint-Beshak, Jan 2024) |
| Star Health | Super Star | Individual/floater | No room limit; no co-pay; unlimited restoration; 100% bonus if claim-free (Beshak) |
| Star Health | Family Health Optima | Floater | Any room except suite; consumables (Beshak) |
| Star Health | Women Care | Women-specific | Any room except suite; spouse can be added mid-term |
| Star Health | Critical Illness Multipay | Critical illness | 37 illnesses |
| Star Health | Cardiac Care | Disease-specific | Up to ₹4L; entry 10–65 |
| Bajaj General | Criti Care | Critical illness | 43 illnesses, all-stage cancer |
| Tata AIG | MediCare | Indemnity | No room-rent limit, 541 day-care, consumables (Beshak) |
| IndusInd General | Health Gain (Power); Health Infinity | Individual/floater | No room-rent limit; reduced PED (Gain Power); consumables (Infinity) |
| Royal Sundaram | Lifeline (Supreme); Multiplier | Individual/floater | No room-rent limit; all day-care; organ donor |
| ManipalCigna | ProHealth (Plus/Accumulate/Protect) | Individual/floater | Any room except suite; 546 day-care; NCB up to 200% |
| SBI General | Critical Illness | Critical illness | 13 illnesses, up to ₹10L |

**Found by name only (`data_status = name_only`):** HDFC ERGO Optima Super Secure (3× cover from day 1), my:Health Suraksha, Optima Secure Global; Niva Bupa Senior First; Aditya Birla Super Health Plus, Activ Care, Activ Secure (Critical Illness/Cancer Secure); Star Super Surplus, Young Star, Medi Classic, Cancer Care, Star Group Health, Group Arogya Sanjeevani; Bajaj Extra Care Plus, Silver Health; Tata AIG MediCare Plus (super top-up), Critical Illness; ManipalCigna Super Top-up, Lifestyle Protection; SBI Health Super Top-up; Acko Platinum Health; Digit health plans; Generali Central FG Health Absolute; New India Senior Citizen Mediclaim, Asha Kiran, Cancer Guard, Premier Mediclaim; Oriental Happy Family Floater (Silver/Gold); United India Family Medicare; National Insurance Parivar Mediclaim / National Mediclaim Plus; Galaxy Health retail plans; Narayana Health Aditi (closed network of ~20 Narayana hospitals).

**Ratings snapshot (independent reviewers, 2026):** Ditto — Optima Secure+ 4.6/5, Care Supreme 4.5, Activ One MAX 4.4. Mint–Beshak — Activ One NXT 4.85, Optima Secure+ 4.78, ManipalCigna Sarvah (Param) 4.75. Care Supreme is marked down across reviewers for Care's complaint volume (42 per 10,000 claims).

---

## 4. Part 3 — Scenario Analysis

### 4.1 How features change payouts (worked example)

Take a ₹3 lakh bill where the room costs ₹8,000 a day. Under a 1%-of-sum-insured cap on a ₹5L policy (₹5,000 a day), the eligible share is 5,000 ÷ 8,000 = 62.5%. **Proportionate deduction** then applies that 62.5% to every room-linked charge (doctor fees, nursing, OT, many investigations), so the payout can fall to about ₹1.9–2.1 lakh. Medicines and implants are usually excluded from the proportionate cut. Add 8–10% of non-payable consumables and a 20% senior co-pay, and the patient could pay 40–50% of the bill. The same bill on a no-cap plan with consumables cover is paid almost in full.

### 4.2 Table C — Scenarios × feature relevance

Scale: 3 = decisive, 2 = material, 1 = minor, 0 = irrelevant.
**Schema:** `scenario_id`, `scenario_name`, one int column per feature, `csr_weight (float 0–1)`, `notes`.

| ID | Scenario | Room-rent / proportionate | Co-pay | Disease sub-limit | Initial / specific wait | PED wait / moratorium | Restoration | Consumables | Cashless network | Pre/post days | Maternity | CSR / complaint weight | Key rule for the app |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| S1 | Planned knee replacement / cataract | 3 | 2 | 3 | 3 (joint replacement often 24–36 m) | 2 | 1 | 3 (implants, consumables) | 2 | 2 | 0 | 0.5 | Check the 2–3-yr specific-disease wait and cataract caps (senior and PSU plans); group policy often best (day-1 cover) |
| S2 | Accident / fracture emergency | 2 | 1 | 1 | 0 (accidents exempt from 30-day wait) | 0 | 1 | 3 (plates, consumables) | 3 | 2 | 0 | 0.6 | Cashless at nearest hospital; Cashless Everywhere request if non-network; ambulance cover |
| S3 | Dengue/typhoid, 3–5 days | 2 | 2 | 0 | 2 (inside first 30 days = rejected) | 0 | 0 | 2 | 2 | 2 | 0 | 0.7 | Small claims: use the policy with no NCB loss (group); common "medical necessity" dispute area |
| S4 | Cardiac event / angioplasty | 3 | 2 | 2 (senior plans cap heart conditions) | 1 | 3 if hypertension/cardiac history | 2 | 3 (stents are consumables) | 3 | 2 | 0 | 0.8 | Large claim: stack group → individual → top-up; check heart sub-limits in senior plans |
| S5 | Cancer, chemo day-care | 1 | 2 | 2 (senior caps; modern-treatment caps) | 1 | 2 | 3 (repeat cycles exhaust SI) | 2 | 2 | 3 (180 days post) | 0 | 0.8 | Claim critical illness lump sum in parallel; unlimited restoration valuable; modern treatments (immunotherapy) sometimes capped |
| S6 | Maternity + newborn | 2 | 1 | 3 (₹25k–60k caps typical) | 3 (24–72 m wait) | 0 | 0 | 1 | 2 | 2 | 3 | 0.4 | Group policy usually the only practical maternity cover; newborn day-1 cover varies |
| S7 | PED (diabetes/hypertension) admission | 1 | 2 | 1 | 1 | 3 | 1 | 1 | 2 | 1 | 0 | 0.9 | Inside the PED wait, only the group policy (usually PED from day 1) or a day-1 PED add-on pays; after 60 m, non-disclosure cannot be contested |
| S8 | Pandemic / mental-health admission | 2 | 1 | 1 | 2 (some plans 36 m for mental illness) | 1 | 2 | 3 (PPE kits in COVID) | 2 | 2 | 0 | 0.7 | Mental illness must be covered like physical illness (IRDAI); check the specific wait |
| S9 | Metro Tier-1 vs Tier-2 | 3 | 3 (zone co-pay if treated in a higher zone) | 1 | 0 | 0 | 1 | 1 | 2 | 0 | 0 | 0.5 | Zone-based pricing plans charge co-pay when a lower-zone policyholder is treated in a metro |
| S10 | Treatment abroad | 0 | 1 | 2 | 1 | 1 | 1 | 1 | 3 (reimbursement mostly) | 1 | 0 | 0.6 | Only global variants (e.g., Optima Secure Global) or international add-ons; most policies exclude it |
| S11 | Claim above one policy's SI | 2 | 2 | 2 | 1 | 1 | 3 | 2 | 1 | 1 | 0 | 0.8 | Balance claimed under other policies with settlement letter + attested copies; super top-up once the deductible is used up |

### 4.3 Large claims

In S4/S5 (large claims), restoration and the sum insured available for the rest of the year matter most. If the group cover is ₹5L and the bill is ₹9L, the group pays ₹5L and the individual policy pays ₹4L on the settlement letter. The parents' floater stays untouched, so their sum insured is preserved for the parents.

---

## 5. Part 4 — Multiple-Policy Claim Logic

### 5.1 Regulatory rules (IRDAI Master Circular on Health Insurance Business, 29 May 2024, and the standard multiple-policies clause in policy wordings)

1. **Fixed-benefit policies** (critical illness, hospital cash, personal accident lump sums) are each paid out separately, whatever the other policies pay. Contribution does not apply to benefits that are fixed or unrelated to treatment cost.
2. **Indemnity policies:**
   - The policyholder may choose any one of their policies to settle a claim, up to that policy's sum insured, under that policy's own terms.
   - If the claim exceeds one policy's sum insured, they may choose which other insurer(s) pay the balance.
   - They may also claim amounts disallowed under the first policy (co-pay, a sub-limit, a room-rent deduction) from another policy, even if the first policy's sum insured was not used up. The second insurer applies its own terms.
   - The total paid can never exceed the actual expenses.
3. **Coordination:** where the chosen policy's cover is less than the admissible claim, the primary insurer must coordinate with the other insurers to settle the balance "without causing any hassles to the policyholder" (Master Circular). In practice, the second claim is filed as reimbursement: attested copies of bills and discharge summary plus the first insurer's settlement letter. The first insurer keeps the originals.
4. **Contribution clause:** some wordings still let an insurer apportion a claim rateably between policies. The policyholder's right to choose (point 2) overrides this for most retail claims. Show it in the app as "possible if the policyholder doesn't choose; verify the wording". Do not assume a rateable split.
5. **Cashless with two insurers:** normally one insurer authorises cashless and the balance is reimbursed by the second. Some hospitals/TPAs can run a second pre-authorisation for the balance. Treat that as a possibility to try, not something to count on.
6. **Top-up / super top-up deductible:** a super top-up pays once the year's admissible claims pass the deductible, whichever policy (or out-of-pocket spending) covered them. A top-up applies the deductible to each hospitalisation. Check the wording: some super top-ups count only amounts paid by an insurer or require the claim to be admissible under their own terms.
7. **Time-bound service:**
   - 1-hour cashless decision, 3-hour discharge authorisation.
   - Settlement within 30 days of the last document, with interest at 2% above the bank rate for delays (as reported).
   - No repudiation without Claims Review Committee approval.
   - Ombudsman awards to be implemented within 30 days.

### 5.2 Policy-by-policy trade-offs

| Policy | Pros of claiming first | Cons / risks | When to skip it |
|---|---|---|---|
| Employer group | Usually PED covered from day 1, no waiting periods, maternity often included, no personal NCB to lose, claims don't affect retail renewal premium | Often has room-rent caps (1–2% of SI), family-wide SI, parental co-pays; cover ends on job change (conversion/porting terms vary); a heavy claim year can push up the employer's renewal and lead to tighter terms | When its room cap or sub-limits cause a big proportionate deduction, or the hospital isn't in its TPA network |
| Own individual | Terms you control: no cap, no co-pay, restoration | Claiming may cut the bonus (plans where bonus reduces on a claim) or trigger reset; waiting periods may not be served | When a claim-reducing bonus is large and group cover is enough; or inside a waiting period |
| Parents' floater (user is a member) | Extra cover | Uses up SI shared with parents (highest-risk members); claim-linked NCB loss hits the whole family; senior co-pays/sub-limits may apply | Use last, only for balances, unless it is the only policy that covers the event |

**Bonuses guaranteed regardless of claims** (Care Supreme's 50%, Activ One MAX's Super Credit, Optima Secure+'s Infinite Benefit, Sarvah's Gullak) weaken the "preserve my NCB" argument. The app must check whether a product's bonus reduces on a claim before penalising use of that product.

### 5.3 Scoring and allocation algorithm

For each claim scenario *s* and each eligible policy *p*:

1. **Eligibility:** reject *p* if the claim falls inside the initial wait, the specific-disease wait or the PED wait, falls under a permanent exclusion, or treatment is abroad without an international benefit.
2. **Expected payout:**
   `payout_p = min(available_SI_p, Σ_items admissible_i × proportionate_factor_p × (1 − copay_p) − sublimit_cut_p − nonpayables_p) − deductible_p`
   where `proportionate_factor_p = min(1, room_cap_p / actual_room_rate)`, applied only to room-linked items.
3. **Settlement confidence:**
   `conf_p = w1·CSR_3yr + w2·(1 − repudiation) + w3·(1 − normalised complaints/10k) + w4·cashless_available`
   Starting weights: w1 = 0.4, w2 = 0.3, w3 = 0.2, w4 = 0.1. Scale the CSR/complaint weight by the scenario's `csr_weight` from Table C.
4. **Future cost:**
   `cost_p = NCB_loss_value + value_of_SI_consumed_for_other_members (floater) + group-renewal externality`
   Put a rupee value on NCB as the extra cover lost × the chance it will be needed.
5. **Rank:** `score_p = payout_p × conf_p − λ·cost_p`. Pick the top policy as primary. Then **cascade** the remaining unpaid amount (disallowed portion or excess over SI) to the next-best eligible policy, recalculating with that policy's own terms. Super top-ups join once the cumulative deductible is used up. Fixed-benefit policies are always added in parallel.
6. **Explain the result:** e.g. "Group pays ₹4.1L (room cap costs you ₹38k); your ReAssure pays the ₹38k + ₹1.2L balance; parents' floater untouched."

### 5.4 Regulatory changes to encode (status as of September 2026)

| Change | Effective | Status | Source quality |
|---|---|---|---|
| Master Circular on Health Insurance Business (1-hr cashless, 3-hr discharge, 100% cashless target, multiple-policy coordination, CRC approval for repudiation) | 29 May 2024; systems by 31 Jul 2024 | In force | IRDAI PDF Ref: IRDAI/HLT/CIR/PRO/84/5/2024 (secondary sources citing /77/05/2024 or /76/5/2024 are wrong) |
| Moratorium reduced to 60 months | 2024 regulations | In force | Multiple |
| Maximum PED wait 36 months; age-65 entry cap removed | April 2024 | In force | Multiple |
| Senior premium hikes on indemnity-based individual products (age 60+) capped at 10%/yr without prior consultation with IRDAI | 30 Jan 2025 | In force | IRDAI/HLT/CIR/MISC/27/1/2025 |
| Cashless Everywhere (General Insurance Council) | Jan 2024 | Live; non-network hospitals may refuse | Multiple |
| NHCX (NHA + IRDAI, on ABDM, FHIR-based) | Live June 2024 | Onboarding uneven; a vendor reports 12,600+ hospitals as of May 2026 (unverified) | Mixed |
| Insurer/hospital public scorecards; basic no-frills health product | Targeted June 2026 | Planned; publication not confirmed | News reports (ETHealthworld via Ditto, Angel One) |
| Show-cause process against 8 insurers over health-portfolio lapses (Niva Bupa, Star Health, Care Health, ManipalCigna, New India, Tata AIG, ICICI Lombard, HDFC ERGO): over-detailed Customer Information Sheet, Product Management Committee members on Claims Review Committees, portability-data timelines | July 2025 | Outcome not confirmed | CNBC-TV18, 11 July 2025 (via CA Alley/Angel One) |

---

## 6. Part 5 — Data Sources and Refresh Pipeline

| Source | Content | Format | Refresh |
|---|---|---|---|
| IRDAI Annual Report (irdai.gov.in → Annual Reports) | Company-wise ICR, aggregate claims, repudiation, cashless share, grievances | PDF (extract tables) | Yearly (~December for prior FY) |
| Insurer public disclosures (NL-37 claims, NL-45 grievances, NL-4 premium, NL-34 solvency) | CSR inputs, ageing buckets, complaints | PDF/Excel on each insurer's site, quarterly | Quarterly; Q4 = full year |
| IBAI General Insurance Claim Insights handbook | CSR, settlement within 3 months, repudiation, pendency, outstanding by insurer | PDF (annual; latest editions cover FY24) | Yearly |
| Insurer brochures, prospectus, policy wording, customer information sheet | Product features, UIN | PDF | On refiling (UIN version changes, e.g., V01→V03) |
| Ditto Data Lab, Beshak, Policybazaar, PolicyX, InsuranceDekho, Coverfox, ACKO | Pre-processed metrics, feature pages, ratings | HTML | Frequent; cross-check against primary sources |
| NHCX (NHA) | Claims exchange; FHIR claim/pre-auth profiles | API for registered payers/providers only | Not a public consumer data API |

No public, consumer-facing API exposes product features or insurer CSR. NHCX serves hospitals, insurers and TPAs; ABDM/ABHA handles health records under consent. Practical pipeline: (1) parse NL-37 and NL-45 PDFs every quarter; (2) parse the IRDAI Annual Report yearly; (3) track product changes by UIN and re-parse wordings when a new version appears; (4) let users upload their own policy schedule and wording (source of truth for their sum insured, members, co-pays and endorsements).

### 6.1 JSON schemas

```json
{
  "Policy": {
    "policy_id": "string",
    "holder_relationship": "enum[self, employer_group, parents_floater, spouse, other]",
    "insurer_id": "string (FK Table A)",
    "product_id": "string|null (FK Table B)",
    "uin": "string|null",
    "policy_type": "enum[individual, family_floater, multi_individual, group, senior, top_up, super_top_up, critical_illness, hospital_cash, personal_accident]",
    "indemnity": "boolean",
    "members": [{"name": "string", "dob": "date"}],
    "sum_insured": "number|\"unlimited\"",
    "bonus_accrued": "number",
    "bonus_rule": {"pct_per_year": "number", "max_pct": "number", "reduces_on_claim": "boolean"},
    "restoration": {"type": "enum[none, once, unlimited]", "same_illness": "boolean", "first_claim_eligible": "boolean"},
    "si_used_this_year": "number",
    "deductible": {"amount": "number", "type": "enum[none, per_claim, aggregate]"},
    "room_rent": {"rule": "enum[no_cap, single_pvt_ac, any_except_suite, pct_si_per_day, fixed_amount, category]", "value": "number|null", "icu_value": "number|null", "proportionate_deduction": "boolean"},
    "copay": [{"trigger": "enum[all_claims, age_at_entry, zone, non_network, room_upgrade, voluntary]", "pct": "number"}],
    "waiting_periods": {"initial_days": "int", "specific_months": "int", "ped_months": "int", "maternity_months": "int|null", "continuity_start": "date"},
    "sublimits": [{"procedure": "string", "cap_amount": "number|null", "cap_pct_si": "number|null"}],
    "pre_post_days": {"pre": "int", "post": "int"},
    "consumables_covered": "boolean",
    "maternity": {"covered": "boolean", "limit_normal": "number|null", "limit_csection": "number|null", "newborn_day1": "boolean"},
    "international_cover": "boolean",
    "fixed_benefits": [{"event": "string", "amount": "number", "survival_days": "int|null"}],
    "renewal_date": "date",
    "data_status": "enum[user_verified, parsed_from_wording, aggregator, name_only]"
  },
  "ClaimScenario": {
    "scenario_id": "string",
    "claimant": "string",
    "category": "enum[S1..S11]",
    "is_ped": "boolean",
    "is_accident": "boolean",
    "admission_date": "date",
    "hospital": {"id": "string|null", "city_tier": "enum[metro, tier2, tier3]", "in_network_by_insurer": {"insurer_id": "boolean"}, "abroad": "boolean"},
    "room_rate_per_day": "number",
    "bill_items": [{"head": "enum[room, icu, doctor, ot, investigations, medicines, implants, consumables, other]", "amount": "number", "room_linked": "boolean"}],
    "pre_hosp_amount": "number",
    "post_hosp_amount": "number",
    "output": {
      "allocation": [{"policy_id": "string", "payout": "number", "mode": "enum[cashless, reimbursement]", "deductions": [{"reason": "string", "amount": "number"}], "confidence": "number"}],
      "out_of_pocket": "number",
      "explanation": "string"
    }
  }
}
```

---

## 7. Product Recommendations

1. **Never show "product CSR".** Label it "Insurer claim record (FY24–26 avg, NL-37)" and show CSR, complaints per 10,000 claims and ICR side by side. Use the 3-year average; mark new insurers (Galaxy, Narayana) as "insufficient history".
2. **Build the payout engine first.** Room-rent proportionate deduction, co-pay, sub-limits, waiting periods and consumables explain most of the gap between amount claimed and amount paid (71% paid by value vs 82–87% of claims settled by number).
3. **Default claim order:** group → own individual → parents' floater (balance only) → super top-up (once deductible used) with fixed-benefit plans in parallel. Recalculate when a waiting period, cap or network gap makes a later policy better.
4. **Make users upload their policy schedule and wording.** Group policies vary by employer and aren't in any public dataset.

---

## 8. Caveats and Data Limitations

- **Published per insurer only:** CSR, ICR, repudiation, pendency, complaints, solvency. Nothing per product. Group, retail and government-scheme claims are blended per insurer; general insurers' disclosures can mix health with personal accident and travel.
- **Definition conflicts:** headline CSRs of 99–100% cited by some aggregators don't match the NL-37-based series. Solvency figures differ by date. Public-sector ICR is 97.30% or 99.84% depending on the base.
- **Not found:** insurer-wise average turnaround time, insurer-wise cashless share, the latest IBAI edition's insurer-level health tables (only secondary FY23/FY24 extracts), audited solvency for every insurer, full feature sets for PSU and smaller private-insurer products, standardised indicative premiums for a 30-year-old with ₹10L cover (aggregator premiums are mostly age 25, ₹15L, Delhi, with add-ons).
- **Product terms change often:** UINs are refiled (Care, ICICI, Star, Tata AIG, ManipalCigna all refiled recently); figures such as Sarvah's bonus cap changed between wordings. Treat Table B values as a snapshot dated September 2026.
- **Reported but unconfirmed:** 2026 scorecards, NHCX onboarding counts (vendor claim), outcomes of the reported show-cause actions. Insurer-sponsored blogs sometimes describe 2024 changes as "2026 rules"; cite the circular itself.
- This is research for building a product, not personal insurance advice. The policy wording always overrides the summarised fields.

---

## Appendix — Source URLs (for the refresh pipeline)

**Regulatory / primary**
- IRDAI Annual Report 2024-25 (PDF mirror): https://lifeinscouncil.org/component/IRDAI%20Annual%20Report%202024-25.pdf
- IBAI Insurance Claim Insights Handbook, 6th edition: https://insuropedia.securenow.in/wp-content/uploads/2022/08/IBAI-Claims-Handbook-Sixth-Edition_2022_Final.pdf
- Master Circular on Health Insurance Business — summary: https://valueadded.in/2024/05/31/master-circular-on-health-insurance-business/
- 1-hour / 3-hour cashless timelines explained: https://www.oquilia.com/news/health-insurance-cashless-tat-3-hour-discharge-2024 · https://patientsquare.com/in/blog/irdai-cashless-rules-doctors/
- IRDAI rules overview (Acko): https://www.acko.com/health-insurance/irda-rules-for-health-insurance/
- 30-day settlement rule: https://righttoinformation.wiki/health-insurance-claim-delay-rights-india
- Multiple-policies clause samples: https://www.lawinsider.com/clause/multiple-policies · https://www.canarahsbclife.com/blog/health-plan/can-a-person-get-more-than-one-health-insurance-policy
- NHCX explainer: https://caladriushealth.ai/what-is-nhcx/ · https://taxguru.in/corporate-law/irdai-health-insurance-panel-pushes-simpler-policies-faster-claims-nhcx-adoption.html
- Scorecards plan: https://joinditto.in/articles/news/irdai-plans-standard-health-policies-and-insurer-hospital-scorecards/ · https://www.angelone.in/news/market-updates/irdai-plans-health-insurance-scorecards-for-insurers-and-hospitals-from-june-to-improve-transparency
- Cashless Everywhere in practice: https://swipeloan.in/irdais-cashless-insurance-rules-in-2026-what-happens-when-the-hospital-still-says-no/

**Insurer metrics (aggregators / news)**
- Ditto Data Lab (NL-37/NL-45 compilation): https://joinditto.in/health-insurance/data-lab/
- Ditto CSR ranking: https://joinditto.in/health-insurance/top-10-claim-settlement-ratio-health-insurance-companies/
- PolicyX CSR: https://www.policyx.com/health-insurance/articles/claim-settlement-ratio/
- Plum CSR rankings: https://www.plumhq.com/blog/claim-settlement-ratio-corporate-health-insurance
- Onsurity group-insurance statistics: https://www.onsurity.com/research/india-group-health-insurance-statistics
- IBAI FY24 repudiation (Outlook Money): https://www.outlookmoney.com/insurance/general-insurance/these-companies-rejected-the-lowest-number-of-general-insurance-claims-in-fy24-ibai-report
- Claims trends (Outlook Money): https://www.outlookmoney.com/insurance/health-insurance/health-insurance-decoding-recent-claims-ratio-and-settlement-trends
- Lok Sabha reply coverage: https://www.insurancebusinessmag.com/asia/news/life-insurance/irdai-cannot-explain-why-health-insurance-claims-go-unpaid-583814.aspx
- Amount-paid vs claimed (The South First): https://thesouthfirst.com/health/health-insurance-claims-standalone-insurers-pay-rs-3-07-per-rs-5-claim-general-insurers-offer-rs-4-17/
- IRDAI data analysis (CAalley): https://www.caalley.com/news-updates/indian-news/paying-claims-or-pushing-back-what-irdai-data-reveals-about-insurers
- Business Standard editorial: https://www.business-standard.com/opinion/editorial/high-claims-low-payouts-why-india-s-health-insurance-cover-isn-t-enough-125111901436_1.html

**Product documents (primary)**
- Care Supreme policy wording (CHIHLIP27061V032627): https://s3.ap-south-1.amazonaws.com/ditto-partners/Care_Supreme_Policy_Wording_dd859b2a9f.pdf
- Niva Bupa ReAssure 3.0 prospectus: https://transactions.nivabupa.com/pages/doc/prospectus/ReAssure30_Prospectus.pdf?v=1.2
- Star Health Assure prospectus: https://d28c6jni2fmamz.cloudfront.net/Prospectus_Star_Health_Assure_Insurance_Policy_V_3_9b8479dfdd.pdf
- Star Comprehensive brochure: https://d28c6jni2fmamz.cloudfront.net/Brochure_Star_Comprehensive_Insurance_Policy_V_15_Web_633bcfcaaf.pdf
- Bajaj Health Guard brochure (BAJHLIP25035V072425): https://www.bajajallianz.com/download-documents/health-insurance/health-guard-individual-policy/Health_Guard_Brochure.pdf
- Tata AIG MediCare Premier wording: https://www.tataaig.com/s3/Tata_AIG_Medi_Care_Premier_2f02f3813c.pdf
- SBI Super Health brochure: https://content.sbigeneral.in/uploads/8b12298872ba4bada50d1507a45f14fb.pdf
- ManipalCigna Sarvah Param T&C: https://www.manipalcigna.com/documents/20124/0/Sarvah-Param-TnC/19341cbc-41ae-b938-feac-cc7e373fbc0d
- ManipalCigna ProHealth Prime Active wording: https://ditto-partners.s3.ap-south-1.amazonaws.com/Manipal+Cigna/ProHealth+Prime+Active-Policy+Wording.pdf
- New India Floater Mediclaim CIS: https://www.newindia.co.in/assets/docs/know-more/health/floater-mediclaim-policy/CISNewIndiaFloaterMediclaimPolicy.pdf
- New India Arogya Sanjeevani: https://www.newindia.co.in/health-insurance/arogya-sanjeevani-policy
- HDFC ERGO Optima Secure+: https://www.hdfcergo.com/health-insurance/optima-secure-plus
- ICICI Lombard Elevate: https://www.icicilombard.com/health-insurance/elevate-health-policy

**Product reviews (feature cross-checks)**
- Ditto: Care Supreme · ReAssure 2.0 · ReAssure 3.0 · Activ One MAX · Elevate · Star Assure · SBI Super Health · Sarvah · Care Supreme Enhance · Critical illness guide · Super top-up premium chart — all under https://joinditto.in/articles/health-insurance/ and https://joinditto.in/health-insurance/
- Beshak best plans index: https://www.beshak.org/insurance/health-insurance/best-health-insurance-plans/
- Mint–Beshak ratings: https://www.beshak.org/insurance/health-insurance/mint-beshak-insurance-ratings/
- Beshak super top-up guide: https://www.beshak.org/insurance/health-insurance/super-top-up/
- Forbes Advisor India — senior plans: https://www.forbes.com/advisor/in/health-insurance/health-insurance-for-senior-citizens/
- PolicyX critical illness list: https://www.policyx.com/health-insurance/articles/list-of-critical-illnesses/
