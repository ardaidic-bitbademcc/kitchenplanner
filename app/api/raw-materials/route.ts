import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { rawMaterials } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(1),
  unit: z.string().min(1),
  unitCost: z.string(),
  stockQty: z.string().optional().default("0"),
  minStock: z.string().optional().default("0"),
  shelfLifeHours: z.number().nullable().optional(),
});

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  const data = await db.select().from(rawMaterials).orderBy(rawMaterials.name);
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "admin")
    return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Geçersiz veri" }, { status: 400 });
  const [item] = await db.insert(rawMaterials).values(parsed.data).returning();
  return NextResponse.json(item, { status: 201 });
}
