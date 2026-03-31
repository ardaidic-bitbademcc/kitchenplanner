"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Badge } from "@/components/ui/Badge";
import { SkeletonTable } from "@/components/ui/Skeleton";
import { ExcelImport } from "@/components/ui/ExcelImport";
import toast from "react-hot-toast";
import { useSession } from "next-auth/react";

interface RawMaterial {
  id: string;
  name: string;
  unit: string;
  unitCost: string;
  stockQty: string;
  minStock: string;
  shelfLifeHours: number | null;
}

const empty = { name: "", unit: "kg", unitCost: "", stockQty: "0", minStock: "0", shelfLifeHours: "" };

export default function RawMaterialsPage() {
  const { data: session } = useSession();
  const isAdmin = (session?.user as any)?.role === "admin";
  const [items, setItems] = useState<RawMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<RawMaterial | null>(null);
  const [form, setForm] = useState(empty);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/raw-materials");
    setItems(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openCreate() {
    setEditItem(null);
    setForm(empty);
    setModalOpen(true);
  }

  function openEdit(item: RawMaterial) {
    setEditItem(item);
    setForm({ name: item.name, unit: item.unit, unitCost: item.unitCost, stockQty: item.stockQty, minStock: item.minStock, shelfLifeHours: item.shelfLifeHours?.toString() || "" });
    setModalOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    const payload = { ...form, shelfLifeHours: form.shelfLifeHours ? parseInt(form.shelfLifeHours) : null };
    const url = editItem ? `/api/raw-materials/${editItem.id}` : "/api/raw-materials";
    const method = editItem ? "PUT" : "POST";
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    setSaving(false);
    if (res.ok) {
      toast.success(editItem ? "Güncellendi" : "Eklendi");
      setModalOpen(false);
      load();
    } else {
      toast.error("Hata oluştu");
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    await fetch(`/api/raw-materials/${deleteId}`, { method: "DELETE" });
    setDeleting(false);
    setDeleteId(null);
    toast.success("Silindi");
    load();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-brown-800">Hammaddeler</h1>
        {isAdmin && (
          <div className="flex gap-2">
            <ExcelImport type="raw-materials" onSuccess={load} />
            <Button onClick={openCreate}>+ Ekle</Button>
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
                  <th className="text-right px-4 py-3">Birim Fiyat</th>
                  <th className="text-right px-4 py-3">Stok</th>
                  <th className="text-right px-4 py-3">Min Stok</th>
                  <th className="text-left px-4 py-3">Durum</th>
                  {isAdmin && <th className="px-4 py-3" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-cream-100">
                {items.map((item) => {
                  const lowStock = parseFloat(item.stockQty) < parseFloat(item.minStock);
                  return (
                    <tr key={item.id} className="hover:bg-cream-50">
                      <td className="px-4 py-3 font-medium text-brown-800">{item.name}</td>
                      <td className="px-4 py-3 text-brown-600">{item.unit}</td>
                      <td className="px-4 py-3 text-right text-brown-700">₺{parseFloat(item.unitCost).toFixed(2)}</td>
                      <td className="px-4 py-3 text-right text-brown-700">{item.stockQty}</td>
                      <td className="px-4 py-3 text-right text-brown-500">{item.minStock}</td>
                      <td className="px-4 py-3">
                        {lowStock ? <Badge color="yellow">Düşük Stok</Badge> : <Badge color="green">Yeterli</Badge>}
                      </td>
                      {isAdmin && (
                        <td className="px-4 py-3">
                          <div className="flex gap-2 justify-end">
                            <Button size="sm" variant="secondary" onClick={() => openEdit(item)}>Düzenle</Button>
                            <Button size="sm" variant="danger" onClick={() => setDeleteId(item.id)}>Sil</Button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? "Hammadde Düzenle" : "Hammadde Ekle"}>
        <div className="space-y-4">
          <Field label="Ad" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
          <Field label="Birim" value={form.unit} onChange={(v) => setForm({ ...form, unit: v })} placeholder="kg, litre, adet..." />
          <Field label="Birim Fiyat (₺)" value={form.unitCost} onChange={(v) => setForm({ ...form, unitCost: v })} type="number" />
          <Field label="Mevcut Stok" value={form.stockQty} onChange={(v) => setForm({ ...form, stockQty: v })} type="number" />
          <Field label="Min Stok" value={form.minStock} onChange={(v) => setForm({ ...form, minStock: v })} type="number" />
          <Field label="Raf Ömrü (saat, opsiyonel)" value={form.shelfLifeHours} onChange={(v) => setForm({ ...form, shelfLifeHours: v })} type="number" />
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>İptal</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Kaydediliyor..." : "Kaydet"}</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete} loading={deleting} message="Bu hammaddeyi silmek istediğinizden emin misiniz?" />
    </div>
  );
}

function Field({ label, value, onChange, type = "text", placeholder }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <div>
      <label className="block text-sm font-medium text-brown-700 mb-1">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full border border-cream-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brown-400" />
    </div>
  );
}
