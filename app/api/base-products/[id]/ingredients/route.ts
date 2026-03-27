import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { baseProductIngredients } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

const schema = z.array(z.object({
  rawMaterialId: z.string().uuid(),
  qtyPerUnit: z.string(),
  unit: z.string(),
}));

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session || (session.user as any).role !== "admin")
    return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Geçersiz veri" }, { status: 400 });
  await db.delete(baseProductIngredients).where(eq(baseProductIngredients.baseProductId, params.id));
  if (parsed.data.length > 0) {
    await db.insert(baseProductIngredients).values(
      parsed.data.map((i) => ({ ...i, baseProductId: params.id }))
    );
  }
  return NextResponse.json({ ok: true });
}
