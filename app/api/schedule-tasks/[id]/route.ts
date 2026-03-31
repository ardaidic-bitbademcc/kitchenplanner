import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { scheduleTasks } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { deductStockForTask } from "@/lib/stock-deduction";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const body = await req.json();
  const { status } = body;

  if (!["pending", "done"].includes(status)) {
    return NextResponse.json({ error: "Geçersiz durum" }, { status: 400 });
  }

  // Mevcut durumu kontrol et
  const taskRows = await db
    .select()
    .from(scheduleTasks)
    .where(eq(scheduleTasks.id, params.id))
    .limit(1);
  const task = taskRows[0];
  if (!task) return NextResponse.json({ error: "Görev bulunamadı" }, { status: 404 });

  // Durumu güncelle
  const [updated] = await db
    .update(scheduleTasks)
    .set({ status })
    .where(eq(scheduleTasks.id, params.id))
    .returning();

  // Sadece pending → done geçişinde stok düş
  if (status === "done" && task.status === "pending") {
    try {
      await deductStockForTask(params.id);
    } catch (e: any) {
      // Stok düşümü başarısız olsa da görev durumu güncellendi
      console.error("Stok düşümü hatası:", e.message);
      return NextResponse.json({ ...updated, stockWarning: e.message });
    }
  }

  return NextResponse.json(updated);
}
