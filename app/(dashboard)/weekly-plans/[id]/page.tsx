"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import toast from "react-hot-toast";
import { useSession } from "next-auth/react";

const DAY_NAMES = ["", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"];
const statusColor = { draft: "gray", active: "blue", completed: "green" } as const;
const statusLabel = { draft: "Taslak", active: "Aktif", completed: "Tamamlandı" };

export default function WeeklyPlanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: session } = useSession();
  const isAdmin = (session?.user as any)?.role === "admin";
  const [plan, setPlan] = useState<any>(null);
  const [calculations, setCalculations] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "schedule" | "calculations">("overview");

  async function load() {
    setLoading(true);
    const [planRes, calcRes] = await Promise.all([
      fetch(`/api/weekly-plans/${id}`),
      fetch(`/api/weekly-plans/${id}/calculations`),
    ]);
    setPlan(await planRes.json());
    setCalculations(await calcRes.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, [id]);

  async function handleGenerate() {
    setGenerating(true);
    const res = await fetch(`/api/weekly-plans/${id}/generate-schedule`, { method: "POST" });
    setGenerating(false);
    if (res.ok) { toast.success("Çizelge oluşturuldu"); load(); }
    else { toast.error("Hata oluştu"); }
  }

  async function updateStatus(status: string) {
    await fetch(`/api/weekly-plans/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    load();
    toast.success("Durum güncellendi");
  }

  if (loading) return <div className="space-y-3">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>;
  if (!plan) return <p className="text-brown-500">Plan bulunamadı.</p>;

  const tasksByDay = (plan.tasks || []).reduce((acc: Record<number, any[]>, t: any) => {
    if (!acc[t.dayOfWeek]) acc[t.dayOfWeek] = [];
    acc[t.dayOfWeek].push(t);
    return acc;
  }, {} as Record<number, any[]>);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-brown-800">
            {new Date(plan.weekStart).toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" })} Haftası
          </h1>
          <div className="mt-1">
            <Badge color={statusColor[plan.status as keyof typeof statusColor]}>
              {statusLabel[plan.status as keyof typeof statusLabel]}
            </Badge>
          </div>
        </div>
        {isAdmin && (
          <div className="flex flex-wrap gap-2">
            {plan.status === "draft" && (
              <Button size="sm" variant="secondary" onClick={() => updateStatus("active")}>Aktive Et</Button>
            )}
            {plan.status === "active" && (
              <Button size="sm" variant="secondary" onClick={() => updateStatus("completed")}>Tamamla</Button>
            )}
            <Button onClick={handleGenerate} disabled={generating} variant="secondary">
              {generating ? "Oluşturuluyor..." : "🔄 Çizelge Oluştur"}
            </Button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-cream-200">
        {(["overview", "schedule", "calculations"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
              activeTab === tab
                ? "border-brown-600 text-brown-700"
                : "border-transparent text-brown-400 hover:text-brown-600"
            }`}
          >
            {tab === "overview" ? "Hedefler" : tab === "schedule" ? "Çizelge" : "Hesaplamalar"}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === "overview" && (
        <div className="bg-white rounded-xl border border-cream-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-cream-100 text-brown-700">
              <tr>
                <th className="text-left px-4 py-3">Ürün</th>
                <th className="text-right px-4 py-3">Hedef Adet</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cream-100">
              {(plan.items || []).map((item: any) => (
                <tr key={item.id}>
                  <td className="px-4 py-3 font-medium text-brown-800">{item.productName}</td>
                  <td className="px-4 py-3 text-right text-brown-700">{item.targetQty} adet</td>
                </tr>
              ))}
              {(plan.items || []).length === 0 && (
                <tr>
                  <td colSpan={2} className="px-4 py-8 text-center text-brown-400">
                    Ürün hedefi tanımlanmamış.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Schedule Tab */}
      {activeTab === "schedule" && (
        <div className="space-y-4">
          {(plan.tasks || []).length === 0 && (
            <div className="bg-cream-50 rounded-xl p-8 text-center text-brown-400">
              <p>Henüz çizelge oluşturulmamış.</p>
              {isAdmin && (
                <Button className="mt-3" onClick={handleGenerate} disabled={generating}>
                  {generating ? "Oluşturuluyor..." : "Çizelge Oluştur"}
                </Button>
              )}
            </div>
          )}
          {Object.entries(tasksByDay)
            .sort(([a], [b]) => Number(a) - Number(b))
            .map(([day, tasks]) => (
              <div key={day} className="bg-white rounded-xl border border-cream-200 overflow-hidden">
                <div className="bg-cream-100 px-4 py-2 font-semibold text-brown-700 text-sm">
                  {DAY_NAMES[Number(day)]}
                </div>
                <div className="divide-y divide-cream-50">
                  {(tasks as any[]).map((task) => {
                    const fifoSoon = task.fifoDeadline &&
                      (new Date(task.fifoDeadline).getTime() - Date.now()) < 12 * 3600 * 1000;
                    return (
                      <div key={task.id} className="px-4 py-3 flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium text-brown-800">{task.taskDescription}</p>
                          <p className="text-xs text-brown-500">
                            {parseFloat(task.requiredQty).toFixed(2)} {task.unit}
                          </p>
                          {task.fifoDeadline && (
                            <p className={`text-xs mt-0.5 ${fifoSoon ? "text-red-600 font-semibold" : "text-brown-400"}`}>
                              SKT: {new Date(task.fifoDeadline).toLocaleString("tr-TR")}
                              {fifoSoon && " ⚠️"}
                            </p>
                          )}
                        </div>
                        <Badge color={task.status === "done" ? "green" : "gray"}>
                          {task.status === "done" ? "Tamamlandı" : "Bekliyor"}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
        </div>
      )}

      {/* Calculations Tab */}
      {activeTab === "calculations" && calculations && (
        <div className="space-y-6">
          <div className="bg-cream-100 border border-cream-300 rounded-xl p-4">
            <div className="text-lg font-bold text-brown-800">
              Toplam Hammadde Maliyeti: ₺{Number(calculations.totalCost || 0).toFixed(2)}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-cream-200 overflow-hidden">
            <div className="px-4 py-3 bg-cream-100 font-semibold text-brown-700 text-sm">
              Baz Ürün İhtiyaçları
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-cream-50 text-brown-600">
                  <tr>
                    <th className="text-left px-4 py-2">Baz Ürün</th>
                    <th className="text-right px-4 py-2">Net Miktar</th>
                    <th className="text-right px-4 py-2">Brüt (fire+marj)</th>
                    <th className="text-left px-4 py-2">Birim</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-cream-50">
                  {(calculations.baseProducts || []).map((bp: any) => (
                    <tr key={bp.id}>
                      <td className="px-4 py-2 font-medium text-brown-800">{bp.name}</td>
                      <td className="px-4 py-2 text-right">{Number(bp.netQty).toFixed(3)}</td>
                      <td className="px-4 py-2 text-right font-semibold text-brown-700">
                        {Number(bp.brutQty).toFixed(3)}
                      </td>
                      <td className="px-4 py-2 text-brown-500">{bp.unit}</td>
                    </tr>
                  ))}
                  {(calculations.baseProducts || []).length === 0 && (
                    <tr><td colSpan={4} className="px-4 py-6 text-center text-brown-400">Hesaplanacak baz ürün yok.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-cream-200 overflow-hidden">
            <div className="px-4 py-3 bg-cream-100 font-semibold text-brown-700 text-sm">
              Hammadde İhtiyaçları
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-cream-50 text-brown-600">
                  <tr>
                    <th className="text-left px-4 py-2">Hammadde</th>
                    <th className="text-right px-4 py-2">Gereken Miktar</th>
                    <th className="text-left px-4 py-2">Birim</th>
                    <th className="text-right px-4 py-2">Toplam Maliyet</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-cream-50">
                  {(calculations.rawMaterials || []).map((rm: any) => (
                    <tr key={rm.id}>
                      <td className="px-4 py-2 font-medium text-brown-800">{rm.name}</td>
                      <td className="px-4 py-2 text-right">{Number(rm.requiredQty).toFixed(3)}</td>
                      <td className="px-4 py-2 text-brown-500">{rm.unit}</td>
                      <td className="px-4 py-2 text-right text-brown-700">₺{Number(rm.totalCost).toFixed(2)}</td>
                    </tr>
                  ))}
                  {(calculations.rawMaterials || []).length === 0 && (
                    <tr><td colSpan={4} className="px-4 py-6 text-center text-brown-400">Hesaplanacak hammadde yok.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
