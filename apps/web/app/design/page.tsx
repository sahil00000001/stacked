import type { Metadata } from "next";
import { t } from "@/lib/i18n/en";
import { DesignShowcase } from "./DesignShowcase";
import { SAMPLE_CONFIDENCE, SAMPLE_INSURERS, SAMPLE_PLANS, SAMPLE_POLICIES } from "./samples";

export const metadata: Metadata = { title: t.design.title };

export default function DesignPage() {
  return (
    <DesignShowcase
      policies={SAMPLE_POLICIES}
      plans={SAMPLE_PLANS}
      confidences={SAMPLE_CONFIDENCE}
      insurers={SAMPLE_INSURERS}
    />
  );
}
