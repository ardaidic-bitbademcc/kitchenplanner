import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { salesHistory, products } from "@/lib/schema";
import * as XLSX from "xlsx";

const VALID_CHANNELS = ["mağaza", "online", "catering", "karma"];
const VALID_EVENT_TYPES = ["normal", "resmi_tatil", "özel_gün", "kampanya", "mevsim"];

/**
 * Excel'den gelen tarih değerini YYYY-MM-DD formatına çevirir.
 *
 * Excel üç farklı formatta tarih gönderebilir:
 *  1. Date nesnesi — cellDates:true ile okunduğunda Excel tarih hücresi
 *  2. Sayı (serial) — Excel'in iç tarih formatı (örn: 46112 = 31.03.2026)
 *  3. String — kullanıcının metin olarak girdiği değer (GG.AA.YYYY veya YYYY-MM-DD)
 */
function parseDateToISO(raw: unknown): string | null {
  // 1) Date nesnesi: Excel hücreyi tarih olarak tanıdı
  if (raw instanceof Date) {
    if (isNaN(raw.getTime())) return null;
    const y = raw.getUTCFullYear();
    const m = String(raw.getUTCMonth() + 1).padStart(2, "0");
    const d = String(raw.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  const str = String(raw).trim();

  // 2) GG.AA.YYYY veya G.A.YYYY (Türkçe format — Excel'in Türkiye locale'de ürettiği format)
  const trMatch = str.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (trMatch) {
    const [, d, m, y] = trMatch;
    const iso = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    // Geçerli tarih mi kontrol et
    if (!isNaN(new Date(iso).getTime())) return iso;
  }

  // 3) YYYY-MM-DD (standart ISO format — kullanıcı elle yazmış olabilir)
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    if (!isNaN(new Date(str).getTime())) return str;
  }

  // 4) Excel serial sayısı string olarak geldi (cellDates kapalıyken)
  //    Excel epoch: 1 Ocak 1900 = 1, Unix epoch: 1 Ocak 1970 = 0
  //    Dönüşüm: (serial - 25569) * 86400 * 1000 = Unix ms
  const serial = Number(str);
  if (!isNaN(serial) && serial > 10000 && serial < 200000) {
    const unixMs = (serial - 25569) * 86400 * 1000;
    const date = new Date(unixMs);
    if (!isNaN(date.getTime())) {
      const y = date.getUTCFullYear();
      const m = String(date.getUTCMonth() + 1).padStart(2, "0");
      const d = String(date.getUTCDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    }
  }

  return null;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "admin")
    return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "Dosya bulunamadı" }, { status: 400 });

  const arrayBuffer = await file.arrayBuffer();
  // cellDates: true → Excel tarih hücrelerini Date nesnesine çevirir
  const wb = XLSX.read(arrayBuffer, { type: "array", cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

  // Skip header row
  const dataRows = rows.slice(1).filter((r) => r[0] && r[1] !== "" && r[2] !== "");

  if (dataRows.length === 0) {
    return NextResponse.json({ error: "Veri satırı bulunamadı" }, { status: 400 });
  }

  // Load product name→id map
  const allProducts = await db.select({ id: products.id, name: products.name }).from(products);
  const productMap = new Map(allProducts.map((p) => [p.name.toLowerCase().trim(), p.id]));

  const inserted: string[] = [];
  const skipped: string[] = [];

  for (let i = 0; i < dataRows.length; i++) {
    const [productName, weekStartRaw, soldQtyRaw, revenueRaw, channelRaw, eventTypeRaw, notes] = dataRows[i];
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

    // Tarih ayrıştırma — GG.AA.YYYY, YYYY-MM-DD ve Excel serial formatlarını kabul eder
    const dateStr = parseDateToISO(weekStartRaw);
    if (!dateStr) {
      skipped.push(
        `Satır ${rowNum}: Geçersiz tarih "${weekStartRaw}" — GG.AA.YYYY formatında girin (örn: 31.03.2026)`
      );
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
