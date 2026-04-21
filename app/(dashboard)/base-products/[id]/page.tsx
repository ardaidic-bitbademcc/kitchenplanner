"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import toast from "react-hot-toast";
import { useSession } from "next-auth/react";

interface Ingredient { id?: string; rawMaterialId: string; qtyPerUnit: string; unit: string; rawMaterialName?: string; }
interface SubProduct { subBaseProductId: string; qtyPerBatch: string; unit: string; subName?: string; }
interface RawMaterial { id: string; name: string; unit: string; }
interface BaseProduct { id: string; name: string; unit: string; }

export default function BaseProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "admin";
  const [bp, setBp] = useState<any>(null);
  const [rawMats, setRawMats] = useState<RawMaterial[]>([]);
  const [allBPs, setAllBPs] = useState<BaseProduct[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [subProducts, setSubProducts] = useState<SubProduct[]>([]);
  const [costData, setCostData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"ingredients" | "subproducts" | "cost">("ingredients");

  async function load() {
    const [bpRes, rmRes, bpListRes, subRes, costRes] = await Promise.all([
      fetch(`/api/base-products/${id}`),
      fetch("/api/raw-materials"),
      fetch("/api/base-products"),
      fetch(`/api/base-products/${id}/sub-products`),
      fetch(`/api/base-products/${id}/cost`),
    ]);
    const bpData = await bpRes.json();
    setBp(bpData);
    setRawMats(await rmRes.json());
    const bpList = await bpListRes.json();
    setAllBPs(bpList.filter((b: BaseProduct) => b.id !== id));
    setIngredients(bpData.ingredients || []);
    setSubProducts(await subRes.json());
    setCostData(await costRes.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, [id]);

  async function saveIngredients() {
    setSaving(true);
    const res = await fetch(`/api/base-products/${id}/ingredients`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ingredients.map((i) => ({ rawMaterialId: i.rawMaterialId, qtyPerUnit: i.qtyPerUnit, unit: i.unit }))),
    });
    setSaving(false);
    if (res.ok) { toast.success("Hammaddeler kaydedildi"); load(); }
    else { toast.error("Hata"); }
  }

  async function saveSubProducts() {
    setSaving(true);
    const res = await fetch(`/api/base-products/${id}/sub-products`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(subProducts.map((s) => ({ subBaseProductId: s.subBaseProductId, qtyPerBatch: s.qtyPerBatch, unit: s.unit }))),
    });
    setSaving(false);
    if (res.ok) { toast.success("Alt baz ürünler kaydedildi"); load(); }
    else { const e = await res.json(); toast.error(e.error || "Hata"); }
  }

  if (loading) return <div className="space-y-3">{[1,2,3].map(i=><Skeleton key={i} className="h-10 w-full"/>)}</div>;

  const tabs = [
    { key: "ingredients", label: `Hammaddeler (${ingredients.length})` },
    { key: "subproducts", label: `Alt Baz Urunler (${subProducts.length})` },
    { key: "cost", label: "Maliyet Analizi" },
  ] as const;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brown-800">{bp?.name}</h1>
        <p className="text-brown-500 text-sm mt-1">
          Parti ciktisi: {bp?.yieldQty} {bp?.unit} · Fire: {(parseFloat(bp?.fireRate)*100).toFixed(0)}% · Raf: {bp?.shelfLifeHours} sa
          {costData && !costData.error && (
            <span className="ml-3 font-semibold text-brown-700">
              · Maliyet: ₺{costData.costPerUnit?.toFixed(2)}/{bp?.unit}
            </span>
          )}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-cream-200">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition ${activeTab === t.key ? "border-brown-600 text-brown-700" : "border-transparent text-brown-400 hover:text-brown-600"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Hammaddeler */}
      {activeTab === "ingredients" && (
        <div className="bg-white rounded-xl border border-cream-200 p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-brown-700">Hammadde Icerigi</h2>
            {isAdmin && <Button size="sm" onClick={() => setIngredients([...ingredients, { rawMaterialId: rawMats[0]?.id||"", qtyPerUnit:"0", unit:"kg" }])}>+ Ekle</Button>}
          </div>
          <div className="space-y-3">
            {ingredients.map((ing, i) => (
              <div key={i} className="flex gap-2 items-end">
                <div className="flex-1">
                  <label className="text-xs text-brown-500 mb-1 block">Hammadde</label>
                  <select value={ing.rawMaterialId} onChange={(e)=>{const u=[...ingredients];u[i].rawMaterialId=e.target.value;setIngredients(u);}} disabled={!isAdmin} className="w-full border border-cream-300 rounded-lg px-2 py-2 text-sm">
                    {rawMats.map(rm=><option key={rm.id} value={rm.id}>{rm.name}</option>)}
                  </select>
                </div>
                <div className="w-24">
                  <label className="text-xs text-brown-500 mb-1 block">Miktar</label>
                  <input type="number" value={ing.qtyPerUnit} onChange={(e)=>{const u=[...ingredients];u[i].qtyPerUnit=e.target.value;setIngredients(u);}} disabled={!isAdmin} className="w-full border border-cream-300 rounded-lg px-2 py-2 text-sm"/>
                </div>
                <div className="w-20">
                  <label className="text-xs text-brown-500 mb-1 block">Birim</label>
                  <input value={ing.unit} onChange={(e)=>{const u=[...ingredients];u[i].unit=e.target.value;setIngredients(u);}} disabled={!isAdmin} className="w-full border border-cream-300 rounded-lg px-2 py-2 text-sm"/>
                </div>
                {isAdmin && <Button size="sm" variant="danger" onClick={()=>setIngredients(ingredients.filter((_,idx)=>idx!==i))}>x</Button>}
              </div>
            ))}
            {ingredients.length===0 && <p className="text-brown-400 text-sm">Hammadde eklenmemis.</p>}
          </div>
          {isAdmin && (
            <div className="mt-4 flex justify-end">
              <Button onClick={saveIngredients} disabled={saving}>{saving?"Kaydediliyor...":"Kaydet"}</Button>
            </div>
          )}
        </div>
      )}

      {/* Alt Baz Urunler */}
      {activeTab === "subproducts" && (
        <div className="bg-white rounded-xl border border-cream-200 p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-brown-700">Alt Baz Urunler</h2>
              <p className="text-xs text-brown-400 mt-0.5">Bu baz urun baska baz urunler iceriyorsa buraya ekleyin</p>
            </div>
            {isAdmin && allBPs.length > 0 && (
              <Button size="sm" onClick={()=>setSubProducts([...subProducts,{subBaseProductId:allBPs[0].id,qtyPerBatch:"0",unit:"kg"}])}>+ Ekle</Button>
            )}
          </div>
          {allBPs.length === 0 && (
            <p className="text-brown-400 text-sm">Baska baz urun yok.</p>
          )}
          <div className="space-y-3">
            {subProducts.map((sp, i) => (
              <div key={i} className="flex gap-2 items-end">
                <div className="flex-1">
                  <label className="text-xs text-brown-500 mb-1 block">Baz Urun</label>
                  <select value={sp.subBaseProductId} onChange={(e)=>{const u=[...subProducts];u[i].subBaseProductId=e.target.value;setSubProducts(u);}} disabled={!isAdmin} className="w-full border border-cream-300 rounded-lg px-2 py-2 text-sm">
                    {allBPs.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
                <div className="w-28">
                  <label className="text-xs text-brown-500 mb-1 block">Parti basina</label>
                  <input type="number" value={sp.qtyPerBatch} onChange={(e)=>{const u=[...subProducts];u[i].qtyPerBatch=e.target.value;setSubProducts(u);}} disabled={!isAdmin} className="w-full border border-cream-300 rounded-lg px-2 py-2 text-sm"/>
                </div>
                <div className="w-20">
                  <label className="text-xs text-brown-500 mb-1 block">Birim</label>
                  <input value={sp.unit} onChange={(e)=>{const u=[...subProducts];u[i].unit=e.target.value;setSubProducts(u);}} disabled={!isAdmin} className="w-full border border-cream-300 rounded-lg px-2 py-2 text-sm"/>
                </div>
                {isAdmin && <Button size="sm" variant="danger" onClick={()=>setSubProducts(subProducts.filter((_,idx)=>idx!==i))}>x</Button>}
              </div>
            ))}
            {subProducts.length===0 && <p className="text-brown-400 text-sm">Alt baz urun tanimlanmamis.</p>}
          </div>
          {isAdmin && (
            <div className="mt-4 flex justify-end">
              <Button onClick={saveSubProducts} disabled={saving}>{saving?"Kaydediliyor...":"Kaydet"}</Button>
            </div>
          )}
        </div>
      )}

      {/* Maliyet Analizi */}
      {activeTab === "cost" && (
        <div className="space-y-4">
          {costData?.error ? (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">{costData.error}</div>
          ) : costData ? (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-brown-50 border border-brown-200 rounded-xl p-4">
                  <p className="text-xs text-brown-500">Toplam Hammadde Maliyeti</p>
                  <p className="text-2xl font-bold text-brown-800">₺{costData.totalIngredientCost?.toFixed(2)}</p>
                  <p className="text-xs text-brown-500 mt-1">1 parti ({costData.yieldQty} {costData.unit}) icin</p>
                </div>
                <div className="bg-cream-100 border border-cream-300 rounded-xl p-4">
                  <p className="text-xs text-brown-500">Birim Maliyet</p>
                  <p className="text-2xl font-bold text-brown-700">₺{costData.costPerUnit?.toFixed(2)}</p>
                  <p className="text-xs text-brown-500 mt-1">1 {costData.unit} basina</p>
                </div>
              </div>
              <div className="bg-white rounded-xl border border-cream-200 overflow-hidden">
                <div className="px-4 py-3 bg-cream-100 font-semibold text-brown-700 text-sm">Maliyet Dokumu</div>
                <table className="w-full text-sm">
                  <thead className="bg-cream-50 text-brown-600">
                    <tr>
                      <th className="text-left px-4 py-2">Bilesen</th>
                      <th className="text-left px-4 py-2">Tip</th>
                      <th className="text-right px-4 py-2">Miktar</th>
                      <th className="text-right px-4 py-2">Birim Fiyat</th>
                      <th className="text-right px-4 py-2">Toplam</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-cream-50">
                    {costData.lines?.map((line: any, i: number) => (
                      <tr key={i} className={line.type==="base_product"?"bg-blue-50/30":""}>
                        <td className="px-4 py-2 font-medium text-brown-800">{line.name}</td>
                        <td className="px-4 py-2 text-xs text-brown-500">{line.type==="raw_material"?"Hammadde":"Baz Urun"}</td>
                        <td className="px-4 py-2 text-right">{line.qty} {line.unit}</td>
                        <td className="px-4 py-2 text-right">₺{line.unitCost?.toFixed(2)}</td>
                        <td className="px-4 py-2 text-right font-semibold text-brown-700">₺{line.totalCost?.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-cream-100 font-semibold text-brown-800">
                    <tr>
                      <td colSpan={4} className="px-4 py-2 text-right">Toplam</td>
                      <td className="px-4 py-2 text-right">₺{costData.totalIngredientCost?.toFixed(2)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
