import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { rawMaterials, stockMovements } from "@/lib/schema";
import { eq, sql } from "drizzle-orm";
import { convertUnit, isSameCategory } from "@/lib/unit-converter";
import { z } from "zod";

const schema = z.object({
  qty: z.number().positive(),
  unit: z.string().min(1),
  notes: z.string().optional(),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session || session.user.role !== "admin")
    return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Geçersiz veri" }, { status: 400 });

  const rmRows = await db
    .select()
    .from(rawMaterials)
    .where(eq(rawMaterials.id, params.id))
    .limit(1);
  const rm = rmRows[0];
  if (!rm) return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });

  // Birim dönüşümü: giriş unit → stok unit
  const qtyInStockUnit = convertUnit(parsed.data.qty, parsed.data.unit, rm.unit);
  const sameCategory = isSameCategory(parsed.data.unit, rm.unit);

  if (!sameCategory) {
    return NextResponse.json(
      { error: `Birim uyumsuzluğu: "${parsed.data.unit}" ile "${rm.unit}" aynı kategoride değil` },
      { status: 400 }
    );
  }

  await db
    .update(rawMaterials)
    .set({
      stockQty: sql`${rawMaterials.stockQty} + ${qtyInStockUnit.toFixed(4)}`,
      updatedAt: new Date(),
    })
    .where(eq(rawMaterials.id, params.id));

  await db.insert(stockMovements).values({
    rawMaterialId: params.id,
    type: "restock",
    qtyChange: qtyInStockUnit.toFixed(4),
    unit: rm.unit,
    notes: parsed.data.notes || `${parsed.data.qty} ${parsed.data.unit} giriş`,
  });

  const [updated] = await db
    .select()
    .from(rawMaterials)
    .where(eq(rawMaterials.id, params.id))
    .limit(1);

  return NextResponse.json(updated);
}
