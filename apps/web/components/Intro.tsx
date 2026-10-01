"use client";

import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { useEffect, useState } from "react";
import { formatINR } from "@stacked/claim-engine";
import { cx } from "@/lib/cx";
import { t } from "@/lib/i18n/en";
import { INTRO_EXAMPLE } from "@/lib/introExample";
import { PlinthButton, PlinthLink } from "./PlinthButton";

const EASE = [0.2, 0.7, 0.2, 1] as const;
const SPRING = { type: "spring", stiffness: 170, damping: 18 } as const;

/** A rupee figure that counts up once, after `delay` seconds. */
function CountUp({ to, delay, run }: { to: number; delay: number; run: boolean }) {
  const mv = useMotionValue(run ? 0 : to);
  const text = useTransform(mv, (v) => formatINR(v));
  useEffect(() => {
    if (!run) return mv.set(to);
    const c = animate(mv, to, { duration: 0.9, delay, ease: EASE });
    return () => c.stop();
  }, [mv, to, delay, run]);
  return <motion.span className="money">{text}</motion.span>;
}

/* back to front: each card's top strip shows, the employer cover (claimed first) lands in front */
const CARDS = [
  {
    tag: "Parents' floater",
    name: "Parents' Mediclaim",
    si: "₹5,00,000",
    from: { x: 0, y: 220, rotate: 12 },
    rest: -2,
  },
  { tag: "Yours", name: "ReAssure 2.0", si: "₹10,00,000", from: { x: 260, y: -20, rotate: 26 }, rest: 2 },
  { tag: "Employer", name: "Employer cover", si: "₹5,00,000", from: { x: -260, y: -40, rotate: -28 }, rest: -1 },
];

/**
 * First-visit intro (DECISIONS U1): the policies deal in like cards, a hospital
 * bill drops, the split bar fills in claim order and the money counts up — the
 * whole idea of the app in about four seconds. Plays once; Replay runs it again.
 * Under prefers-reduced-motion everything renders in its final state.
 */
export function Intro({
  onTryDemo,
  demoBusy,
  demoReady,
}: {
  onTryDemo: () => void;
  demoBusy: boolean;
  demoReady: boolean;
}) {
  const reduce = useReducedMotion() ?? false;
  const [round, setRound] = useState(0);
  const run = !reduce;
  const at = (s: number) => (run ? s : 0);
  const i = t.intro;
  const words = i.headline.split(" ");
  const total = INTRO_EXAMPLE.bill;
  let elapsed = 0;

  return (
    <section aria-labelledby="intro-title" className="relative -mx-4 overflow-hidden px-4 pb-4" data-testid="intro">
      <motion.p
        key={`brand-${round}`}
        className="flex items-center gap-2 text-14 font-medium text-ash"
        initial={run ? { opacity: 0, y: -8 } : false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: EASE }}
      >
        <span aria-hidden className="inline-block size-2 rounded-full bg-mint" />
        {i.kicker}
      </motion.p>

      <h1 id="intro-title" className="mt-3 text-40 font-medium leading-[1.05] md:text-56" key={`h-${round}`}>
        {words.map((w, n) => (
          <span key={n}>
            <motion.span
              className="inline-block"
              initial={run ? { opacity: 0, y: 36, filter: "blur(8px)" } : false}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ duration: 0.55, delay: at(0.1 + n * 0.08), ease: EASE }}
            >
              {w}
            </motion.span>
            {n < words.length - 1 ? " " : ""}
          </span>
        ))}
      </h1>

      <motion.p
        key={`sub-${round}`}
        className="mt-4 text-16 text-ash font-medium md:text-20"
        initial={run ? { opacity: 0 } : false}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: at(0.6) }}
      >
        {i.sub}
      </motion.p>

      {/* The stage: decorative; the sentence below carries the same information */}
      <p className="sr-only">{i.stageAlt}</p>
      <div key={`stage-${round}`} aria-hidden className="relative mt-12 select-none">
        <div className="relative mx-auto h-[12.5rem] max-w-md">
          {CARDS.map((c, n) => (
            <motion.div
              key={c.name}
              className="grain absolute inset-x-6 rounded-card border border-edge p-4"
              style={{ top: n * 44, zIndex: n }}
              initial={run ? { ...c.from, opacity: 0 } : false}
              animate={{ x: 0, y: 0, rotate: c.rest, opacity: 1 }}
              transition={{ ...SPRING, delay: at(0.35 + n * 0.18) }}
            >
              <div className="flex items-center justify-between">
                <span className="eyebrow">{c.name}</span>
                <span className="rounded-chip border border-edge px-2 text-12 font-medium text-bone">{c.tag}</span>
              </div>
              <p className="money mt-3 text-28 font-medium text-bone">{c.si}</p>
            </motion.div>
          ))}
          {/* scan line sweeping across the stack */}
          {run && (
            <motion.span
              className="absolute top-0 bottom-0 z-10 w-0.5 bg-mint"
              initial={{ left: "4%", opacity: 0 }}
              animate={{ left: ["4%", "96%"], opacity: [0, 1, 1, 0] }}
              transition={{ duration: 0.9, delay: 1.25, ease: "easeInOut" }}
            />
          )}
          {/* the hospital bill drops onto the stack */}
          <motion.div
            className="absolute right-3 -top-9 z-20 rounded-button bg-bone px-3 py-1.5 text-14 font-bold text-ink shadow-plinth"
            initial={run ? { y: -120, opacity: 0, rotate: -10 } : false}
            animate={{ y: 0, opacity: 1, rotate: 3 }}
            transition={{ type: "spring", stiffness: 260, damping: 14, delay: at(1.15) }}
          >
            {i.bill} <span className="money">{formatINR(total, { compact: true })}</span>
          </motion.div>
        </div>

        {/* the claim split bar fills in claim order */}
        <div className="mx-auto mt-2 max-w-md">
          <div className="flex h-4 w-full overflow-hidden rounded-button bg-slate">
            {[
              ...INTRO_EXAMPLE.split.map((s) => ({ ...s, kind: "covered" })),
              { policy_id: "you", label: i.youPay, amount: INTRO_EXAMPLE.youPay, kind: "partial" },
            ].map((s, n) => {
              const share = s.amount / total;
              const delay = 2.0 + elapsed * 0.9;
              elapsed += share;
              return (
                <motion.span
                  key={s.policy_id}
                  className={cx(
                    "h-full shrink-0",
                    s.kind === "covered" ? "bg-covered" : "bg-partial",
                    n > 0 && "border-l border-edge",
                  )}
                  initial={run ? { width: 0 } : false}
                  animate={{ width: `${share * 100}%` }}
                  transition={{ duration: share * 0.9, delay: at(delay), ease: EASE }}
                />
              );
            })}
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-14">
            {INTRO_EXAMPLE.split.map((s, n) => (
              <motion.div
                key={s.policy_id}
                initial={run ? { opacity: 0, y: 8 } : false}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: at(2.1 + n * 0.35) }}
              >
                <p className="font-medium text-bone">{n === 0 ? i.first : i.then}</p>
                <p className="text-ash font-medium">{s.label}</p>
                <p className="font-medium text-covered">
                  <CountUp to={s.amount} delay={2.1 + n * 0.35} run={run} />
                </p>
              </motion.div>
            ))}
            <motion.div
              initial={run ? { opacity: 0, y: 8 } : false}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: at(2.9) }}
            >
              <p className="font-medium text-bone">{i.youPay}</p>
              <p className="text-ash font-medium">{i.consumables}</p>
              <p className="font-medium text-partial">
                <CountUp to={INTRO_EXAMPLE.youPay} delay={2.9} run={run} />
              </p>
            </motion.div>
          </div>
          <motion.p
            className="mt-3 text-14 font-medium text-bone"
            initial={run ? { opacity: 0, scale: 0.92 } : false}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ ...SPRING, delay: at(3.3) }}
          >
            {i.lumpSumPrefix}{" "}
            <span className="money text-covered">{formatINR(INTRO_EXAMPLE.lumpSum, { compact: true })}</span>{" "}
            {i.lumpSumSuffix}
          </motion.p>
        </div>
      </div>

      <ul className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3" key={`pts-${round}`}>
        {i.points.map((p, n) => (
          <motion.li
            key={p.title}
            className="grain rounded-card border border-edge p-4"
            initial={run ? { opacity: 0, y: 16 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: at(3.5 + n * 0.12), ease: EASE }}
          >
            <p className="text-16 font-medium text-bone">{p.title}</p>
            <p className="mt-1 text-14 font-medium text-ash">{p.body}</p>
          </motion.li>
        ))}
      </ul>

      <div className="actions mt-8">
        <PlinthButton size="lg" onClick={onTryDemo} disabled={!demoReady} busy={demoBusy} busyLabel={i.loading}>
          {i.tryDemo}
        </PlinthButton>
        <PlinthLink href="/add?way=employer" size="lg" variant="secondary">
          {t.vault.add}
        </PlinthLink>
      </div>
      <p className="mt-4 text-14 font-medium text-ash">
        {t.vault.empty.title} {t.vault.empty.body}
      </p>

      <ol className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {i.steps.map((s, n) => (
          <li key={s} className="flex items-start gap-3">
            <span className="money flex size-7 shrink-0 items-center justify-center rounded-button border border-edge text-14 font-medium">
              {n + 1}
            </span>
            <span className="pt-0.5 text-16 text-bone">{s}</span>
          </li>
        ))}
      </ol>

      {run && (
        <button
          type="button"
          onClick={() => setRound((r) => r + 1)}
          className="mt-6 min-h-11 text-14 font-medium text-mint underline underline-offset-4"
        >
          {i.replay}
        </button>
      )}
    </section>
  );
}
