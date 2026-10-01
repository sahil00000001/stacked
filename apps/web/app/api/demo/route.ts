import { NextResponse } from "next/server";
import { getDemoPolicies } from "@/lib/data";

export const revalidate = 3600;

/** Sample policies for "Try with sample policies" (the fictional demo user). */
export async function GET() {
  return NextResponse.json(await getDemoPolicies());
}
