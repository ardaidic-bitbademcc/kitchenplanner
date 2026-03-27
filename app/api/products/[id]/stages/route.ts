import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { productStages } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

const schema = z.array(z.object({
  stageName: z.string(),
  stageOrder: z.number(),
  dayOffset: z.number(),
  durationHours: z.string(),
  notes: z.string().nullable().optional(),
}));

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session || (session.user as any).role !== "admin")
    return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Geçersiz veri" }, { status: 400 });
  await db.delete(productStages).where(eq(productStages.productId, params.id));
  if (parsed.data.length > 0) {
    await db.insert(productStages).values(parsed.data.map((s) => ({ ...s, productId: params.id })));
  }
  return NextResponse.json({ ok: true });
}
