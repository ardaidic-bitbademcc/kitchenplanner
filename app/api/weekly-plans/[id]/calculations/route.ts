import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { weeklyPlanItems, productBaseRequirements, baseProducts, baseProductIngredients, rawMaterials } from "@/lib/schema";
import { eq, inArray } from "drizzle-orm";
import { calcBrutQty } from "@/lib/calculations";

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const items = await db.select().from(weeklyPlanItems).where(eq(weeklyPlanItems.planId, params.id));
  if (items.length === 0) {
    return NextResponse.json({ baseProducts: [], rawMaterials: [], totalCost: 0 });
  }

  // Tek seferde tüm ürünlerin baz gereksinimlerini çek
  const productIds = items.map((i) => i.productId);
  const allReqs = await db
    .select()
    .from(productBaseRequirements)
    .where(inArray(productBaseRequirements.productId, productIds));

  if (allReqs.length === 0) {
    return NextResponse.json({ baseProducts: [], rawMaterials: [], totalCost: 0 });
  }

  const bpIds = Array.from(new Set(allReqs.map((r) => r.baseProductId)));

  // Tüm baz ürünleri ve malzemeleri paralel olarak tek seferde çek
  const [allBps, allIngredients] = await Promise.all([
    db.select().from(baseProducts).where(inArray(baseProducts.id, bpIds)),
    db
      .select({
        baseProductId: baseProductIngredients.baseProductId,
        rawMaterialId: baseProductIngredients.rawMaterialId,
        qtyPerUnit: baseProductIngredients.qtyPerUnit,
        unit: baseProductIngredients.unit,
        name: rawMaterials.name,
        unitCost: rawMaterials.unitCost,
      })
      .from(baseProductIngredients)
      .leftJoin(rawMaterials, eq(baseProductIngredients.rawMaterialId, rawMaterials.id))
      .where(inArray(baseProductIngredients.baseProductId, bpIds)),
  ]);

  // Lookup map'leri
  const bpMap = new Map(allBps.map((bp) => [bp.id, bp]));
  const ingMap = new Map<string, typeof allIngredients>();
  for (const ing of allIngredients) {
    if (!ingMap.has(ing.baseProductId)) ingMap.set(ing.baseProductId, []);
    ingMap.get(ing.baseProductId)!.push(ing);
  }
  const itemQtyMap = new Map(items.map((i) => [i.productId, i.targetQty]));

  const baseProductMap = new Map<string, { name: string; unit: string; yieldQty: number; fireRate: number; shelfLifeHours: number; netQty: number; brutQty: number }>();
  const rawMaterialMap = new Map<string, { name: string; unit: string; unitCost: number; requiredQty: number; totalCost: number }>();

  for (const req of allReqs) {
    const bp = bpMap.get(req.baseProductId);
    if (!bp) continue;

    const targetQty = itemQtyMap.get(req.productId) ?? 0;
    const netQty = targetQty * parseFloat(req.qtyPerUnit as string);
    const brutQty = calcBrutQty(netQty, parseFloat(bp.fireRate as string));

    const existingBp = baseProductMap.get(bp.id);
    if (existingBp) {
      existingBp.netQty += netQty;
      existingBp.brutQty += brutQty;
    } else {
      baseProductMap.set(bp.id, {
        name: bp.name,
        unit: bp.unit,
        yieldQty: parseFloat(bp.yieldQty as string),
        fireRate: parseFloat(bp.fireRate as string),
        shelfLifeHours: bp.shelfLifeHours,
        netQty,
        brutQty,
      });
    }

    for (const ing of ingMap.get(bp.id) ?? []) {
      if (!ing.rawMaterialId) continue;
      const reqQty = brutQty * parseFloat(ing.qtyPerUnit as string);
      const unitCost = parseFloat(ing.unitCost as string);
      const existingRm = rawMaterialMap.get(ing.rawMaterialId);
      if (existingRm) {
        existingRm.requiredQty += reqQty;
        existingRm.totalCost += reqQty * unitCost;
      } else {
        rawMaterialMap.set(ing.rawMaterialId, {
          name: ing.name || "",
          unit: ing.unit,
          unitCost,
          requiredQty: reqQty,
          totalCost: reqQty * unitCost,
        });
      }
    }
  }

  return NextResponse.json({
    baseProducts: Array.from(baseProductMap.entries()).map(([id, v]) => ({ id, ...v })),
    rawMaterials: Array.from(rawMaterialMap.entries()).map(([id, v]) => ({ id, ...v })),
    totalCost: Array.from(rawMaterialMap.values()).reduce((s, v) => s + v.totalCost, 0),
  });
}
