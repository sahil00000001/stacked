import type { Metadata } from "next";
import { t } from "@/lib/i18n/en";
import { Welcome } from "./Welcome";

export const metadata: Metadata = { title: t.intro.headline };

export default function WelcomePage() {
  return <Welcome />;
}
