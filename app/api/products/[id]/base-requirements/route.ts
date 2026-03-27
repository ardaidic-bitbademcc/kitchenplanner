import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { productBaseRequirements } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

const schema = z.array(z.object({
  baseProductId: z.string().uuid(),
  qtyPerUnit: z.string(),
}));

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session || (session.user as any).role !== "admin")
    return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Geçersiz veri" }, { status: 400 });
  await db.delete(productBaseRequirements).where(eq(productBaseRequirements.productId, params.id));
  if (parsed.data.length > 0) {
    await db.insert(productBaseRequirements).values(parsed.data.map((r) => ({ ...r, productId: params.id })));
  }
  return NextResponse.json({ ok: true });
}
