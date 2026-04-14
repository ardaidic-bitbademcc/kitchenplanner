import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import ExcelJS from "exceljs";

const UNITS = ["kg", "gr", "litre", "dl", "cl", "ml", "adet"];
const UNITS_FORMULA = `"${UNITS.join(",")}"`;  // "kg,gr,litre,dl,cl,ml,adet"

type TemplateConfig = {
  headers: { header: string; key: string; width: number }[];
  example: Record<string, string | number>[];
  unitColumn?: string; // hangi kolon dropdown alacak, örn: "B"
};

const TEMPLATES: Record<string, TemplateConfig> = {
  "raw-materials": {
    headers: [
      { header: "Ad *",               key: "ad",      width: 28 },
      { header: "Birim *",            key: "birim",   width: 18 },
      { header: "Birim Fiyat (₺) *", key: "fiyat",   width: 20 },
      { header: "Mevcut Stok",        key: "stok",    width: 15 },
      { header: "Min Stok",           key: "minStok", width: 15 },
      { header: "Raf Ömrü (saat)",    key: "raf",     width: 18 },
    ],
    example: [
      { ad: "Süt",      birim: "litre", fiyat: 25,  stok: 50,  minStok: 10, raf: 72 },
      { ad: "Yumurta",  birim: "adet",  fiyat: 7,   stok: 200, minStok: 50, raf: "" },
      { ad: "Tereyağı", birim: "kg",    fiyat: 450, stok: 20,  minStok: 5,  raf: "" },
    ],
    unitColumn: "B",
  },
  "base-products": {
    headers: [
      { header: "Ad *",                key: "ad",     width: 28 },
      { header: "Birim *",             key: "birim",  width: 18 },
      { header: "Parti Çıktısı *",     key: "parti",  width: 18 },
      { header: "Fire Oranı (0-1) *",  key: "fire",   width: 20 },
      { header: "Raf Ömrü (saat) *",   key: "raf",    width: 20 },
      { header: "Notlar",              key: "notlar", width: 35 },
    ],
    example: [
      { ad: "Fransız Kreması", birim: "kg",   parti: 1,  fire: 0.1,  raf: 48, notlar: "SKT: 48 saat" },
      { ad: "Pasta Taban",     birim: "adet", parti: 10, fire: 0.05, raf: 24, notlar: "" },
    ],
    unitColumn: "B",
  },
  "products": {
    headers: [
      { header: "Ad *",           key: "ad",      width: 28 },
      { header: "Açıklama",       key: "aciklama", width: 40 },
      { header: "Satış Fiyatı (₺)", key: "fiyat", width: 20 },
    ],
    example: [
      { ad: "Ekler",      aciklama: "Fransız kremalı ekler pasta", fiyat: 85 },
      { ad: "Profiterol", aciklama: "Çikolata soslu profiterol",   fiyat: 65 },
    ],
  },
};

export async function GET(req: NextRequest, { params }: { params: { type: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const template = TEMPLATES[params.type];
  if (!template) return NextResponse.json({ error: "Geçersiz şablon tipi" }, { status: 400 });

  const wb = new ExcelJS.Workbook();
  wb.creator = "KitchenPlanner";
  wb.created = new Date();

  // ── Sheet 1: Veri ──────────────────────────────────────────────────────────
  const ws = wb.addWorksheet("Veri", {
    views: [{ state: "frozen", ySplit: 1 }], // başlık satırını dondur
  });

  ws.columns = template.headers;

  // Başlık satırı stili
  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9C4A3" } };
  headerRow.alignment = { vertical: "middle", horizontal: "center" };
  headerRow.height = 20;

  // Örnek satırlar
  template.example.forEach((row) => ws.addRow(row));

  // ── Birim Dropdown (Veri Doğrulama) ───────────────────────────────────────
  if (template.unitColumn) {
    const col = template.unitColumn;
    for (let rowNum = 2; rowNum <= 1000; rowNum++) {
      ws.getCell(`${col}${rowNum}`).dataValidation = {
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
  }

  // ── Sheet 2: Birimler Referans ─────────────────────────────────────────────
  if (template.unitColumn) {
    const wsRef = wb.addWorksheet("Birimler (Referans)");
    wsRef.columns = [
      { header: "Birim", key: "birim", width: 12 },
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
  }

  // ── Sheet 3: Talimatlar ────────────────────────────────────────────────────
  const wsTal = wb.addWorksheet("Talimatlar");
  wsTal.columns = [{ key: "a", width: 38 }, { key: "b", width: 58 }];

  const instructions: [string, string][] = [
    ["KULLANIM TALİMATLARI", ""],
    ["", ""],
    ["1. Örnek satırları silin", "'Veri' sekmesindeki gri satırlar örnek içindir"],
    ["2. Verilerinizi girin", "* ile işaretli kolonlar zorunludur"],
    ["3. Birim kolonunu kullanın", "Hücreye tıklayın → sağdaki oka basarak seçin"],
    ["4. Kaydedin", ".xlsx formatında kaydedin"],
    ["5. Yükleyin", "Uygulamada 'Excel İçe Aktar' butonunu kullanın"],
    ["", ""],
    ["ALAN AÇIKLAMALARI", ""],
    ...getFieldDescriptions(params.type),
  ];

  instructions.forEach(([a, b], i) => {
    const row = wsTal.addRow({ a, b });
    if (i === 0 || i === 8) row.font = { bold: true };
  });

  // ── Buffer'a yaz ───────────────────────────────────────────────────────────
  const buffer = await wb.xlsx.writeBuffer();

  const typeLabels: Record<string, string> = {
    "raw-materials":  "hammaddeler",
    "base-products":  "baz-urunler",
    "products":       "urunler",
  };

  return new NextResponse(Buffer.from(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="sablon-${typeLabels[params.type] || params.type}.xlsx"`,
    },
  });
}

function getFieldDescriptions(type: string): [string, string][] {
  switch (type) {
    case "raw-materials":
      return [
        ["Ad",               "Hammadde adı — örn: Süt, Un, Tereyağı"],
        ["Birim",            "Dropdown'dan seçin: kg, gr, litre, dl, cl, ml, adet"],
        ["Birim Fiyat",      "1 birim fiyatı TL cinsinden"],
        ["Mevcut Stok",      "Şu anki stok (opsiyonel, varsayılan: 0)"],
        ["Min Stok",         "Bu eşiğin altına düşünce dashboard'da uyarı çıkar"],
        ["Raf Ömrü (saat)",  "Opsiyonel — boş bırakılabilir"],
      ];
    case "base-products":
      return [
        ["Ad",               "Baz ürün adı — örn: Fransız Kreması, Ganaj"],
        ["Birim",            "Dropdown'dan seçin: kg, gr, litre, dl, cl, ml, adet"],
        ["Parti Çıktısı",    "1 parti üretimde elde edilen miktar"],
        ["Fire Oranı",       "0 ile 1 arasında — örn: 0.10 = %10 fire"],
        ["Raf Ömrü (saat)",  "Kaç saat taze kalır — örn: 48"],
        ["Notlar",           "Opsiyonel not"],
      ];
    case "products":
      return [
        ["Ad",           "Son ürün adı — örn: Ekler, Profiterol"],
        ["Açıklama",     "Opsiyonel kısa açıklama"],
        ["Satış Fiyatı", "TL cinsinden (opsiyonel)"],
      ];
    default:
      return [];
  }
}
