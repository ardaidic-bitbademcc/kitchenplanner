"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { SkeletonTable } from "@/components/ui/Skeleton";
import toast from "react-hot-toast";
import { useSession } from "next-auth/react";

interface SaleRecord {
  id: string;
  productId: string;
  productName: string;
  weekStart: string;
  soldQty: number;
  notes: string | null;
}
interface Product { id: string; name: string; }
const empty = { productId: "", weekStart: "", soldQty: "", notes: "" };

export default function SalesHistoryPage() {
  const { data: session } = useSession();
  const isAdmin = (session?.user as any)?.role === "admin";
  const [records, setRecords] = useState<SaleRecord[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function load() {
    setLoading(true);
    const [recRes, prodRes] = await Promise.all([
      fetch("/api/sales-history"),
      fetch("/api/products"),
    ]);
    setRecords(await recRes.json());
    setProducts(await prodRes.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  // Group by weekStart for display
  const grouped = records.reduce((acc, r) => {
    if (!acc[r.weekStart]) acc[r.weekStart] = [];
    acc[r.weekStart].push(r);
    return acc;
  }, {} as Record<string, SaleRecord[]>);

  const sortedWeeks = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  async function handleSave() {
    if (!form.productId || !form.weekStart || !form.soldQty) {
      toast.error("Tüm zorunlu alanları doldurun");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/sales-history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, soldQty: parseInt(form.soldQty) }),
    });
    setSaving(false);
    if (res.ok) { toast.success("Satış kaydedildi"); setModalOpen(false); setForm(empty); load(); }
    else { toast.error("Hata oluştu"); }
  }

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    await fetch(`/api/sales-history/${deleteId}`, { method: "DELETE" });
    setDeleting(false); setDeleteId(null);
    toast.success("Silindi"); load();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-brown-800">Satış Geçmişi</h1>
          <p className="text-sm text-brown-500 mt-1">AI plan önerisi için haftalık satış adetlerini girin</p>
        </div>
        {isAdmin && <Button onClick={() => { setForm({ ...empty, productId: products[0]?.id || "" }); setModalOpen(true); }}>+ Satış Ekle</Button>}
      </div>

      {loading ? <SkeletonTable rows={6} /> : (
        <div className="space-y-4">
          {sortedWeeks.length === 0 && (
            <div className="bg-cream-50 rounded-xl border border-cream-200 p-8 text-center text-brown-400">
              <p className="text-lg mb-1">Henüz satış verisi yok</p>
              <p className="text-sm">AI planlaması için satış geçmişi ekleyin</p>
            </div>
          )}
          {sortedWeeks.map((week) => (
            <div key={week} className="bg-white rounded-xl border border-cream-200 overflow-hidden">
              <div className="bg-cream-100 px-4 py-2 font-semibold text-brown-700 text-sm">
                {new Date(week + "T00:00:00").toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" })} haftası
              </div>
              <table className="w-full text-sm">
                <tbody className="divide-y divide-cream-50">
                  {grouped[week].map((r) => (
                    <tr key={r.id} className="hover:bg-cream-50">
                      <td className="px-4 py-3 font-medium text-brown-800">{r.productName}</td>
                      <td className="px-4 py-3 text-brown-700 font-semibold">{r.soldQty} adet</td>
                      <td className="px-4 py-3 text-brown-400 text-xs">{r.notes || ""}</td>
                      {isAdmin && (
                        <td className="px-4 py-3 text-right">
                          <Button size="sm" variant="danger" onClick={() => setDeleteId(r.id)}>Sil</Button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Satış Verisi Ekle">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-brown-700 mb-1">Ürün *</label>
            <select value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value })} className="w-full border border-cream-300 rounded-lg px-3 py-2 text-sm">
              <option value="">Seçin...</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-brown-700 mb-1">Hafta Başı (Pazartesi) *</label>
            <input type="date" value={form.weekStart} onChange={(e) => setForm({ ...form, weekStart: e.target.value })} className="w-full border border-cream-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-brown-700 mb-1">Satılan Adet *</label>
            <input type="number" min="0" value={form.soldQty} onChange={(e) => setForm({ ...form, soldQty: e.target.value })} className="w-full border border-cream-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-brown-700 mb-1">Not (opsiyonel)</label>
            <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Özel gün, kampanya vb." className="w-full border border-cream-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>İptal</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Kaydediliyor..." : "Kaydet"}</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete} loading={deleting} message="Bu satış kaydını silmek istiyor musunuz?" />
    </div>
  );
}
