import type { ReactNode } from "react";
import { formatINR } from "@stacked/claim-engine";
import { cx } from "@/lib/cx";
import { t } from "@/lib/i18n/en";

/** Rupee figure: tabular figures, Indian grouping; compact in bars and cards. */
export function Money({ amount, compact, className }: { amount: number; compact?: boolean; className?: string }) {
  return <span className={cx("money", className)}>{formatINR(amount, { compact })}</span>;
}

/** Period and source line under every metric (12px ash, the only 12px text). */
export function SourceNote({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cx("text-12 text-ash font-medium", className)}>{children}</p>;
}

/** Fixed footer on every result and scorecard (§4.6). */
export function Disclaimer() {
  return (
    <footer className="mt-10 border-t border-edge pt-4">
      <p className="text-14 text-ash font-medium">{t.app.disclaimer}</p>
    </footer>
  );
}

/** Page title block; the h1 is the page's job, never a label repeating content. */
export function PageHeader({ title, intro, children }: { title: string; intro?: string; children?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-col gap-2">
      <h1 className="text-28">{title}</h1>
      {intro && <p className="text-16 text-ash font-medium">{intro}</p>}
      {children}
    </header>
  );
}

export function Section({ title, children, id }: { title: string; children: ReactNode; id?: string }) {
  return (
    <section className="mt-8" aria-labelledby={id}>
      <h2 id={id} className="text-20 mb-3">
        {title}
      </h2>
      {children}
    </section>
  );
}

/** A term chip on a PolicyCard. */
export function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex min-h-7 items-center rounded-chip border border-edge px-2 text-14 font-medium text-bone">
      {children}
    </span>
  );
}
