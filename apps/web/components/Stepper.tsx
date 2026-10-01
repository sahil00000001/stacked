import { cx } from "@/lib/cx";

export interface Step {
  id: string;
  title: string;
  detail: string;
  timing?: string;
  status: "todo" | "current" | "done";
}

/** The claim-day timeline. Numbered because it is a real sequence. */
export function Stepper({ steps }: { steps: Step[] }) {
  return (
    <ol className="flex flex-col">
      {steps.map((s, i) => (
        <li
          key={s.id}
          className="relative flex gap-4 pb-6 last:pb-0"
          aria-current={s.status === "current" ? "step" : undefined}
        >
          {i < steps.length - 1 && <span aria-hidden className="absolute top-8 bottom-0 left-[13.5px] w-px bg-edge" />}
          <span
            aria-hidden
            className={cx(
              "money flex size-7 shrink-0 items-center justify-center rounded-button border text-14 font-medium",
              s.status === "current" ? "border-bone bg-bone text-ink" : "border-edge text-bone",
              s.status === "done" && "text-covered",
            )}
          >
            {i + 1}
          </span>
          <div className="flex flex-col gap-1 pt-0.5">
            <h3 className="text-16 font-medium">
              <span className="sr-only">Step {i + 1}: </span>
              {s.title}
            </h3>
            <p className="text-14 font-medium text-ash">{s.detail}</p>
            {s.timing && <p className="text-14 font-medium text-bone">{s.timing}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}
