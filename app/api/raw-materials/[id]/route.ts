import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { rawMaterials } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(1).optional(),
  unit: z.string().min(1).optional(),
  unitCost: z.string().optional(),
  stockQty: z.string().optional(),
  minStock: z.string().optional(),
  shelfLifeHours: z.number().nullable().optional(),
});

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session || (session.user as any).role !== "admin")
    return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Geçersiz veri" }, { status: 400 });
  const [item] = await db
    .update(rawMaterials)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(rawMaterials.id, params.id))
    .returning();
  return NextResponse.json(item);
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session || (session.user as any).role !== "admin")
    return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
  await db.delete(rawMaterials).where(eq(rawMaterials.id, params.id));
  return NextResponse.json({ ok: true });
}
