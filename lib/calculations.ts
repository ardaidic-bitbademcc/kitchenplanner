export interface BaseProductCalc {
  baseProductId: string;
  name: string;
  unit: string;
  yieldQty: number;
  fireRate: number;
  shelfLifeHours: number;
  netQty: number;
  brutQty: number;
}

export interface RawMaterialCalc {
  rawMaterialId: string;
  name: string;
  unit: string;
  unitCost: number;
  requiredQty: number;
  totalCost: number;
}

export function calcBrutQty(netQty: number, fireRate: number): number {
  return netQty * (1 + fireRate) * 1.05;
}

export function calcRawMaterialQty(brutQty: number, qtyPerUnit: number): number {
  return brutQty * qtyPerUnit;
}

export function calcPortionCost(
  ingredients: { unitCost: number; qty: number }[],
  yieldQty: number
): number {
  const totalCost = ingredients.reduce((sum, i) => sum + i.unitCost * i.qty, 0);
  return yieldQty > 0 ? totalCost / yieldQty : 0;
}

export function calcFifoDeadline(assemblyDate: Date, shelfLifeHours: number): Date {
  return new Date(assemblyDate.getTime() + shelfLifeHours * 60 * 60 * 1000);
}
