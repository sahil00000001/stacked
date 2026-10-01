"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";
import { shortInsurerName, type InsurerMetrics, type Policy } from "@stacked/claim-engine";
import { availableText, copayChip, relationshipTag, roomChip, siText, termsSheet, waitChip } from "@/lib/describe";
import { cx } from "@/lib/cx";
import { t } from "@/lib/i18n/en";
import { FieldRow } from "./FieldRow";
import { Chip } from "./primitives";

/**
 * One policy, as a card in a wallet. Collapsed: insurer eyebrow, relationship
 * tag, sum insured, three term chips. Expanded: every Policy field in plain
 * language. Never shows a claim settlement ratio — that is insurer-level.
 */
export function PolicyCard({
  policy,
  insurer,
  productName,
  today,
  expanded,
  onToggle,
  stackIndex = 0,
  actions,
}: {
  policy: Policy;
  insurer?: InsurerMetrics;
  productName: string | null;
  today: string;
  expanded: boolean;
  onToggle: () => void;
  stackIndex?: number;
  actions?: ReactNode;
}) {
  const reduce = useReducedMotion();
  const tilt = expanded ? 0 : stackIndex % 2 === 0 ? -2 : 2;
  const nameOnly = policy.data_status === "name_only";
  const name = policy.label ?? productName ?? t.policyType[policy.policy_type];
  const regionId = `terms-${policy.policy_id}`;

  return (
    <motion.article
      layout={!reduce}
      transition={{ duration: 0.18, ease: [0.2, 0.7, 0.2, 1] }}
      style={{ rotate: tilt, zIndex: expanded ? 5 : undefined }}
      className={cx("grain relative rounded-card border border-edge", expanded && "ring-0")}
      data-testid="policy-card"
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={regionId}
        className="flex w-full flex-col gap-4 rounded-card p-5 text-left"
      >
        <span className="flex items-start justify-between gap-3">
          <span className="eyebrow pt-0.5">{insurer ? shortInsurerName(insurer.insurer_name) : t.common.notKnown}</span>
          <span className="rounded-chip border border-edge px-2 py-0.5 text-14 font-medium text-bone">
            {relationshipTag(policy)}
          </span>
        </span>
        <span className="flex flex-col gap-1">
          <span className="text-16 font-medium text-bone">{name}</span>
          <span className={cx("money font-medium text-bone", expanded ? "text-40" : "text-28")}>
            {nameOnly && policy.sum_insured === 0 ? t.vault.siNotKnown : siText(policy)}
          </span>
          <span className="text-14 font-medium text-ash">
            <span className="money">{availableText(policy)}</span> {t.vault.availableThisYear}
          </span>
        </span>
        <span className="flex flex-wrap gap-2">
          <Chip>{nameOnly ? t.common.notKnown : roomChip(policy)}</Chip>
          <Chip>{nameOnly ? t.common.notKnown : copayChip(policy)}</Chip>
          <Chip>{waitChip(policy, today)}</Chip>
        </span>
        <span className="text-14 font-medium text-mint underline underline-offset-4">
          {expanded ? t.vault.collapseHint : t.vault.expandHint}
        </span>
      </button>

      {expanded && (
        <section
          id={regionId}
          aria-label={`${name} terms`}
          className="flex flex-col gap-6 border-t border-edge px-5 pt-4 pb-5"
        >
          {policy.data_status !== "user_verified" && (
            <p className="text-14 font-medium text-ash">{t.vault.presetNote}</p>
          )}
          {termsSheet(policy, insurer, productName, today).map((sec) => (
            <div key={sec.title}>
              <h3 className="mb-1 text-16 font-medium">{sec.title}</h3>
              <dl>
                {sec.rows.map((r) => (
                  <FieldRow key={r.label} label={r.label} value={r.value} unknown={r.unknown} />
                ))}
              </dl>
            </div>
          ))}
          {actions && <div className="flex flex-wrap gap-3">{actions}</div>}
        </section>
      )}
    </motion.article>
  );
}
