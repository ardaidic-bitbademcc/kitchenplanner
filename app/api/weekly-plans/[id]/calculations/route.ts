import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { weeklyPlanItems, productBaseRequirements, baseProducts, baseProductIngredients, rawMaterials } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { calcBrutQty } from "@/lib/calculations";

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const items = await db.select().from(weeklyPlanItems).where(eq(weeklyPlanItems.planId, params.id));
  const baseProductMap = new Map<string, { name: string; unit: string; yieldQty: number; fireRate: number; shelfLifeHours: number; netQty: number; brutQty: number }>();
  const rawMaterialMap = new Map<string, { name: string; unit: string; unitCost: number; requiredQty: number; totalCost: number }>();

  for (const item of items) {
    const reqs = await db.select().from(productBaseRequirements).where(eq(productBaseRequirements.productId, item.productId));
    for (const req of reqs) {
      const bp = await db.query.baseProducts.findFirst({ where: eq(baseProducts.id, req.baseProductId) });
      if (!bp) continue;
      const netQty = item.targetQty * parseFloat(req.qtyPerUnit as string);
      const brutQty = calcBrutQty(netQty, parseFloat(bp.fireRate as string));
      const existing = baseProductMap.get(bp.id);
      if (existing) {
        existing.netQty += netQty;
        existing.brutQty += brutQty;
      } else {
        baseProductMap.set(bp.id, { name: bp.name, unit: bp.unit, yieldQty: parseFloat(bp.yieldQty as string), fireRate: parseFloat(bp.fireRate as string), shelfLifeHours: bp.shelfLifeHours, netQty, brutQty });
      }

      const ingredients = await db.select({ rawMaterialId: baseProductIngredients.rawMaterialId, qtyPerUnit: baseProductIngredients.qtyPerUnit, unit: baseProductIngredients.unit, name: rawMaterials.name, unitCost: rawMaterials.unitCost }).from(baseProductIngredients).leftJoin(rawMaterials, eq(baseProductIngredients.rawMaterialId, rawMaterials.id)).where(eq(baseProductIngredients.baseProductId, bp.id));
      for (const ing of ingredients) {
        if (!ing.rawMaterialId) continue;
        const reqQty = brutQty * parseFloat(ing.qtyPerUnit as string);
        const unitCost = parseFloat(ing.unitCost as string);
        const existing = rawMaterialMap.get(ing.rawMaterialId);
        if (existing) {
          existing.requiredQty += reqQty;
          existing.totalCost += reqQty * unitCost;
        } else {
          rawMaterialMap.set(ing.rawMaterialId, { name: ing.name || "", unit: ing.unit, unitCost, requiredQty: reqQty, totalCost: reqQty * unitCost });
        }
      }
    }
  }

  return NextResponse.json({
    baseProducts: Array.from(baseProductMap.entries()).map(([id, v]) => ({ id, ...v })),
    rawMaterials: Array.from(rawMaterialMap.entries()).map(([id, v]) => ({ id, ...v })),
    totalCost: Array.from(rawMaterialMap.values()).reduce((s, v) => s + v.totalCost, 0),
  });
}
