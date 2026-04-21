"use client";
import { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { SkeletonTable } from "@/components/ui/Skeleton";
import { Badge } from "@/components/ui/Badge";
import toast from "react-hot-toast";
import { useSession } from "next-auth/react";

interface SaleRecord {
  id: string; productId: string; productName: string; weekStart: string;
  soldQty: number; revenue: string|null; channel: string; eventType: string; notes: string|null;
}
interface Product { id: string; name: string; }

const CHANNELS = ["mağaza","online","catering","karma"];
const EVENT_TYPES = ["normal","resmi_tatil","özel_gün","kampanya","mevsim"];
const EVENT_LABELS: Record<string,string> = { normal:"Normal", resmi_tatil:"Resmi Tatil", "özel_gün":"Özel Gün", kampanya:"Kampanya", mevsim:"Mevsim" };
const EVENT_COLORS: Record<string,"gray"|"blue"|"green"|"yellow"|"red"> = { normal:"gray", resmi_tatil:"blue", "özel_gün":"green", kampanya:"yellow", mevsim:"red" };

const empty = { productId:"", weekStart:"", soldQty:"", revenue:"", channel:"mağaza", eventType:"normal", notes:"" };

export default function SalesHistoryPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "admin";
  const [records, setRecords] = useState<SaleRecord[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [deleteId, setDeleteId] = useState<string|null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    setLoading(true);
    const [recRes, prodRes] = await Promise.all([fetch("/api/sales-history"), fetch("/api/products")]);
    setRecords(await recRes.json());
    setProducts(await prodRes.json());
    setLoading(false);
  }
  useEffect(()=>{ load(); },[]);

  const grouped = records.reduce((acc,r)=>{
    if(!acc[r.weekStart]) acc[r.weekStart]=[];
    acc[r.weekStart].push(r);
    return acc;
  },{} as Record<string,SaleRecord[]>);
  const sortedWeeks = Object.keys(grouped).sort((a,b)=>b.localeCompare(a));

  async function handleSave() {
    if(!form.productId||!form.weekStart||!form.soldQty){ toast.error("Zorunlu alanları doldurun"); return; }
    setSaving(true);
    const res = await fetch("/api/sales-history",{
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({...form, soldQty:parseInt(form.soldQty), revenue:form.revenue||null}),
    });
    setSaving(false);
    if(res.ok){ toast.success("Kaydedildi"); setModalOpen(false); setForm(empty); load(); }
    else { const e=await res.json(); toast.error(e.error||"Hata"); }
  }

  async function handleDelete() {
    if(!deleteId) return;
    setDeleting(true);
    await fetch(`/api/sales-history/${deleteId}`,{method:"DELETE"});
    setDeleting(false); setDeleteId(null);
    toast.success("Silindi"); load();
  }

  async function handleDownloadTemplate() {
    const res = await fetch("/api/sales-history/template");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href=url; a.download="satis-gecmisi-sablonu.xlsx"; a.click();
    URL.revokeObjectURL(url);
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if(!file) return;
    setImporting(true); setImportResult(null);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/sales-history/bulk",{method:"POST",body:fd});
    const result = await res.json();
    setImporting(false);
    if(res.ok){
      toast.success(`${result.inserted} kayit eklendi`);
      setImportResult(result);
      load();
    } else { toast.error(result.error||"Yukleme hatasi"); }
    if(fileRef.current) fileRef.current.value="";
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-brown-800">Satis Gecmisi</h1>
          <p className="text-sm text-brown-500 mt-0.5">AI plan onerileri icin haftalik satis verilerini girin</p>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={handleDownloadTemplate}>Sablon Indir</Button>
            <Button variant="secondary" size="sm" onClick={()=>fileRef.current?.click()} disabled={importing}>
              {importing?"Yukleniyor...":"Excel Yukle"}
            </Button>
            <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileUpload}/>
            <Button size="sm" onClick={()=>{ setForm({...empty,productId:products[0]?.id||""}); setModalOpen(true); }}>+ Ekle</Button>
          </div>
        )}
      </div>

      {/* Import result */}
      {importResult && (
        <div className={`mb-4 rounded-xl border p-4 text-sm ${importResult.skipped?.length>0?"bg-yellow-50 border-yellow-200":"bg-green-50 border-green-200"}`}>
          <p className="font-semibold mb-1">{importResult.inserted} kayit eklendi{importResult.skipped?.length>0?`, ${importResult.skipped.length} atlandi`:""}</p>
          {importResult.skipped?.map((s:string,i:number)=>(
            <p key={i} className="text-yellow-700 text-xs">{s}</p>
          ))}
          <button className="text-xs text-gray-400 mt-1 underline" onClick={()=>setImportResult(null)}>Kapat</button>
        </div>
      )}

      {loading ? <SkeletonTable rows={6}/> : (
        <div className="space-y-4">
          {sortedWeeks.length===0 && (
            <div className="bg-cream-50 rounded-xl border border-cream-200 p-8 text-center">
              <p className="text-lg text-brown-400 mb-1">Satis verisi yok</p>
              <p className="text-sm text-brown-400">Excel sablonunu indirin, doldurun ve yukleyin</p>
              {isAdmin && <Button className="mt-3" size="sm" onClick={handleDownloadTemplate}>Sablon Indir</Button>}
            </div>
          )}
          {sortedWeeks.map(week=>(
            <div key={week} className="bg-white rounded-xl border border-cream-200 overflow-hidden">
              <div className="bg-cream-100 px-4 py-2 font-semibold text-brown-700 text-sm">
                {new Date(week+"T00:00:00").toLocaleDateString("tr-TR",{day:"2-digit",month:"long",year:"numeric"})} haftasi
                <span className="ml-3 text-brown-400 font-normal text-xs">
                  Toplam: {grouped[week].reduce((s,r)=>s+r.soldQty,0)} adet
                  {grouped[week].some(r=>r.revenue) && ` · ₺${grouped[week].reduce((s,r)=>s+parseFloat(r.revenue||"0"),0).toFixed(0)}`}
                </span>
              </div>
              <table className="w-full text-sm">
                <tbody className="divide-y divide-cream-50">
                  {grouped[week].map(r=>(
                    <tr key={r.id} className="hover:bg-cream-50">
                      <td className="px-4 py-2.5 font-medium text-brown-800">{r.productName}</td>
                      <td className="px-4 py-2.5 font-semibold text-brown-700">{r.soldQty} adet</td>
                      <td className="px-4 py-2.5 text-brown-500">{r.revenue?`₺${parseFloat(r.revenue).toFixed(0)}`:"-"}</td>
                      <td className="px-4 py-2.5 text-brown-400 text-xs">{r.channel}</td>
                      <td className="px-4 py-2.5"><Badge color={EVENT_COLORS[r.eventType]||"gray"}>{EVENT_LABELS[r.eventType]||r.eventType}</Badge></td>
                      <td className="px-4 py-2.5 text-brown-400 text-xs">{r.notes||""}</td>
                      {isAdmin && <td className="px-4 py-2.5 text-right"><Button size="sm" variant="danger" onClick={()=>setDeleteId(r.id)}>Sil</Button></td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={()=>setModalOpen(false)} title="Satis Verisi Ekle">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-brown-700 mb-1">Urun *</label>
            <select value={form.productId} onChange={e=>setForm({...form,productId:e.target.value})} className="w-full border border-cream-300 rounded-lg px-3 py-2 text-sm">
              <option value="">Secin...</option>
              {products.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-brown-700 mb-1">Hafta Basi *</label>
              <input type="date" value={form.weekStart} onChange={e=>setForm({...form,weekStart:e.target.value})} className="w-full border border-cream-300 rounded-lg px-3 py-2 text-sm"/>
            </div>
            <div>
              <label className="block text-sm font-medium text-brown-700 mb-1">Satilan Adet *</label>
              <input type="number" min="0" value={form.soldQty} onChange={e=>setForm({...form,soldQty:e.target.value})} className="w-full border border-cream-300 rounded-lg px-3 py-2 text-sm"/>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-brown-700 mb-1">Gelir (TL)</label>
              <input type="number" min="0" value={form.revenue} onChange={e=>setForm({...form,revenue:e.target.value})} className="w-full border border-cream-300 rounded-lg px-3 py-2 text-sm"/>
            </div>
            <div>
              <label className="block text-sm font-medium text-brown-700 mb-1">Kanal *</label>
              <select value={form.channel} onChange={e=>setForm({...form,channel:e.target.value})} className="w-full border border-cream-300 rounded-lg px-3 py-2 text-sm">
                {CHANNELS.map(c=><option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-brown-700 mb-1">Olay Tipi *</label>
            <select value={form.eventType} onChange={e=>setForm({...form,eventType:e.target.value})} className="w-full border border-cream-300 rounded-lg px-3 py-2 text-sm">
              {EVENT_TYPES.map(t=><option key={t} value={t}>{EVENT_LABELS[t]}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-brown-700 mb-1">Not</label>
            <input value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} className="w-full border border-cream-300 rounded-lg px-3 py-2 text-sm"/>
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="secondary" onClick={()=>setModalOpen(false)}>Iptal</Button>
            <Button onClick={handleSave} disabled={saving}>{saving?"Kaydediliyor...":"Kaydet"}</Button>
          </div>
        </div>
      </Modal>
      <ConfirmDialog open={!!deleteId} onClose={()=>setDeleteId(null)} onConfirm={handleDelete} loading={deleting} message="Bu satis kaydini silmek istiyor musunuz?"/>
    </div>
  );
}
