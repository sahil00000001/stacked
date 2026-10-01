import type { Metadata } from "next";
import { t } from "@/lib/i18n/en";
import { ClaimPlanView } from "./ClaimPlanView";

export const metadata: Metadata = { title: t.plan.title };

export default function PlanPage() {
  return <ClaimPlanView />;
}
