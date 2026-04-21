"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { SkeletonTable } from "@/components/ui/Skeleton";
import { ExcelImport } from "@/components/ui/ExcelImport";
import toast from "react-hot-toast";
import { useSession } from "next-auth/react";
import Link from "next/link";

interface Product { id: string; name: string; description: string | null; sellingPrice: string | null; }

const empty = { name: "", description: "", sellingPrice: "" };

export default function ProductsPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "admin";
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<Product | null>(null);
  const [form, setForm] = useState(empty);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/products");
    setItems(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openEdit(item: Product) {
    setEditItem(item);
    setForm({ name: item.name, description: item.description || "", sellingPrice: item.sellingPrice || "" });
    setModalOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    const payload = { ...form, sellingPrice: form.sellingPrice || null, description: form.description || null };
    const url = editItem ? `/api/products/${editItem.id}` : "/api/products";
    const method = editItem ? "PUT" : "POST";
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    setSaving(false);
    if (res.ok) { toast.success(editItem ? "Güncellendi" : "Eklendi"); setModalOpen(false); load(); }
    else { toast.error("Hata oluştu"); }
  }

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    await fetch(`/api/products/${deleteId}`, { method: "DELETE" });
    setDeleting(false); setDeleteId(null);
    toast.success("Silindi"); load();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-brown-800">Son Ürünler</h1>
        {isAdmin && (
          <div className="flex gap-2">
            <ExcelImport type="products" onSuccess={load} />
            <Button onClick={() => { setEditItem(null); setForm(empty); setModalOpen(true); }}>+ Ekle</Button>
          </div>
        )}
      </div>
      {loading ? <SkeletonTable /> : (
        <div className="bg-white rounded-xl border border-cream-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-cream-100 text-brown-700">
                <tr>
                  <th className="text-left px-4 py-3">Ad</th>
                  <th className="text-left px-4 py-3">Açıklama</th>
                  <th className="text-right px-4 py-3">Satış Fiyatı</th>
                  {isAdmin && <th className="px-4 py-3" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-cream-100">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-cream-50">
                    <td className="px-4 py-3 font-medium">
                      <Link href={`/products/${item.id}`} className="text-brown-700 hover:underline">{item.name}</Link>
                    </td>
                    <td className="px-4 py-3 text-brown-500">{item.description || "-"}</td>
                    <td className="px-4 py-3 text-right">{item.sellingPrice ? `₺${parseFloat(item.sellingPrice).toFixed(2)}` : "-"}</td>
                    {isAdmin && (
                      <td className="px-4 py-3">
                        <div className="flex gap-2 justify-end">
                          <Button size="sm" variant="secondary" onClick={() => openEdit(item)}>Düzenle</Button>
                          <Link href={`/products/${item.id}`}><Button size="sm" variant="ghost">Detay</Button></Link>
                          <Button size="sm" variant="danger" onClick={() => setDeleteId(item.id)}>Sil</Button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? "Ürün Düzenle" : "Ürün Ekle"}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-brown-700 mb-1">Ad</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full border border-cream-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brown-400" />
          </div>
          <div>
            <label className="block text-sm font-medium text-brown-700 mb-1">Açıklama</label>
            <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full border border-cream-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brown-400" />
          </div>
          <div>
            <label className="block text-sm font-medium text-brown-700 mb-1">Satış Fiyatı (₺)</label>
            <input type="number" value={form.sellingPrice} onChange={(e) => setForm({ ...form, sellingPrice: e.target.value })} className="w-full border border-cream-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brown-400" />
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>İptal</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Kaydediliyor..." : "Kaydet"}</Button>
          </div>
        </div>
      </Modal>
      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete} loading={deleting} message="Bu ürünü silmek istediğinizden emin misiniz?" />
    </div>
  );
}
