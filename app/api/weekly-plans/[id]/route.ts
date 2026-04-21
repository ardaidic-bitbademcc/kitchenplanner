import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { weeklyPlans, weeklyPlanItems, scheduleTasks, products } from "@/lib/schema";
import { eq } from "drizzle-orm";

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  const plan = await db.query.weeklyPlans.findFirst({ where: eq(weeklyPlans.id, params.id) });
  if (!plan) return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });
  const items = await db
    .select({ id: weeklyPlanItems.id, productId: weeklyPlanItems.productId, targetQty: weeklyPlanItems.targetQty, productName: products.name })
    .from(weeklyPlanItems)
    .leftJoin(products, eq(weeklyPlanItems.productId, products.id))
    .where(eq(weeklyPlanItems.planId, params.id));
  const tasks = await db.select().from(scheduleTasks).where(eq(scheduleTasks.planId, params.id)).orderBy(scheduleTasks.dayOfWeek);
  return NextResponse.json({ ...plan, items, tasks });
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session || session.user.role !== "admin")
    return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
  const body = await req.json();
  const { items, ...planData } = body;
  const [plan] = await db.update(weeklyPlans).set({ ...planData, updatedAt: new Date() }).where(eq(weeklyPlans.id, params.id)).returning();
  if (items) {
    await db.delete(weeklyPlanItems).where(eq(weeklyPlanItems.planId, params.id));
    if (items.length > 0) {
      await db.insert(weeklyPlanItems).values(items.map((i: any) => ({ ...i, planId: params.id })));
    }
  }
  return NextResponse.json(plan);
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session || session.user.role !== "admin")
    return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
  await db.delete(weeklyPlans).where(eq(weeklyPlans.id, params.id));
  return NextResponse.json({ ok: true });
}
