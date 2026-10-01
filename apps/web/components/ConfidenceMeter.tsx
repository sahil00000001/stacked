import { METRIC_SOURCE, formatDateLong, type Confidence } from "@stacked/claim-engine";
import { cx } from "@/lib/cx";
import { SourceNote } from "./primitives";

const fill = (level: Confidence["level"]) => (level === "insufficient_history" ? 0 : level);
const tone = (level: Confidence["level"]) =>
  level === "insufficient_history" ? "" : level >= 4 ? "bg-covered" : level === 3 ? "bg-partial" : "bg-risk";

/** Five segments and a sentence — never a bare percentage. */
export function ConfidenceMeter({ confidence }: { confidence: Confidence }) {
  const n = fill(confidence.level);
  const insufficient = confidence.level === "insufficient_history";
  return (
    <div className="flex flex-col gap-2">
      <div
        role="meter"
        aria-valuemin={0}
        aria-valuemax={5}
        aria-valuenow={n}
        aria-valuetext={confidence.text}
        aria-label={`Settlement confidence for ${confidence.insurer_name}`}
        className={cx(
          "flex w-40 gap-0.5",
          insufficient && "rounded-[1px] outline outline-1 outline-dashed outline-edge outline-offset-2",
        )}
      >
        {[1, 2, 3, 4, 5].map((i) => (
          <span key={i} className={cx("h-1.5 flex-1 rounded-[1px]", i <= n ? tone(confidence.level) : "bg-slate")} />
        ))}
      </div>
      <p className="text-16 text-bone">{confidence.text}</p>
      <SourceNote>
        {METRIC_SOURCE}. Insurer-level, not specific to this product.
        {confidence.as_of ? ` As of ${formatDateLong(confidence.as_of)}.` : ""}
      </SourceNote>
    </div>
  );
}
