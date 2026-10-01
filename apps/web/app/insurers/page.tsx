import type { Metadata } from "next";
import { Disclaimer, PageHeader } from "@/components/primitives";
import { getInsurers } from "@/lib/data";
import { t } from "@/lib/i18n/en";
import { InsurerList } from "./InsurerList";

export const metadata: Metadata = { title: t.insurers.title };

export default async function InsurersPage() {
  const insurers = await getInsurers();
  return (
    <>
      <PageHeader title={t.insurers.title} intro={t.insurers.intro} />
      <InsurerList insurers={insurers} />
      <Disclaimer />
    </>
  );
}
