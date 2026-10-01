import { DEFAULT_ORDER_RANK, DEFAULT_WEIGHTS, ENGINE_VERSION } from "./config.js";
import { computeConfidence } from "./confidence.js";
import { futureCost, isSharedFloater, ncbCoverLost, othersOnPolicy, type FutureCost } from "./cost.js";
import { checkEligibility, type RawReason } from "./eligibility.js";
import { explainPlan } from "./explain.js";
import { fixedBenefitPayouts } from "./fixed.js";
import { en, render, type Catalogue } from "./messages.en.js";
import { policyNames, yourName } from "./names.js";
import { availableSI, evaluatePolicy, isTopUp, remainingDeductible, type Evaluation, type WorkItem } from "./payout.js";
import {
  ClaimScenarioSchema,
  InsurerMetricsSchema,
  PolicySchema,
  type ClaimScenario,
  type InsurerMetrics,
  type Policy,
} from "./schemas.js";
import type {
  Allocation,
  ClaimPlan,
  Confidence,
  FixedBenefitPayout,
  Params,
  PolicyOutcome,
  Reason,
  Weights,
  WeightsInput,
} from "./types.js";

export interface AllocateOptions {
  catalogue?: Catalogue;
  /** validate inputs with the Zod schemas (default true) */
  validate?: boolean;
}

interface Candidate {
  p: Policy;
  conf: Confidence;
  tier: number;
  index: number;
  rank: number;
}

interface Step {
  c: Candidate;
  ev: Evaluation;
  recD: number;
  recB: number;
  cost: FutureCost;
}

interface Sim {
  steps: Step[];
  value: number;
  tiers: number[];
  indexes: number[];
  paying: number;
  paid: number;
  signature: string;
}

const EPS = 1;

export function buildWorkItems(s: ClaimScenario): WorkItem[] {
  const items: WorkItem[] = s.bill_items.map((b) => ({
    head: b.head,
    amount: b.amount,
    room_linked: b.room_linked,
    unpaid: b.amount,
  }));
  if (s.pre_hosp_amount > 0)
    items.push({ head: "pre_hosp", amount: s.pre_hosp_amount, room_linked: false, unpaid: s.pre_hosp_amount });
  if (s.post_hosp_amount > 0)
    items.push({ head: "post_hosp", amount: s.post_hosp_amount, room_linked: false, unpaid: s.post_hosp_amount });
  return items;
}

/** Default-order tier: group → own → spouse → other → parents' floater → top-up → super top-up. */
function orderTier(p: Policy): number {
  return p.policy_type === "super_top_up"
    ? 11
    : p.policy_type === "top_up"
      ? 10
      : DEFAULT_ORDER_RANK[p.holder_relationship]!;
}

function permutations<T>(list: T[]): T[][] {
  if (list.length <= 1) return [list.slice()];
  const out: T[][] = [];
  list.forEach((head, i) => {
    for (const rest of permutations([...list.slice(0, i), ...list.slice(i + 1)])) out.push([head, ...rest]);
  });
  return out;
}

function lexCmp(a: number[], b: number[]): number {
  for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) return a[i]! - b[i]!;
  return a.length - b.length;
}

/** Runs one cascade order: each policy is asked for what is still unpaid, on its own terms. */
function simulate(order: Candidate[], s: ClaimScenario, items: WorkItem[], w: Weights): Sim {
  const work = items.map((i) => ({ ...i }));
  let poolD = 0; // unpaid because an earlier policy's terms disallowed it
  let poolB = 0; // unpaid because it was above an earlier policy's SI
  let value = 0;
  const steps: Step[] = [];
  for (const c of order) {
    const ev = evaluatePolicy(c.p, s, work);
    ev.paid.forEach((amt, i) => {
      work[i]!.unpaid = Math.max(0, work[i]!.unpaid - amt);
    });
    const share = ev.presented > 0 ? ev.payout / ev.presented : 0;
    const recD = poolD * share;
    const recB = poolB * share;
    poolD -= recD;
    poolB -= recB;
    for (const d of ev.deductions) {
      if (d.code === "above_si") poolB += d.amount;
      else poolD += d.amount;
    }
    const cost = futureCost(c.p, ev.payout, s.claimant, w);
    value += ev.payout * c.conf.value - w.lambda * cost.total;
    steps.push({ c, ev, recD, recB, cost });
  }
  const paying = steps.filter((st) => st.ev.payout > 0);
  const idle = steps.filter((st) => st.ev.payout <= 0).sort((a, b) => a.c.rank - b.c.rank);
  const ordered = [...paying, ...idle];
  return {
    steps: ordered,
    value,
    tiers: ordered.map((st) => st.c.tier),
    indexes: ordered.map((st) => st.c.index),
    paying: paying.length,
    paid: paying.reduce((t, st) => t + st.ev.payout, 0),
    signature: paying.map((st) => `${st.c.p.policy_id}:${st.ev.payout}`).join("|"),
  };
}

type TieRule = "paid" | "tier" | "count" | "value" | "index";

/**
 * Between plans whose value is within the materiality tolerance: more rupees
 * paid first, then default order (employer before own before parents'
 * floater), then fewer claims, then higher value, then the order the policies
 * were added.
 */
function tieCompare(a: Sim, b: Sim): { cmp: number; by: TieRule } {
  if (Math.abs(a.paid - b.paid) > EPS) return { cmp: b.paid - a.paid, by: "paid" };
  const t = lexCmp(a.tiers, b.tiers);
  if (t !== 0) return { cmp: t, by: "tier" };
  if (a.paying !== b.paying) return { cmp: a.paying - b.paying, by: "count" };
  if (Math.abs(a.value - b.value) > EPS) return { cmp: b.value - a.value, by: "value" };
  return { cmp: lexCmp(a.indexes, b.indexes), by: "index" };
}

/** Plans within `tie_tolerance` of the best value are treated as equal (DECISIONS E5). */
function choose(sims: Sim[], tolerance: number): { best: Sim | null; window: Sim[] } {
  if (sims.length === 0) return { best: null, window: [] };
  const top = Math.max(...sims.map((x) => x.value));
  const floor = top - Math.max(EPS, tolerance * Math.abs(top));
  const window = sims.filter((x) => x.value >= floor);
  const best = window.reduce((a, b) => (tieCompare(b, a).cmp < 0 ? b : a));
  return { best, window };
}

/** All cascade orders to try: base policies in every order, then top-ups after them. */
function candidateOrders(cands: Candidate[], s: ClaimScenario, items: WorkItem[], w: Weights): Candidate[][] {
  const byRank = (a: Candidate, b: Candidate) => a.rank - b.rank;
  const base = cands.filter((c) => !isTopUp(c.p));
  const tops = cands.filter((c) => isTopUp(c.p)).sort(byRank);
  let baseOrders: Candidate[][];
  if (base.length <= w.max_exhaustive) {
    baseOrders = permutations(base);
  } else {
    // greedy fallback: stand-alone score, ties by default order
    const solo = (c: Candidate) => {
      const ev = evaluatePolicy(
        c.p,
        s,
        items.map((i) => ({ ...i })),
      );
      return ev.payout * c.conf.value - w.lambda * futureCost(c.p, ev.payout, s.claimant, w).total;
    };
    const scored = base.map((c) => ({ c, v: solo(c) }));
    scored.sort((a, b) => b.v - a.v || a.c.rank - b.c.rank);
    baseOrders = [scored.map((x) => x.c)];
  }
  const topOrders = tops.length <= 3 ? permutations(tops) : [tops];
  return baseOrders.flatMap((b) => topOrders.map((t) => [...b, ...t]));
}

/**
 * Section 8: allocateClaim(policies, scenario, insurers, weights?) → ClaimPlan.
 *
 * Ranking: every cascade order of the eligible indemnity policies is simulated,
 * and the order with the highest Σ(payout × conf) − λ·Σcost wins. Equal plans
 * fall back to the default order. See DECISIONS.md, "Ranking by plan".
 */
export function allocateClaim(
  policiesIn: Policy[],
  scenarioIn: ClaimScenario,
  insurersIn: InsurerMetrics[],
  weights: WeightsInput = {},
  options: AllocateOptions = {},
): ClaimPlan {
  const validate = options.validate ?? true;
  const policies = validate ? policiesIn.map((p) => PolicySchema.parse(p)) : policiesIn;
  const s = validate ? ClaimScenarioSchema.parse(scenarioIn) : scenarioIn;
  const insurers = validate ? insurersIn.map((i) => InsurerMetricsSchema.parse(i)) : insurersIn;

  const cat = options.catalogue ?? en;
  const w: Weights = {
    ...DEFAULT_WEIGHTS,
    ...weights,
    csr_weight_by_category: { ...DEFAULT_WEIGHTS.csr_weight_by_category, ...weights.csr_weight_by_category },
  };
  const insurerById = new Map(insurers.map((i) => [i.insurer_id, i]));
  const names = policyNames(policies, insurerById, cat);
  const nameOf = (id: string) => yourName(names.get(id)!, cat);
  const reason = (code: string, params: Params = {}): Reason => ({ code, params, text: render(cat, code, params) });
  const confOf = (p: Policy) => computeConfidence(p.insurer_id, insurerById.get(p.insurer_id), s, w, cat);

  const items = buildWorkItems(s);
  const totalBill = Math.round(items.reduce((t, i) => t + i.amount, 0));
  const warnings: Reason[] = [];
  const warn = (code: string, params: Params = {}) => {
    const r = reason(code, params);
    if (!warnings.some((x) => x.text === r.text)) warnings.push(r);
  };

  /* ── 1. Eligibility ─────────────────────────────────────────── */
  const ineligible: PolicyOutcome[] = [];
  const ineligibleRaw = new Map<string, RawReason[]>();
  const candidates: Candidate[] = [];
  const fixedPolicies: Policy[] = [];

  policies.forEach((p, index) => {
    const raw = checkEligibility(p, s);
    if (p.indemnity && raw.length === 0 && availableSI(p).amount <= 0) raw.push({ code: "si_exhausted", params: {} });
    if (raw.length > 0) {
      ineligibleRaw.set(p.policy_id, raw);
      ineligible.push({ policy_id: p.policy_id, reasons: raw.map((r) => reason(r.code, r.params)) });
      return;
    }
    if (!p.indemnity) {
      fixedPolicies.push(p);
      return;
    }
    if (availableSI(p).restored && !p.restoration.same_illness)
      warn("restoration_same_illness", { name: nameOf(p.policy_id) });
    if (p.renewal_date < s.admission_date)
      warn("renewal_before_admission", { name: nameOf(p.policy_id), date: p.renewal_date });
    const tier = orderTier(p);
    candidates.push({ p, conf: confOf(p), tier, index, rank: tier * 1000 + index });
  });

  /* ── 2–5. Payout, confidence, cost, rank and cascade ────────── */
  const sims =
    candidates.length > 0 ? candidateOrders(candidates, s, items, w).map((o) => simulate(o, s, items, w)) : [];
  const { best, window } = choose(sims, w.tie_tolerance);
  const steps = best?.steps ?? [];
  const tieRules = new Set(
    window.filter((x) => best && best.paying > 0 && x.signature !== best.signature).map((x) => tieCompare(best!, x).by),
  );

  const allocation: Allocation[] = [];
  const untouched: PolicyOutcome[] = [];
  for (const st of steps) {
    for (const r of st.ev.warnings)
      warn(r.code, r.params.policy_id ? { name: nameOf(String(r.params.policy_id)) } : r.params);
    if (st.ev.payout <= 0) {
      untouched.push({
        policy_id: st.c.p.policy_id,
        reasons: [reason(st.ev.presented > 0 ? "nothing_admissible" : "not_needed")],
      });
      continue;
    }
    const order = allocation.length + 1;
    const inNetwork = s.hospital.in_network_by_insurer[st.c.p.insurer_id];
    const recD = order === 1 ? 0 : Math.min(st.ev.payout, Math.round(st.recD));
    allocation.push({
      policy_id: st.c.p.policy_id,
      order,
      role: order === 1 ? "primary" : "secondary",
      presented: st.ev.presented,
      payout: st.ev.payout,
      mode: order === 1 && inNetwork !== false ? "cashless" : "reimbursement",
      deductions: st.ev.deductions.map((d) => ({ ...d, reason: render(cat, d.code, d.params) })),
      recovered_disallowed: recD,
      recovered_balance: order === 1 ? 0 : st.ev.payout - recD,
      confidence: st.c.conf.value,
      confidence_detail: st.c.conf,
      cost: Math.round(st.cost.total),
      score: st.ev.payout * st.c.conf.value - w.lambda * st.cost.total,
    });
  }

  /* ── Fixed benefits, in parallel ────────────────────────────── */
  const fixed: FixedBenefitPayout[] = [];
  for (const p of fixedPolicies) {
    const matches = fixedBenefitPayouts(p, s);
    if (matches.length === 0) {
      ineligible.push({ policy_id: p.policy_id, reasons: [reason("fixed_benefit_no_match")] });
      continue;
    }
    for (const m of matches) {
      const conditions = [reason("claim_separately")];
      if (m.survival_days) conditions.unshift(reason("survival_period", { days: m.survival_days }));
      fixed.push({
        policy_id: p.policy_id,
        event: m.event,
        payout: m.payout,
        conditions,
        confidence_detail: confOf(p),
      });
    }
  }

  const indemnityPaid = allocation.reduce((t, a) => t + a.payout, 0);
  const fixedPaid = fixed.reduce((t, f) => t + f.payout, 0);

  /* ── Warnings that depend on the chosen plan ────────────────── */
  const primary = allocation[0];
  const policyById = new Map(policies.map((p) => [p.policy_id, p]));
  if (primary) {
    const pp = policyById.get(primary.policy_id)!;
    const inNet = s.hospital.in_network_by_insurer[pp.insurer_id];
    const insurer = primary.confidence_detail.insurer_name;
    if (inNet === undefined) warn("network_unknown", { insurer });
    else if (inNet === false) warn("non_network", { insurer });
  }
  for (const a of allocation) {
    const p = policyById.get(a.policy_id)!;
    if (p.room_rent.rule === "single_pvt_ac" || p.room_rent.rule === "any_except_suite") {
      const room = p.room_rent.rule === "single_pvt_ac" ? "a single private AC room" : "any room except a suite";
      warn("room_category", { name: nameOf(p.policy_id), room });
    }
    if (a.confidence_detail.level === "insufficient_history")
      warn("insufficient_history", { insurer: a.confidence_detail.insurer_name });
  }
  if (allocation.length > 1) {
    warn("contribution_clause");
    warn("second_by_reimbursement");
  }

  /* ── Why this order ─────────────────────────────────────────── */
  const why = whyThisOrder({
    allocation,
    steps,
    candidates,
    ineligible,
    ineligibleRaw,
    fixed,
    policyById,
    s,
    items,
    tieRules,
    nameOf,
    reason,
  });

  const plan: ClaimPlan = {
    engine_version: ENGINE_VERSION,
    scenario_id: s.scenario_id,
    category: s.category,
    total_bill: totalBill,
    allocation,
    untouched,
    ineligible,
    fixed_benefits: fixed,
    fixed_benefit_payout: fixedPaid,
    indemnity_paid: indemnityPaid,
    out_of_pocket: Math.max(0, totalBill - indemnityPaid),
    why_this_order: why,
    warnings,
    headline: "",
    explanation: "",
    explanation_sentences: [],
  };
  const explained = explainPlan(plan, names, cat);
  plan.headline = explained.headline;
  plan.explanation_sentences = explained.sentences;
  plan.explanation = explained.sentences.join(" ");
  return plan;
}

interface WhyInput {
  allocation: Allocation[];
  steps: Step[];
  candidates: Candidate[];
  ineligible: PolicyOutcome[];
  ineligibleRaw: Map<string, RawReason[]>;
  fixed: FixedBenefitPayout[];
  policyById: Map<string, Policy>;
  s: ClaimScenario;
  items: WorkItem[];
  tieRules: Set<TieRule>;
  nameOf: (id: string) => string;
  reason: (code: string, params?: Params) => Reason;
}

/** "Why this order": every sentence comes from a fact the engine used. */
function whyThisOrder(x: WhyInput): Reason[] {
  const out: Reason[] = [];
  const add = (code: string, params: Params = {}) => out.push(x.reason(code, params));
  const primary = x.allocation[0];

  if (primary) {
    const pp = x.policyById.get(primary.policy_id)!;
    const pName = x.nameOf(pp.policy_id);
    const others = x.candidates.filter((c) => c.p.policy_id !== pp.policy_id && !isTopUp(c.p));
    const solo = (p: Policy) =>
      evaluatePolicy(
        p,
        x.s,
        x.items.map((i) => ({ ...i })),
      ).payout;
    const primarySolo = solo(pp);

    const pedBlocked = [...x.ineligibleRaw.values()].some((rs) => rs.some((r) => r.code === "ped_wait"));
    if (x.s.is_ped && pedBlocked) add("ped_only", { name: pName, policy_id: pp.policy_id });

    const reducing = pp.bonus_rule.reduces_on_claim && ncbCoverLost(pp) > 0;
    if (pp.holder_relationship === "employer_group" && !reducing) {
      add("group_no_bonus", { name: pName, policy_id: pp.policy_id });
    } else if (!pp.bonus_rule.reduces_on_claim && (pp.bonus_accrued > 0 || pp.bonus_rule.pct_per_year > 0)) {
      add("bonus_not_reduced", { policy_id: pp.policy_id });
    }

    // the first alternative that could have paid as much but has a weaker record
    const weaker = others.find((c) => primary.confidence - c.conf.value > 0.005 && solo(c.p) >= primarySolo - EPS);
    if (weaker && primary.confidence_detail.csr_3yr != null && weaker.conf.csr_3yr != null) {
      add("stronger_record", {
        insurer: primary.confidence_detail.insurer_name,
        csr: String(Number(primary.confidence_detail.csr_3yr.toFixed(1))),
        other_insurer: weaker.conf.insurer_name,
        other_csr: String(Number(weaker.conf.csr_3yr.toFixed(1))),
        period: primary.confidence_detail.period,
      });
    }

    const lower = others
      .map((c) => ({ c, v: solo(c.p) }))
      .filter((o) => primarySolo - o.v >= Math.max(1000, primarySolo * 0.01))
      .sort((a, b) => b.v - a.v)[0];
    if (lower) add("pays_more", { name: pName, amount: primarySolo - lower.v, other: x.nameOf(lower.c.p.policy_id) });
  }

  if (x.tieRules.has("tier")) add("default_order");
  else if (x.tieRules.has("count")) add("fewer_claims");

  for (const st of x.steps) {
    const p = st.c.p;
    const name = x.nameOf(p.policy_id);
    const paid = st.ev.payout > 0;
    if (p.bonus_rule.reduces_on_claim && ncbCoverLost(p) > 0) {
      if (!paid && p.bonus_accrued > 0) add("bonus_kept", { name, amount: p.bonus_accrued, policy_id: p.policy_id });
      if (paid) add("bonus_reduced", { name, amount: Math.round(st.cost.ncb_cover_lost), policy_id: p.policy_id });
    }
    if (isSharedFloater(p) && othersOnPolicy(p, x.s.claimant) > 0) {
      if (!paid) add("floater_untouched", { name, policy_id: p.policy_id });
      else if (x.allocation.length > 1 && x.allocation[x.allocation.length - 1]!.policy_id === p.policy_id)
        add("floater_last", { name, policy_id: p.policy_id });
    }
    if (paid && isTopUp(p) && p.deductible.type !== "none") {
      add("super_topup", {
        name,
        deductible: p.deductible.amount,
        remaining: remainingDeductible(p),
        policy_id: p.policy_id,
      });
    }
  }

  for (const o of x.ineligible) {
    const first = o.reasons[0]!;
    if (first.code === "fixed_benefit_no_match") continue;
    const text = first.text.charAt(0).toLowerCase() + first.text.slice(1);
    add("cannot_pay", { name: x.nameOf(o.policy_id), reason: text, policy_id: o.policy_id });
  }
  for (const f of x.fixed)
    add("fixed_parallel", { name: x.nameOf(f.policy_id), amount: f.payout, policy_id: f.policy_id });
  return out;
}
