/**
 * parseDateToISO — tarih ayrıştırma fonksiyonu testleri
 *
 * Excel'den gelen tarihler üç farklı formatta gelebilir:
 *   1. Date nesnesi  (cellDates:true ile, Excel tarih hücresi)
 *   2. Sayı / string sayı  (Excel serial date, cellDates:false veya mixed)
 *   3. String  (kullanıcı metin olarak girmiş: GG.AA.YYYY veya YYYY-MM-DD)
 *
 * Fonksiyon tüm bu durumları handle edip YYYY-MM-DD döndürmeli.
 * Hatalı giriş için null döndürmeli.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

// Fonksiyonu route dosyasından kopyalamak yerine burada tekrar tanımla
// (route dosyası Next.js API bağımlılıkları nedeniyle doğrudan import edilemiyor)
function parseDateToISO(raw: unknown): string | null {
  if (raw instanceof Date) {
    if (isNaN(raw.getTime())) return null;
    const y = raw.getUTCFullYear();
    const m = String(raw.getUTCMonth() + 1).padStart(2, "0");
    const d = String(raw.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  const str = String(raw).trim();

  // GG.AA.YYYY veya G.A.YYYY
  const trMatch = str.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (trMatch) {
    const [, d, m, y] = trMatch;
    const iso = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    if (!isNaN(new Date(iso).getTime())) return iso;
  }

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    if (!isNaN(new Date(str).getTime())) return str;
  }

  // Excel serial sayısı
  const serial = Number(str);
  if (!isNaN(serial) && serial > 10000 && serial < 200000) {
    const unixMs = (serial - 25569) * 86400 * 1000;
    const date = new Date(unixMs);
    if (!isNaN(date.getTime())) {
      const y = date.getUTCFullYear();
      const m = String(date.getUTCMonth() + 1).padStart(2, "0");
      const d = String(date.getUTCDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    }
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Date nesnesi (Excel cellDates:true sonucu)
// ─────────────────────────────────────────────────────────────────────────────

describe("Date nesnesi girişleri", () => {
  test("geçerli UTC Date nesnesi → YYYY-MM-DD döner", () => {
    const date = new Date("2026-03-31T00:00:00.000Z");
    assert.equal(parseDateToISO(date), "2026-03-31");
  });

  test("Excel UTC midnight olarak gönderdiği tarih doğru çevrilir", () => {
    // Excel 14 Nisan 2026 Pazartesi → cellDates ile gelir
    const date = new Date("2026-04-14T00:00:00.000Z");
    assert.equal(parseDateToISO(date), "2026-04-14");
  });

  test("geçersiz Date nesnesi → null döner", () => {
    assert.equal(parseDateToISO(new Date("invalid")), null);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. GG.AA.YYYY string (Türkçe format — Excel'in Türkiye locale dönüşümü)
// ─────────────────────────────────────────────────────────────────────────────

describe("GG.AA.YYYY string girişleri (Türkçe format)", () => {
  test("31.03.2026 → 2026-03-31", () => {
    assert.equal(parseDateToISO("31.03.2026"), "2026-03-31");
  });

  test("01.01.2026 → 2026-01-01", () => {
    assert.equal(parseDateToISO("01.01.2026"), "2026-01-01");
  });

  test("tek haneli gün ve ay (1.4.2026) → 2026-04-01", () => {
    assert.equal(parseDateToISO("1.4.2026"), "2026-04-01");
  });

  test("14.04.2026 (Pazartesi) → 2026-04-14", () => {
    assert.equal(parseDateToISO("14.04.2026"), "2026-04-14");
  });

  test("başında/sonunda boşluk varsa temizlenir", () => {
    assert.equal(parseDateToISO("  31.03.2026  "), "2026-03-31");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. YYYY-MM-DD string (ISO format — kullanıcı elle yazmış)
// ─────────────────────────────────────────────────────────────────────────────

describe("YYYY-MM-DD string girişleri (ISO format)", () => {
  test("2026-03-31 → 2026-03-31 (değişmeden)", () => {
    assert.equal(parseDateToISO("2026-03-31"), "2026-03-31");
  });

  test("2026-04-14 → 2026-04-14", () => {
    assert.equal(parseDateToISO("2026-04-14"), "2026-04-14");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Excel serial sayısı (cellDates:false durumu)
//    Excel epoch: 1 Ocak 1900 = 1
//    Unix epoch: 1 Ocak 1970 = 0 → 25569 gün fark
//
//    31.03.2026 = 46112
//    14.04.2026 = 46125
//    01.01.2026 = 46023
// ─────────────────────────────────────────────────────────────────────────────

describe("Excel serial date sayı girişleri", () => {
  test("46112 → 2026-03-31 (31 Mart 2026)", () => {
    assert.equal(parseDateToISO(46112), "2026-03-31");
  });

  test("46125 → 2026-04-13 (13 Nisan 2026)", () => {
    // 46112 + 13 = 46125 → 31 Mart + 13 gün = 13 Nisan
    assert.equal(parseDateToISO(46125), "2026-04-13");
  });

  test("46023 → 2026-01-01 (1 Ocak 2026)", () => {
    assert.equal(parseDateToISO(46023), "2026-01-01");
  });

  test("serial sayı string olarak gelirse de çalışır", () => {
    assert.equal(parseDateToISO("46112"), "2026-03-31");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Hatalı/geçersiz girişler → null
// ─────────────────────────────────────────────────────────────────────────────

describe("Geçersiz girişler → null", () => {
  test("boş string → null", () => {
    assert.equal(parseDateToISO(""), null);
  });

  test("sadece metin → null", () => {
    assert.equal(parseDateToISO("tarih yok"), null);
  });

  test("yanlış format SS/GG/YYYY → null", () => {
    assert.equal(parseDateToISO("03/31/2026"), null);
  });

  test("geçersiz tarih değeri 32.13.2026 → null", () => {
    // Ay 13 geçersiz — Date("2026-13-32") Invalid Date döner
    assert.equal(parseDateToISO("32.13.2026"), null);
  });

  test("undefined → null", () => {
    assert.equal(parseDateToISO(undefined), null);
  });

  test("null → null", () => {
    assert.equal(parseDateToISO(null), null);
  });
});
