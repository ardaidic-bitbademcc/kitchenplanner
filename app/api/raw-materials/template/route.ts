import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import * as XLSX from "xlsx";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const wb = XLSX.utils.book_new();

  // Sheet 1: Veri Girişi
  const ws = XLSX.utils.aoa_to_sheet([
    ["Ad *", "Birim *", "Birim Fiyat (₺) *", "Mevcut Stok", "Min Stok", "Raf Ömrü (saat)"],
    ["Un", "kg", "40", "50", "10", ""],
    ["Süt", "litre", "25", "30", "5", "48"],
    ["Yumurta", "adet", "7", "200", "50", "168"],
    ["Tereyağı", "kg", "450", "10", "3", "720"],
    ["Şeker", "kg", "55", "25", "8", ""],
  ]);
  ws["!cols"] = [{ wch: 25 }, { wch: 12 }, { wch: 18 }, { wch: 14 }, { wch: 12 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, ws, "Hammaddeler");

  // Sheet 2: Açıklamalar
  const info = XLSX.utils.aoa_to_sheet([
    ["Alan", "Açıklama", "Örnek"],
    ["Ad *", "Hammadde adı (zorunlu)", "Un, Süt, Yumurta"],
    ["Birim *", "Ölçü birimi (zorunlu)", "kg, litre, adet, gram, ml, g, lt"],
    ["Birim Fiyat *", "₺ cinsinden birim maliyet (zorunlu)", "40.50"],
    ["Mevcut Stok", "Şu anki stok (opsiyonel, varsayılan: 0)", "50"],
    ["Min Stok", "Uyarı için minimum seviye (opsiyonel)", "10"],
    ["Raf Ömrü (saat)", "Saat cinsinden raf ömrü (opsiyonel)", "48"],
    ["", "", ""],
    ["NOT:", "* işaretli alanlar zorunludur", ""],
    ["NOT:", "Desteklenen birimler: kg, g, gram, mg, litre, lt, l, ml, cl, dl, adet, düzine", ""],
  ]);
  info["!cols"] = [{ wch: 20 }, { wch: 50 }, { wch: 25 }];
  XLSX.utils.book_append_sheet(wb, info, "Açıklamalar");

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="hammadde-sablonu.xlsx"',
    },
  });
}
