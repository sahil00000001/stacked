import type { Metadata } from "next";
import { t } from "@/lib/i18n/en";
import { Simulate } from "./Simulate";

export const metadata: Metadata = { title: t.simulate.title };

export default function SimulatePage() {
  return <Simulate />;
}
