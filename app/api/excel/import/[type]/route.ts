import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { rawMaterials, baseProducts, products } from "@/lib/schema";
import * as XLSX from "xlsx";

export async function POST(req: NextRequest, { params }: { params: { type: string } }) {
  const session = await auth();
  if (!session || session.user.role !== "admin")
    return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });

  const formData = await req.formData();
  const file = formData.get("file") as File;
  if (!file) return NextResponse.json({ error: "Dosya bulunamadı" }, { status: 400 });

  const arrayBuffer = await file.arrayBuffer();
  const wb = XLSX.read(arrayBuffer, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: "" });

  if (rows.length < 2) return NextResponse.json({ error: "Veri satırı bulunamadı" }, { status: 400 });

  // Skip header row
  const dataRows = rows.slice(1).filter((row: any[]) => row.some((cell) => cell !== "" && cell !== null && cell !== undefined));

  let inserted = 0;
  let errors: string[] = [];

  if (params.type === "raw-materials") {
    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i] as any[];
      const [name, unit, unitCost, stockQty, minStock, shelfLifeHours] = row;
      if (!name || !unit || unitCost === "" || unitCost === undefined) {
        errors.push(`Satır ${i + 2}: Ad, Birim ve Birim Fiyat zorunludur`);
        continue;
      }
      try {
        await db.insert(rawMaterials).values({
          name: String(name).trim(),
          unit: String(unit).trim(),
          unitCost: String(Number(unitCost)),
          stockQty: stockQty !== "" ? String(Number(stockQty)) : "0",
          minStock: minStock !== "" ? String(Number(minStock)) : "0",
          shelfLifeHours: shelfLifeHours !== "" && shelfLifeHours !== null ? Number(shelfLifeHours) : null,
        });
        inserted++;
      } catch (e: any) {
        errors.push(`Satır ${i + 2}: ${e.message?.includes("unique") ? "Bu ad zaten mevcut" : "Kayıt hatası"}`);
      }
    }
  } else if (params.type === "base-products") {
    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i] as any[];
      const [name, unit, yieldQty, fireRate, shelfLifeHours, notes] = row;
      if (!name || !unit || yieldQty === "" || fireRate === "" || shelfLifeHours === "") {
        errors.push(`Satır ${i + 2}: Zorunlu alanlar eksik`);
        continue;
      }
      try {
        await db.insert(baseProducts).values({
          name: String(name).trim(),
          unit: String(unit).trim(),
          yieldQty: String(Number(yieldQty)),
          fireRate: String(Number(fireRate)),
          shelfLifeHours: Number(shelfLifeHours),
          notes: notes ? String(notes).trim() : null,
        });
        inserted++;
      } catch (e: any) {
        errors.push(`Satır ${i + 2}: ${e.message?.includes("unique") ? "Bu ad zaten mevcut" : "Kayıt hatası"}`);
      }
    }
  } else if (params.type === "products") {
    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i] as any[];
      const [name, description, sellingPrice] = row;
      if (!name) {
        errors.push(`Satır ${i + 2}: Ad zorunludur`);
        continue;
      }
      try {
        await db.insert(products).values({
          name: String(name).trim(),
          description: description ? String(description).trim() : null,
          sellingPrice: sellingPrice !== "" && sellingPrice !== null ? String(Number(sellingPrice)) : null,
        });
        inserted++;
      } catch (e: any) {
        errors.push(`Satır ${i + 2}: ${e.message?.includes("unique") ? "Bu ad zaten mevcut" : "Kayıt hatası"}`);
      }
    }
  } else {
    return NextResponse.json({ error: "Geçersiz içe aktarma tipi" }, { status: 400 });
  }

  return NextResponse.json({ inserted, errors, total: dataRows.length });
}
