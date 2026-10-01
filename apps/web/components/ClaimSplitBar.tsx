"use client";

import { motion, useReducedMotion } from "motion/react";
import { formatINR, type ClaimPlan } from "@stacked/claim-engine";
import { cx } from "@/lib/cx";
import { planSegments, splitSentence, type Segment } from "@/lib/planView";

const FILL = 0.5; // seconds, the whole bar (tokens: --duration-split-fill)
const NARROW = 15; // % below which a label moves to the list under the bar

const segClass: Record<Segment["kind"], string> = {
  covered: "bg-covered",
  deducted: "bg-partial",
  above: "hatch-risk",
};

/**
 * The signature element: the whole bill as one bar, split by who pays.
 * Segments fill left to right in cascade order over 500ms — the app's one
 * orchestrated animation. Instant under reduced motion.
 */
export function ClaimSplitBar({
  plan,
  nameOf,
  animate = true,
}: {
  plan: ClaimPlan;
  nameOf: (id: string) => string;
  animate?: boolean;
}) {
  const reduce = useReducedMotion();
  const segs = planSegments(plan, nameOf);
  const total = Math.max(1, plan.total_bill);
  const run = animate && !reduce;
  let elapsed = 0;

  const withPct = segs.map((s) => ({ ...s, pct: (s.amount / total) * 100 }));
  const narrow = withPct.filter((s) => s.pct < NARROW);

  return (
    <figure className="flex flex-col gap-3" data-testid="claim-split-bar">
      <div
        role="img"
        aria-label={splitSentence(plan, segs)}
        className="flex h-5 w-full overflow-hidden rounded-button bg-slate"
      >
        {withPct.map((s, i) => {
          const share = s.pct / 100;
          const delay = elapsed * FILL;
          elapsed += share;
          return (
            <motion.div
              key={s.key}
              data-kind={s.kind}
              className={cx("h-full shrink-0", segClass[s.kind], i > 0 && "border-l border-edge")}
              initial={run ? { width: 0 } : false}
              animate={{ width: `${s.pct}%` }}
              transition={run ? { duration: share * FILL, delay, ease: [0.2, 0.7, 0.2, 1] } : { duration: 0 }}
            />
          );
        })}
      </div>
      <figcaption className="flex w-full">
        {withPct.map((s) => (
          <div key={s.key} className="min-w-0 shrink-0 pr-2" style={{ width: `${s.pct}%` }}>
            {s.pct >= NARROW && <SegmentLabel s={s} />}
          </div>
        ))}
      </figcaption>
      {narrow.length > 0 && (
        <ul className="flex flex-col gap-1">
          {narrow.map((s) => (
            <li key={s.key} className="flex items-baseline gap-2">
              <span aria-hidden className={cx("inline-block size-2.5 shrink-0 rounded-[1px]", segClass[s.kind])} />
              <SegmentLabel s={s} inline />
            </li>
          ))}
        </ul>
      )}
    </figure>
  );
}

function SegmentLabel({ s, inline }: { s: Segment; inline?: boolean }) {
  return (
    <span className={cx("text-14 font-medium", inline ? "flex flex-wrap gap-x-2" : "flex flex-col")}>
      <span className="text-bone">{s.label}</span>
      <span className="money text-ash">{formatINR(s.amount, { compact: true })}</span>
    </span>
  );
}
