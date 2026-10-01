import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Runtime check that the database is reachable from the server (no details leaked). */
export async function GET() {
  if (!process.env.DATABASE_URL) return NextResponse.json({ status: "ok", database: "not configured" });
  try {
    const { PrismaClient } = await import("@prisma/client");
    const g = globalThis as unknown as { __prisma?: InstanceType<typeof PrismaClient> };
    g.__prisma ??= new PrismaClient();
    const insurers = await g.__prisma.insurer.count();
    return NextResponse.json({ status: "ok", database: "connected", insurers });
  } catch (e) {
    const code = (e as { code?: string; errorCode?: string }).code ?? (e as { errorCode?: string }).errorCode ?? "unknown";
    return NextResponse.json({ status: "degraded", database: "unavailable", code }, { status: 503 });
  }
}
