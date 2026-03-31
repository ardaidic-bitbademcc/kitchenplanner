import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { calcProductCost } from "@/lib/cost-calculator";

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  try {
    const result = await calcProductCost(params.id);
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
