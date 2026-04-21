import { db } from "./db";
import {
  weeklyPlanItems,
  productBaseRequirements,
  productStages,
  baseProducts,
  scheduleTasks,
  weeklyPlans,
  products,
} from "./schema";
import { eq } from "drizzle-orm";
import { calcBrutQty, calcFifoDeadline } from "./calculations";

// Parse a date string like "2026-03-30" as local midnight (avoid UTC shift)
function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export async function generateSchedule(planId: string): Promise<void> {
  const plan = await db.select().from(weeklyPlans).where(eq(weeklyPlans.id, planId)).limit(1).then(r => r[0]);
  if (!plan) throw new Error("Plan bulunamadı");

  // weekStart is the Monday of the week
  const weekStart = parseLocalDate(String(plan.weekStart));

  // Friday = weekStart + 4 days (Monday=0 offset)
  const fridayDate = new Date(weekStart);
  fridayDate.setDate(weekStart.getDate() + 4);

  const items = await db.select().from(weeklyPlanItems).where(eq(weeklyPlanItems.planId, planId));

  if (items.length === 0) {
    // Still delete old tasks even if no items
    await db.delete(scheduleTasks).where(eq(scheduleTasks.planId, planId));
    return;
  }

  type TaskEntry = {
    planId: string;
    productId: string | null;
    baseProductId: string | null;
    dayOfWeek: number;
    stageName: string;
    taskDescription: string;
    requiredQty: number;
    unit: string;
    fifoDeadline: Date | null;
    status: "pending" | "done";
  };

  const taskMap = new Map<string, TaskEntry>();

  for (const item of items) {
    const baseReqs = await db
      .select()
      .from(productBaseRequirements)
      .where(eq(productBaseRequirements.productId, item.productId));

    const stages = await db
      .select()
      .from(productStages)
      .where(eq(productStages.productId, item.productId))
      .orderBy(productStages.stageOrder);

    const productRows = await db
      .select()
      .from(products)
      .where(eq(products.id, item.productId))
      .limit(1);
    const product = productRows[0];

    if (stages.length === 0) continue; // skip products with no stages defined

    for (const req of baseReqs) {
      const bpRows = await db
        .select()
        .from(baseProducts)
        .where(eq(baseProducts.id, req.baseProductId))
        .limit(1);
      const bp = bpRows[0];
      if (!bp) continue;

      const netQty = item.targetQty * parseFloat(req.qtyPerUnit as string);
      const brutQty = calcBrutQty(netQty, parseFloat(bp.fireRate as string));

      for (const stage of stages) {
        // dayOffset is relative to Friday (sales day)
        // e.g. dayOffset=-3 means 3 days before Friday = Tuesday
        const taskDay = new Date(fridayDate);
        taskDay.setDate(fridayDate.getDate() + stage.dayOffset);

        // getDay(): 0=Sun,1=Mon,...,6=Sat → convert to 1=Mon,...,7=Sun
        const jsDay = taskDay.getDay();
        const dayOfWeek = jsDay === 0 ? 7 : jsDay;

        // FIFO deadline = production date + shelf life hours (use-by date)
        let fifoDeadline: Date | null = null;
        if (bp.shelfLifeHours) {
          fifoDeadline = calcFifoDeadline(taskDay, bp.shelfLifeHours);
        }

        // Consolidate same base-product + day + stage across multiple products
        const key = `${req.baseProductId}_${dayOfWeek}_${stage.stageName}`;
        const existing = taskMap.get(key);

        if (existing) {
          existing.requiredQty += brutQty;
          // Extend task description to include this product too
          if (!existing.taskDescription.includes(product?.name || "")) {
            existing.taskDescription += `, ${product?.name || ""}`;
          }
        } else {
          taskMap.set(key, {
            planId,
            productId: item.productId,
            baseProductId: req.baseProductId,
            dayOfWeek,
            stageName: stage.stageName,
            taskDescription: `${product?.name || ""} - ${stage.stageName} (${bp.name})`,
            requiredQty: brutQty,
            unit: bp.unit,
            fifoDeadline,
            status: "pending",
          });
        }
      }
    }
  }

  // Delete old tasks and insert new ones
  await db.delete(scheduleTasks).where(eq(scheduleTasks.planId, planId));

  const newTasks = Array.from(taskMap.values()).map((t) => ({
    ...t,
    requiredQty: t.requiredQty.toFixed(4),
  }));

  if (newTasks.length > 0) {
    await db.insert(scheduleTasks).values(newTasks);
  }
}
