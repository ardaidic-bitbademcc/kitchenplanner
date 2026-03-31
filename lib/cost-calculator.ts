import { db } from "./db";
import {
  baseProducts,
  baseProductIngredients,
  baseProductSubProducts,
  rawMaterials,
  products,
  productBaseRequirements,
} from "./schema";
import { eq } from "drizzle-orm";

export interface IngredientLine {
  name: string;
  type: "raw_material" | "base_product";
  qty: number;
  unit: string;
  unitCost: number;
  totalCost: number;
}

export interface BaseProductCostResult {
  id: string;
  name: string;
  unit: string;
  yieldQty: number;
  costPerUnit: number; // cost per 1 unit of output
  totalIngredientCost: number;
  lines: IngredientLine[];
}

export interface ProductCostResult {
  id: string;
  name: string;
  sellingPrice: number | null;
  costPerUnit: number;
  profitPerUnit: number | null;
  marginPct: number | null;
  baseProductLines: Array<{
    baseProductId: string;
    name: string;
    qtyPerUnit: number;
    unit: string;
    costPerBpUnit: number;
    totalCost: number;
  }>;
}

// Recursive: calculates cost per 1 unit of a base product
export async function calcBaseProductCost(
  baseProductId: string,
  visited = new Set<string>()
): Promise<BaseProductCostResult> {
  if (visited.has(baseProductId)) {
    throw new Error("Döngüsel baz ürün referansı tespit edildi");
  }
  visited.add(baseProductId);

  const bpRows = await db
    .select()
    .from(baseProducts)
    .where(eq(baseProducts.id, baseProductId))
    .limit(1);
  const bp = bpRows[0];
  if (!bp) throw new Error(`Baz ürün bulunamadı: ${baseProductId}`);

  const yieldQty = parseFloat(bp.yieldQty as string);
  const lines: IngredientLine[] = [];

  // 1. Raw material ingredients
  const ingredients = await db
    .select({
      rawMaterialId: baseProductIngredients.rawMaterialId,
      qtyPerUnit: baseProductIngredients.qtyPerUnit,
      unit: baseProductIngredients.unit,
      name: rawMaterials.name,
      unitCost: rawMaterials.unitCost,
    })
    .from(baseProductIngredients)
    .leftJoin(rawMaterials, eq(baseProductIngredients.rawMaterialId, rawMaterials.id))
    .where(eq(baseProductIngredients.baseProductId, baseProductId));

  for (const ing of ingredients) {
    const qty = parseFloat(ing.qtyPerUnit as string);
    const unitCost = parseFloat(ing.unitCost as string || "0");
    lines.push({
      name: ing.name || "?",
      type: "raw_material",
      qty,
      unit: ing.unit,
      unitCost,
      totalCost: qty * unitCost,
    });
  }

  // 2. Sub base products (recursive)
  const subBps = await db
    .select()
    .from(baseProductSubProducts)
    .where(eq(baseProductSubProducts.baseProductId, baseProductId));

  for (const sub of subBps) {
    const subResult = await calcBaseProductCost(sub.subBaseProductId, new Set(visited));
    const qty = parseFloat(sub.qtyPerBatch as string);
    lines.push({
      name: subResult.name,
      type: "base_product",
      qty,
      unit: sub.unit,
      unitCost: subResult.costPerUnit,
      totalCost: qty * subResult.costPerUnit,
    });
  }

  const totalIngredientCost = lines.reduce((s, l) => s + l.totalCost, 0);
  const costPerUnit = yieldQty > 0 ? totalIngredientCost / yieldQty : 0;

  return {
    id: bp.id,
    name: bp.name,
    unit: bp.unit,
    yieldQty,
    costPerUnit,
    totalIngredientCost,
    lines,
  };
}

// Calculate cost per unit of a final product
export async function calcProductCost(productId: string): Promise<ProductCostResult> {
  const prodRows = await db.select().from(products).where(eq(products.id, productId)).limit(1);
  const product = prodRows[0];
  if (!product) throw new Error(`Ürün bulunamadı: ${productId}`);

  const baseReqs = await db
    .select()
    .from(productBaseRequirements)
    .where(eq(productBaseRequirements.productId, productId));

  const baseProductLines = [];
  let totalCostPerUnit = 0;

  for (const req of baseReqs) {
    const bpCost = await calcBaseProductCost(req.baseProductId);
    const qtyPerUnit = parseFloat(req.qtyPerUnit as string);
    const lineCost = qtyPerUnit * bpCost.costPerUnit;
    totalCostPerUnit += lineCost;
    baseProductLines.push({
      baseProductId: req.baseProductId,
      name: bpCost.name,
      qtyPerUnit,
      unit: "adet başı",
      costPerBpUnit: bpCost.costPerUnit,
      totalCost: lineCost,
    });
  }

  const sellingPrice = product.sellingPrice ? parseFloat(product.sellingPrice as string) : null;
  const profitPerUnit = sellingPrice !== null ? sellingPrice - totalCostPerUnit : null;
  const marginPct =
    sellingPrice && sellingPrice > 0 ? (profitPerUnit! / sellingPrice) * 100 : null;

  return {
    id: product.id,
    name: product.name,
    sellingPrice,
    costPerUnit: totalCostPerUnit,
    profitPerUnit,
    marginPct,
    baseProductLines,
  };
}
