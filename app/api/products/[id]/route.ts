import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { products, productBaseRequirements, productStages, baseProducts } from "@/lib/schema";
import { eq } from "drizzle-orm";

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  const product = await db.query.products.findFirst({ where: eq(products.id, params.id) });
  if (!product) return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });
  const baseReqs = await db
    .select({ id: productBaseRequirements.id, baseProductId: productBaseRequirements.baseProductId, qtyPerUnit: productBaseRequirements.qtyPerUnit, baseProductName: baseProducts.name })
    .from(productBaseRequirements)
    .leftJoin(baseProducts, eq(productBaseRequirements.baseProductId, baseProducts.id))
    .where(eq(productBaseRequirements.productId, params.id));
  const stages = await db.select().from(productStages).where(eq(productStages.productId, params.id)).orderBy(productStages.stageOrder);
  return NextResponse.json({ ...product, baseRequirements: baseReqs, stages });
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session || session.user.role !== "admin")
    return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
  const body = await req.json();
  const [item] = await db.update(products).set({ ...body, updatedAt: new Date() }).where(eq(products.id, params.id)).returning();
  return NextResponse.json(item);
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session || session.user.role !== "admin")
    return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
  await db.delete(products).where(eq(products.id, params.id));
  return NextResponse.json({ ok: true });
}
