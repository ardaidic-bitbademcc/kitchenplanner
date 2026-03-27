"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";

interface Product { id: string; name: string; }

export default function NewWeeklyPlanPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [weekStart, setWeekStart] = useState("");
  const [items, setItems] = useState<{ productId: string; targetQty: number }[]>([]);
  const [saving, setSaving] = useState(false);

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
        <div>
          <label className="block text-sm font-medium text-brown-700 mb-1">Hafta Başı (Pazartesi)</label>
          <input
            type="date"
            value={weekStart}
            onChange={(e) => setWeekStart(e.target.value)}
            className="border border-cream-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brown-400"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-brown-700">Ürün Hedefleri</h2>
            <Button size="sm" onClick={addItem}>+ Ürün Ekle</Button>
          </div>
          <div className="space-y-3">
            {items.map((item, i) => (
              <div key={i} className="flex gap-3 items-end">
                <div className="flex-1">
                  <label className="text-xs text-brown-500 mb-1 block">Ürün</label>
                  <select
                    value={item.productId}
                    onChange={(e) => { const u = [...items]; u[i].productId = e.target.value; setItems(u); }}
                    className="w-full border border-cream-300 rounded-lg px-2 py-2 text-sm"
                  >
                    {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div className="w-28">
                  <label className="text-xs text-brown-500 mb-1 block">Hedef Adet</label>
                  <input
                    type="number"
                    min="1"
                    value={item.targetQty}
                    onChange={(e) => { const u = [...items]; u[i].targetQty = parseInt(e.target.value) || 1; setItems(u); }}
                    className="w-full border border-cream-300 rounded-lg px-2 py-2 text-sm"
                  />
                </div>
                <Button size="sm" variant="danger" onClick={() => setItems(items.filter((_, idx) => idx !== i))}>×</Button>
              </div>
            ))}
            {items.length === 0 && <p className="text-brown-400 text-sm">Henüz ürün eklenmedi.</p>}
          </div>
        </div>

        <div className="flex gap-3 justify-end">
          <Button variant="secondary" onClick={() => router.back()}>İptal</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Oluşturuluyor..." : "Plan Oluştur"}</Button>
        </div>
      </div>
    </div>
  );
}
