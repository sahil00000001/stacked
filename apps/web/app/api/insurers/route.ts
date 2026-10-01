import { NextResponse } from "next/server";
import { getInsurers } from "@/lib/data";

export const revalidate = 3600;

export async function GET() {
  return NextResponse.json(await getInsurers());
}
