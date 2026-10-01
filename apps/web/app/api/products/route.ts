import { NextResponse } from "next/server";
import { getProducts } from "@/lib/data";

export const revalidate = 3600;

export async function GET() {
  return NextResponse.json(await getProducts());
}
