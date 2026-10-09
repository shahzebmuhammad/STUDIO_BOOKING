import { NextResponse } from "next/server";
import { callSheets, createSessionToken, studioSessionCookie } from "@/lib/sheets-api";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { email?: string; password?: string };
    const user = await callSheets("login", { email: body.email, password: body.password }) as { id: string; email: string; fullName: string; role: string; mustChangePassword: boolean };
    const token = createSessionToken(user);
    const response = NextResponse.json({ user });
    response.cookies.set(studioSessionCookie(token));
    return response;
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not sign in." }, { status: 401 });
  }
}
