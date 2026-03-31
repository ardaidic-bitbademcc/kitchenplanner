import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { salesHistory } from "@/lib/schema";
import { eq } from "drizzle-orm";

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session || (session.user as any).role !== "admin")
    return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
  await db.delete(salesHistory).where(eq(salesHistory.id, params.id));
  return NextResponse.json({ ok: true });
}
