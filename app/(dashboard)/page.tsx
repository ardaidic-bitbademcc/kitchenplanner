import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { rawMaterials, weeklyPlans, scheduleTasks, baseProducts } from "@/lib/schema";
import { lt, eq, and, lte } from "drizzle-orm";
import { Badge } from "@/components/ui/Badge";
import Link from "next/link";

export default async function DashboardPage() {
  const session = await auth();
  const user = session?.user;

  const allMaterials = await db.select().from(rawMaterials);
  const lowStock = allMaterials.filter(
    (m) => parseFloat(m.stockQty as string) < parseFloat(m.minStock as string)
  );

  const plans = await db.select().from(weeklyPlans).orderBy(weeklyPlans.weekStart);
  const activePlans = plans.filter((p) => p.status === "active");

  // FIFO alerts: tasks with fifoDeadline within 12 hours
  const now = new Date();
  const in12h = new Date(now.getTime() + 12 * 60 * 60 * 1000);
  const allTasks = await db.select().from(scheduleTasks);
  const fifoAlerts = allTasks.filter(
    (t) => t.fifoDeadline && new Date(t.fifoDeadline) <= in12h && t.status === "pending"
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-brown-800">Dashboard</h1>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard title="Aktif Plan" value={activePlans.length.toString()} icon="📅" color="bg-blue-50" />
        <SummaryCard title="Toplam Plan" value={plans.length.toString()} icon="📋" color="bg-cream-100" />
        <SummaryCard title="Stok Uyarısı" value={lowStock.length.toString()} icon="⚠️" color={lowStock.length > 0 ? "bg-yellow-50" : "bg-green-50"} />
        <SummaryCard title="FIFO Uyarısı" value={fifoAlerts.length.toString()} icon="🔴" color={fifoAlerts.length > 0 ? "bg-red-50" : "bg-green-50"} />
      </div>

      {/* Stock alerts */}
      {lowStock.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <h2 className="font-semibold text-yellow-800 mb-3">⚠️ Düşük Stok Uyarıları</h2>
          <div className="space-y-2">
            {lowStock.map((m) => (
              <div key={m.id} className="flex justify-between items-center bg-white rounded-lg px-3 py-2 text-sm">
                <span className="font-medium text-brown-800">{m.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">{m.stockQty} {m.unit}</span>
                  <Badge color="yellow">Min: {m.minStock} {m.unit}</Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* FIFO alerts */}
      {fifoAlerts.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <h2 className="font-semibold text-red-800 mb-3">🔴 FIFO Uyarıları (&lt;12 saat)</h2>
          <div className="space-y-2">
            {fifoAlerts.map((t) => (
              <div key={t.id} className="flex justify-between items-center bg-white rounded-lg px-3 py-2 text-sm">
                <span className="font-medium text-brown-800">{t.taskDescription}</span>
                <Badge color="red">SKT: {t.fifoDeadline ? new Date(t.fifoDeadline).toLocaleString("tr-TR") : "-"}</Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active plans */}
      {activePlans.length > 0 && (
        <div className="bg-white rounded-xl border border-cream-200 p-4">
          <h2 className="font-semibold text-brown-800 mb-3">Aktif Planlar</h2>
          <div className="space-y-2">
            {activePlans.map((p) => (
              <Link key={p.id} href={`/weekly-plans/${p.id}`} className="flex justify-between items-center hover:bg-cream-50 rounded-lg px-3 py-2 transition">
                <span className="text-brown-700">
                  {new Date(p.weekStart).toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" })} haftası
                </span>
                <Badge color="blue">Aktif</Badge>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ title, value, icon, color }: { title: string; value: string; icon: string; color: string }) {
  return (
    <div className={`${color} rounded-xl p-4 border border-cream-200`}>
      <div className="text-2xl mb-1">{icon}</div>
      <div className="text-2xl font-bold text-brown-800">{value}</div>
      <div className="text-sm text-brown-600">{title}</div>
    </div>
  );
}
