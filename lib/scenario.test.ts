/**
 * PASTANE HAFTALIK ÜRETİM PLANI — SENARYO TESTİ
 * Hafta: 14–18 Nisan 2026 (Pazartesi–Cuma)
 * Son satış günü: Cuma 18 Nisan 2026, saat 18:00
 *
 * Bu dosya gerçek bir butik pastane senaryosu simüle eder:
 *   - 15 hammadde
 *   - 10 baz ürün
 *   - 12 satış ürünü + birleştirme malzemeleri
 *   - Yapay zekanın ürettiği haftalık üretim planı
 *   - Tüm hesaplama sonuçları önceden el ile hesaplanmış ve assert edilmiştir
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  calcBrutQty,
  calcRawMaterialQty,
  calcPortionCost,
  calcFifoDeadline,
} from "./calculations";

// ─────────────────────────────────────────────────────────────────────────────
// 1. HAMMADDELER (raw_materials)
// ─────────────────────────────────────────────────────────────────────────────

const RAW = {
  sut:          { name: "Süt",              unit: "litre",  unitCost: 25  },
  yumurta:      { name: "Yumurta",          unit: "adet",   unitCost: 7   },
  tereyagi:     { name: "Tereyağı",         unit: "kg",     unitCost: 450 },
  seker:        { name: "Şeker",            unit: "kg",     unitCost: 55  },
  nisasta:      { name: "Mısır Nişastası",  unit: "kg",     unitCost: 90  },
  un:           { name: "Un",               unit: "kg",     unitCost: 40  },
  vanilya:      { name: "Vanilya Özü",      unit: "ml",     unitCost: 2   },
  cikolata:     { name: "Bitter Çikolata",  unit: "kg",     unitCost: 320 },
  kremSanti:    { name: "Krem Şanti",       unit: "litre",  unitCost: 120 },
  kremPeyniri:  { name: "Krem Peyniri",     unit: "kg",     unitCost: 280 },
  biskuvi:      { name: "Bisküvi",          unit: "kg",     unitCost: 100 },
  limonSuyu:    { name: "Limon Suyu",       unit: "litre",  unitCost: 60  },
  mascarpone:   { name: "Mascarpone",       unit: "kg",     unitCost: 350 },
  kahveOzu:     { name: "Kahve Özü",        unit: "ml",     unitCost: 3   },
  frambuaz:     { name: "Frambuaz Püresi",  unit: "kg",     unitCost: 180 },
};

// ─────────────────────────────────────────────────────────────────────────────
// 2. BAZ ÜRÜNLER (base_products) + İçerikleri
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Her baz ürün için:
 *   yieldQty      : bir partideki çıktı miktarı
 *   fireRate      : fire oranı (0.10 = %10)
 *   shelfLifeHours: raf ömrü (saat)
 *   ingredients   : { unitCost, qty } — calcPortionCost'a girecek format
 */
const BASE = {
  fransizKremasi: {
    name: "Fransız Kreması",
    unit: "kg",
    yieldQty: 1,
    fireRate: 0.10,
    shelfLifeHours: 48,
    // Süt 0.6L + Yumurta 4 adet + Tereyağı 0.05kg + Şeker 0.16kg + Nişasta 0.06kg
    ingredients: [
      { unitCost: RAW.sut.unitCost,      qty: 0.6  },  // 15.00 ₺
      { unitCost: RAW.yumurta.unitCost,  qty: 4    },  // 28.00 ₺
      { unitCost: RAW.tereyagi.unitCost, qty: 0.05 },  // 22.50 ₺
      { unitCost: RAW.seker.unitCost,    qty: 0.16 },  //  8.80 ₺
      { unitCost: RAW.nisasta.unitCost,  qty: 0.06 },  //  5.40 ₺
    ],
    // Toplam: 79.70 ₺ / 1 kg yield → 79.70 ₺/kg
  },

  chouxHamuru: {
    name: "Choux Hamuru",
    unit: "kg",
    yieldQty: 1,
    fireRate: 0.05,
    shelfLifeHours: 24,
    // Süt 0.25L + Tereyağı 0.1kg + Un 0.15kg + Yumurta 3 adet
    ingredients: [
      { unitCost: RAW.sut.unitCost,      qty: 0.25 },  //  6.25 ₺
      { unitCost: RAW.tereyagi.unitCost, qty: 0.1  },  // 45.00 ₺
      { unitCost: RAW.un.unitCost,       qty: 0.15 },  //  6.00 ₺
      { unitCost: RAW.yumurta.unitCost,  qty: 3    },  // 21.00 ₺
    ],
    // Toplam: 78.25 ₺ / 1 kg yield → 78.25 ₺/kg
  },

  pandispanya: {
    name: "Pandispanya (30cm)",
    unit: "adet",
    yieldQty: 1,
    fireRate: 0.08,
    shelfLifeHours: 72,
    // Yumurta 6 adet + Şeker 0.18kg + Un 0.12kg + Vanilya 5ml
    ingredients: [
      { unitCost: RAW.yumurta.unitCost,  qty: 6    },  // 42.00 ₺
      { unitCost: RAW.seker.unitCost,    qty: 0.18 },  //  9.90 ₺
      { unitCost: RAW.un.unitCost,       qty: 0.12 },  //  4.80 ₺
      { unitCost: RAW.vanilya.unitCost,  qty: 5    },  // 10.00 ₺
    ],
    // Toplam: 66.70 ₺ / 1 adet yield → 66.70 ₺/adet
  },

  cikolataliGanaj: {
    name: "Çikolatalı Ganaj",
    unit: "kg",
    yieldQty: 1,
    fireRate: 0.05,
    shelfLifeHours: 96,
    // Bitter Çikolata 0.6kg + Krem Şanti 0.4L + Tereyağı 0.05kg
    ingredients: [
      { unitCost: RAW.cikolata.unitCost,   qty: 0.6  },  // 192.00 ₺
      { unitCost: RAW.kremSanti.unitCost,  qty: 0.4  },  //  48.00 ₺
      { unitCost: RAW.tereyagi.unitCost,   qty: 0.05 },  //  22.50 ₺
    ],
    // Toplam: 262.50 ₺ / 1 kg yield → 262.50 ₺/kg
  },

  limonKremasi: {
    name: "Limon Kreması",
    unit: "kg",
    yieldQty: 1,
    fireRate: 0.08,
    shelfLifeHours: 72,
    // Limon Suyu 0.3L + Şeker 0.3kg + Yumurta 4 adet + Tereyağı 0.15kg
    ingredients: [
      { unitCost: RAW.limonSuyu.unitCost,  qty: 0.3  },  //  18.00 ₺
      { unitCost: RAW.seker.unitCost,      qty: 0.3  },  //  16.50 ₺
      { unitCost: RAW.yumurta.unitCost,    qty: 4    },  //  28.00 ₺
      { unitCost: RAW.tereyagi.unitCost,   qty: 0.15 },  //  67.50 ₺
    ],
    // Toplam: 130.00 ₺ / 1 kg yield → 130.00 ₺/kg
  },

  mascarponKremasi: {
    name: "Mascarpone Kreması",
    unit: "kg",
    yieldQty: 1,
    fireRate: 0.05,
    shelfLifeHours: 48,
    // Mascarpone 0.5kg + Krem Şanti 0.3L + Şeker 0.1kg + Yumurta 2 adet
    ingredients: [
      { unitCost: RAW.mascarpone.unitCost, qty: 0.5  },  // 175.00 ₺
      { unitCost: RAW.kremSanti.unitCost,  qty: 0.3  },  //  36.00 ₺
      { unitCost: RAW.seker.unitCost,      qty: 0.1  },  //   5.50 ₺
      { unitCost: RAW.yumurta.unitCost,    qty: 2    },  //  14.00 ₺
    ],
    // Toplam: 230.50 ₺ / 1 kg yield → 230.50 ₺/kg
  },

  cheesecakeDolgusu: {
    name: "Cheesecake Dolgusu (18cm)",
    unit: "adet",
    yieldQty: 1,
    fireRate: 0.05,
    shelfLifeHours: 96,
    // Krem Peyniri 0.5kg + Şeker 0.15kg + Yumurta 3 adet + Krem Şanti 0.2L + Vanilya 5ml
    ingredients: [
      { unitCost: RAW.kremPeyniri.unitCost, qty: 0.5  },  // 140.00 ₺
      { unitCost: RAW.seker.unitCost,       qty: 0.15 },  //   8.25 ₺
      { unitCost: RAW.yumurta.unitCost,     qty: 3    },  //  21.00 ₺
      { unitCost: RAW.kremSanti.unitCost,   qty: 0.2  },  //  24.00 ₺
      { unitCost: RAW.vanilya.unitCost,     qty: 5    },  //  10.00 ₺
    ],
    // Toplam: 203.25 ₺ / 1 adet yield → 203.25 ₺/adet
  },

  beze: {
    name: "Beze",
    unit: "adet",
    yieldQty: 30,           // bir partiden 30 adet beze çıkar
    fireRate: 0.15,
    shelfLifeHours: 168,    // 1 hafta
    // Yumurta 4 adet (beyaz) + Şeker 0.25kg
    ingredients: [
      { unitCost: RAW.yumurta.unitCost, qty: 4    },  // 28.00 ₺
      { unitCost: RAW.seker.unitCost,   qty: 0.25 },  // 13.75 ₺
    ],
    // Toplam: 41.75 ₺ / 30 adet yield → 1.3917 ₺/adet
  },

  kremKaramelSos: {
    name: "Krem Karamel Sos",
    unit: "litre",
    yieldQty: 1,
    fireRate: 0.10,
    shelfLifeHours: 72,
    // Şeker 0.3kg + Krem Şanti 0.5L
    ingredients: [
      { unitCost: RAW.seker.unitCost,     qty: 0.3  },  //  16.50 ₺
      { unitCost: RAW.kremSanti.unitCost, qty: 0.5  },  //  60.00 ₺
    ],
    // Toplam: 76.50 ₺ / 1 L yield → 76.50 ₺/L
  },

  kremBruleKremasi: {
    name: "Crème Brûlée Kreması",
    unit: "porsiyon",
    yieldQty: 1,
    fireRate: 0.05,
    shelfLifeHours: 48,
    // Krem Şanti 0.1L + Yumurta 1 adet + Şeker 0.02kg + Vanilya 2ml
    ingredients: [
      { unitCost: RAW.kremSanti.unitCost, qty: 0.1  },  //  12.00 ₺
      { unitCost: RAW.yumurta.unitCost,   qty: 1    },  //   7.00 ₺
      { unitCost: RAW.seker.unitCost,     qty: 0.02 },  //   1.10 ₺
      { unitCost: RAW.vanilya.unitCost,   qty: 2    },  //   4.00 ₺
    ],
    // Toplam: 24.10 ₺ / 1 porsiyon yield → 24.10 ₺/porsiyon
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// 3. SATIŞ ÜRÜNLERİ + BİRLEŞTİRME MALZEMELERİ (product_base_requirements)
// ─────────────────────────────────────────────────────────────────────────────
//
// Her satış ürünü için "birleştirme malzemeleri":
//   baseProduct → qtyPerUnit (1 satış ürünü başına kaç birim baz ürün)

const PRODUCTS = {
  ekler: {
    name: "Ekler",
    requirements: [
      { base: BASE.chouxHamuru,    qtyPerUnit: 0.03  },  // 0.03 kg choux / adet
      { base: BASE.fransizKremasi, qtyPerUnit: 0.045 },  // 0.045 kg krem / adet
    ],
  },
  profiterol: {
    name: "Profiterol",
    requirements: [
      { base: BASE.chouxHamuru,    qtyPerUnit: 0.025 },
      { base: BASE.cikolataliGanaj, qtyPerUnit: 0.02 },
    ],
  },
  cikolataliTart: {
    name: "Çikolatalı Tart",
    requirements: [
      { base: BASE.pandispanya,     qtyPerUnit: 0.05  },  // 1/20 pandispanya
      { base: BASE.cikolataliGanaj, qtyPerUnit: 0.06  },
    ],
  },
  limonluTart: {
    name: "Limonlu Tart",
    requirements: [
      { base: BASE.pandispanya,   qtyPerUnit: 0.05  },
      { base: BASE.limonKremasi,  qtyPerUnit: 0.07  },
    ],
  },
  frambuazliPasta: {
    name: "Frambuazlı Yaş Pasta",
    requirements: [
      { base: BASE.pandispanya,    qtyPerUnit: 1     },   // 1 tam pandispanya
      { base: BASE.fransizKremasi, qtyPerUnit: 0.2   },
    ],
  },
  cikolataliPasta: {
    name: "Çikolatalı Yaş Pasta",
    requirements: [
      { base: BASE.pandispanya,     qtyPerUnit: 1     },
      { base: BASE.cikolataliGanaj, qtyPerUnit: 0.25  },
    ],
  },
  millefeuille: {
    name: "Millefeuille",
    requirements: [
      { base: BASE.fransizKremasi, qtyPerUnit: 0.08  },
    ],
  },
  tiramisu: {
    name: "Tiramisu",
    requirements: [
      { base: BASE.mascarponKremasi, qtyPerUnit: 0.12 },
    ],
  },
  cheesecake: {
    name: "Cheesecake",
    requirements: [
      { base: BASE.cheesecakeDolgusu, qtyPerUnit: 1   },  // 1 tam dolgulu taban
    ],
  },
  bezePasta: {
    name: "Beze Pasta",
    requirements: [
      { base: BASE.beze,           qtyPerUnit: 3   },     // 3 beze disk / pasta
    ],
  },
  kremKaramel: {
    name: "Krem Karamel",
    requirements: [
      { base: BASE.kremKaramelSos, qtyPerUnit: 0.08 },    // 80 ml sos / porsiyon
    ],
  },
  cremeBrule: {
    name: "Crème Brûlée",
    requirements: [
      { base: BASE.kremBruleKremasi, qtyPerUnit: 1   },
    ],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// 4. YAPAY ZEKANIN ÜRETTİĞİ HAFTALIK ÜRETİM PLANI
//    (14–18 Nisan 2026, son satış günü Cuma 18 Nisan saat 18:00)
// ─────────────────────────────────────────────────────────────────────────────
//
// YZ şunları göz önünde bulundurdu:
//   • Geçen haftanın satış verileri (baseline)
//   • Nisan ortasındaki okul tatili → ekler/profiterol talebi %20 arttı
//   • Hafta sonu siparişleri için Cuma kapanışa kadar hazır olmalı
//   • Krem Karamel ve Crème Brûlée düşük fire oranı → güvenli üretim

const WEEKLY_PLAN = {
  weekStart: "14 Nisan 2026",
  saleDeadline: new Date("2026-04-18T18:00:00.000Z"),  // Cuma 18:00 UTC
  items: [
    { product: PRODUCTS.ekler,           targetQty: 100 },
    { product: PRODUCTS.profiterol,      targetQty: 80  },
    { product: PRODUCTS.cikolataliTart,  targetQty: 30  },
    { product: PRODUCTS.limonluTart,     targetQty: 30  },
    { product: PRODUCTS.frambuazliPasta, targetQty: 15  },
    { product: PRODUCTS.cikolataliPasta, targetQty: 15  },
    { product: PRODUCTS.millefeuille,    targetQty: 20  },
    { product: PRODUCTS.tiramisu,        targetQty: 25  },
    { product: PRODUCTS.cheesecake,      targetQty: 20  },
    { product: PRODUCTS.bezePasta,       targetQty: 10  },
    { product: PRODUCTS.kremKaramel,     targetQty: 40  },
    { product: PRODUCTS.cremeBrule,      targetQty: 40  },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Yardımcı: net baz ürün ihtiyacını hesapla
// ─────────────────────────────────────────────────────────────────────────────
function calcNetBaseQty(baseProduct: typeof BASE.fransizKremasi): number {
  let total = 0;
  for (const item of WEEKLY_PLAN.items) {
    for (const req of item.product.requirements) {
      if (req.base === baseProduct) {
        total += item.targetQty * req.qtyPerUnit;
      }
    }
  }
  return total;
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. BAZ ÜRÜN MALİYET TESTLERİ
// ─────────────────────────────────────────────────────────────────────────────

describe("Baz ürün porsiyon maliyetleri", () => {
  test("Fransız Kreması → 79.70 ₺/kg", () => {
    const cost = calcPortionCost(BASE.fransizKremasi.ingredients, BASE.fransizKremasi.yieldQty);
    assert.equal(cost, 79.7);
  });

  test("Choux Hamuru → 78.25 ₺/kg", () => {
    const cost = calcPortionCost(BASE.chouxHamuru.ingredients, BASE.chouxHamuru.yieldQty);
    assert.equal(cost, 78.25);
  });

  test("Pandispanya → 66.70 ₺/adet", () => {
    const cost = calcPortionCost(BASE.pandispanya.ingredients, BASE.pandispanya.yieldQty);
    // 42+9.9+4.8+10 = 66.7 — JS floating point: 66.69999999999999
    assert.ok(Math.abs(cost - 66.7) < 1e-9, `Beklenen 66.7, alınan: ${cost}`);
  });

  test("Çikolatalı Ganaj → 262.50 ₺/kg", () => {
    const cost = calcPortionCost(BASE.cikolataliGanaj.ingredients, BASE.cikolataliGanaj.yieldQty);
    assert.equal(cost, 262.5);
  });

  test("Limon Kreması → 130.00 ₺/kg", () => {
    const cost = calcPortionCost(BASE.limonKremasi.ingredients, BASE.limonKremasi.yieldQty);
    assert.equal(cost, 130);
  });

  test("Mascarpone Kreması → 230.50 ₺/kg", () => {
    const cost = calcPortionCost(BASE.mascarponKremasi.ingredients, BASE.mascarponKremasi.yieldQty);
    assert.equal(cost, 230.5);
  });

  test("Cheesecake Dolgusu → 203.25 ₺/adet", () => {
    const cost = calcPortionCost(BASE.cheesecakeDolgusu.ingredients, BASE.cheesecakeDolgusu.yieldQty);
    assert.equal(cost, 203.25);
  });

  test("Beze → ~1.392 ₺/adet (41.75 ₺ / 30 adet)", () => {
    const cost = calcPortionCost(BASE.beze.ingredients, BASE.beze.yieldQty);
    // 41.75 / 30 = 1.3916666...
    assert.ok(Math.abs(cost - (41.75 / 30)) < 1e-9, `Beklenen ~1.3917, alınan: ${cost}`);
  });

  test("Krem Karamel Sos → 76.50 ₺/litre", () => {
    const cost = calcPortionCost(BASE.kremKaramelSos.ingredients, BASE.kremKaramelSos.yieldQty);
    assert.equal(cost, 76.5);
  });

  test("Crème Brûlée Kreması → 24.10 ₺/porsiyon", () => {
    const cost = calcPortionCost(BASE.kremBruleKremasi.ingredients, BASE.kremBruleKremasi.yieldQty);
    assert.ok(Math.abs(cost - 24.1) < 1e-9, `Beklenen 24.10, alınan: ${cost}`);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. NET BAZ ÜRÜN İHTİYACI (plan + birleştirme malzemeleri)
//
// Elle hesap:
//   Fransız Kreması  = Ekler(100×0.045) + Frambuazlı(15×0.2) + Millefeuille(20×0.08)
//                    = 4.5 + 3.0 + 1.6 = 9.1 kg
//   Choux Hamuru     = Ekler(100×0.03) + Profiterol(80×0.025)
//                    = 3.0 + 2.0 = 5.0 kg
//   Çikolatalı Ganaj = Profiterol(80×0.02) + Çik.Tart(30×0.06) + Çik.Pasta(15×0.25)
//                    = 1.6 + 1.8 + 3.75 = 7.15 kg
//   Pandispanya      = Çik.Tart(30×0.05) + Lim.Tart(30×0.05) + Framb.Pasta(15×1) + Çik.Pasta(15×1)
//                    = 1.5 + 1.5 + 15 + 15 = 33 adet
//   Limon Kreması    = Limonlu Tart(30×0.07) = 2.1 kg
//   Mascarpone Krem. = Tiramisu(25×0.12) = 3.0 kg
//   Cheesecake Dolg. = Cheesecake(20×1) = 20 adet
//   Beze             = Beze Pasta(10×3) = 30 adet
//   Krem Karamel Sos = Krem Karamel(40×0.08) = 3.2 L
//   Crème Brûlée Kr. = Crème Brûlée(40×1) = 40 porsiyon
// ─────────────────────────────────────────────────────────────────────────────

describe("Haftalık plan — net baz ürün ihtiyaçları", () => {
  test("Fransız Kreması net ihtiyaç → 9.1 kg", () => {
    assert.equal(calcNetBaseQty(BASE.fransizKremasi), 9.1);
  });

  test("Choux Hamuru net ihtiyaç → 5.0 kg", () => {
    assert.equal(calcNetBaseQty(BASE.chouxHamuru), 5.0);
  });

  test("Çikolatalı Ganaj net ihtiyaç → 7.15 kg", () => {
    const result = calcNetBaseQty(BASE.cikolataliGanaj);
    assert.ok(Math.abs(result - 7.15) < 1e-9, `Beklenen 7.15, alınan: ${result}`);
  });

  test("Pandispanya net ihtiyaç → 33 adet", () => {
    assert.equal(calcNetBaseQty(BASE.pandispanya), 33);
  });

  test("Limon Kreması net ihtiyaç → 2.1 kg", () => {
    assert.ok(Math.abs(calcNetBaseQty(BASE.limonKremasi) - 2.1) < 1e-9);
  });

  test("Mascarpone Kreması net ihtiyaç → 3.0 kg", () => {
    assert.equal(calcNetBaseQty(BASE.mascarponKremasi), 3.0);
  });

  test("Cheesecake Dolgusu net ihtiyaç → 20 adet", () => {
    assert.equal(calcNetBaseQty(BASE.cheesecakeDolgusu), 20);
  });

  test("Beze net ihtiyaç → 30 adet", () => {
    assert.equal(calcNetBaseQty(BASE.beze), 30);
  });

  test("Krem Karamel Sos net ihtiyaç → 3.2 L", () => {
    assert.ok(Math.abs(calcNetBaseQty(BASE.kremKaramelSos) - 3.2) < 1e-9);
  });

  test("Crème Brûlée Kreması net ihtiyaç → 40 porsiyon", () => {
    assert.equal(calcNetBaseQty(BASE.kremBruleKremasi), 40);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. BRÜT ÜRETİM MİKTARLARI (fire + %5 güvenlik marjı)
//
// Elle hesap:
//   Fransız Kreması  : 9.1  × 1.10 × 1.05 = 10.5105 kg
//   Choux Hamuru     : 5.0  × 1.05 × 1.05 = 5.5125  kg
//   Çikolatalı Ganaj : 7.15 × 1.05 × 1.05 = 7.884...kg
//   Pandispanya      : 33   × 1.08 × 1.05 = 37.422  adet
//   Limon Kreması    : 2.1  × 1.08 × 1.05 = 2.3814  kg
//   Mascarpone Krem. : 3.0  × 1.05 × 1.05 = 3.3075  kg
//   Cheesecake Dolg. : 20   × 1.05 × 1.05 = 22.05   adet
//   Beze             : 30   × 1.15 × 1.05 = 36.225  adet
//   Krem Karamel Sos : 3.2  × 1.10 × 1.05 = 3.696   L
//   Crème Brûlée Kr. : 40   × 1.05 × 1.05 = 44.1    porsiyon
// ─────────────────────────────────────────────────────────────────────────────

describe("Brüt üretim miktarları (fire + güvenlik marjı)", () => {
  test("Fransız Kreması brüt → 10.5105 kg", () => {
    const net = calcNetBaseQty(BASE.fransizKremasi);
    const brut = calcBrutQty(net, BASE.fransizKremasi.fireRate);
    assert.ok(Math.abs(brut - 10.5105) < 1e-9, `Beklenen 10.5105, alınan: ${brut}`);
  });

  test("Choux Hamuru brüt → 5.5125 kg", () => {
    const net = calcNetBaseQty(BASE.chouxHamuru);
    const brut = calcBrutQty(net, BASE.chouxHamuru.fireRate);
    assert.ok(Math.abs(brut - 5.5125) < 1e-9, `Beklenen 5.5125, alınan: ${brut}`);
  });

  test("Çikolatalı Ganaj brüt → 7.882875 kg", () => {
    // 7.15 × 1.05 × 1.05: 7.15×1.05=7.5075, 7.5075×1.05=7.882875
    const net = calcNetBaseQty(BASE.cikolataliGanaj);
    const brut = calcBrutQty(net, BASE.cikolataliGanaj.fireRate);
    assert.ok(Math.abs(brut - 7.882875) < 1e-9, `Beklenen 7.882875, alınan: ${brut}`);
  });

  test("Pandispanya brüt → 37.422 adet", () => {
    const net = calcNetBaseQty(BASE.pandispanya);
    const brut = calcBrutQty(net, BASE.pandispanya.fireRate);
    assert.ok(Math.abs(brut - 37.422) < 1e-9, `Beklenen 37.422, alınan: ${brut}`);
  });

  test("Limon Kreması brüt → 2.3814 kg", () => {
    const net = calcNetBaseQty(BASE.limonKremasi);
    const brut = calcBrutQty(net, BASE.limonKremasi.fireRate);
    assert.ok(Math.abs(brut - 2.3814) < 1e-9, `Beklenen 2.3814, alınan: ${brut}`);
  });

  test("Mascarpone Kreması brüt → 3.3075 kg", () => {
    const net = calcNetBaseQty(BASE.mascarponKremasi);
    const brut = calcBrutQty(net, BASE.mascarponKremasi.fireRate);
    assert.ok(Math.abs(brut - 3.3075) < 1e-9, `Beklenen 3.3075, alınan: ${brut}`);
  });

  test("Cheesecake Dolgusu brüt → 22.05 adet", () => {
    const net = calcNetBaseQty(BASE.cheesecakeDolgusu);
    const brut = calcBrutQty(net, BASE.cheesecakeDolgusu.fireRate);
    assert.ok(Math.abs(brut - 22.05) < 1e-9, `Beklenen 22.05, alınan: ${brut}`);
  });

  test("Beze brüt → 36.225 adet", () => {
    const net = calcNetBaseQty(BASE.beze);
    const brut = calcBrutQty(net, BASE.beze.fireRate);
    assert.ok(Math.abs(brut - 36.225) < 1e-9, `Beklenen 36.225, alınan: ${brut}`);
  });

  test("Krem Karamel Sos brüt → 3.696 L", () => {
    const net = calcNetBaseQty(BASE.kremKaramelSos);
    const brut = calcBrutQty(net, BASE.kremKaramelSos.fireRate);
    assert.ok(Math.abs(brut - 3.696) < 1e-9, `Beklenen 3.696, alınan: ${brut}`);
  });

  test("Crème Brûlée Kreması brüt → 44.1 porsiyon", () => {
    const net = calcNetBaseQty(BASE.kremBruleKremasi);
    const brut = calcBrutQty(net, BASE.kremBruleKremasi.fireRate);
    assert.ok(Math.abs(brut - 44.1) < 1e-9, `Beklenen 44.1, alınan: ${brut}`);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. KRİTİK HAMMADDE İHTİYAÇLARI (calcRawMaterialQty ile)
//
// Fransız Kreması brüt = 10.5105 kg
//   Süt    : 10.5105 × 0.6  = 6.3063 litre
//   Yumurta: 10.5105 × 4    = 42.042 adet
//
// Choux Hamuru brüt = 5.5125 kg
//   Tereyağı: 5.5125 × 0.1  = 0.55125 kg
//   Un      : 5.5125 × 0.15 = 0.826875 kg
// ─────────────────────────────────────────────────────────────────────────────

describe("Kritik hammadde ihtiyaçları", () => {
  const franBrut = calcBrutQty(9.1, 0.10);   // 10.5105
  const chouxBrut = calcBrutQty(5.0, 0.05);  // 5.5125

  test("Fransız Kreması için süt ihtiyacı → 6.3063 litre", () => {
    const result = calcRawMaterialQty(franBrut, 0.6);
    assert.ok(Math.abs(result - 6.3063) < 1e-9, `Beklenen 6.3063, alınan: ${result}`);
  });

  test("Fransız Kreması için yumurta ihtiyacı → 42.042 adet", () => {
    const result = calcRawMaterialQty(franBrut, 4);
    assert.ok(Math.abs(result - 42.042) < 1e-9, `Beklenen 42.042, alınan: ${result}`);
  });

  test("Choux Hamuru için tereyağı ihtiyacı → 0.55125 kg", () => {
    const result = calcRawMaterialQty(chouxBrut, 0.1);
    assert.ok(Math.abs(result - 0.55125) < 1e-9, `Beklenen 0.55125, alınan: ${result}`);
  });

  test("Choux Hamuru için un ihtiyacı → 0.826875 kg", () => {
    const result = calcRawMaterialQty(chouxBrut, 0.15);
    assert.ok(Math.abs(result - 0.826875) < 1e-9, `Beklenen 0.826875, alınan: ${result}`);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. FIFO DEADLINELERİ
//    Montaj (satış) tarihi: Cuma 18 Nisan 2026, 18:00 UTC
//    En geç üretim başlangıcı = montaj tarihi − raf ömrü (saat)
//
//    Fransız Kreması  (48h) → Çarşamba 16 Nisan 18:00 UTC
//    Choux Hamuru     (24h) → Perşembe  17 Nisan 18:00 UTC
//    Çikolatalı Ganaj (96h) → Salı      14 Nisan 18:00 UTC  ← haftanın en erken görevi!
//    Pandispanya      (72h) → Çarşamba  15 Nisan 18:00 UTC
//    Cheesecake Dolg. (96h) → Salı      14 Nisan 18:00 UTC
//    Beze            (168h) → Cumartesi 11 Nisan 18:00 UTC  ← önceki haftadan hazırlanmalı!
//    Mascarpone Krem. (48h) → Perşembe  16 Nisan 18:00 UTC
//    Krem Karamel Sos (72h) → Çarşamba  15 Nisan 18:00 UTC
//    Crème Brûlée Kr. (48h) → Perşembe  16 Nisan 18:00 UTC
// ─────────────────────────────────────────────────────────────────────────────

describe("FIFO deadline hesaplamaları", () => {
  const saleDeadline = WEEKLY_PLAN.saleDeadline;

  test("Fransız Kreması (48h) → 16 Nisan 18:00", () => {
    const result = calcFifoDeadline(saleDeadline, 48);
    assert.deepEqual(result, new Date("2026-04-16T18:00:00.000Z"));
  });

  test("Choux Hamuru (24h) → 17 Nisan 18:00", () => {
    const result = calcFifoDeadline(saleDeadline, 24);
    assert.deepEqual(result, new Date("2026-04-17T18:00:00.000Z"));
  });

  test("Çikolatalı Ganaj (96h) → 14 Nisan 18:00 (Salı — haftanın ilk görevi!)", () => {
    const result = calcFifoDeadline(saleDeadline, 96);
    assert.deepEqual(result, new Date("2026-04-14T18:00:00.000Z"));
  });

  test("Pandispanya (72h) → 15 Nisan 18:00", () => {
    const result = calcFifoDeadline(saleDeadline, 72);
    assert.deepEqual(result, new Date("2026-04-15T18:00:00.000Z"));
  });

  test("Cheesecake Dolgusu (96h) → 14 Nisan 18:00", () => {
    const result = calcFifoDeadline(saleDeadline, 96);
    assert.deepEqual(result, new Date("2026-04-14T18:00:00.000Z"));
  });

  test("Beze (168h = 1 hafta) → 11 Nisan 18:00 (önceki haftadan hazırlanmalı!)", () => {
    const result = calcFifoDeadline(saleDeadline, 168);
    assert.deepEqual(result, new Date("2026-04-11T18:00:00.000Z"));
  });

  test("Mascarpone Kreması (48h) → 16 Nisan 18:00", () => {
    const result = calcFifoDeadline(saleDeadline, 48);
    assert.deepEqual(result, new Date("2026-04-16T18:00:00.000Z"));
  });

  test("Krem Karamel Sos (72h) → 15 Nisan 18:00", () => {
    const result = calcFifoDeadline(saleDeadline, 72);
    assert.deepEqual(result, new Date("2026-04-15T18:00:00.000Z"));
  });

  test("Crème Brûlée Kreması (48h) → 16 Nisan 18:00", () => {
    const result = calcFifoDeadline(saleDeadline, 48);
    assert.deepEqual(result, new Date("2026-04-16T18:00:00.000Z"));
  });
});
