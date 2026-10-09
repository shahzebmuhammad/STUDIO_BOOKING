import { NextResponse } from "next/server";
import { callSheets, createSessionToken, getStudioSession, studioSessionCookie } from "@/lib/sheets-api";

export async function POST(request: Request) {
  const session = await getStudioSession();
  if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  try {
    const body = await request.json() as { currentPassword?: string; newPassword?: string };
    await callSheets("changePassword", { userId: session.id, currentPassword: body.currentPassword, newPassword: body.newPassword });
    const user = { id: session.id, email: session.email, fullName: session.fullName, role: session.role, mustChangePassword: false };
    const response = NextResponse.json({ user });
    response.cookies.set(studioSessionCookie(createSessionToken(user)));
    return response;
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not update password." }, { status: 400 });
  }
}
