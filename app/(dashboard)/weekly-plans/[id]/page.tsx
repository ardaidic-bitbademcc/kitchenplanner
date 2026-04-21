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
  const isAdmin = session?.user?.role === "admin";
  const [plan, setPlan] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [calculations, setCalculations] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [togglingTask, setTogglingTask] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "schedule" | "calculations">("overview");

  async function load() {
    setLoading(true);
    const [planRes, calcRes] = await Promise.all([
      fetch(`/api/weekly-plans/${id}`),
      fetch(`/api/weekly-plans/${id}/calculations`),
    ]);
    const planData = await planRes.json();
    setPlan(planData);
    setTasks(planData.tasks || []);
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

  async function toggleTask(task: any) {
    const newStatus = task.status === "pending" ? "done" : "pending";
    setTogglingTask(task.id);
    const res = await fetch(`/api/schedule-tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    setTogglingTask(null);
    if (res.ok) {
      const updated = await res.json();
      setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, status: updated.status } : t));
      if (newStatus === "done") {
        toast.success("Görev tamamlandı, stok düşüldü");
        if (updated.stockWarning) toast.error(`Stok uyarısı: ${updated.stockWarning}`);
      } else {
        toast("Görev tekrar açıldı (stok iade edilmedi)");
      }
    } else {
      toast.error("Güncelleme başarısız");
    }
  }

  if (loading) return <div className="space-y-3">{[1,2,3,4,5].map(i=><Skeleton key={i} className="h-12 w-full"/>)}</div>;
  if (!plan) return <p className="text-brown-500">Plan bulunamadı.</p>;

  const tasksByDay = tasks.reduce((acc: Record<number, any[]>, t: any) => {
    if (!acc[t.dayOfWeek]) acc[t.dayOfWeek] = [];
    acc[t.dayOfWeek].push(t);
    return acc;
  }, {});

  const completedCount = tasks.filter(t => t.status === "done").length;
  const totalCount = tasks.length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-brown-800">
            {new Date(plan.weekStart + "T00:00:00").toLocaleDateString("tr-TR", { day:"2-digit", month:"long", year:"numeric" })} Haftası
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge color={statusColor[plan.status as keyof typeof statusColor]}>{statusLabel[plan.status as keyof typeof statusLabel]}</Badge>
            {totalCount > 0 && (
              <span className="text-xs text-brown-500">{completedCount}/{totalCount} görev tamamlandı</span>
            )}
          </div>
        </div>
        {isAdmin && (
          <Button onClick={handleGenerate} disabled={generating} variant="secondary">
            {generating ? "Oluşturuluyor..." : "Çizelge Oluştur"}
          </Button>
        )}
      </div>

      {/* Progress bar */}
      {totalCount > 0 && (
        <div className="w-full bg-cream-200 rounded-full h-2">
          <div
            className="bg-green-500 h-2 rounded-full transition-all"
            style={{ width: `${(completedCount / totalCount) * 100}%` }}
          />
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-cream-200">
        {(["overview","schedule","calculations"] as const).map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition ${activeTab===tab ? "border-brown-600 text-brown-700" : "border-transparent text-brown-400 hover:text-brown-600"}`}>
            {tab==="overview" ? "Hedefler" : tab==="schedule" ? `Çizelge${totalCount>0?` (${completedCount}/${totalCount})`:""}` : "Hesaplamalar"}
          </button>
        ))}
      </div>

      {/* Overview */}
      {activeTab==="overview" && (
        <div className="bg-white rounded-xl border border-cream-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-cream-100 text-brown-700">
              <tr>
                <th className="text-left px-4 py-3">Ürün</th>
                <th className="text-right px-4 py-3">Hedef Adet</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cream-100">
              {(plan.items||[]).map((item:any) => (
                <tr key={item.id}>
                  <td className="px-4 py-3 font-medium text-brown-800">{item.productName}</td>
                  <td className="px-4 py-3 text-right text-brown-700">{item.targetQty} adet</td>
                </tr>
              ))}
              {(plan.items||[]).length===0 && (
                <tr><td colSpan={2} className="px-4 py-8 text-center text-brown-400">Ürün hedefi tanımlanmamış.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Schedule */}
      {activeTab==="schedule" && (
        <div className="space-y-4">
          {tasks.length===0 && (
            <div className="bg-cream-50 rounded-xl p-8 text-center text-brown-400">
              <p>Henüz çizelge oluşturulmamış.</p>
              {isAdmin && <Button className="mt-3" onClick={handleGenerate} disabled={generating}>{generating?"Oluşturuluyor...":"Çizelge Oluştur"}</Button>}
            </div>
          )}
          {Object.entries(tasksByDay).sort(([a],[b])=>Number(a)-Number(b)).map(([day, dayTasks]) => (
            <div key={day} className="bg-white rounded-xl border border-cream-200 overflow-hidden">
              <div className="bg-cream-100 px-4 py-2 font-semibold text-brown-700 text-sm flex items-center justify-between">
                <span>{DAY_NAMES[Number(day)]}</span>
                <span className="text-xs font-normal text-brown-400">
                  {(dayTasks as any[]).filter(t=>t.status==="done").length}/{(dayTasks as any[]).length} tamamlandı
                </span>
              </div>
              <div className="divide-y divide-cream-50">
                {(dayTasks as any[]).map((task) => {
                  const fifoSoon = task.fifoDeadline && (new Date(task.fifoDeadline).getTime()-Date.now()) < 12*3600*1000;
                  const isDone = task.status === "done";
                  return (
                    <div key={task.id} className={`px-4 py-3 flex items-center justify-between gap-3 ${isDone?"bg-green-50/40":""}`}>
                      <div className="flex-1">
                        <p className={`text-sm font-medium ${isDone ? "text-brown-400 line-through" : "text-brown-800"}`}>
                          {task.taskDescription}
                        </p>
                        <p className="text-xs text-brown-500 mt-0.5">
                          {parseFloat(task.requiredQty).toFixed(3)} {task.unit}
                          {task.fifoDeadline && (
                            <span className={`ml-2 ${fifoSoon?"text-red-600 font-semibold":""}`}>
                              · SKT: {new Date(task.fifoDeadline).toLocaleString("tr-TR",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"})}
                              {fifoSoon&&" ⚠️"}
                            </span>
                          )}
                        </p>
                      </div>
                      <button
                        onClick={() => toggleTask(task)}
                        disabled={togglingTask===task.id}
                        className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition border ${
                          isDone
                            ? "bg-green-100 text-green-700 border-green-200 hover:bg-green-200"
                            : "bg-white text-brown-600 border-cream-300 hover:bg-cream-50"
                        } disabled:opacity-50`}
                      >
                        {togglingTask===task.id ? "..." : isDone ? "Tamamlandi" : "Tamamla"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Calculations */}
      {activeTab==="calculations" && calculations && (
        <div className="space-y-6">
          <div className="bg-brown-50 border border-brown-200 rounded-xl p-4">
            <div className="text-lg font-bold text-brown-800">Toplam Hammadde Maliyeti: ₺{calculations.totalCost?.toFixed(2)}</div>
          </div>
          <div className="bg-white rounded-xl border border-cream-200 overflow-hidden">
            <div className="px-4 py-3 bg-cream-100 font-semibold text-brown-700 text-sm">Baz Ürün İhtiyaçları</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-cream-50 text-brown-600">
                  <tr>
                    <th className="text-left px-4 py-2">Baz Ürün</th>
                    <th className="text-right px-4 py-2">Net</th>
                    <th className="text-right px-4 py-2">Brüt (fire+marj)</th>
                    <th className="text-left px-4 py-2">Birim</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-cream-50">
                  {calculations.baseProducts?.map((bp:any)=>(
                    <tr key={bp.id}>
                      <td className="px-4 py-2 font-medium text-brown-800">{bp.name}</td>
                      <td className="px-4 py-2 text-right">{bp.netQty?.toFixed(3)}</td>
                      <td className="px-4 py-2 text-right font-semibold text-brown-700">{bp.brutQty?.toFixed(3)}</td>
                      <td className="px-4 py-2 text-brown-500">{bp.unit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-cream-200 overflow-hidden">
            <div className="px-4 py-3 bg-cream-100 font-semibold text-brown-700 text-sm">Hammadde İhtiyaçları</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-cream-50 text-brown-600">
                  <tr>
                    <th className="text-left px-4 py-2">Hammadde</th>
                    <th className="text-right px-4 py-2">Gereken</th>
                    <th className="text-left px-4 py-2">Birim</th>
                    <th className="text-right px-4 py-2">Maliyet</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-cream-50">
                  {calculations.rawMaterials?.map((rm:any)=>(
                    <tr key={rm.id}>
                      <td className="px-4 py-2 font-medium text-brown-800">{rm.name}</td>
                      <td className="px-4 py-2 text-right">{rm.requiredQty?.toFixed(3)}</td>
                      <td className="px-4 py-2 text-brown-500">{rm.unit}</td>
                      <td className="px-4 py-2 text-right text-brown-700">₺{rm.totalCost?.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
