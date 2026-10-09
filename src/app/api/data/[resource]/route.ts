import { NextResponse, type NextRequest } from "next/server";
import { callSheets, getStudioSession } from "@/lib/sheets-api";

type Context = { params: Promise<{ resource: string }> };

async function requestData(request: NextRequest, context: Context, method: "GET" | "POST" | "PATCH") {
  const session = await getStudioSession();
  if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { resource } = await context.params;
  const body = method === "GET" ? {} : await request.json().catch(() => ({})) as Record<string, unknown>;
  const actor = { id: session.id, email: session.email, role: session.role };
  const action = resource === "staff" ? (method === "GET" ? "listStaff" : "createStaff") : resource === "tasks" ? (method === "GET" ? "listTasks" : method === "PATCH" ? "updateTask" : "createTask") : "";
  if (!action) return NextResponse.json({ error: "Unknown data resource." }, { status: 404 });
  try {
    const data = await callSheets(action, { ...body, actor });
    return NextResponse.json({ data });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not access studio data." }, { status: 400 });
  }
}

export function GET(request: NextRequest, context: Context) { return requestData(request, context, "GET"); }
export function POST(request: NextRequest, context: Context) { return requestData(request, context, "POST"); }
export function PATCH(request: NextRequest, context: Context) { return requestData(request, context, "PATCH"); }
