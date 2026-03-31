import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { salesHistory, products } from "@/lib/schema";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";

const schema = z.object({
  productId: z.string().uuid(),
  weekStart: z.string(),
  soldQty: z.number().int().min(0),
  notes: z.string().optional(),
});

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  const data = await db
    .select({
      id: salesHistory.id,
      productId: salesHistory.productId,
      productName: products.name,
      weekStart: salesHistory.weekStart,
      soldQty: salesHistory.soldQty,
      notes: salesHistory.notes,
      createdAt: salesHistory.createdAt,
    })
    .from(salesHistory)
    .leftJoin(products, eq(salesHistory.productId, products.id))
    .orderBy(desc(salesHistory.weekStart));
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user as any).role !== "admin")
    return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Geçersiz veri" }, { status: 400 });
  const [item] = await db.insert(salesHistory).values(parsed.data).returning();
  return NextResponse.json(item, { status: 201 });
}
