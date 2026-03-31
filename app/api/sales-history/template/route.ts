import { NextRequest, NextResponse } from "next/server";
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
    "Hafta Başı * (YYYY-AA-GG)",
    "Satılan Adet *",
    "Gelir (₺)",
    "Kanal *",
    "Olay Tipi *",
    "Not",
  ];

  const example = [
    allProducts[0]?.name || "Ekler",
    "2026-03-31",
    "120",
    "10200",
    "mağaza",
    "normal",
    "Örnek satır - silin",
  ];

  const wsData = [headers, example];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Column widths
  ws["!cols"] = [
    { wch: 25 }, { wch: 22 }, { wch: 15 }, { wch: 12 },
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

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="satis-gecmisi-sablonu.xlsx"',
    },
  });
}
