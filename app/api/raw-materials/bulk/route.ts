import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { rawMaterials } from "@/lib/schema";
import * as XLSX from "xlsx";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user as any).role !== "admin")
    return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "Dosya bulunamadı" }, { status: 400 });

  const arrayBuffer = await file.arrayBuffer();
  const wb = XLSX.read(arrayBuffer, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

  // Skip header row, drop empty rows
  const dataRows = rows.slice(1).filter((r) => String(r[0]).trim() && String(r[1]).trim() && String(r[2]).trim());

  if (dataRows.length === 0)
    return NextResponse.json({ error: "Veri satırı bulunamadı. İlk satır başlık, altındaki satırlar veri olmalı." }, { status: 400 });

  const inserted: string[] = [];
  const skipped: string[] = [];

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const rowNum = i + 2;

    const name = String(row[0]).trim();
    const unit = String(row[1]).trim();
    const unitCost = parseFloat(String(row[2]));

    if (isNaN(unitCost) || unitCost < 0) {
      skipped.push(`Satır ${rowNum} (${name}): Geçersiz birim fiyat "${row[2]}"`);
      continue;
    }

    const stockQtyRaw = String(row[3]).trim();
    const minStockRaw = String(row[4]).trim();
    const shelfLifeRaw = String(row[5]).trim();

    const stockQty = stockQtyRaw !== "" ? parseFloat(stockQtyRaw) : 0;
    const minStock = minStockRaw !== "" ? parseFloat(minStockRaw) : 0;
    const shelfLifeHours = shelfLifeRaw !== "" ? parseInt(shelfLifeRaw) : null;

    if (isNaN(stockQty)) { skipped.push(`Satır ${rowNum} (${name}): Geçersiz stok miktarı`); continue; }
    if (isNaN(minStock)) { skipped.push(`Satır ${rowNum} (${name}): Geçersiz min stok`); continue; }

    try {
      await db.insert(rawMaterials).values({
        name,
        unit,
        unitCost: unitCost.toFixed(2),
        stockQty: stockQty.toFixed(3),
        minStock: minStock.toFixed(3),
        shelfLifeHours,
      });
      inserted.push(name);
    } catch (e: any) {
      skipped.push(`Satır ${rowNum} (${name}): ${e.message}`);
    }
  }

  return NextResponse.json({ inserted: inserted.length, insertedNames: inserted, skipped });
}
