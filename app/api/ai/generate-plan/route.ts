import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { products, baseProducts, rawMaterials, weeklyPlans, weeklyPlanItems, salesHistory, productBaseRequirements, productStages } from "@/lib/schema";
import { desc, eq } from "drizzle-orm";
import { openai } from "@/lib/openai";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user as any).role !== "admin")
    return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });

  const body = await req.json();
  const { weekStart } = body;
  if (!weekStart) return NextResponse.json({ error: "weekStart zorunlu" }, { status: 400 });

  // Gather context
  const allProducts = await db.select().from(products);
  const allBaseProducts = await db.select().from(baseProducts);
  const allRawMaterials = await db.select().from(rawMaterials);
  const baseReqs = await db.select().from(productBaseRequirements);
  const stages = await db.select().from(productStages);

  // Last 8 weeks of sales history
  const salesData = await db
    .select()
    .from(salesHistory)
    .orderBy(desc(salesHistory.weekStart))
    .limit(80); // up to 10 products × 8 weeks

  // Last 4 plans for context
  const recentPlans = await db
    .select()
    .from(weeklyPlans)
    .orderBy(desc(weeklyPlans.weekStart))
    .limit(4);

  const recentPlanItems = recentPlans.length > 0
    ? await db
        .select()
        .from(weeklyPlanItems)
        .where(eq(weeklyPlanItems.planId, recentPlans[0].id))
    : [];

  // Build context object for GPT
  const context = {
    weekStart,
    products: allProducts.map((p) => ({
      id: p.id,
      name: p.name,
      sellingPrice: p.sellingPrice,
    })),
    baseProducts: allBaseProducts.map((bp) => ({
      id: bp.id,
      name: bp.name,
      unit: bp.unit,
      yieldQty: bp.yieldQty,
      fireRate: bp.fireRate,
      shelfLifeHours: bp.shelfLifeHours,
    })),
    rawMaterialStock: allRawMaterials.map((rm) => ({
      name: rm.name,
      unit: rm.unit,
      stockQty: rm.stockQty,
      minStock: rm.minStock,
      unitCost: rm.unitCost,
    })),
    productBaseRequirements: baseReqs.map((r) => {
      const p = allProducts.find((x) => x.id === r.productId);
      const bp = allBaseProducts.find((x) => x.id === r.baseProductId);
      return {
        product: p?.name,
        baseProduct: bp?.name,
        qtyPerUnit: r.qtyPerUnit,
      };
    }),
    productStages: stages.map((s) => {
      const p = allProducts.find((x) => x.id === s.productId);
      return {
        product: p?.name,
        stageName: s.stageName,
        dayOffset: s.dayOffset,
        durationHours: s.durationHours,
      };
    }),
    salesHistory: salesData.map((s) => {
      const p = allProducts.find((x) => x.id === s.productId);
      return {
        product: p?.name,
        weekStart: s.weekStart,
        soldQty: s.soldQty,
      };
    }),
    recentPlanItems: recentPlanItems.map((i) => {
      const p = allProducts.find((x) => x.id === i.productId);
      return { product: p?.name, targetQty: i.targetQty };
    }),
  };

  const systemPrompt = `Sen bir butik pastane için üretim planlama asistanısın.
Görevin: verilen hafta için her ürün için kaç adet üretilmesi gerektiğini optimize ederek planlamak.

Optimizasyon kriterleri:
1. TALEP TAHMİNİ: Geçmiş satış verilerini analiz et, ortalama + trend hesapla
2. GÜVENLİK STOĞU: Ortalama talebin %10-15 üzerinde hedefle
3. TAM PARTİ OPTİMİZASYONU: Baz ürün parti çıktılarına göre tam/yarım parti hesapla, yarım parti olabilirse kabul et ama %20'den az party kaybını tercih et
4. RAF ÖMRÜ: Kısa raflı ürünler için aşırı üretimden kaçın
5. STOK KONTROLÜ: Mevcut hammadde stoğu yeterliliğini kontrol et
6. MALİYET ETKİNLİĞİ: Pahalı hammaddeli ürünlerde israfı minimize et

Yanıt formatı (sadece JSON döndür, başka metin yok):
{
  "planItems": [
    {
      "productId": "uuid",
      "productName": "string",
      "targetQty": number,
      "reasoning": "Türkçe kısa gerekçe (1-2 cümle)"
    }
  ],
  "summary": "Türkçe genel özet (2-3 cümle)",
  "warnings": ["Türkçe uyarı listesi (stok eksikliği, kısa raf ömrü vb.)"]
}`;

  const userMessage = `Hafta başı: ${weekStart}
İşte mevcut veri:
${JSON.stringify(context, null, 2)}

Bu haftanın üretim planını oluştur. Eğer satış geçmişi yoksa son planı veya makul bir başlangıç miktarı kullan.`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
    temperature: 0.3,
    response_format: { type: "json_object" },
  });

  const content = response.choices[0].message.content;
  if (!content) return NextResponse.json({ error: "AI yanıt vermedi" }, { status: 500 });

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    return NextResponse.json({ error: "AI yanıtı parse edilemedi" }, { status: 500 });
  }

  return NextResponse.json({
    ...parsed,
    tokensUsed: response.usage?.total_tokens,
    cost: ((response.usage?.prompt_tokens || 0) * 0.00000015 + (response.usage?.completion_tokens || 0) * 0.0000006).toFixed(6),
  });
}
