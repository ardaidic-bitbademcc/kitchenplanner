import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { weeklyPlans, weeklyPlanItems } from "@/lib/schema";
import { desc } from "drizzle-orm";
import { z } from "zod";

const schema = z.object({
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Geçersiz tarih formatı (YYYY-MM-DD)"),
  status: z.enum(["draft", "active", "completed"]).optional().default("draft"),
  items: z.array(z.object({ productId: z.string().uuid(), targetQty: z.number() })).optional().default([]),
});

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  const data = await db.select().from(weeklyPlans).orderBy(desc(weeklyPlans.weekStart));
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "admin")
    return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Geçersiz veri" }, { status: 400 });
  const userId = session.user.id;
  const [plan] = await db.insert(weeklyPlans).values({ weekStart: parsed.data.weekStart, status: parsed.data.status, createdBy: userId }).returning();
  if (parsed.data.items.length > 0) {
    await db.insert(weeklyPlanItems).values(parsed.data.items.map((i) => ({ ...i, planId: plan.id })));
  }
  return NextResponse.json(plan, { status: 201 });
}
