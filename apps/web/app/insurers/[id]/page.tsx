import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { INSURERS } from "@stacked/seed-data";
import { InsurerScorecard } from "@/components/InsurerScorecard";
import { getInsurer } from "@/lib/data";
import { t } from "@/lib/i18n/en";

export function generateStaticParams() {
  return INSURERS.map((i) => ({ id: i.insurer_id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const insurer = await getInsurer((await params).id);
  return { title: insurer?.insurer_name ?? t.insurers.title };
}

export default async function InsurerPage({ params }: { params: Promise<{ id: string }> }) {
  const insurer = await getInsurer((await params).id);
  if (!insurer) notFound();
  return (
    <>
      <Link href="/insurers" className="mb-6 inline-flex min-h-11 items-center text-14 font-medium">
        {t.common.back} to {t.insurers.title.toLowerCase()}
      </Link>
      <InsurerScorecard insurer={insurer} />
    </>
  );
}
