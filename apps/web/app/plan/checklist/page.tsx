import type { Metadata } from "next";
import { t } from "@/lib/i18n/en";
import { Checklist } from "./Checklist";

export const metadata: Metadata = { title: t.checklist.title };

export default function ChecklistPage() {
  return <Checklist />;
}
