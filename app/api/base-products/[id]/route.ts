import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { baseProducts, baseProductIngredients, rawMaterials } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  const bp = await db.query.baseProducts.findFirst({
    where: eq(baseProducts.id, params.id),
  });
  if (!bp) return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });
  const ingredients = await db
    .select({ id: baseProductIngredients.id, rawMaterialId: baseProductIngredients.rawMaterialId, qtyPerUnit: baseProductIngredients.qtyPerUnit, unit: baseProductIngredients.unit, rawMaterialName: rawMaterials.name })
    .from(baseProductIngredients)
    .leftJoin(rawMaterials, eq(baseProductIngredients.rawMaterialId, rawMaterials.id))
    .where(eq(baseProductIngredients.baseProductId, params.id));
  return NextResponse.json({ ...bp, ingredients });
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session || session.user.role !== "admin")
    return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
  const body = await req.json();
  const [item] = await db
    .update(baseProducts)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(baseProducts.id, params.id))
    .returning();
  return NextResponse.json(item);
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session || session.user.role !== "admin")
    return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
  await db.delete(baseProducts).where(eq(baseProducts.id, params.id));
  return NextResponse.json({ ok: true });
}
