"use client";

import { useState } from "react";
import type { Policy } from "@stacked/claim-engine";
import { EmptyState } from "@/components/EmptyState";
import { PlinthButton, PlinthLink } from "@/components/PlinthButton";
import { PolicyCard } from "@/components/PolicyCard";
import { PageHeader } from "@/components/primitives";
import { Sheet } from "@/components/Sheet";
import { useToast } from "@/components/Toast";
import { computeGaps } from "@/lib/gaps";
import { useHydrated } from "@/lib/hydrated";
import { t } from "@/lib/i18n/en";
import { useInsurers, useProducts } from "@/lib/queries";
import { todayISO } from "@/lib/simulate";
import { useStore } from "@/lib/store";
import { formatINR } from "@stacked/claim-engine";

/** Wallet order: employer → own → spouse → other → parents' floater → top-ups → fixed benefits. */
const ORDER: Record<string, number> = { employer_group: 0, self: 1, spouse: 2, other: 3, parents_floater: 4 };
const rank = (p: Policy) =>
  !p.indemnity
    ? 7
    : p.policy_type === "super_top_up"
      ? 6
      : p.policy_type === "top_up"
        ? 5
        : (ORDER[p.holder_relationship] ?? 3);

export default function VaultPage() {
  const hydrated = useHydrated();
  const policies = useStore((s) => s.policies);
  const usualRoomRate = useStore((s) => s.settings.usualRoomRate);
  const removePolicy = useStore((s) => s.removePolicy);
  const { data: insurers = [] } = useInsurers();
  const { data: products = [] } = useProducts();
  const [open, setOpen] = useState<string | null>(null);
  const [removing, setRemoving] = useState<Policy | null>(null);
  const toast = useToast();

  if (!hydrated) return <PageHeader title={t.vault.title} intro={t.vault.intro} />;

  const today = todayISO();
  const sorted = [...policies].sort((a, b) => rank(a) - rank(b));
  const gaps = computeGaps(sorted, insurers, { today, usualRoomRate });

  return (
    <>
      <PageHeader title={t.vault.title} intro={t.vault.intro} />

      {gaps.length > 0 && (
        <details
          className="grain mb-6 rounded-card border border-edge p-4"
          open={gaps.length <= 3}
          data-testid="gap-banner"
        >
          <summary className="cursor-pointer text-16 font-medium text-bone">{t.vault.gapsTitle(gaps.length)}</summary>
          <ul className="mt-3 flex list-disc flex-col gap-2 pl-5">
            {gaps.map((g) => (
              <li key={`${g.policy_id}-${g.code}`} className="text-16 text-bone">
                {g.text}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-14 font-medium text-ash">{t.vault.gapsAssumption(formatINR(usualRoomRate))}</p>
        </details>
      )}

      {sorted.length === 0 ? (
        <EmptyState
          title={t.vault.empty.title}
          body={t.vault.empty.body}
          action={<PlinthLink href="/add?way=employer">{t.vault.add}</PlinthLink>}
        />
      ) : (
        <>
          <ul className="flex flex-col gap-3" aria-label={t.vault.title}>
            {sorted.map((p, i) => {
              const insurer = insurers.find((x) => x.insurer_id === p.insurer_id);
              const product = products.find((x) => x.product_id === p.product_id);
              return (
                <li key={p.policy_id}>
                  <PolicyCard
                    policy={p}
                    insurer={insurer}
                    productName={product ? [product.product_name, product.variant].filter(Boolean).join(" ") : null}
                    today={today}
                    stackIndex={i}
                    expanded={open === p.policy_id}
                    onToggle={() => setOpen(open === p.policy_id ? null : p.policy_id)}
                    actions={
                      <>
                        <PlinthLink href={`/add?edit=${p.policy_id}`} variant="secondary">
                          {p.data_status === "user_verified" ? t.common.edit : t.vault.markVerified}
                        </PlinthLink>
                        <PlinthButton variant="secondary" onClick={() => setRemoving(p)}>
                          {t.common.remove}
                        </PlinthButton>
                      </>
                    }
                  />
                </li>
              );
            })}
          </ul>
          <div className="mt-8">
            <PlinthLink href="/add">{t.vault.add}</PlinthLink>
          </div>
        </>
      )}

      <Sheet open={removing !== null} onClose={() => setRemoving(null)} title={t.vault.removeConfirm}>
        <p className="text-16 text-ash font-medium">{removing?.label ?? ""}</p>
        <div className="flex flex-wrap gap-3">
          <PlinthButton
            onClick={() => {
              if (removing) removePolicy(removing.policy_id);
              setRemoving(null);
              toast(t.vault.removed);
            }}
          >
            {t.common.remove}
          </PlinthButton>
          <PlinthButton variant="secondary" onClick={() => setRemoving(null)}>
            {t.common.cancel}
          </PlinthButton>
        </div>
      </Sheet>
    </>
  );
}
