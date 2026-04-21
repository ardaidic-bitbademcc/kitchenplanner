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

interface BaseProduct {
  id: string;
  name: string;
  unit: string;
  yieldQty: string;
  fireRate: string;
  shelfLifeHours: number;
  notes: string | null;
}

const empty = { name: "", unit: "kg", yieldQty: "1", fireRate: "0.10", shelfLifeHours: "48", notes: "" };

export default function BaseProductsPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "admin";
  const [items, setItems] = useState<BaseProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<BaseProduct | null>(null);
  const [form, setForm] = useState(empty);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/base-products");
    setItems(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openEdit(item: BaseProduct) {
    setEditItem(item);
    setForm({ name: item.name, unit: item.unit, yieldQty: item.yieldQty, fireRate: item.fireRate, shelfLifeHours: item.shelfLifeHours.toString(), notes: item.notes || "" });
    setModalOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    const payload = { ...form, shelfLifeHours: parseInt(form.shelfLifeHours) };
    const url = editItem ? `/api/base-products/${editItem.id}` : "/api/base-products";
    const method = editItem ? "PUT" : "POST";
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    setSaving(false);
    if (res.ok) { toast.success(editItem ? "Güncellendi" : "Eklendi"); setModalOpen(false); load(); }
    else { toast.error("Hata oluştu"); }
  }

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    await fetch(`/api/base-products/${deleteId}`, { method: "DELETE" });
    setDeleting(false); setDeleteId(null);
    toast.success("Silindi"); load();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-brown-800">Baz Ürünler</h1>
        {isAdmin && (
          <div className="flex gap-2">
            <ExcelImport type="base-products" onSuccess={load} />
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
                  <th className="text-left px-4 py-3">Birim</th>
                  <th className="text-right px-4 py-3">Parti Çıktısı</th>
                  <th className="text-right px-4 py-3">Fire %</th>
                  <th className="text-right px-4 py-3">Raf Ömrü (sa)</th>
                  {isAdmin && <th className="px-4 py-3" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-cream-100">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-cream-50">
                    <td className="px-4 py-3 font-medium text-brown-800">
                      <Link href={`/base-products/${item.id}`} className="hover:underline text-brown-700">{item.name}</Link>
                    </td>
                    <td className="px-4 py-3 text-brown-600">{item.unit}</td>
                    <td className="px-4 py-3 text-right">{item.yieldQty}</td>
                    <td className="px-4 py-3 text-right">{(parseFloat(item.fireRate) * 100).toFixed(0)}%</td>
                    <td className="px-4 py-3 text-right">{item.shelfLifeHours}</td>
                    {isAdmin && (
                      <td className="px-4 py-3">
                        <div className="flex gap-2 justify-end">
                          <Button size="sm" variant="secondary" onClick={() => openEdit(item)}>Düzenle</Button>
                          <Link href={`/base-products/${item.id}`}><Button size="sm" variant="ghost">İçerik</Button></Link>
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
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? "Baz Ürün Düzenle" : "Baz Ürün Ekle"}>
        <div className="space-y-4">
          {(["name","unit","yieldQty","fireRate","notes"] as const).map((f) => (
            <div key={f}>
              <label className="block text-sm font-medium text-brown-700 mb-1">
                {f === "name" ? "Ad" : f === "unit" ? "Birim" : f === "yieldQty" ? "Parti Çıktısı" : f === "fireRate" ? "Fire Oranı (örn: 0.10)" : "Notlar"}
              </label>
              <input value={form[f]} onChange={(e) => setForm({ ...form, [f]: e.target.value })} className="w-full border border-cream-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brown-400" />
            </div>
          ))}
          <div>
            <label className="block text-sm font-medium text-brown-700 mb-1">Raf Ömrü (saat)</label>
            <input type="number" value={form.shelfLifeHours} onChange={(e) => setForm({ ...form, shelfLifeHours: e.target.value })} className="w-full border border-cream-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brown-400" />
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>İptal</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Kaydediliyor..." : "Kaydet"}</Button>
          </div>
        </div>
      </Modal>
      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete} loading={deleting} message="Bu baz ürünü silmek istediğinizden emin misiniz?" />
    </div>
  );
}
