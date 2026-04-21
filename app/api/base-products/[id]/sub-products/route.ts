import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { baseProductSubProducts, baseProducts } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

const schema = z.array(
  z.object({
    subBaseProductId: z.string().uuid(),
    qtyPerBatch: z.string(),
    unit: z.string(),
  })
);

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const rows = await db
    .select({
      id: baseProductSubProducts.id,
      subBaseProductId: baseProductSubProducts.subBaseProductId,
      qtyPerBatch: baseProductSubProducts.qtyPerBatch,
      unit: baseProductSubProducts.unit,
      subName: baseProducts.name,
      subUnit: baseProducts.unit,
    })
    .from(baseProductSubProducts)
    .leftJoin(baseProducts, eq(baseProductSubProducts.subBaseProductId, baseProducts.id))
    .where(eq(baseProductSubProducts.baseProductId, params.id));

  return NextResponse.json(rows);
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session || session.user.role !== "admin")
    return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Geçersiz veri" }, { status: 400 });

  // Prevent self-reference
  if (parsed.data.some((r) => r.subBaseProductId === params.id)) {
    return NextResponse.json({ error: "Baz ürün kendini içeremez" }, { status: 400 });
  }

  await db.delete(baseProductSubProducts).where(eq(baseProductSubProducts.baseProductId, params.id));

  if (parsed.data.length > 0) {
    await db
      .insert(baseProductSubProducts)
      .values(parsed.data.map((r) => ({ ...r, baseProductId: params.id })));
  }

  return NextResponse.json({ ok: true });
}
