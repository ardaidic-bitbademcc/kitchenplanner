/**
 * Sabit birim dönüşüm tablosu
 * base: hangi temel birime dönüştürülür
 * factor: 1 birim = factor * base
 */
export const UNIT_MAP: Record<string, { base: "g" | "ml" | "adet"; factor: number }> = {
  // Ağırlık (base: gram)
  g:         { base: "g", factor: 1 },
  gr:        { base: "g", factor: 1 },
  gram:      { base: "g", factor: 1 },
  kg:        { base: "g", factor: 1000 },
  kilogram:  { base: "g", factor: 1000 },
  mg:        { base: "g", factor: 0.001 },
  // Hacim (base: ml)
  ml:        { base: "ml", factor: 1 },
  litre:     { base: "ml", factor: 1000 },
  lt:        { base: "ml", factor: 1000 },
  l:         { base: "ml", factor: 1000 },
  cl:        { base: "ml", factor: 10 },
  dl:        { base: "ml", factor: 100 },
  // Adet (base: adet)
  adet:      { base: "adet", factor: 1 },
  düzine:    { base: "adet", factor: 12 },
};

function normalize(unit: string) {
  return unit.toLowerCase().trim();
}

/** qty değerini temel birime çevirir. Bilinmeyen birimde qty aynen döner. */
export function toBase(qty: number, unit: string): { qty: number; base: string } {
  const entry = UNIT_MAP[normalize(unit)];
  if (!entry) return { qty, base: normalize(unit) };
  return { qty: qty * entry.factor, base: entry.base };
}

/**
 * fromUnit cinsinden qty'yi toUnit'e çevirir.
 * Farklı kategoriler (ağırlık↔hacim) uyumsuzsa qty olduğu gibi döner.
 */
export function convertUnit(qty: number, fromUnit: string, toUnit: string): number {
  const from = UNIT_MAP[normalize(fromUnit)];
  const to   = UNIT_MAP[normalize(toUnit)];
  // Bilinmeyen ya da farklı kategori → dönüşüm yapma
  if (!from || !to || from.base !== to.base) return qty;
  return (qty * from.factor) / to.factor;
}

/** İki birimin aynı kategoride (ağırlık, hacim, adet) olup olmadığını kontrol eder */
export function isSameCategory(unitA: string, unitB: string): boolean {
  const a = UNIT_MAP[normalize(unitA)];
  const b = UNIT_MAP[normalize(unitB)];
  if (!a || !b) return unitA === unitB;
  return a.base === b.base;
}
