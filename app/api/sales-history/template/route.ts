import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { products } from "@/lib/schema";
import * as XLSX from "xlsx";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const allProducts = await db.select({ id: products.id, name: products.name }).from(products).orderBy(products.name);

  const wb = XLSX.utils.book_new();

  // === Sheet 1: Veri Girişi ===
  const headers = [
    "Ürün Adı *",
    "Haftanın Pazartesi Tarihi * (GG.AA.YYYY)",
    "Satılan Adet *",
    "Gelir (₺)",
    "Kanal *",
    "Olay Tipi *",
    "Not",
  ];

  const example = [
    allProducts[0]?.name || "Ekler",
    "31.03.2026",
    "120",
    "10200",
    "mağaza",
    "normal",
    "Örnek satır - silin",
  ];

  const wsData = [headers, example];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // B2 hücresini metin (text) olarak işaretle — Excel'in otomatik tarih
  // dönüşümünü engellemek için. Kullanıcı da GG.AA.YYYY formatında girecek.
  if (ws["B2"]) {
    ws["B2"].t = "s"; // string type
    ws["B2"].z = "@"; // text number format code
  }

  ws["!cols"] = [
    { wch: 25 }, { wch: 35 }, { wch: 15 }, { wch: 12 },
    { wch: 15 }, { wch: 18 }, { wch: 30 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, "Satış Verisi");

  // === Sheet 2: Referans - Ürünler ===
  const prodSheet = XLSX.utils.aoa_to_sheet([
    ["Geçerli Ürün Adları"],
    ...allProducts.map((p) => [p.name]),
  ]);
  prodSheet["!cols"] = [{ wch: 30 }];
  XLSX.utils.book_append_sheet(wb, prodSheet, "Ürünler (Referans)");

  // === Sheet 3: Referans - Değerler ===
  const refData = [
    ["Kanal Değerleri", "Olay Tipi Değerleri"],
    ["mağaza", "normal"],
    ["online", "resmi_tatil"],
    ["catering", "özel_gün"],
    ["karma", "kampanya"],
    ["", "mevsim"],
  ];
  const refSheet = XLSX.utils.aoa_to_sheet(refData);
  refSheet["!cols"] = [{ wch: 20 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, refSheet, "Geçerli Değerler");

  // === Sheet 4: Nasıl Doldurulur ===
  const helpData = [
    ["SATIŞ GEÇMİŞİ ŞABLONU — DOLDURMA REHBERİ"],
    [""],
    ["KOLON", "AÇIKLAMA", "ÖRNEK"],
    ["Ürün Adı *", '"Ürünler (Referans)" sayfasındaki adlardan birini girin', "Ekler"],
    [
      "Haftanın Pazartesi Tarihi *",
      "O satış haftasının PAZARTESİ günü — GG.AA.YYYY formatında metin olarak girin.\n"
      + "YZ bu tarihi kullanarak bir sonraki hafta için üretim tahmini üretir.\n"
      + "Örnek: 28 Nisan – 2 Mayıs haftası için → 28.04.2026",
      "28.04.2026",
    ],
    ["Satılan Adet *", "O haftada satılan toplam ürün adedi (tam sayı)", "120"],
    ["Gelir (₺)", "O haftaki toplam satış geliri (opsiyonel)", "10200"],
    ["Kanal *", '"Geçerli Değerler" sayfasına bakın', "mağaza"],
    ["Olay Tipi *", '"Geçerli Değerler" sayfasına bakın', "normal"],
    ["Not", "Ek açıklama (opsiyonel)", "Ramazan etkisi"],
    [""],
    ["ÖNEMLİ: Tarih Kolonunu Doğru Doldurun"],
    ["• GG.AA.YYYY formatında metin olarak girin: 31.03.2026"],
    ["• Excel otomatik dönüştürürse: hücreye sağ tıklayın → Hücreleri Biçimlendir → Metin seçin"],
    ["• Tarih hep o haftanın PAZARTESİ günü olmalıdır"],
  ];
  const helpSheet = XLSX.utils.aoa_to_sheet(helpData);
  helpSheet["!cols"] = [{ wch: 35 }, { wch: 70 }, { wch: 20 }];
  helpSheet["!rows"] = [{ hpt: 20 }, {}, { hpt: 18 }];
  XLSX.utils.book_append_sheet(wb, helpSheet, "Nasıl Doldurulur");

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="satis-gecmisi-sablonu.xlsx"',
    },
  });
}
