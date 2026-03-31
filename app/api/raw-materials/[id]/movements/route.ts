import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { stockMovements } from "@/lib/schema";
import { eq, desc } from "drizzle-orm";

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const movements = await db
    .select()
    .from(stockMovements)
    .where(eq(stockMovements.rawMaterialId, params.id))
    .orderBy(desc(stockMovements.createdAt))
    .limit(100);

  return NextResponse.json(movements);
}
