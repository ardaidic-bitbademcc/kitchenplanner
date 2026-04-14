import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import * as XLSX from "xlsx";

// Sistemdeki tüm geçerli birimler — her iki şablonda aynı liste kullanılır
const UNITS = ["kg", "gr", "litre", "dl", "cl", "ml", "adet"];

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

// Birim dropdown'ı olan şablon tipleri ve hangi kolon (0-indexed)
const UNIT_COLUMN: Record<string, string> = {
  "raw-materials": "B",
  "base-products": "B",
};

export async function GET(req: NextRequest, { params }: { params: { type: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const template = TEMPLATES[params.type];
  if (!template) return NextResponse.json({ error: "Geçersiz şablon tipi" }, { status: 400 });

  const wb = XLSX.utils.book_new();

  // === Sheet 1: Veri Girişi ===
  const dataRows = [template.headers, ...template.example];
  const ws = XLSX.utils.aoa_to_sheet(dataRows);

  ws["!cols"] = template.headers.map(() => ({ wch: 25 }));
  ws["!freeze"] = { xSplit: 0, ySplit: 1 };

  // Birim kolonu için dropdown (veri doğrulama) ekle
  if (UNIT_COLUMN[params.type]) {
    const col = UNIT_COLUMN[params.type];
    const unitList = UNITS.join(","); // "kg,gr,litre,dl,cl,ml,adet"

    (ws as any)["!dataValidations"] = [
      {
        type: "list",
        sqref: `${col}2:${col}1000`,   // 2. satırdan 1000. satıra kadar tüm veri satırları
        formula1: `"${unitList}"`,      // Excel inline liste — tırnak içinde, virgülle ayrılmış
        showDropDown: false,            // false = dropdown oku göster (Excel'in ters mantığı)
        showErrorMessage: true,
        errorStyle: "stop",             // stop = geçersiz değer girilince kaydetme
        errorTitle: "Geçersiz Birim",
        error: `Lütfen listeden bir birim seçin: ${UNITS.join(", ")}`,
        showInputMessage: true,
        promptTitle: "Birim Seçin",
        prompt: `Geçerli birimler: ${UNITS.join(", ")}`,
      },
    ];
  }

  XLSX.utils.book_append_sheet(wb, ws, "Veri");

  // === Sheet 2: Birimler Referans (görünür yardımcı sayfa) ===
  if (UNIT_COLUMN[params.type]) {
    const unitRefData = [
      ["Geçerli Birimler", "Açıklama"],
      ["kg", "Kilogram"],
      ["gr", "Gram"],
      ["litre", "Litre"],
      ["dl", "Desilitre"],
      ["cl", "Santilitre"],
      ["ml", "Mililitre"],
      ["adet", "Adet (sayı)"],
    ];
    const wsRef = XLSX.utils.aoa_to_sheet(unitRefData);
    wsRef["!cols"] = [{ wch: 12 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, wsRef, "Birimler (Referans)");
  }

  // === Sheet 3: Talimatlar ===
  const instructionRows = [
    ["KULLANIM TALİMATLARI"],
    [""],
    ["1. 'Veri' sekmesindeki örnek satırları silin"],
    ["2. Kendi verilerinizi girin"],
    ["3. * ile işaretli alanlar zorunludur"],
    ["4. Birim kolonunda hücreye tıklayın — sağında çıkan oka basarak seçim yapın"],
    ["5. Dosyayı kaydedin (.xlsx formatında)"],
    ["6. Uygulamada 'Excel İçe Aktar' butonuna basın ve dosyayı yükleyin"],
    [""],
    ["ALAN AÇIKLAMALARI:"],
    ...Object.entries(getFieldDescriptions(params.type)).map(([k, v]) => [`  ${k}:`, v]),
  ];
  const wsInst = XLSX.utils.aoa_to_sheet(instructionRows);
  wsInst["!cols"] = [{ wch: 30 }, { wch: 55 }];
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
        "Birim": "Dropdown'dan seçin: kg, gr, litre, dl, cl, ml, adet",
        "Birim Fiyat": "1 birim fiyatı TL cinsinden",
        "Mevcut Stok": "Şu anki stok miktarı (varsayılan: 0)",
        "Min Stok": "Minimum stok eşiği — altında uyarı verir",
        "Raf Ömrü (saat)": "Opsiyonel — boş bırakılabilir",
      };
    case "base-products":
      return {
        "Ad": "Baz ürün adı (örn: Fransız Kreması, Ganaj)",
        "Birim": "Dropdown'dan seçin: kg, gr, litre, dl, cl, ml, adet",
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
