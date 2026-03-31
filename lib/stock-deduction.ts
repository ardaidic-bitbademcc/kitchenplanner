import { db } from "./db";
import {
  scheduleTasks,
  baseProducts,
  baseProductIngredients,
  baseProductSubProducts,
  rawMaterials,
  stockMovements,
} from "./schema";
import { eq, sql } from "drizzle-orm";
import { convertUnit, isSameCategory } from "./unit-converter";

interface FlatIngredient {
  rawMaterialId: string;
  qty: number;       // in ingredient's own unit
  unit: string;
}

/** Baz ürünün tüm hammaddelerini (alt baz ürünler dahil) özyinelemeli olarak düzleştirir */
async function flattenIngredients(
  baseProductId: string,
  multiplier: number,
  visited = new Set<string>()
): Promise<FlatIngredient[]> {
  if (visited.has(baseProductId)) return [];
  visited.add(baseProductId);

  const result: FlatIngredient[] = [];

  // Doğrudan hammaddeler
  const ingredients = await db
    .select()
    .from(baseProductIngredients)
    .where(eq(baseProductIngredients.baseProductId, baseProductId));

  for (const ing of ingredients) {
    result.push({
      rawMaterialId: ing.rawMaterialId,
      qty: parseFloat(ing.qtyPerUnit as string) * multiplier,
      unit: ing.unit,
    });
  }

  // Alt baz ürünler (özyinelemeli)
  const subBps = await db
    .select()
    .from(baseProductSubProducts)
    .where(eq(baseProductSubProducts.baseProductId, baseProductId));

  for (const sub of subBps) {
    const subMultiplier = parseFloat(sub.qtyPerBatch as string) * multiplier;
    const subIngredients = await flattenIngredients(
      sub.subBaseProductId,
      subMultiplier,
      new Set(visited)
    );
    result.push(...subIngredients);
  }

  return result;
}

/** Görev tamamlandığında stoktan düş ve hareket kaydı oluştur */
export async function deductStockForTask(taskId: string): Promise<void> {
  // Görevi getir
  const taskRows = await db
    .select()
    .from(scheduleTasks)
    .where(eq(scheduleTasks.id, taskId))
    .limit(1);
  const task = taskRows[0];
  if (!task || !task.baseProductId) return;

  // Baz ürünü getir (yieldQty ve unit için)
  const bpRows = await db
    .select()
    .from(baseProducts)
    .where(eq(baseProducts.id, task.baseProductId))
    .limit(1);
  const bp = bpRows[0];
  if (!bp) return;

  // Kaç birim üretildi → kaç parti?
  // task.requiredQty: görevin üretmesi gereken miktar (bp.unit cinsinden)
  const requiredQty = parseFloat(task.requiredQty as string);
  const yieldQty    = parseFloat(bp.yieldQty as string);
  // Her parti yieldQty kadar üretir; requiredQty ÷ yieldQty = parti sayısı
  const batches = yieldQty > 0 ? requiredQty / yieldQty : 1;

  // Tüm hammadde ihtiyaçlarını düzleştir
  const flat = await flattenIngredients(task.baseProductId, batches);

  // rawMaterialId bazında topla (aynı hammadde birden fazla kez çıkabilir)
  const grouped = new Map<string, { qty: number; unit: string }>();
  for (const f of flat) {
    const existing = grouped.get(f.rawMaterialId);
    if (existing) {
      // Birimi stok birimiyle uyumlu şekilde ekle
      existing.qty += convertUnit(f.qty, f.unit, existing.unit);
    } else {
      grouped.set(f.rawMaterialId, { qty: f.qty, unit: f.unit });
    }
  }

  // Her hammadde için stoktan düş
  for (const [rawMaterialId, { qty, unit }] of Array.from(grouped.entries())) {
    // Mevcut stok birimini bul
    const rmRows = await db
      .select({ stockQty: rawMaterials.stockQty, unit: rawMaterials.unit })
      .from(rawMaterials)
      .where(eq(rawMaterials.id, rawMaterialId))
      .limit(1);
    const rm = rmRows[0];
    if (!rm) continue;

    // Birim dönüşümü: ingredient unit → stok unit
    const deductInStockUnit = convertUnit(qty, unit, rm.unit);

    // Stoku güncelle (negatife düşürme — uyarı için kontrol edilebilir ama şimdilik izin ver)
    await db
      .update(rawMaterials)
      .set({
        stockQty: sql`${rawMaterials.stockQty} - ${deductInStockUnit.toFixed(4)}`,
        updatedAt: new Date(),
      })
      .where(eq(rawMaterials.id, rawMaterialId));

    // Hareket kaydı
    await db.insert(stockMovements).values({
      rawMaterialId,
      taskId,
      type: "usage",
      qtyChange: (-deductInStockUnit).toFixed(4),
      unit: rm.unit,
      notes: `Görev: ${task.taskDescription}`,
    });
  }
}
