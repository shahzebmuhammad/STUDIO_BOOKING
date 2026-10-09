import { NextResponse } from "next/server";
import { getStudioSession } from "@/lib/sheets-api";

export async function GET() {
  const user = await getStudioSession();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  return NextResponse.json({ user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role, mustChangePassword: user.mustChangePassword } });
}
