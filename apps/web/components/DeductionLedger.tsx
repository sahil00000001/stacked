import { formatINR, type Allocation } from "@stacked/claim-engine";
import { t } from "@/lib/i18n/en";

/** Why a policy pays less than the bill, one line per reason, tabular figures. */
export function DeductionLedger({
  allocation,
  youPay,
  caption,
}: {
  allocation: Pick<Allocation, "presented" | "payout" | "deductions">;
  youPay?: number;
  caption?: string;
}) {
  return (
    <table className="w-full border-collapse text-16">
      {caption && <caption className="mb-2 text-left text-14 font-medium text-ash">{caption}</caption>}
      <tbody>
        <tr className="border-b border-edge">
          <th scope="row" className="py-2 pr-4 text-left font-regular text-bone">
            {t.plan.presented}
          </th>
          <td className="money py-2 text-right whitespace-nowrap text-bone">{formatINR(allocation.presented)}</td>
        </tr>
        {allocation.deductions.map((d) => (
          <tr key={d.code} className="border-b border-edge">
            <th scope="row" className="py-2 pr-4 text-left font-regular text-ash">
              {d.reason}
            </th>
            <td
              className="money py-2 text-right whitespace-nowrap text-partial"
              aria-label={t.plan.deducted(formatINR(d.amount))}
            >
              −{formatINR(d.amount)}
            </td>
          </tr>
        ))}
        <tr>
          <th scope="row" className="pt-3 pr-4 text-left font-medium text-bone">
            {t.plan.thisPays}
          </th>
          <td className="money pt-3 text-right whitespace-nowrap font-medium text-covered">
            {formatINR(allocation.payout)}
          </td>
        </tr>
        {youPay != null && (
          <tr className="border-t border-edge">
            <th scope="row" className="pt-3 pr-4 text-left font-bold text-bone">
              {t.plan.youPayLine}
            </th>
            <td className="money pt-3 text-right whitespace-nowrap font-bold text-risk">{formatINR(youPay)}</td>
          </tr>
        )}
      </tbody>
    </table>
  );
}
