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

export async function generateSchedule(planId: string): Promise<void> {
  const plan = await db.query.weeklyPlans.findFirst({
    where: eq(weeklyPlans.id, planId),
  });
  if (!plan) throw new Error("Plan bulunamadı");

  const weekStart = new Date(plan.weekStart);
  // Last sales day = Friday (day_of_week=5), offset from Monday
  const fridayDate = new Date(weekStart);
  fridayDate.setDate(weekStart.getDate() + 4); // Monday + 4 = Friday

  const items = await db.query.weeklyPlanItems.findMany({
    where: eq(weeklyPlanItems.planId, planId),
  });

  // Map: key = `${baseProductId}_${dayOfWeek}_${stageName}` => consolidated task
  const taskMap = new Map<
    string,
    {
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
    }
  >();

  for (const item of items) {
    const baseReqs = await db.query.productBaseRequirements.findMany({
      where: eq(productBaseRequirements.productId, item.productId),
    });

    const stages = await db.query.productStages.findMany({
      where: eq(productStages.productId, item.productId),
    });

    const product = await db.query.products.findFirst({
      where: eq(products.id, item.productId),
    });

    for (const req of baseReqs) {
      const bp = await db.query.baseProducts.findFirst({
        where: eq(baseProducts.id, req.baseProductId),
      });
      if (!bp) continue;

      const netQty = item.targetQty * parseFloat(req.qtyPerUnit as string);
      const brutQty = calcBrutQty(netQty, parseFloat(bp.fireRate as string));

      for (const stage of stages) {
        const taskDay = new Date(fridayDate);
        taskDay.setDate(fridayDate.getDate() + stage.dayOffset);
        const dayOfWeek = taskDay.getDay() === 0 ? 7 : taskDay.getDay();

        let fifoDeadline: Date | null = null;
        if (bp.shelfLifeHours && stage.dayOffset === 0) {
          fifoDeadline = calcFifoDeadline(fridayDate, bp.shelfLifeHours);
        }

        const key = `${req.baseProductId}_${dayOfWeek}_${stage.stageName}`;
        const existing = taskMap.get(key);

        if (existing) {
          existing.requiredQty += brutQty;
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

  // Transaction: delete existing tasks, insert new ones
  await db.delete(scheduleTasks).where(eq(scheduleTasks.planId, planId));

  const newTasks = Array.from(taskMap.values()).map((t) => ({
    ...t,
    requiredQty: t.requiredQty.toString(),
  }));

  if (newTasks.length > 0) {
    await db.insert(scheduleTasks).values(newTasks);
  }
}
