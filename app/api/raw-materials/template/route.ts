import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import ExcelJS from "exceljs";

const UNITS = ["kg", "gr", "litre", "dl", "cl", "ml", "adet"];
const UNITS_FORMULA = `"${UNITS.join(",")}"`;

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const wb = new ExcelJS.Workbook();
  wb.creator = "KitchenPlanner";
  wb.created = new Date();

  // ── Sheet 1: Veri ──────────────────────────────────────────────────────────
  const ws = wb.addWorksheet("Hammaddeler", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  ws.columns = [
    { header: "Ad *",              key: "ad",      width: 28 },
    { header: "Birim *",           key: "birim",   width: 18 },
    { header: "Birim Fiyat (₺) *", key: "fiyat",   width: 20 },
    { header: "Mevcut Stok",       key: "stok",    width: 15 },
    { header: "Min Stok",          key: "minStok", width: 15 },
    { header: "Raf Ömrü (saat)",   key: "raf",     width: 18 },
  ];

  // Başlık satırı stili
  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9C4A3" } };
  headerRow.alignment = { vertical: "middle", horizontal: "center" };
  headerRow.height = 20;

  // Örnek satırlar
  const examples = [
    { ad: "Un",       birim: "kg",    fiyat: 40,  stok: 50,  minStok: 10, raf: ""  },
    { ad: "Süt",      birim: "litre", fiyat: 25,  stok: 30,  minStok: 5,  raf: 48  },
    { ad: "Yumurta",  birim: "adet",  fiyat: 7,   stok: 200, minStok: 50, raf: 168 },
    { ad: "Tereyağı", birim: "kg",    fiyat: 450, stok: 10,  minStok: 3,  raf: 720 },
    { ad: "Şeker",    birim: "kg",    fiyat: 55,  stok: 25,  minStok: 8,  raf: ""  },
  ];
  examples.forEach((row) => ws.addRow(row));

  // ── Birim Dropdown (B2:B1000) ──────────────────────────────────────────────
  for (let rowNum = 2; rowNum <= 1000; rowNum++) {
    ws.getCell(`B${rowNum}`).dataValidation = {
      type: "list",
      allowBlank: false,
      formulae: [UNITS_FORMULA],
      showErrorMessage: true,
      errorStyle: "error",
      errorTitle: "Geçersiz Birim",
      error: `Lütfen listeden seçin: ${UNITS.join(", ")}`,
      showInputMessage: true,
      promptTitle: "Birim Seçin",
      prompt: `Geçerli birimler:\n${UNITS.join(", ")}`,
    };
  }

  // ── Sheet 2: Birimler Referans ─────────────────────────────────────────────
  const wsRef = wb.addWorksheet("Birimler (Referans)");
  wsRef.columns = [
    { header: "Birim",    key: "birim",    width: 12 },
    { header: "Açıklama", key: "aciklama", width: 22 },
  ];
  wsRef.getRow(1).font = { bold: true };
  const unitDescs: [string, string][] = [
    ["kg",    "Kilogram"],
    ["gr",    "Gram"],
    ["litre", "Litre"],
    ["dl",    "Desilitre"],
    ["cl",    "Santilitre"],
    ["ml",    "Mililitre"],
    ["adet",  "Adet (sayı)"],
  ];
  unitDescs.forEach(([b, a]) => wsRef.addRow({ birim: b, aciklama: a }));

  // ── Sheet 3: Açıklamalar ───────────────────────────────────────────────────
  const wsInfo = wb.addWorksheet("Açıklamalar");
  wsInfo.columns = [{ key: "a", width: 22 }, { key: "b", width: 50 }, { key: "c", width: 25 }];

  const rows: [string, string, string][] = [
    ["Alan", "Açıklama", "Örnek"],
    ["Ad *",             "Hammadde adı (zorunlu)",                          "Un, Süt, Yumurta"],
    ["Birim *",          "Dropdown'dan seçin (zorunlu)",                    "kg, litre, adet..."],
    ["Birim Fiyat *",    "₺ cinsinden birim maliyet (zorunlu)",             "40.50"],
    ["Mevcut Stok",      "Şu anki stok (opsiyonel, varsayılan: 0)",         "50"],
    ["Min Stok",         "Uyarı için minimum seviye (opsiyonel)",           "10"],
    ["Raf Ömrü (saat)",  "Saat cinsinden raf ömrü (opsiyonel)",             "48"],
    ["", "", ""],
    ["NOT:", "* işaretli alanlar zorunludur", ""],
    ["NOT:", "Birim kolonunda hücreye tıklayın → sağdaki oka basın", ""],
  ];
  rows.forEach(([a, b, c], i) => {
    const row = wsInfo.addRow({ a, b, c });
    if (i === 0) row.font = { bold: true };
  });

  const buffer = await wb.xlsx.writeBuffer();

  return new NextResponse(Buffer.from(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="hammadde-sablonu.xlsx"',
    },
  });
}
