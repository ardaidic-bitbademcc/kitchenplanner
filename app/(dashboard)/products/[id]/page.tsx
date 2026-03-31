"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import toast from "react-hot-toast";
import { useSession } from "next-auth/react";

function CostCard({ label, value, sub, highlight }: { label: string; value: string; sub: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl border p-3 ${highlight ? "bg-green-50 border-green-200" : "bg-white border-cream-200"}`}>
      <p className="text-xs text-brown-500">{label}</p>
      <p className={`text-xl font-bold ${highlight ? "text-green-700" : "text-brown-800"}`}>{value}</p>
      <p className="text-xs text-brown-400">{sub}</p>
    </div>
  );
}

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: session } = useSession();
  const isAdmin = (session?.user as any)?.role === "admin";
  const [product, setProduct] = useState<any>(null);
  const [baseProducts, setBaseProducts] = useState<any[]>([]);
  const [baseReqs, setBaseReqs] = useState<{ baseProductId: string; qtyPerUnit: string }[]>([]);
  const [stages, setStages] = useState<{ stageName: string; stageOrder: number; dayOffset: number; durationHours: string; notes: string }[]>([]);
  const [costData, setCostData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"baseReqs" | "stages" | "cost">("baseReqs");

  async function load() {
    const [pRes, bpRes] = await Promise.all([fetch(`/api/products/${id}`), fetch("/api/base-products")]);
    const pData = await pRes.json();
    const bpData = await bpRes.json();
    setProduct(pData);
    setBaseProducts(bpData);
    setBaseReqs(pData.baseRequirements?.map((r: any) => ({ baseProductId: r.baseProductId, qtyPerUnit: r.qtyPerUnit })) || []);
    setStages(pData.stages?.map((s: any) => ({ stageName: s.stageName, stageOrder: s.stageOrder, dayOffset: s.dayOffset, durationHours: s.durationHours, notes: s.notes || "" })) || []);
    fetch(`/api/products/${id}/cost`).then(r => r.json()).then(setCostData);
    setLoading(false);
  }

  useEffect(() => { load(); }, [id]);

  async function saveBaseReqs() {
    setSaving(true);
    const res = await fetch(`/api/products/${id}/base-requirements`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(baseReqs) });
    setSaving(false);
    if (res.ok) { toast.success("Baz urun baglantilari kaydedildi"); }
    else { toast.error("Hata"); }
  }

  async function saveStages() {
    setSaving(true);
    const res = await fetch(`/api/products/${id}/stages`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(stages.map((s) => ({ ...s, stageOrder: Number(s.stageOrder), dayOffset: Number(s.dayOffset) }))) });
    setSaving(false);
    if (res.ok) { toast.success("Asamalar kaydedildi"); }
    else { toast.error("Hata"); }
  }

  if (loading) return <div className="space-y-3">{[1,2,3,4].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>;

  const tabs = [
    { key: "baseReqs", label: "Baz Urun Baglantilari" },
    { key: "stages", label: "Uretim Asamalari" },
    { key: "cost", label: "Maliyet" },
  ] as const;

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-brown-800">{product?.name}</h1>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-cream-200">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition ${activeTab === t.key ? "border-brown-600 text-brown-700" : "border-transparent text-brown-400 hover:text-brown-600"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Base requirements */}
      {activeTab === "baseReqs" && (
        <div className="bg-white rounded-xl border border-cream-200 p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-brown-700">Baz Urun Baglantilari</h2>
            {isAdmin && <Button size="sm" onClick={() => setBaseReqs([...baseReqs, { baseProductId: baseProducts[0]?.id || "", qtyPerUnit: "0" }])}>+ Ekle</Button>}
          </div>
          <div className="space-y-3">
            {baseReqs.map((req, i) => (
              <div key={i} className="flex gap-2 items-end">
                <div className="flex-1">
                  <label className="text-xs text-brown-500 mb-1 block">Baz Urun</label>
                  <select value={req.baseProductId} onChange={(e) => { const u = [...baseReqs]; u[i].baseProductId = e.target.value; setBaseReqs(u); }} disabled={!isAdmin} className="w-full border border-cream-300 rounded-lg px-2 py-2 text-sm">
                    {baseProducts.map((bp) => <option key={bp.id} value={bp.id}>{bp.name}</option>)}
                  </select>
                </div>
                <div className="w-32">
                  <label className="text-xs text-brown-500 mb-1 block">Miktar/adet</label>
                  <input type="number" value={req.qtyPerUnit} onChange={(e) => { const u = [...baseReqs]; u[i].qtyPerUnit = e.target.value; setBaseReqs(u); }} disabled={!isAdmin} className="w-full border border-cream-300 rounded-lg px-2 py-2 text-sm" />
                </div>
                {isAdmin && <Button size="sm" variant="danger" onClick={() => setBaseReqs(baseReqs.filter((_, idx) => idx !== i))}>x</Button>}
              </div>
            ))}
            {baseReqs.length === 0 && <p className="text-brown-400 text-sm">Baz urun baglantisi yok.</p>}
          </div>
          {isAdmin && <div className="mt-4 flex justify-end"><Button onClick={saveBaseReqs} disabled={saving}>Kaydet</Button></div>}
        </div>
      )}

      {/* Stages */}
      {activeTab === "stages" && (
        <div className="bg-white rounded-xl border border-cream-200 p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-brown-700">Uretim Asamalari</h2>
            {isAdmin && <Button size="sm" onClick={() => setStages([...stages, { stageName: "Yeni Asama", stageOrder: stages.length + 1, dayOffset: 0, durationHours: "1", notes: "" }])}>+ Asama Ekle</Button>}
          </div>
          <div className="space-y-3">
            {stages.map((s, i) => (
              <div key={i} className="border border-cream-100 rounded-lg p-3 space-y-2">
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="text-xs text-brown-500 block mb-1">Asama Adi</label>
                    <input value={s.stageName} onChange={(e) => { const u = [...stages]; u[i].stageName = e.target.value; setStages(u); }} disabled={!isAdmin} className="w-full border border-cream-300 rounded-lg px-2 py-1.5 text-sm" />
                  </div>
                  <div className="w-16">
                    <label className="text-xs text-brown-500 block mb-1">Sira</label>
                    <input type="number" value={s.stageOrder} onChange={(e) => { const u = [...stages]; u[i].stageOrder = parseInt(e.target.value); setStages(u); }} disabled={!isAdmin} className="w-full border border-cream-300 rounded-lg px-2 py-1.5 text-sm" />
                  </div>
                  <div className="w-24">
                    <label className="text-xs text-brown-500 block mb-1">Gun Offset</label>
                    <input type="number" value={s.dayOffset} onChange={(e) => { const u = [...stages]; u[i].dayOffset = parseInt(e.target.value); setStages(u); }} disabled={!isAdmin} className="w-full border border-cream-300 rounded-lg px-2 py-1.5 text-sm" />
                  </div>
                  <div className="w-20">
                    <label className="text-xs text-brown-500 block mb-1">Sure (sa)</label>
                    <input type="number" value={s.durationHours} onChange={(e) => { const u = [...stages]; u[i].durationHours = e.target.value; setStages(u); }} disabled={!isAdmin} className="w-full border border-cream-300 rounded-lg px-2 py-1.5 text-sm" />
                  </div>
                  {isAdmin && <div className="flex items-end"><Button size="sm" variant="danger" onClick={() => setStages(stages.filter((_, idx) => idx !== i))}>x</Button></div>}
                </div>
              </div>
            ))}
            {stages.length === 0 && <p className="text-brown-400 text-sm">Asama tanimlanmamis.</p>}
          </div>
          {isAdmin && <div className="mt-4 flex justify-end"><Button onClick={saveStages} disabled={saving}>Asamalari Kaydet</Button></div>}
        </div>
      )}

      {/* Cost */}
      {activeTab === "cost" && costData && (
        <div className="space-y-4">
          {costData.error ? (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">{costData.error}</div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <CostCard label="Uretim Maliyeti" value={`₺${costData.costPerUnit?.toFixed(2)}`} sub="adet basina"/>
                <CostCard label="Satis Fiyati" value={costData.sellingPrice ? `₺${parseFloat(costData.sellingPrice).toFixed(2)}` : "-"} sub="adet"/>
                <CostCard label="Kar" value={costData.profitPerUnit!=null ? `₺${costData.profitPerUnit?.toFixed(2)}` : "-"} sub="adet basina" highlight={costData.profitPerUnit > 0}/>
                <CostCard label="Kar Marji" value={costData.marginPct!=null ? `%${costData.marginPct?.toFixed(1)}` : "-"} sub="satis uzerinden" highlight={costData.marginPct > 0}/>
              </div>
              <div className="bg-white rounded-xl border border-cream-200 overflow-hidden">
                <div className="px-4 py-3 bg-cream-100 font-semibold text-brown-700 text-sm">Baz Urun Maliyet Dokumu</div>
                <table className="w-full text-sm">
                  <thead className="bg-cream-50 text-brown-600">
                    <tr>
                      <th className="text-left px-4 py-2">Baz Urun</th>
                      <th className="text-right px-4 py-2">Miktar/adet</th>
                      <th className="text-right px-4 py-2">BP Birim Maliyeti</th>
                      <th className="text-right px-4 py-2">Toplam</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-cream-50">
                    {costData.baseProductLines?.map((line: any, i: number) => (
                      <tr key={i}>
                        <td className="px-4 py-2 font-medium text-brown-800">{line.name}</td>
                        <td className="px-4 py-2 text-right">{line.qtyPerUnit}</td>
                        <td className="px-4 py-2 text-right">₺{line.costPerBpUnit?.toFixed(2)}</td>
                        <td className="px-4 py-2 text-right font-semibold text-brown-700">₺{line.totalCost?.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-cream-100 font-semibold text-brown-800">
                    <tr>
                      <td colSpan={3} className="px-4 py-2 text-right">Toplam Maliyet/adet</td>
                      <td className="px-4 py-2 text-right">₺{costData.costPerUnit?.toFixed(2)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
