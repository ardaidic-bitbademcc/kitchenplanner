import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { salesHistory, products } from "@/lib/schema";
import { eq } from "drizzle-orm";
import * as XLSX from "xlsx";

const VALID_CHANNELS = ["mağaza", "online", "catering", "karma"];
const VALID_EVENT_TYPES = ["normal", "resmi_tatil", "özel_gün", "kampanya", "mevsim"];

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

  // Skip header row
  const dataRows = rows.slice(1).filter((r) => r[0] && r[1] && r[2]);

  if (dataRows.length === 0) {
    return NextResponse.json({ error: "Veri satırı bulunamadı" }, { status: 400 });
  }

  // Load product name→id map
  const allProducts = await db.select({ id: products.id, name: products.name }).from(products);
  const productMap = new Map(allProducts.map((p) => [p.name.toLowerCase().trim(), p.id]));

  const inserted: string[] = [];
  const skipped: string[] = [];

  for (let i = 0; i < dataRows.length; i++) {
    const [productName, weekStart, soldQtyRaw, revenueRaw, channelRaw, eventTypeRaw, notes] = dataRows[i];
    const rowNum = i + 2;

    const productId = productMap.get(String(productName).toLowerCase().trim());
    if (!productId) {
      skipped.push(`Satır ${rowNum}: "${productName}" ürünü bulunamadı`);
      continue;
    }

    const soldQty = parseInt(String(soldQtyRaw));
    if (isNaN(soldQty) || soldQty < 0) {
      skipped.push(`Satır ${rowNum}: Geçersiz adet "${soldQtyRaw}"`);
      continue;
    }

    // Validate date format YYYY-MM-DD
    const dateStr = String(weekStart).trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      skipped.push(`Satır ${rowNum}: Geçersiz tarih formatı "${dateStr}" (YYYY-AA-GG olmalı)`);
      continue;
    }

    const channel = VALID_CHANNELS.includes(String(channelRaw).toLowerCase().trim())
      ? String(channelRaw).toLowerCase().trim()
      : "mağaza";

    const eventType = VALID_EVENT_TYPES.includes(String(eventTypeRaw).toLowerCase().trim())
      ? String(eventTypeRaw).toLowerCase().trim()
      : "normal";

    const revenue = revenueRaw !== "" ? String(parseFloat(String(revenueRaw)).toFixed(2)) : null;

    try {
      await db.insert(salesHistory).values({
        productId,
        weekStart: dateStr,
        soldQty,
        revenue,
        channel,
        eventType,
        notes: notes ? String(notes).trim() : null,
      });
      inserted.push(`${productName} / ${dateStr}`);
    } catch (e: any) {
      skipped.push(`Satır ${rowNum}: DB hatası - ${e.message}`);
    }
  }

  return NextResponse.json({
    inserted: inserted.length,
    skipped,
    details: inserted,
  });
}
