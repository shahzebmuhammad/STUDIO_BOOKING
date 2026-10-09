"use server";

import { createClient } from "@/lib/supabase/server";
import type { ClientRecord } from "@/lib/prototype-data";
import type { PaymentRecord } from "@/lib/prototype-data";

export type BookingInput = {
  clientId: string;
  session: string;
  studio: string;
  date: string;
  start: string;
  end: string;
  packageName?: string;
  specialRequests?: string;
};

async function getUserAndOrganization() {
  const supabase = await createClient();
  const { data: verifiedToken, error: authError } = await supabase.auth.getClaims();
  const claims = verifiedToken?.claims;
  const userId = claims?.sub;
  if (authError || !userId) throw new Error("Sign in to access the studio database.");
  const { data: membership, error } = await supabase.from("organization_members").select("organization_id, role").eq("user_id", userId).order("created_at", { ascending: true }).limit(1).maybeSingle();
  if (error) throw new Error(`Could not load workspace membership: ${error.message}`);
  if (!membership) throw new Error("Create a studio workspace before accessing studio records.");
  return { supabase, userId, organizationId: membership.organization_id as string };
}

export async function listOrganizationClients(): Promise<ClientRecord[]> {
  const { supabase, organizationId } = await getUserAndOrganization();
  const { data, error } = await supabase.from("clients").select("id,name,company,email,phone,emirate,vat_number,notes,photo_path,created_at,bookings(count)").eq("organization_id", organizationId).order("created_at", { ascending: false });
  if (error) throw new Error(`Could not load clients: ${error.message}`);
  return (data ?? []).map((row) => ({
    id: String(row.id), name: String(row.name), company: String(row.company ?? ""), email: String(row.email ?? ""), phone: String(row.phone ?? ""),
    emirate: row.emirate ?? undefined, vatNumber: row.vat_number ?? undefined, notes: row.notes ?? undefined, photoId: row.photo_path ?? undefined,
    sessions: Number((row.bookings as unknown as Array<{ count: number }> | null)?.[0]?.count ?? 0), createdAt: row.created_at, initials: String(row.name).split(/\s+/).map((part: string) => part[0] ?? "").join("").slice(0, 2).toUpperCase(), tone: "violet",
  }));
}

export async function createOrganizationClient(input: Pick<ClientRecord, "name" | "company" | "email" | "phone"> & { photoPath?: string }): Promise<ClientRecord> {
  const { supabase, organizationId } = await getUserAndOrganization();
  const name = input.name.trim();
  if (name.length < 2 || name.length > 160) throw new Error("Client name must be between 2 and 160 characters.");
  const { data, error } = await supabase.from("clients").insert({
    organization_id: organizationId, name, company: input.company.trim(), email: input.email.trim(), phone: input.phone.trim(), photo_path: input.photoPath ?? null,
  }).select("id,name,company,email,phone,emirate,vat_number,notes,photo_path,created_at").single();
  if (error) throw new Error(`Could not save client: ${error.message}`);
  return { id: data.id, name: data.name, company: data.company ?? "", email: data.email ?? "", phone: data.phone ?? "", emirate: data.emirate ?? undefined, vatNumber: data.vat_number ?? undefined, notes: data.notes ?? undefined, photoId: data.photo_path ?? undefined, createdAt: data.created_at, sessions: 0, initials: name.split(/\s+/).map((part) => part[0] ?? "").join("").slice(0, 2).toUpperCase(), tone: "violet" };
}

export async function updateOrganizationClientPhoto(clientId: string, photoPath: string): Promise<void> {
  const { supabase, organizationId } = await getUserAndOrganization();
  const { error } = await supabase.from("clients").update({ photo_path: photoPath }).eq("organization_id", organizationId).eq("id", clientId);
  if (error) throw new Error(`Could not update client photo: ${error.message}`);
}

export async function listOrganizationBookings(): Promise<Array<{ id: string; client: string; session: string; studio: string; date: string; start: string; end: string; status: string; initials: string; package?: string; assignedStaff?: string; requests?: string }>> {
  const { supabase, organizationId } = await getUserAndOrganization();
  const { data, error } = await supabase.from("bookings").select("id,session_name,starts_at,ends_at,status,package_name,special_requests,clients(name),studios(name)").eq("organization_id", organizationId).order("starts_at", { ascending: false });
  if (error) throw new Error(`Could not load bookings: ${error.message}`);
  return (data ?? []).map((row) => {
    const client = row.clients as unknown as { name: string } | null;
    const studio = row.studios as unknown as { name: string } | null;
    const startDate = new Date(row.starts_at);
    const endDate = new Date(row.ends_at);
    const localParts = (date: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dubai", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
    const parts = (date: Date) => Object.fromEntries(localParts(date).map((part) => [part.type, part.value]));
    const start = parts(startDate);
    const end = parts(endDate);
    const fullName = client?.name ?? "Client";
    return { id: row.id, client: fullName, session: row.session_name, studio: studio?.name ?? "Studio", date: `${start.year}-${start.month}-${start.day}`, start: `${start.hour}:${start.minute}`, end: `${end.hour}:${end.minute}`, status: row.status.replaceAll("_", " "), initials: fullName.split(/\s+/).map((part: string) => part[0] ?? "").join("").slice(0, 2).toUpperCase(), package: row.package_name ?? undefined, requests: row.special_requests ?? undefined };
  });
}

export async function createOrganizationBooking(input: BookingInput) {
  const { supabase, organizationId, userId } = await getUserAndOrganization();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date) || !/^\d{2}:\d{2}$/.test(input.start) || !/^\d{2}:\d{2}$/.test(input.end) || input.end <= input.start) throw new Error("Choose a valid date and time range.");
  const { data: studio, error: studioError } = await supabase.from("studios").select("id").eq("organization_id", organizationId).eq("name", input.studio).single();
  if (studioError || !studio) throw new Error("Selected studio is not configured in this workspace.");
  const startsAt = new Date(`${input.date}T${input.start}:00+04:00`).toISOString();
  const endsAt = new Date(`${input.date}T${input.end}:00+04:00`).toISOString();
  const { data, error } = await supabase.from("bookings").insert({
    organization_id: organizationId, client_id: input.clientId, studio_id: studio.id, session_name: input.session.trim(),
    starts_at: startsAt, ends_at: endsAt, status: "confirmed", package_name: input.packageName ?? null,
    special_requests: input.specialRequests ?? null, created_by: userId,
  }).select("id").single();
  if (error?.code === "23P01") throw new Error("That studio time has just been reserved. Pick another available slot.");
  if (error || !data) throw new Error(`Could not save booking: ${error?.message ?? "Unknown database error"}`);
  const client = (await supabase.from("clients").select("name").eq("organization_id", organizationId).eq("id", input.clientId).single()).data;
  return { id: data.id, client: client?.name ?? "Client", session: input.session, studio: input.studio, date: input.date, start: input.start, end: input.end, status: "Confirmed", initials: (client?.name ?? "C").split(/\s+/).map((part: string) => part[0] ?? "").join("").slice(0, 2).toUpperCase() };
}

export async function updateOrganizationBookingStatus(bookingId: string, status: string) {
  const allowed = ["inquiry", "quote_sent", "pending_payment", "confirmed", "completed", "cancelled", "no_show"];
  const normalized = status.toLowerCase().replaceAll(" ", "_") === "in_session" ? "confirmed" : status.toLowerCase().replaceAll(" ", "_");
  if (!allowed.includes(normalized)) throw new Error("Invalid booking status.");
  const { supabase, organizationId } = await getUserAndOrganization();
  const { error } = await supabase.from("bookings").update({ status: normalized }).eq("organization_id", organizationId).eq("id", bookingId);
  if (error) throw new Error(`Could not update booking status: ${error.message}`);
}

export type EquipmentInput = { name: string; category: string; serialNumber: string; studio: string; photoPath?: string };
export type EquipmentRow = { id: string; name: string; category: string; serial: string; status: string; photoId?: string };
const equipmentStatusLabel: Record<string, string> = { available: "Available", in_use: "In Use", maintenance: "Maintenance", damaged: "Damaged" };

export async function listOrganizationEquipment(): Promise<EquipmentRow[]> {
  const { supabase, organizationId } = await getUserAndOrganization();
  const { data, error } = await supabase.from("equipment").select("id,name,category,serial_number,status,photo_path,studios(name)").eq("organization_id", organizationId).order("created_at", { ascending: false });
  if (error) throw new Error(`Could not load equipment: ${error.message}`);
  return (data ?? []).map((row) => {
    const studio = row.studios as unknown as { name: string } | null;
    return { id: row.id, name: row.name, category: `${row.category}${studio?.name ? ` · ${studio.name}` : ""}`, serial: row.serial_number, status: equipmentStatusLabel[row.status] ?? row.status, photoId: row.photo_path ?? undefined };
  });
}

export async function createOrganizationEquipment(input: EquipmentInput): Promise<EquipmentRow> {
  const { supabase, organizationId } = await getUserAndOrganization();
  let studioId: string | null = null;
  if (input.studio !== "Shared inventory") {
    const { data: studio, error: studioError } = await supabase.from("studios").select("id").eq("organization_id", organizationId).eq("name", input.studio).single();
    if (studioError || !studio) throw new Error("Selected studio is not configured in this workspace.");
    studioId = studio.id;
  }
  const { data, error } = await supabase.from("equipment").insert({ organization_id: organizationId, name: input.name.trim(), category: input.category.trim(), serial_number: input.serialNumber.trim(), studio_id: studioId, photo_path: input.photoPath ?? null, status: "available" }).select("id,name,category,serial_number,status,photo_path").single();
  if (error?.code === "23505") throw new Error("That serial number is already registered.");
  if (error || !data) throw new Error(`Could not save equipment: ${error?.message ?? "Unknown database error"}`);
  return { id: data.id, name: data.name, category: `${data.category}${input.studio === "Shared inventory" ? " · Shared inventory" : ` · ${input.studio}`}`, serial: data.serial_number, status: "Available", photoId: data.photo_path ?? undefined };
}

export async function updateOrganizationEquipmentStatus(itemId: string, status: string) {
  const statusMap: Record<string, string> = { Available: "available", "In Use": "in_use", Maintenance: "maintenance", Damaged: "damaged" };
  const normalized = statusMap[status];
  if (!normalized) throw new Error("Invalid equipment status.");
  const { supabase, organizationId } = await getUserAndOrganization();
  const { error } = await supabase.from("equipment").update({ status: normalized }).eq("organization_id", organizationId).eq("id", itemId);
  if (error) throw new Error(`Could not update equipment: ${error.message}`);
}

export async function listOrganizationPayments(clientId?: string): Promise<PaymentRecord[]> {
  const { supabase, organizationId } = await getUserAndOrganization();
  let request = supabase.from("payments").select("id,client_id,amount,method,status,payment_link,receipt_path,created_at,invoices(invoice_number),clients(name)").eq("organization_id", organizationId).order("created_at", { ascending: false });
  if (clientId) request = request.eq("client_id", clientId);
  const { data, error } = await request;
  if (error) throw new Error(`Could not load payments: ${error.message}`);
  return (data ?? []).map((row) => {
    const invoice = row.invoices as unknown as { invoice_number: string } | null;
    const client = row.clients as unknown as { name: string } | null;
    return { id: row.id, invoice: invoice?.invoice_number ?? "—", clientId: row.client_id, clientName: client?.name ?? "Client", amount: Number(row.amount), method: row.method === "cash" ? "Cash" : "Card", status: row.status.replaceAll("_", " ").replace(/\b\w/g, (letter: string) => letter.toUpperCase()), createdAt: row.created_at, paymentLink: row.payment_link ?? undefined, receiptId: row.receipt_path ? `payment-receipts:${row.receipt_path}` : undefined, receiptName: row.receipt_path?.split("/").at(-1) } as PaymentRecord;
  });
}

export async function recordOrganizationPayment(input: { clientId: string; invoice: string; amount: number; method: PaymentRecord["method"]; status: PaymentRecord["status"]; paymentLink?: string; receiptPath?: string }) {
  const { supabase } = await getUserAndOrganization();
  const method = input.method === "Cash" ? "cash" : "card";
  const status = input.status.toLowerCase().replaceAll(" ", "_");
  const { data, error } = await supabase.rpc("record_payment", {
    p_client_id: input.clientId,
    p_invoice_number: input.invoice,
    p_amount: input.amount,
    p_method: method,
    p_status: status,
    p_payment_link: input.paymentLink ?? null,
    p_receipt_path: input.receiptPath ?? null,
  });
  if (error) throw new Error(`Could not save payment: ${error.message}`);
  const result = data as { payment_id: string };
  const { data: client } = await supabase.from("clients").select("name").eq("id", input.clientId).single();
  return { id: result.payment_id, invoice: input.invoice, clientId: input.clientId, clientName: client?.name ?? "Client", amount: input.amount, method: input.method, status: input.status, createdAt: new Date().toISOString(), paymentLink: input.paymentLink, receiptId: input.receiptPath ? `payment-receipts:${input.receiptPath}` : undefined, receiptName: input.receiptPath?.split("/").at(-1) } satisfies PaymentRecord;
}

export async function updateOrganizationPaymentStatus(paymentId: string, status: PaymentRecord["status"]) {
  const { supabase, organizationId } = await getUserAndOrganization();
  const normalized = status.toLowerCase().replaceAll(" ", "_");
  const { error } = await supabase.from("payments").update({ status: normalized, paid_at: normalized === "paid" ? new Date().toISOString() : null }).eq("organization_id", organizationId).eq("id", paymentId);
  if (error) throw new Error(`Could not update payment: ${error.message}`);
}

export type MembershipRow = { id: string; client: string; plan: "Starter" | "Professional" | "Enterprise"; start: string; renewal: string; included: number; used: number; status: string };
export async function listOrganizationMemberships(): Promise<MembershipRow[]> {
  const { supabase, organizationId } = await getUserAndOrganization();
  const { data, error } = await supabase.from("memberships").select("id,plan,starts_on,renews_on,included_hours,is_active,clients(name),episodes(id)").eq("organization_id", organizationId).order("starts_on", { ascending: false });
  if (error) throw new Error(`Could not load memberships: ${error.message}`);
  return (data ?? []).map((row) => {
    const client = row.clients as unknown as { name: string } | null;
    const plan = row.plan === "starter" ? "Starter" : row.plan === "professional" ? "Professional" : "Enterprise";
    const used = Number((row.episodes as unknown as Array<{ id: string }> | null)?.length ?? 0);
    return { id: row.id, client: client?.name ?? "Client", plan, start: row.starts_on, renewal: row.renews_on, included: Number(row.included_hours ?? (plan === "Starter" ? 4 : plan === "Professional" ? 10 : 99)), used, status: row.is_active ? "Active" : "Renewal due" };
  });
}

export async function createOrganizationMembership(input: { clientId: string; plan: "Starter" | "Professional" | "Enterprise"; start: string; renewal: string }) {
  const { supabase, organizationId } = await getUserAndOrganization();
  const plans = { Starter: { plan: "starter", included_hours: 4 }, Professional: { plan: "professional", included_hours: 10 }, Enterprise: { plan: "enterprise", included_hours: null } } as const;
  const selected = plans[input.plan];
  const { data, error } = await supabase.from("memberships").insert({ organization_id: organizationId, client_id: input.clientId, plan: selected.plan, included_hours: selected.included_hours, starts_on: input.start, renews_on: input.renewal }).select("id").single();
  if (error || !data) throw new Error(`Could not create membership: ${error?.message ?? "Unknown database error"}`);
  const { data: client } = await supabase.from("clients").select("name").eq("organization_id", organizationId).eq("id", input.clientId).single();
  return { id: data.id, client: client?.name ?? "Client", plan: input.plan, start: input.start, renewal: input.renewal, included: selected.included_hours ?? 99, used: 0, status: "Active" } satisfies MembershipRow;
}

export type EpisodeRow = { id: string; name: string; show: string; client: string; editor: string; date: string; status: string };
export async function listOrganizationEpisodes(): Promise<EpisodeRow[]> {
  const { supabase, organizationId } = await getUserAndOrganization();
  const { data, error } = await supabase.from("episodes").select("id,name,show_name,recorded_at,status,clients(name),profiles(display_name)").eq("organization_id", organizationId).order("created_at", { ascending: false });
  if (error) throw new Error(`Could not load episodes: ${error.message}`);
  return (data ?? []).map((row) => {
    const client = row.clients as unknown as { name: string } | null;
    const editor = row.profiles as unknown as { display_name: string } | null;
    return { id: row.id, name: row.name, show: row.show_name ?? "", client: client?.name ?? "Client", editor: editor?.display_name ?? "Unassigned", date: row.recorded_at ? new Date(row.recorded_at).toLocaleDateString("en-AE") : "Not recorded", status: row.status.replaceAll("_", " ").replace(/\b\w/g, (letter: string) => letter.toUpperCase()) };
  });
}

export async function createOrganizationEpisode(input: { name: string; show: string; clientId: string; editorName: string }) {
  const { supabase, organizationId } = await getUserAndOrganization();
  const { data: client, error: clientError } = await supabase.from("clients").select("id,name").eq("organization_id", organizationId).eq("id", input.clientId).single();
  if (clientError || !client) throw new Error("Choose a valid client.");
  const { data, error } = await supabase.from("episodes").insert({ organization_id: organizationId, client_id: client.id, name: input.name.trim(), show_name: input.show.trim() || null, status: "recorded" }).select("id,created_at").single();
  if (error || !data) throw new Error(`Could not create episode: ${error?.message ?? "Unknown database error"}`);
  return { id: data.id, name: input.name.trim(), show: input.show, client: client.name, editor: input.editorName || "Unassigned", date: new Date(data.created_at).toLocaleDateString("en-AE"), status: "Recorded" } satisfies EpisodeRow;
}

export async function updateOrganizationEpisodeStatus(episodeId: string, status: string) {
  const normalized = status.toLowerCase().replaceAll(" ", "_");
  if (!(["recorded", "editing", "review", "approved", "published"] as string[]).includes(normalized)) throw new Error("Invalid production status.");
  const { supabase, organizationId } = await getUserAndOrganization();
  const { error } = await supabase.from("episodes").update({ status: normalized }).eq("organization_id", organizationId).eq("id", episodeId);
  if (error) throw new Error(`Could not update episode: ${error.message}`);
}

export type TaskRow = { id: string; title: string; category: string; assignee: string; due: string; done: boolean };
export async function listOrganizationTasks(): Promise<TaskRow[]> {
  const { supabase, organizationId } = await getUserAndOrganization();
  const { data, error } = await supabase.from("tasks").select("id,title,category,due_at,completed_at,profiles(display_name)").eq("organization_id", organizationId).order("due_at", { ascending: true, nullsFirst: false });
  if (error) throw new Error(`Could not load tasks: ${error.message}`);
  return (data ?? []).map((row) => {
    const profile = row.profiles as unknown as { display_name: string } | null;
    return { id: row.id, title: row.title, category: row.category, assignee: profile?.display_name ?? "Unassigned", due: row.due_at ? new Date(row.due_at).toLocaleTimeString("en-AE", { hour: "2-digit", minute: "2-digit" }) : "No due time", done: Boolean(row.completed_at) };
  });
}

export async function createOrganizationTask(input: { title: string; category: string; due: string; assigneeName: string }) {
  const { supabase, organizationId, userId } = await getUserAndOrganization();
  const dueAt = /^\d{2}:\d{2}$/.test(input.due) ? new Date(`${new Date().toISOString().slice(0, 10)}T${input.due}:00`).toISOString() : null;
  const { data, error } = await supabase.from("tasks").insert({ organization_id: organizationId, title: input.title.trim(), category: input.category, due_at: dueAt, assigned_to: userId, created_by: userId }).select("id").single();
  if (error || !data) throw new Error(`Could not create task: ${error?.message ?? "Unknown database error"}`);
  return { id: data.id, title: input.title.trim(), category: input.category, assignee: input.assigneeName, due: input.due, done: false } satisfies TaskRow;
}

export async function updateOrganizationTask(taskId: string, done: boolean) {
  const { supabase, organizationId } = await getUserAndOrganization();
  const { error } = await supabase.from("tasks").update({ completed_at: done ? new Date().toISOString() : null }).eq("organization_id", organizationId).eq("id", taskId);
  if (error) throw new Error(`Could not update task: ${error.message}`);
}

export async function getOrganizationDashboardSummary() {
  const { supabase, organizationId } = await getUserAndOrganization();
  const dayParts = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Dubai", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date()).map((part) => [part.type, part.value]));
  const startUtcDate = new Date(Date.UTC(Number(dayParts.year), Number(dayParts.month) - 1, Number(dayParts.day)) - 4 * 60 * 60 * 1000);
  const endUtcDate = new Date(startUtcDate.getTime() + 24 * 60 * 60 * 1000);
  const startUtc = startUtcDate.toISOString();
  const endUtc = endUtcDate.toISOString();
  const [bookingsResult, revenueResult, pendingResult, membershipsResult, studiosResult, equipmentResult, clientsResult] = await Promise.all([
    supabase.from("bookings").select("id,starts_at,ends_at,status,studio_id").eq("organization_id", organizationId).gte("starts_at", startUtc).lt("starts_at", endUtc),
    supabase.from("payments").select("amount").eq("organization_id", organizationId).eq("status", "paid").gte("paid_at", startUtc).lt("paid_at", endUtc),
    supabase.from("payments").select("amount").eq("organization_id", organizationId).in("status", ["unpaid", "partially_paid"]),
    supabase.from("memberships").select("id").eq("organization_id", organizationId).eq("is_active", true),
    supabase.from("studios").select("id").eq("organization_id", organizationId).eq("is_active", true),
    supabase.from("equipment").select("id").eq("organization_id", organizationId).eq("status", "available"),
    supabase.from("clients").select("id", { count: "exact", head: true }).eq("organization_id", organizationId),
  ]);
  const failure = [bookingsResult, revenueResult, pendingResult, membershipsResult, studiosResult, equipmentResult, clientsResult].find((result) => result.error)?.error;
  if (failure) throw new Error(`Could not load dashboard totals: ${failure.message}`);
  const hoursBooked = (bookingsResult.data ?? []).reduce((sum, booking) => sum + (new Date(booking.ends_at).getTime() - new Date(booking.starts_at).getTime()) / 3_600_000, 0);
  const dailyCapacity = Math.max(1, (studiosResult.data?.length ?? 0) * 14);
  return {
    bookingsToday: bookingsResult.data?.length ?? 0,
    revenueToday: (revenueResult.data ?? []).reduce((sum, payment) => sum + Number(payment.amount), 0),
    pendingPayments: (pendingResult.data ?? []).reduce((sum, payment) => sum + Number(payment.amount), 0),
    pendingInvoiceCount: pendingResult.data?.length ?? 0,
    activeMemberships: membershipsResult.data?.length ?? 0,
    studioUtilization: Math.min(100, Math.round(hoursBooked / dailyCapacity * 100)),
    availableEquipment: equipmentResult.data?.length ?? 0,
    totalClients: clientsResult.count ?? 0,
  };
}
