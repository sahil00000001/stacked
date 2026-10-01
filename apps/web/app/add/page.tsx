import type { Metadata } from "next";
import { Suspense } from "react";
import { t } from "@/lib/i18n/en";
import { AddPolicy } from "./AddPolicy";

export const metadata: Metadata = { title: t.add.title };

export default function AddPage() {
  return (
    <Suspense>
      <AddPolicy />
    </Suspense>
  );
}
