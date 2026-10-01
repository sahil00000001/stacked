"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatINR } from "@stacked/claim-engine";
import { MoneyField } from "@/components/FieldRow";
import { InstallCard } from "@/components/InstallCard";
import { PlinthButton } from "@/components/PlinthButton";
import { PageHeader, Section } from "@/components/primitives";
import { Sheet } from "@/components/Sheet";
import { useToast } from "@/components/Toast";
import { useHydrated } from "@/lib/hydrated";
import { t } from "@/lib/i18n/en";
import { useStore } from "@/lib/store";

const savedAt = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });

export function You() {
  const hydrated = useHydrated();
  const router = useRouter();
  const toast = useToast();
  const plans = useStore((s) => s.plans);
  const settings = useStore((s) => s.settings);
  const setSettings = useStore((s) => s.setSettings);
  const deletePlan = useStore((s) => s.deletePlan);
  const setCurrent = useStore((s) => s.setCurrent);
  const clearAll = useStore((s) => s.clearAll);
  const [rate, setRate] = useState<number | null>(null);
  const [confirm, setConfirm] = useState(false);

  if (!hydrated) return <PageHeader title={t.you.title} />;
  const roomRate = rate ?? settings.usualRoomRate;

  return (
    <>
      <PageHeader title={t.you.title} />

      <Section title={t.pwa.title} id="app">
        <InstallCard />
        <Link href="/welcome" className="mt-4 inline-flex min-h-11 items-center text-14 font-medium">
          {t.intro.watch}
        </Link>
      </Section>

      <Section title={t.you.plans} id="plans">
        {plans.length === 0 ? (
          <p className="text-16 text-ash font-medium">{t.you.noPlans}</p>
        ) : (
          <ul className="flex flex-col gap-3" data-testid="saved-plans">
            {plans.map((p) => (
              <li key={p.id} className="grain flex flex-col gap-3 rounded-card border border-edge p-4">
                <div>
                  <p className="text-16 font-medium">{p.plan.headline}</p>
                  <p className="text-14 font-medium text-ash">
                    {p.scenario.category}, bill {formatINR(p.plan.total_bill)}, you pay{" "}
                    {formatINR(p.plan.out_of_pocket)}. {t.you.savedAt(savedAt.format(new Date(p.saved_at)))}.{" "}
                    {t.plan.engine(p.engine_version)}.
                  </p>
                </div>
                <div className="actions">
                  <PlinthButton
                    variant="secondary"
                    onClick={() => {
                      setCurrent({ scenario: p.scenario, policies: p.policies, plan: p.plan, saved_id: p.id });
                      router.push("/plan");
                    }}
                  >
                    {t.you.open}
                  </PlinthButton>
                  <PlinthButton
                    variant="secondary"
                    onClick={() => {
                      deletePlan(p.id);
                      toast(t.you.deleted);
                    }}
                  >
                    {t.you.delete}
                  </PlinthButton>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={t.you.settings} id="settings">
        <form
          className="flex max-w-sm flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (roomRate && roomRate > 0) setSettings({ usualRoomRate: roomRate });
            toast(t.you.settingsSaved);
          }}
        >
          <MoneyField label={t.you.usualRoomRate} hint={t.you.usualRoomRateHint} value={roomRate} onValue={setRate} />
          <PlinthButton type="submit" variant="secondary" className="w-full sm:w-auto sm:self-start">
            {t.you.saveSettings}
          </PlinthButton>
        </form>
      </Section>

      <Section title={t.you.privacy} id="privacy">
        <p className="mb-4 text-16 text-bone">{t.you.privacyBody}</p>
        <PlinthButton variant="secondary" onClick={() => setConfirm(true)}>
          {t.you.clearAll}
        </PlinthButton>
      </Section>

      <Section title={t.you.sources} id="sources">
        <p className="text-16 text-bone">{t.you.sourcesBody}</p>
      </Section>

      <Sheet open={confirm} onClose={() => setConfirm(false)} title={t.you.clearConfirm}>
        <div className="actions">
          <PlinthButton
            onClick={() => {
              clearAll();
              setConfirm(false);
              toast(t.you.cleared);
            }}
          >
            {t.you.clearAll}
          </PlinthButton>
          <PlinthButton variant="secondary" onClick={() => setConfirm(false)}>
            {t.common.cancel}
          </PlinthButton>
        </div>
      </Sheet>
    </>
  );
}
