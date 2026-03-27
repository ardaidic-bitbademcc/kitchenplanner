"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { SkeletonTable } from "@/components/ui/Skeleton";
import toast from "react-hot-toast";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";

interface User { id: string; email: string; name: string; role: "admin" | "viewer"; createdAt: string; }
const empty = { email: "", name: "", password: "", role: "viewer" as const };

export default function UsersPage() {
  const { data: session } = useSession();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/users");
    if (res.status === 403) { setLoading(false); return; }
    setUsers(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleSave() {
    setSaving(true);
    const url = editUser ? `/api/admin/users/${editUser.id}` : "/api/admin/users";
    const method = editUser ? "PUT" : "POST";
    const payload = editUser ? { name: form.name, role: form.role } : form;
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    setSaving(false);
    if (res.ok) { toast.success(editUser ? "Güncellendi" : "Kullanıcı eklendi"); setModalOpen(false); load(); }
    else { toast.error("Hata oluştu"); }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-brown-800">Kullanıcılar</h1>
        <Button onClick={() => { setEditUser(null); setForm(empty); setModalOpen(true); }}>+ Kullanıcı Ekle</Button>
      </div>
      {loading ? <SkeletonTable /> : (
        <div className="bg-white rounded-xl border border-cream-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-cream-100 text-brown-700">
              <tr>
                <th className="text-left px-4 py-3">Ad</th>
                <th className="text-left px-4 py-3">Email</th>
                <th className="text-left px-4 py-3">Rol</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-cream-100">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-cream-50">
                  <td className="px-4 py-3 font-medium text-brown-800">{u.name}</td>
                  <td className="px-4 py-3 text-brown-600">{u.email}</td>
                  <td className="px-4 py-3"><Badge color={u.role === "admin" ? "blue" : "gray"}>{u.role}</Badge></td>
                  <td className="px-4 py-3">
                    <Button size="sm" variant="secondary" onClick={() => { setEditUser(u); setForm({ email: u.email, name: u.name, password: "", role: u.role }); setModalOpen(true); }}>Düzenle</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editUser ? "Kullanıcı Düzenle" : "Kullanıcı Ekle"}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-brown-700 mb-1">Ad</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full border border-cream-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          {!editUser && (
            <>
              <div>
                <label className="block text-sm font-medium text-brown-700 mb-1">Email</label>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full border border-cream-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-brown-700 mb-1">Şifre</label>
                <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="w-full border border-cream-300 rounded-lg px-3 py-2 text-sm" />
              </div>
            </>
          )}
          <div>
            <label className="block text-sm font-medium text-brown-700 mb-1">Rol</label>
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as "admin" | "viewer" })} className="w-full border border-cream-300 rounded-lg px-3 py-2 text-sm">
              <option value="viewer">viewer</option>
              <option value="admin">admin</option>
            </select>
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>İptal</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Kaydediliyor..." : "Kaydet"}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
