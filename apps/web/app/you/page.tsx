import type { Metadata } from "next";
import { t } from "@/lib/i18n/en";
import { You } from "./You";

export const metadata: Metadata = { title: t.you.title };

export default function YouPage() {
  return <You />;
}
