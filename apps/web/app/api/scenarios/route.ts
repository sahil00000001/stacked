import { NextResponse } from "next/server";
import { getScenarios } from "@/lib/data";

export const revalidate = 3600;

export async function GET() {
  return NextResponse.json(await getScenarios());
}
