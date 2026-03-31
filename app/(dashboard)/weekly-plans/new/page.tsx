"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";

interface Product { id: string; name: string; }
interface AiPlanItem {
  productId: string;
  productName: string;
  targetQty: number;
  reasoning: string;
}
interface AiResult {
  planItems: AiPlanItem[];
  summary: string;
  warnings: string[];
  tokensUsed: number;
  cost: string;
}

export default function NewWeeklyPlanPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [weekStart, setWeekStart] = useState("");
  const [items, setItems] = useState<{ productId: string; targetQty: number }[]>([]);
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<AiResult | null>(null);
  const [mode, setMode] = useState<"manual" | "ai">("manual");

  useEffect(() => {
    fetch("/api/products").then((r) => r.json()).then(setProducts);
    const now = new Date();
    const day = now.getDay();
    const diff = day === 0 ? 1 : 8 - day;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diff);
    setWeekStart(monday.toISOString().split("T")[0]);
  }, []);

  function addItem() {
    if (products.length === 0) return;
    setItems([...items, { productId: products[0].id, targetQty: 1 }]);
  }

  async function handleAiGenerate() {
    if (!weekStart) { toast.error("Önce hafta başı tarihini seçin"); return; }
    setAiLoading(true);
    setAiResult(null);
    const res = await fetch("/api/ai/generate-plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ weekStart }),
    });
    setAiLoading(false);
    if (!res.ok) {
      const err = await res.json();
      toast.error(err.error || "AI hatası");
      return;
    }
    const result: AiResult = await res.json();
    setAiResult(result);
    // Apply AI suggestions to items
    setItems(result.planItems.map((p) => ({ productId: p.productId, targetQty: p.targetQty })));
    toast.success("AI planı oluşturuldu!");
  }

  async function handleSave() {
    if (!weekStart) { toast.error("Hafta başı seçin"); return; }
    setSaving(true);
    const res = await fetch("/api/weekly-plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ weekStart, status: "draft", items }),
    });
    setSaving(false);
    if (res.ok) {
      const plan = await res.json();
      toast.success("Plan oluşturuldu");
      router.push(`/weekly-plans/${plan.id}`);
    } else {
      toast.error("Hata oluştu");
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-brown-800 mb-6">Yeni Haftalık Plan</h1>
      <div className="bg-white rounded-xl border border-cream-200 p-6 space-y-6">

        {/* Week start */}
        <div>
          <label className="block text-sm font-medium text-brown-700 mb-1">Hafta Başı (Pazartesi)</label>
          <input type="date" value={weekStart} onChange={(e) => setWeekStart(e.target.value)}
            className="border border-cream-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brown-400" />
        </div>

        {/* Mode toggle */}
        <div className="flex gap-2">
          <button onClick={() => setMode("manual")}
            className={`flex-1 py-2 rounded-lg text-sm font-medium border transition ${mode === "manual" ? "bg-brown-600 text-white border-brown-600" : "border-cream-300 text-brown-600 hover:bg-cream-50"}`}>
            Manuel Giris
          </button>
          <button onClick={() => setMode("ai")}
            className={`flex-1 py-2 rounded-lg text-sm font-medium border transition ${mode === "ai" ? "bg-brown-600 text-white border-brown-600" : "border-cream-300 text-brown-600 hover:bg-cream-50"}`}>
            AI ile Planla
          </button>
        </div>

        {/* AI Mode */}
        {mode === "ai" && (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <p className="text-sm text-blue-800 mb-3">
                <strong>GPT-4o-mini</strong> satis gecmisinizi, stok durumunuzu ve parti ciktilarini analiz ederek optimal uretim miktarlarini onerır.
              </p>
              <Button onClick={handleAiGenerate} disabled={aiLoading} className="w-full">
                {aiLoading ? "AI analiz ediyor..." : "AI Plani Olustur"}
              </Button>
            </div>

            {aiResult && (
              <div className="space-y-4">
                {/* Summary */}
                <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                  <p className="text-sm font-semibold text-green-800 mb-1">AI Ozeti</p>
                  <p className="text-sm text-green-700">{aiResult.summary}</p>
                  <p className="text-xs text-green-500 mt-2">
                    {aiResult.tokensUsed} token kullanildi · ~${aiResult.cost} maliyet
                  </p>
                </div>

                {/* Warnings */}
                {aiResult.warnings?.length > 0 && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 space-y-1">
                    <p className="text-sm font-semibold text-yellow-800">Uyarilar</p>
                    {aiResult.warnings.map((w, i) => (
                      <p key={i} className="text-sm text-yellow-700">- {w}</p>
                    ))}
                  </div>
                )}

                {/* AI suggestions */}
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-brown-700">AI Onerileri (duzenleyebilirsiniz):</p>
                  {aiResult.planItems.map((item, i) => (
                    <div key={i} className="border border-cream-200 rounded-xl p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-brown-800">{item.productName}</span>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="0"
                            defaultValue={item.targetQty}
                            onChange={(e) => {
                              const qty = parseInt(e.target.value) || 0;
                              setItems((prev) => prev.map((p) => p.productId === item.productId ? { ...p, targetQty: qty } : p));
                            }}
                            className="w-20 border border-cream-300 rounded-lg px-2 py-1 text-sm text-center font-semibold"
                          />
                          <span className="text-xs text-brown-500">adet</span>
                        </div>
                      </div>
                      <p className="text-xs text-brown-500 italic">{item.reasoning}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Manual Mode */}
        {mode === "manual" && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-brown-700">Urun Hedefleri</h2>
              <Button size="sm" onClick={addItem}>+ Urun Ekle</Button>
            </div>
            <div className="space-y-3">
              {items.map((item, i) => (
                <div key={i} className="flex gap-3 items-end">
                  <div className="flex-1">
                    <label className="text-xs text-brown-500 mb-1 block">Urun</label>
                    <select value={item.productId}
                      onChange={(e) => { const u = [...items]; u[i].productId = e.target.value; setItems(u); }}
                      className="w-full border border-cream-300 rounded-lg px-2 py-2 text-sm">
                      {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                  <div className="w-28">
                    <label className="text-xs text-brown-500 mb-1 block">Hedef Adet</label>
                    <input type="number" min="1" value={item.targetQty}
                      onChange={(e) => { const u = [...items]; u[i].targetQty = parseInt(e.target.value) || 1; setItems(u); }}
                      className="w-full border border-cream-300 rounded-lg px-2 py-2 text-sm" />
                  </div>
                  <Button size="sm" variant="danger" onClick={() => setItems(items.filter((_, idx) => idx !== i))}>x</Button>
                </div>
              ))}
              {items.length === 0 && <p className="text-brown-400 text-sm">Henuz urun eklenmedi.</p>}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 justify-end border-t border-cream-100 pt-4">
          <Button variant="secondary" onClick={() => router.back()}>Iptal</Button>
          <Button onClick={handleSave} disabled={saving || items.length === 0}>
            {saving ? "Olusturuluyor..." : "Plani Kaydet"}
          </Button>
        </div>
      </div>
    </div>
  );
}
