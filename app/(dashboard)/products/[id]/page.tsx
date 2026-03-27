"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import toast from "react-hot-toast";
import { useSession } from "next-auth/react";

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: session } = useSession();
  const isAdmin = (session?.user as any)?.role === "admin";
  const [product, setProduct] = useState<any>(null);
  const [baseProducts, setBaseProducts] = useState<any[]>([]);
  const [baseReqs, setBaseReqs] = useState<{ baseProductId: string; qtyPerUnit: string }[]>([]);
  const [stages, setStages] = useState<{ stageName: string; stageOrder: number; dayOffset: number; durationHours: string; notes: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load() {
    const [pRes, bpRes] = await Promise.all([fetch(`/api/products/${id}`), fetch("/api/base-products")]);
    const pData = await pRes.json();
    const bpData = await bpRes.json();
    setProduct(pData);
    setBaseProducts(bpData);
    setBaseReqs(pData.baseRequirements?.map((r: any) => ({ baseProductId: r.baseProductId, qtyPerUnit: r.qtyPerUnit })) || []);
    setStages(pData.stages?.map((s: any) => ({ stageName: s.stageName, stageOrder: s.stageOrder, dayOffset: s.dayOffset, durationHours: s.durationHours, notes: s.notes || "" })) || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [id]);

  async function saveBaseReqs() {
    setSaving(true);
    const res = await fetch(`/api/products/${id}/base-requirements`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(baseReqs) });
    setSaving(false);
    if (res.ok) { toast.success("Baz ürün bağlantıları kaydedildi"); }
    else { toast.error("Hata"); }
  }

  async function saveStages() {
    setSaving(true);
    const res = await fetch(`/api/products/${id}/stages`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(stages.map((s) => ({ ...s, stageOrder: Number(s.stageOrder), dayOffset: Number(s.dayOffset) }))) });
    setSaving(false);
    if (res.ok) { toast.success("Aşamalar kaydedildi"); }
    else { toast.error("Hata"); }
  }

  if (loading) return <div className="space-y-3">{[1,2,3,4].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>;

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-brown-800">{product?.name}</h1>

      {/* Base requirements */}
      <div className="bg-white rounded-xl border border-cream-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-brown-700">Baz Ürün Bağlantıları</h2>
          {isAdmin && <Button size="sm" onClick={() => setBaseReqs([...baseReqs, { baseProductId: baseProducts[0]?.id || "", qtyPerUnit: "0" }])}>+ Ekle</Button>}
        </div>
        <div className="space-y-3">
          {baseReqs.map((req, i) => (
            <div key={i} className="flex gap-2 items-end">
              <div className="flex-1">
                <label className="text-xs text-brown-500 mb-1 block">Baz Ürün</label>
                <select value={req.baseProductId} onChange={(e) => { const u = [...baseReqs]; u[i].baseProductId = e.target.value; setBaseReqs(u); }} disabled={!isAdmin} className="w-full border border-cream-300 rounded-lg px-2 py-2 text-sm">
                  {baseProducts.map((bp) => <option key={bp.id} value={bp.id}>{bp.name}</option>)}
                </select>
              </div>
              <div className="w-32">
                <label className="text-xs text-brown-500 mb-1 block">Miktar/adet</label>
                <input type="number" value={req.qtyPerUnit} onChange={(e) => { const u = [...baseReqs]; u[i].qtyPerUnit = e.target.value; setBaseReqs(u); }} disabled={!isAdmin} className="w-full border border-cream-300 rounded-lg px-2 py-2 text-sm" />
              </div>
              {isAdmin && <Button size="sm" variant="danger" onClick={() => setBaseReqs(baseReqs.filter((_, idx) => idx !== i))}>×</Button>}
            </div>
          ))}
          {baseReqs.length === 0 && <p className="text-brown-400 text-sm">Baz ürün bağlantısı yok.</p>}
        </div>
        {isAdmin && <div className="mt-4 flex justify-end"><Button onClick={saveBaseReqs} disabled={saving}>Kaydet</Button></div>}
      </div>

      {/* Stages */}
      <div className="bg-white rounded-xl border border-cream-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-brown-700">Üretim Aşamaları</h2>
          {isAdmin && <Button size="sm" onClick={() => setStages([...stages, { stageName: "Yeni Aşama", stageOrder: stages.length + 1, dayOffset: 0, durationHours: "1", notes: "" }])}>+ Aşama Ekle</Button>}
        </div>
        <div className="space-y-3">
          {stages.map((s, i) => (
            <div key={i} className="border border-cream-100 rounded-lg p-3 space-y-2">
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-xs text-brown-500 block mb-1">Aşama Adı</label>
                  <input value={s.stageName} onChange={(e) => { const u = [...stages]; u[i].stageName = e.target.value; setStages(u); }} disabled={!isAdmin} className="w-full border border-cream-300 rounded-lg px-2 py-1.5 text-sm" />
                </div>
                <div className="w-16">
                  <label className="text-xs text-brown-500 block mb-1">Sıra</label>
                  <input type="number" value={s.stageOrder} onChange={(e) => { const u = [...stages]; u[i].stageOrder = parseInt(e.target.value); setStages(u); }} disabled={!isAdmin} className="w-full border border-cream-300 rounded-lg px-2 py-1.5 text-sm" />
                </div>
                <div className="w-24">
                  <label className="text-xs text-brown-500 block mb-1">Gün Offset</label>
                  <input type="number" value={s.dayOffset} onChange={(e) => { const u = [...stages]; u[i].dayOffset = parseInt(e.target.value); setStages(u); }} disabled={!isAdmin} className="w-full border border-cream-300 rounded-lg px-2 py-1.5 text-sm" />
                </div>
                <div className="w-20">
                  <label className="text-xs text-brown-500 block mb-1">Süre (sa)</label>
                  <input type="number" value={s.durationHours} onChange={(e) => { const u = [...stages]; u[i].durationHours = e.target.value; setStages(u); }} disabled={!isAdmin} className="w-full border border-cream-300 rounded-lg px-2 py-1.5 text-sm" />
                </div>
                {isAdmin && <div className="flex items-end"><Button size="sm" variant="danger" onClick={() => setStages(stages.filter((_, idx) => idx !== i))}>×</Button></div>}
              </div>
            </div>
          ))}
          {stages.length === 0 && <p className="text-brown-400 text-sm">Aşama tanımlanmamış.</p>}
        </div>
        {isAdmin && <div className="mt-4 flex justify-end"><Button onClick={saveStages} disabled={saving}>Aşamaları Kaydet</Button></div>}
      </div>
    </div>
  );
}
