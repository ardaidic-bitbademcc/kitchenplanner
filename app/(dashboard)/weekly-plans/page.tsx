"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { SkeletonTable } from "@/components/ui/Skeleton";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import toast from "react-hot-toast";
import { useSession } from "next-auth/react";
import Link from "next/link";

interface Plan { id: string; weekStart: string; status: "draft" | "active" | "completed"; createdAt: string; }

const statusColor = { draft: "gray", active: "blue", completed: "green" } as const;
const statusLabel = { draft: "Taslak", active: "Aktif", completed: "Tamamlandı" };

export default function WeeklyPlansPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "admin";
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/weekly-plans");
    setPlans(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    await fetch(`/api/weekly-plans/${deleteId}`, { method: "DELETE" });
    setDeleting(false); setDeleteId(null);
    toast.success("Plan silindi"); load();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-brown-800">Haftalık Planlar</h1>
        {isAdmin && <Link href="/weekly-plans/new"><Button>+ Yeni Plan</Button></Link>}
      </div>
      {loading ? <SkeletonTable rows={3} /> : (
        <div className="bg-white rounded-xl border border-cream-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-cream-100 text-brown-700">
              <tr>
                <th className="text-left px-4 py-3">Hafta</th>
                <th className="text-left px-4 py-3">Durum</th>
                <th className="text-left px-4 py-3">Oluşturulma</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-cream-100">
              {plans.map((p) => (
                <tr key={p.id} className="hover:bg-cream-50">
                  <td className="px-4 py-3 font-medium text-brown-800">
                    {new Date(p.weekStart).toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" })} haftası
                  </td>
                  <td className="px-4 py-3"><Badge color={statusColor[p.status]}>{statusLabel[p.status]}</Badge></td>
                  <td className="px-4 py-3 text-brown-500">{new Date(p.createdAt).toLocaleDateString("tr-TR")}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2 justify-end">
                      <Link href={`/weekly-plans/${p.id}`}><Button size="sm" variant="secondary">Detay</Button></Link>
                      {isAdmin && <Button size="sm" variant="danger" onClick={() => setDeleteId(p.id)}>Sil</Button>}
                    </div>
                  </td>
                </tr>
              ))}
              {plans.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-brown-400">Henüz plan oluşturulmamış.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete} loading={deleting} message="Bu planı silmek istediğinizden emin misiniz?" />
    </div>
  );
}
