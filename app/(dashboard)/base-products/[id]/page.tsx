"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import toast from "react-hot-toast";
import { useSession } from "next-auth/react";

interface Ingredient { id?: string; rawMaterialId: string; qtyPerUnit: string; unit: string; rawMaterialName?: string; }
interface RawMaterial { id: string; name: string; unit: string; }

export default function BaseProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: session } = useSession();
  const isAdmin = (session?.user as any)?.role === "admin";
  const [bp, setBp] = useState<any>(null);
  const [rawMats, setRawMats] = useState<RawMaterial[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load() {
    const [bpRes, rmRes] = await Promise.all([fetch(`/api/base-products/${id}`), fetch("/api/raw-materials")]);
    const bpData = await bpRes.json();
    const rmData = await rmRes.json();
    setBp(bpData);
    setRawMats(rmData);
    setIngredients(bpData.ingredients || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [id]);

  function addIngredient() {
    setIngredients([...ingredients, { rawMaterialId: rawMats[0]?.id || "", qtyPerUnit: "0", unit: "kg" }]);
  }

  function removeIngredient(i: number) {
    setIngredients(ingredients.filter((_, idx) => idx !== i));
  }

  function updateIngredient(i: number, field: keyof Ingredient, value: string) {
    const updated = [...ingredients];
    (updated[i] as any)[field] = value;
    setIngredients(updated);
  }

  async function handleSave() {
    setSaving(true);
    const res = await fetch(`/api/base-products/${id}/ingredients`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ingredients.map((i) => ({ rawMaterialId: i.rawMaterialId, qtyPerUnit: i.qtyPerUnit, unit: i.unit }))),
    });
    setSaving(false);
    if (res.ok) { toast.success("İçerik kaydedildi"); load(); }
    else { toast.error("Hata oluştu"); }
  }

  if (loading) return <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>;

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-brown-800 mb-1">{bp?.name}</h1>
      <p className="text-brown-500 text-sm mb-6">Parti çıktısı: {bp?.yieldQty} {bp?.unit} · Fire: {(parseFloat(bp?.fireRate) * 100).toFixed(0)}% · Raf ömrü: {bp?.shelfLifeHours} sa</p>

      <div className="bg-white rounded-xl border border-cream-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-brown-700">Hammadde İçeriği</h2>
          {isAdmin && <Button size="sm" onClick={addIngredient}>+ Hammadde Ekle</Button>}
        </div>
        <div className="space-y-3">
          {ingredients.map((ing, i) => (
            <div key={i} className="flex gap-2 items-end">
              <div className="flex-1">
                <label className="text-xs text-brown-500 mb-1 block">Hammadde</label>
                <select value={ing.rawMaterialId} onChange={(e) => updateIngredient(i, "rawMaterialId", e.target.value)} disabled={!isAdmin} className="w-full border border-cream-300 rounded-lg px-2 py-2 text-sm">
                  {rawMats.map((rm) => <option key={rm.id} value={rm.id}>{rm.name}</option>)}
                </select>
              </div>
              <div className="w-24">
                <label className="text-xs text-brown-500 mb-1 block">Miktar</label>
                <input type="number" value={ing.qtyPerUnit} onChange={(e) => updateIngredient(i, "qtyPerUnit", e.target.value)} disabled={!isAdmin} className="w-full border border-cream-300 rounded-lg px-2 py-2 text-sm" />
              </div>
              <div className="w-20">
                <label className="text-xs text-brown-500 mb-1 block">Birim</label>
                <input value={ing.unit} onChange={(e) => updateIngredient(i, "unit", e.target.value)} disabled={!isAdmin} className="w-full border border-cream-300 rounded-lg px-2 py-2 text-sm" />
              </div>
              {isAdmin && <Button size="sm" variant="danger" onClick={() => removeIngredient(i)}>×</Button>}
            </div>
          ))}
          {ingredients.length === 0 && <p className="text-brown-400 text-sm">Henüz hammadde eklenmemiş.</p>}
        </div>
        {isAdmin && (
          <div className="mt-4 flex justify-end">
            <Button onClick={handleSave} disabled={saving}>{saving ? "Kaydediliyor..." : "Kaydet"}</Button>
          </div>
        )}
      </div>
    </div>
  );
}
