import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import * as XLSX from "xlsx";

const TEMPLATES: Record<string, { headers: string[]; example: (string | number)[][] }> = {
  "raw-materials": {
    headers: ["Ad *", "Birim *", "Birim Fiyat (₺) *", "Mevcut Stok", "Min Stok", "Raf Ömrü (saat)"],
    example: [
      ["Süt", "litre", 25, 50, 10, 72],
      ["Yumurta", "adet", 7, 200, 50, ""],
      ["Tereyağı", "kg", 450, 20, 5, ""],
    ],
  },
  "base-products": {
    headers: ["Ad *", "Birim *", "Parti Çıktısı *", "Fire Oranı (0-1) *", "Raf Ömrü (saat) *", "Notlar"],
    example: [
      ["Fransız Kreması", "kg", 1, 0.1, 48, "SKT: 48 saat"],
      ["Pasta Taban", "adet", 10, 0.05, 24, ""],
    ],
  },
  "products": {
    headers: ["Ad *", "Açıklama", "Satış Fiyatı (₺)"],
    example: [
      ["Ekler", "Fransız kremalı ekler pasta", 85],
      ["Profiterol", "Çikolata soslu profiterol", 65],
    ],
  },
};

export async function GET(req: NextRequest, { params }: { params: { type: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const template = TEMPLATES[params.type];
  if (!template) return NextResponse.json({ error: "Geçersiz şablon tipi" }, { status: 400 });

  const wb = XLSX.utils.book_new();

  // Data sheet
  const dataRows = [template.headers, ...template.example];
  const ws = XLSX.utils.aoa_to_sheet(dataRows);

  // Column widths
  ws["!cols"] = template.headers.map(() => ({ wch: 25 }));

  // Style header row (xlsx doesn't support full styling in community version, but we can freeze)
  ws["!freeze"] = { xSplit: 0, ySplit: 1 };

  XLSX.utils.book_append_sheet(wb, ws, "Veri");

  // Instructions sheet
  const instructionRows = [
    ["KULLANIM TALİMATLARI"],
    [""],
    ["1. 'Veri' sekmesindeki örnek satırları silin"],
    ["2. Kendi verilerinizi girin"],
    ["3. * ile işaretli alanlar zorunludur"],
    ["4. Dosyayı kaydedin (.xlsx formatında)"],
    ["5. Uygulamada 'Excel İçe Aktar' butonuna basın ve dosyayı yükleyin"],
    [""],
    ["ALAN AÇIKLAMALARI:"],
    ...Object.entries(getFieldDescriptions(params.type)).map(([k, v]) => [`  ${k}:`, v]),
  ];
  const wsInst = XLSX.utils.aoa_to_sheet(instructionRows);
  wsInst["!cols"] = [{ wch: 30 }, { wch: 50 }];
  XLSX.utils.book_append_sheet(wb, wsInst, "Talimatlar");

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  const typeLabels: Record<string, string> = {
    "raw-materials": "hammaddeler",
    "base-products": "baz-urunler",
    "products": "urunler",
  };

  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="sablon-${typeLabels[params.type] || params.type}.xlsx"`,
    },
  });
}

function getFieldDescriptions(type: string): Record<string, string> {
  switch (type) {
    case "raw-materials":
      return {
        "Ad": "Hammadde adı (örn: Süt, Un, Tereyağı)",
        "Birim": "Ölçü birimi (kg, litre, adet, ml, gr)",
        "Birim Fiyat": "1 birim fiyatı TL cinsinden",
        "Mevcut Stok": "Şu anki stok miktarı (varsayılan: 0)",
        "Min Stok": "Minimum stok eşiği - altında uyarı verir",
        "Raf Ömrü (saat)": "Opsiyonel - boş bırakılabilir",
      };
    case "base-products":
      return {
        "Ad": "Baz ürün adı (örn: Fransız Kreması, Ganaj)",
        "Birim": "Çıktı birimi (kg, litre, adet)",
        "Parti Çıktısı": "1 parti üretimde elde edilen miktar",
        "Fire Oranı": "0 ile 1 arasında (örn: 0.10 = %10 fire)",
        "Raf Ömrü (saat)": "Kaç saat taze kalır (örn: 48)",
        "Notlar": "Opsiyonel not",
      };
    case "products":
      return {
        "Ad": "Son ürün adı (örn: Ekler, Profiterol)",
        "Açıklama": "Opsiyonel kısa açıklama",
        "Satış Fiyatı": "TL cinsinden satış fiyatı (opsiyonel)",
      };
    default:
      return {};
  }
}
