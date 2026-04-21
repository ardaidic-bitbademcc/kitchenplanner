"use client";
import { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Badge } from "@/components/ui/Badge";
import { SkeletonTable } from "@/components/ui/Skeleton";
import toast from "react-hot-toast";
import { useSession } from "next-auth/react";

interface RawMaterial {
  id: string; name: string; unit: string; unitCost: string;
  stockQty: string; minStock: string; shelfLifeHours: number | null;
}
interface Movement {
  id: string; type: string; qtyChange: string; unit: string; notes: string | null; createdAt: string;
}

const emptyForm = { name: "", unit: "kg", unitCost: "", stockQty: "0", minStock: "0", shelfLifeHours: "" };
const restockEmpty = { qty: "", unit: "", notes: "" };

export default function RawMaterialsPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "admin";
  const [items, setItems] = useState<RawMaterial[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit/create modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<RawMaterial | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  // Delete
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Restock modal
  const [restockItem, setRestockItem] = useState<RawMaterial | null>(null);
  const [restockForm, setRestockForm] = useState(restockEmpty);
  const [restocking, setRestocking] = useState(false);

  // Movements modal
  const [movementsItem, setMovementsItem] = useState<RawMaterial | null>(null);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [movementsLoading, setMovementsLoading] = useState(false);

  // Excel import
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ inserted: number; insertedNames: string[]; skipped: string[] } | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/raw-materials");
    setItems(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openCreate() {
    setEditItem(null); setForm(emptyForm); setModalOpen(true);
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
    if (res.ok) { toast.success(editItem ? "Güncellendi" : "Eklendi"); setModalOpen(false); load(); }
    else { toast.error("Hata oluştu"); }
  }

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    await fetch(`/api/raw-materials/${deleteId}`, { method: "DELETE" });
    setDeleting(false); setDeleteId(null);
    toast.success("Silindi"); load();
  }

  function openRestock(item: RawMaterial) {
    setRestockItem(item);
    setRestockForm({ qty: "", unit: item.unit, notes: "" });
  }

  async function handleRestock() {
    if (!restockItem || !restockForm.qty) { toast.error("Miktar girin"); return; }
    setRestocking(true);
    const res = await fetch(`/api/raw-materials/${restockItem.id}/restock`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ qty: parseFloat(restockForm.qty), unit: restockForm.unit, notes: restockForm.notes || undefined }),
    });
    setRestocking(false);
    if (res.ok) { toast.success("Stok eklendi"); setRestockItem(null); load(); }
    else { const e = await res.json(); toast.error(e.error || "Hata"); }
  }

  async function handleDownloadTemplate() {
    const res = await fetch("/api/raw-materials/template");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "hammadde-sablonu.xlsx"; a.click();
    URL.revokeObjectURL(url);
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true); setImportResult(null);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/raw-materials/bulk", { method: "POST", body: fd });
    const result = await res.json();
    setImporting(false);
    if (res.ok) {
      toast.success(`${result.inserted} hammadde eklendi`);
      setImportResult(result);
      load();
    } else {
      toast.error(result.error || "Yükleme hatası");
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  async function openMovements(item: RawMaterial) {
    setMovementsItem(item);
    setMovementsLoading(true);
    const res = await fetch(`/api/raw-materials/${item.id}/movements`);
    setMovements(await res.json());
    setMovementsLoading(false);
  }

  const TYPE_LABELS: Record<string, string> = { usage: "Kullanım", restock: "Stok Girişi", adjustment: "Düzeltme" };
  const TYPE_COLORS: Record<string, "red" | "green" | "blue"> = { usage: "red", restock: "green", adjustment: "blue" };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-brown-800">Hammaddeler</h1>
        <div className="flex gap-2 flex-wrap justify-end">
          <Button variant="secondary" size="sm" onClick={handleDownloadTemplate}>⬇ Şablon İndir</Button>
          <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()} disabled={importing}>
            {importing ? "Yükleniyor..." : "⬆ Excel Yükle"}
          </Button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileUpload} />
          {isAdmin && <Button onClick={openCreate}>+ Ekle</Button>}
        </div>
      </div>

      {importResult && (
        <div className={`mb-4 rounded-xl border p-4 text-sm ${importResult.skipped.length > 0 ? "bg-yellow-50 border-yellow-200" : "bg-green-50 border-green-200"}`}>
          <div className="flex items-start justify-between">
            <div>
              <p className="font-semibold text-green-800">
                ✅ {importResult.inserted} hammadde eklendi
                {importResult.skipped.length > 0 && `, ${importResult.skipped.length} satır atlandı`}
              </p>
              {importResult.skipped.map((s, i) => (
                <p key={i} className="text-yellow-700 text-xs mt-0.5">⚠ {s}</p>
              ))}
            </div>
            <button onClick={() => setImportResult(null)} className="text-gray-400 hover:text-gray-600 text-lg leading-none ml-4">×</button>
          </div>
        </div>
      )}

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
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-cream-100">
                {items.map((item) => {
                  const stock = parseFloat(item.stockQty);
                  const min = parseFloat(item.minStock);
                  const lowStock = stock < min;
                  const outOfStock = stock <= 0;
                  return (
                    <tr key={item.id} className="hover:bg-cream-50">
                      <td className="px-4 py-3 font-medium text-brown-800">{item.name}</td>
                      <td className="px-4 py-3 text-brown-600">{item.unit}</td>
                      <td className="px-4 py-3 text-right">₺{parseFloat(item.unitCost).toFixed(2)}</td>
                      <td className={`px-4 py-3 text-right font-semibold ${outOfStock ? "text-red-600" : lowStock ? "text-yellow-600" : "text-brown-700"}`}>
                        {parseFloat(item.stockQty).toFixed(3)} {item.unit}
                      </td>
                      <td className="px-4 py-3 text-right text-brown-400">{item.minStock}</td>
                      <td className="px-4 py-3">
                        {outOfStock
                          ? <Badge color="red">Tükendi</Badge>
                          : lowStock
                          ? <Badge color="yellow">Düşük Stok</Badge>
                          : <Badge color="green">Yeterli</Badge>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1.5 justify-end flex-wrap">
                          <Button size="sm" variant="ghost" onClick={() => openMovements(item)}>📋</Button>
                          {isAdmin && <>
                            <Button size="sm" variant="secondary" onClick={() => openRestock(item)}>+ Stok</Button>
                            <Button size="sm" variant="ghost" onClick={() => openEdit(item)}>Düzenle</Button>
                            <Button size="sm" variant="danger" onClick={() => setDeleteId(item.id)}>Sil</Button>
                          </>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit/Create Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? "Hammadde Düzenle" : "Hammadde Ekle"}>
        <div className="space-y-4">
          {(["name", "unit", "unitCost", "stockQty", "minStock"] as const).map((f) => (
            <div key={f}>
              <label className="block text-sm font-medium text-brown-700 mb-1">
                {f === "name" ? "Ad" : f === "unit" ? "Birim (kg, litre, adet...)" : f === "unitCost" ? "Birim Fiyat (₺)" : f === "stockQty" ? "Mevcut Stok" : "Min Stok"}
              </label>
              <input value={form[f]} onChange={(e) => setForm({ ...form, [f]: e.target.value })}
                type={["unitCost","stockQty","minStock"].includes(f) ? "number" : "text"}
                className="w-full border border-cream-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brown-400" />
            </div>
          ))}
          <div>
            <label className="block text-sm font-medium text-brown-700 mb-1">Raf Ömrü (saat, opsiyonel)</label>
            <input type="number" value={form.shelfLifeHours} onChange={(e) => setForm({ ...form, shelfLifeHours: e.target.value })}
              className="w-full border border-cream-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brown-400" />
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>İptal</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Kaydediliyor..." : "Kaydet"}</Button>
          </div>
        </div>
      </Modal>

      {/* Restock Modal */}
      <Modal open={!!restockItem} onClose={() => setRestockItem(null)} title={`Stok Ekle — ${restockItem?.name}`}>
        <div className="space-y-4">
          <p className="text-sm text-brown-500">Mevcut stok: <strong>{parseFloat(restockItem?.stockQty||"0").toFixed(3)} {restockItem?.unit}</strong></p>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-sm font-medium text-brown-700 mb-1">Eklenecek Miktar *</label>
              <input type="number" min="0.001" step="0.001" value={restockForm.qty}
                onChange={(e) => setRestockForm({ ...restockForm, qty: e.target.value })}
                className="w-full border border-cream-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div className="w-28">
              <label className="block text-sm font-medium text-brown-700 mb-1">Birim</label>
              <input value={restockForm.unit} onChange={(e) => setRestockForm({ ...restockForm, unit: e.target.value })}
                className="w-full border border-cream-300 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
          {restockForm.unit && restockItem && restockForm.unit !== restockItem.unit && (
            <p className="text-xs text-blue-600 bg-blue-50 rounded-lg px-3 py-2">
              Otomatik dönüşüm: {restockForm.qty || "?"} {restockForm.unit} → {restockItem.unit} cinsine çevrilecek
            </p>
          )}
          <div>
            <label className="block text-sm font-medium text-brown-700 mb-1">Not (opsiyonel)</label>
            <input value={restockForm.notes} onChange={(e) => setRestockForm({ ...restockForm, notes: e.target.value })}
              placeholder="Tedarikçi, fatura no..." className="w-full border border-cream-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="secondary" onClick={() => setRestockItem(null)}>İptal</Button>
            <Button onClick={handleRestock} disabled={restocking}>{restocking ? "Ekleniyor..." : "Stok Ekle"}</Button>
          </div>
        </div>
      </Modal>

      {/* Movements Modal */}
      <Modal open={!!movementsItem} onClose={() => setMovementsItem(null)} title={`Stok Hareketleri — ${movementsItem?.name}`}>
        {movementsLoading ? (
          <SkeletonTable rows={4} />
        ) : movements.length === 0 ? (
          <p className="text-brown-400 text-sm py-4 text-center">Henüz hareket kaydı yok.</p>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {movements.map((m) => (
              <div key={m.id} className="flex items-start justify-between py-2 border-b border-cream-100 last:border-0">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge color={TYPE_COLORS[m.type] || "gray"}>{TYPE_LABELS[m.type] || m.type}</Badge>
                    <span className={`font-semibold text-sm ${parseFloat(m.qtyChange) < 0 ? "text-red-600" : "text-green-600"}`}>
                      {parseFloat(m.qtyChange) > 0 ? "+" : ""}{parseFloat(m.qtyChange).toFixed(3)} {m.unit}
                    </span>
                  </div>
                  {m.notes && <p className="text-xs text-brown-400 mt-0.5">{m.notes}</p>}
                </div>
                <span className="text-xs text-brown-400 shrink-0 ml-4">
                  {new Date(m.createdAt).toLocaleString("tr-TR", { day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit" })}
                </span>
              </div>
            ))}
          </div>
        )}
      </Modal>

      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete} loading={deleting} message="Bu hammaddeyi silmek istediğinizden emin misiniz?" />
    </div>
  );
}
