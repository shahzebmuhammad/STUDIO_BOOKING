"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import LocalPhoto from "@/components/LocalPhoto";
import { ArrowLeft, ArrowRight, Banknote, CalendarDays, Check, ChevronDown, CircleDollarSign, Clock3, Copy, CreditCard, ExternalLink, FileText, Mail, Paperclip, Plus, ReceiptText, Search, Upload, UserRound, X } from "lucide-react";
import { loadClients, loadPayments, openStoredReceipt, saveClients, savePayments, storeMedia, storeReceipt } from "@/lib/prototype-data";
import type { ClientRecord, PaymentRecord } from "@/lib/prototype-data";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { listOrganizationBookings, listOrganizationClients, listOrganizationPayments, recordOrganizationPayment, updateOrganizationClientPhoto, updateOrganizationPaymentStatus } from "@/lib/supabase/actions";
import { getOrganizationFileUrl, uploadOrganizationFile } from "@/lib/supabase/storage";

type Props = { onNotify: (message: string) => void };
type BookingItem = { id: string; client: string; session: string; studio: string; date: string; start: string; end: string; status: string };
const displayBookingId = (id: string) => id.replace(/^MPL-/, "BK-");
const sampleHistory: BookingItem[] = [
  { id: "MPL-1048", client: "Sara Khalid", session: "The Founder’s Table · Episode 18", studio: "Studio A", date: "2026-10-09", start: "09:00", end: "11:00", status: "In session" },
  { id: "MPL-1032", client: "Sara Khalid", session: "The Founder’s Table · Episode 17", studio: "Studio A", date: "2026-10-02", start: "10:00", end: "12:00", status: "Completed" },
  { id: "MPL-1019", client: "Sara Khalid", session: "The Founder’s Table · Episode 16", studio: "Studio A", date: "2026-09-24", start: "13:00", end: "15:00", status: "Completed" },
  { id: "MPL-1049", client: "Omar Al Nuaimi", session: "Brand Story Podcast · Interview", studio: "Studio B", date: "2026-10-09", start: "11:30", end: "13:00", status: "Confirmed" },
  { id: "MPL-1026", client: "Omar Al Nuaimi", session: "Brand Story Podcast · Ep. 11", studio: "Studio B", date: "2026-09-30", start: "14:00", end: "15:30", status: "Completed" },
  { id: "MPL-1050", client: "Noura Creative", session: "Campaign voice-over recording", studio: "Studio A", date: "2026-10-09", start: "14:00", end: "16:00", status: "Confirmed" },
  { id: "MPL-1031", client: "Noura Creative", session: "Product launch voice-over", studio: "Studio A", date: "2026-10-01", start: "09:30", end: "11:00", status: "Completed" },
  { id: "MPL-1051", client: "Majid Fahad", session: "Creator membership session", studio: "Studio B", date: "2026-10-09", start: "16:30", end: "17:30", status: "Pending" },
];
const currency = (amount: number) => `AED ${amount.toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function Heading({ eyebrow, title, subtitle, action }: { eyebrow: string; title: string; subtitle: string; action?: ReactNode }) {
  return <div className="module-heading"><div><div className="module-eyebrow">{eyebrow}</div><h1>{title}</h1><p>{subtitle}</p></div>{action}</div>;
}

export function ClientProfileWorkspace({ clientId, onNotify }: Props & { clientId: string }) {
  const router = useRouter();
  const [client, setClient] = useState<ClientRecord | null>(null);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [tab, setTab] = useState("Overview");
  const [profileError, setProfileError] = useState("");

  useEffect(() => {
    let active = true;
    const timeout = window.setTimeout(() => {
      const loaded = isSupabaseConfigured() ? listOrganizationClients() : Promise.resolve(loadClients());
      void loaded.then((clientRecords) => {
      if (!active) return;
      const record = clientRecords.find((item) => item.id === clientId) ?? null;
      setClient(record);
      const paymentRows = loadPayments().filter((payment) => payment.clientId === clientId);
      setPayments(paymentRows);
      const storedBookings = JSON.parse(window.localStorage.getItem("mpl-bookings") ?? "[]") as BookingItem[];
      const bookingLoad = isSupabaseConfigured() ? listOrganizationBookings() : Promise.resolve([...storedBookings, ...sampleHistory]);
      const paymentLoad = isSupabaseConfigured() ? listOrganizationPayments(clientId) : Promise.resolve(paymentRows);
      void Promise.all([bookingLoad, paymentLoad]).then(([allBookings, clientPayments]) => {
        if (!active) return;
        setBookings(allBookings.filter((item) => item.client === record?.name));
        setPayments(clientPayments);
      }).catch((cause: unknown) => { if (active) setProfileError(cause instanceof Error ? cause.message : "Could not load client history."); });
      }).catch((cause: unknown) => { if (active) { setClient(null); setProfileError(cause instanceof Error ? cause.message : "Could not load client profile."); } });
    }, 0);
    return () => { active = false; window.clearTimeout(timeout); };
  }, [clientId]);

  const totalPaid = payments.filter((payment) => payment.status === "Paid").reduce((sum, payment) => sum + payment.amount, 0);
  if (!client) return <div className="module-workspace"><Heading eyebrow="CLIENT PROFILE" title={profileError ? "Profile unavailable" : "Client not found"} subtitle={profileError || "This client may have been removed or is not available in this workspace."} action={<button className="secondary-button" onClick={() => router.push("/clients")}><ArrowLeft size={15} /> Back to clients</button>} /><div className="module-card profile-empty"><UserRound size={24} /><p>Choose a client from the directory to see their profile.</p></div></div>;

  return <div className="module-workspace profile-workspace">
    <button className="back-link" onClick={() => router.push("/clients")}><ArrowLeft size={14} /> All clients</button>
    <div className="profile-hero"><LocalPhoto mediaId={client.photoId} alt={`${client.name} profile photo`} className={`profile-large-avatar ${client.tone}`} fallback={client.initials} /><div className="profile-identity"><div className="module-eyebrow">CLIENT PROFILE · {client.id}</div><h1>{client.name}</h1><p>{client.company}</p><div className="profile-contact-pills"><span><Mail size={14} />{client.email}</span><span><UserRound size={14} />{client.phone}</span></div></div><div className="profile-actions"><label className="secondary-button profile-photo-action"><Upload size={14} /> Change photo<input type="file" accept="image/png,image/jpeg,image/webp" onChange={async (event) => { const file = event.target.files?.[0]; if (!file) return; if (file.size > 5 * 1024 * 1024) { onNotify("Client photos must be smaller than 5 MB."); return; } try { const photoId = isSupabaseConfigured() ? await uploadOrganizationFile("client-media", file) : await storeMedia(file); const updated = { ...client, photoId }; if (isSupabaseConfigured()) await updateOrganizationClientPhoto(client.id, photoId); else saveClients(loadClients().map((item) => item.id === client.id ? updated : item)); setClient(updated); onNotify("Client photo updated."); } catch (cause) { onNotify(cause instanceof Error ? cause.message : "The photo could not be saved."); } }} /></label><button className="primary-button" onClick={() => { window.sessionStorage.setItem("mpl-payment-client", client.id); router.push("/payments"); }}><Plus size={15} /> New payment</button></div></div>
    <div className="profile-kpi-grid"><article><span>Total bookings</span><strong>{isSupabaseConfigured() ? bookings.length : Math.max(client.sessions, bookings.length)}</strong><small><CalendarDays size={13} /> Studio sessions</small></article><article><span>Payments recorded</span><strong>{payments.length}</strong><small><ReceiptText size={13} /> {currency(totalPaid)} paid</small></article><article><span>Membership</span><strong>{isSupabaseConfigured() ? "View plans" : client.sessions >= 10 ? "Professional" : "—"}</strong><small><Clock3 size={13} /> {isSupabaseConfigured() ? "See memberships workspace" : client.sessions >= 10 ? "Illustrative plan" : "No active plan"}</small></article><article><span>Client since</span><strong>{client.createdAt ? new Date(client.createdAt).getFullYear() : "—"}</strong><small><CircleDollarSign size={13} /> Studio client</small></article></div>
    {profileError && <div className="database-error-banner" role="alert">Database connection: {profileError}</div>}
    <div className="profile-tabs">{["Overview", "Bookings", "Payments", "Notes & documents"].map((value) => <button key={value} className={tab === value ? "profile-tab-active" : ""} onClick={() => setTab(value)}>{value}{value === "Bookings" ? ` (${bookings.length})` : value === "Payments" ? ` (${payments.length})` : ""}</button>)}</div>
    {tab === "Overview" && <div className="profile-panels"><section className="module-card profile-details-card"><div className="profile-section-heading"><div><strong>Contact details</strong><small>Client and billing information</small></div><UserRound size={17} /></div><dl className="client-detail-list"><div><dt>Contact person</dt><dd>{client.name}</dd></div><div><dt>Company</dt><dd>{client.company}</dd></div><div><dt>Email address</dt><dd>{client.email}</dd></div><div><dt>Phone number</dt><dd>{client.phone}</dd></div><div><dt>Emirate</dt><dd>{client.emirate ?? "Not provided"}</dd></div><div><dt>VAT number</dt><dd>{client.vatNumber ?? "Not provided"}</dd></div></dl>{client.notes && <div className="client-note"><strong>Client notes</strong><p>{client.notes}</p></div>}</section><section className="module-card profile-history-card"><div className="profile-section-heading"><div><strong>Recent bookings</strong><small>Latest studio sessions</small></div><button onClick={() => setTab("Bookings")}>View all <ArrowRight size={14} /></button></div>{bookings.slice(0, 4).map((booking) => <div className="profile-booking-row" key={booking.id}><span className="profile-booking-date">{new Date(`${booking.date}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span><span className="profile-booking-main"><strong>{booking.session}</strong><small>{booking.studio} · {booking.start}–{booking.end}</small></span><span className={`profile-status ${booking.status === "Completed" ? "profile-status-complete" : ""}`}>{booking.status}</span></div>)}{!bookings.length && <div className="profile-empty-small">No booking history recorded yet.</div>}</section></div>}
    {tab === "Bookings" && <section className="module-card profile-table-card"><div className="profile-section-heading"><div><strong>Booking history</strong><small>All studio reservations for {client.name}</small></div><button className="primary-button" onClick={() => { window.sessionStorage.setItem("mpl-booking-client", client.id); router.push("/bookings/new"); }}><Plus size={14} /> Book session</button></div>{bookings.length ? <div className="booking-list-table"><table className="module-table"><thead><tr><th>BOOKING</th><th>SESSION</th><th>STUDIO</th><th>DATE & TIME</th><th>STATUS</th></tr></thead><tbody>{bookings.map((booking) => <tr key={booking.id}><td>{displayBookingId(booking.id)}</td><td>{booking.session}</td><td>{booking.studio}</td><td>{booking.date}<small className="table-subline">{booking.start}–{booking.end}</small></td><td>{booking.status}</td></tr>)}</tbody></table></div> : <div className="profile-empty-small">No booking history recorded yet.</div>}</section>}
    {tab === "Payments" && <section className="module-card profile-table-card"><div className="profile-section-heading"><div><strong>Payment history</strong><small>Invoices and receipts for {client.name}</small></div><button className="primary-button" onClick={() => { window.sessionStorage.setItem("mpl-payment-client", client.id); router.push("/payments"); }}><Plus size={14} /> Record payment</button></div>{payments.length ? <div className="booking-list-table"><table className="module-table"><thead><tr><th>INVOICE</th><th>DATE</th><th>METHOD</th><th>AMOUNT</th><th>STATUS</th><th>RECEIPT</th></tr></thead><tbody>{payments.map((payment) => <tr key={payment.id}><td>{payment.invoice}</td><td>{new Date(payment.createdAt).toLocaleDateString("en-AE")}</td><td>{payment.method}</td><td>{currency(payment.amount)}</td><td>{payment.status}</td><td>{payment.receiptName ?? "—"}</td></tr>)}</tbody></table></div> : <div className="profile-empty-small">No payments recorded yet.</div>}</section>}
    {tab === "Notes & documents" && <section className="module-card profile-details-card"><div className="profile-section-heading"><div><strong>Notes & documents</strong><small>Client notes and payment receipts</small></div><FileText size={17} /></div><div className="client-note"><strong>Notes</strong><p>{client.notes ?? "No notes have been added for this client."}</p></div><div className="profile-document-list">{payments.filter((payment) => payment.receiptName).map((payment) => <div key={payment.id}><ReceiptText size={16} /><span><strong>{payment.receiptName}</strong><small>{payment.invoice} · {currency(payment.amount)}</small></span><span className="document-local-label">{isSupabaseConfigured() ? "Private receipt" : "Local receipt"}</span></div>)}{!payments.some((payment) => payment.receiptName) && <div className="profile-empty-small">No receipts uploaded for this client.</div>}</div></section>}
    <div className="module-note">{isSupabaseConfigured() ? "Client activity is saved to this studio workspace. Payment processing is not connected." : "Client activity is stored in this browser only. No external profile or billing system is connected."}</div>
  </div>;
}

export function PaymentsWorkspace({ clients, onNotify }: Props & { clients: ClientRecord[] }) {
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [method, setMethod] = useState<"Cash" | "Card">("Card");
  const [paymentStatus, setPaymentStatus] = useState<PaymentRecord["status"]>("Unpaid");
  const [processing, setProcessing] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [paymentLink, setPaymentLink] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All payments");
  const router = useRouter();
  const remoteMode = isSupabaseConfigured();

  useEffect(() => {
    let active = true;
    const timeout = window.setTimeout(() => {
      const paymentLoad = remoteMode ? listOrganizationPayments() : Promise.resolve(loadPayments());
      void paymentLoad.then((rows) => { if (active) setPayments(rows); }).catch((cause: unknown) => { if (active) setLoadError(cause instanceof Error ? cause.message : "Could not load payments."); });
      const presetClient = window.sessionStorage.getItem("mpl-payment-client");
      if (presetClient) {
        setSelectedClientId(presetClient);
        setShowForm(true);
        window.sessionStorage.removeItem("mpl-payment-client");
      }
    }, 0);
    return () => { active = false; window.clearTimeout(timeout); };
  }, [remoteMode]);

  const filtered = useMemo(() => payments.filter((payment) => `${payment.invoice} ${payment.clientName} ${payment.method}`.toLowerCase().includes(query.toLowerCase()) && (filter === "All payments" || payment.status === filter)), [payments, query, filter]);
  const totalPaid = payments.filter((payment) => payment.status === "Paid").reduce((sum, payment) => sum + payment.amount, 0);
  const outstanding = payments.filter((payment) => payment.status === "Unpaid" || payment.status === "Partially paid").reduce((sum, payment) => sum + payment.amount, 0);
  const selectedClient = clients.find((client) => client.id === selectedClientId);

  const sendPaymentEmail = () => {
    if (!selectedClient?.email || !paymentLink) return;
    const subject = encodeURIComponent("Studio payment link");
    const body = encodeURIComponent(`Hello ${selectedClient.name},\n\nPlease complete your payment using this link:\n${paymentLink}\n\nThank you,\nStudio Operations`);
    window.location.href = `mailto:${encodeURIComponent(selectedClient.email)}?subject=${subject}&body=${body}`;
    onNotify("Email draft opened. Review and send it in your mail app; no message has been sent yet.");
  };

  const copyPaymentLink = async () => {
    if (!paymentLink) return;
    try {
      await navigator.clipboard.writeText(paymentLink);
      onNotify("Payment link copied. Share it with the client when ready.");
    } catch {
      onNotify("Clipboard access is unavailable. Select and copy the payment link manually.");
    }
  };

  const submitPayment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (processing) return;
    setError("");
    const form = new FormData(event.currentTarget);
    const amount = Number(form.get("amount"));
    const invoice = String(form.get("invoice")).trim();
    if (!selectedClient) { setError("Select a client to link this payment to."); return; }
    if (!Number.isFinite(amount) || amount <= 0) { setError("Enter an amount greater than zero."); return; }
    if (method === "Card" && paymentLink && !/^https:\/\//i.test(paymentLink)) { setError("Payment links must start with https://."); return; }
    if (receiptFile && receiptFile.size > 8 * 1024 * 1024) { setError("Receipt files must be smaller than 8 MB."); return; }
    setProcessing(true);
    let receiptId: string | undefined;
    try {
      if (receiptFile) receiptId = remoteMode ? await uploadOrganizationFile("payment-receipts", receiptFile) : await storeReceipt(receiptFile);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : remoteMode ? "Could not upload the receipt." : "Could not store that receipt in this browser.");
      setProcessing(false);
      return;
    }
    let payment: PaymentRecord;
    try {
      payment = remoteMode
        ? await recordOrganizationPayment({ clientId: selectedClient.id, invoice, amount, method, status: paymentStatus, ...(method === "Card" && paymentLink ? { paymentLink } : {}), ...(receiptId ? { receiptPath: receiptId.split(":").slice(1).join(":") } : {}) })
        : { id: crypto.randomUUID(), invoice, clientId: selectedClient.id, clientName: selectedClient.name, amount, method, status: paymentStatus, createdAt: new Date().toISOString(), ...(method === "Card" && paymentLink ? { paymentLink } : {}), ...(receiptFile && receiptId ? { receiptId, receiptName: receiptFile.name } : {}) };
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save the payment record.");
      setProcessing(false);
      return;
    }
    const next = [payment, ...payments];
    setPayments(next);
    if (!remoteMode) savePayments(next);
    setReceiptFile(null);
    setPaymentLink("");
    setShowForm(false);
    setProcessing(false);
    onNotify(`${invoice} recorded for ${selectedClient.name}. No payment was processed.`);
  };

  const openReceipt = async (payment: PaymentRecord) => {
    if (!payment.receiptId) return;
    try {
      if (remoteMode || payment.receiptId.includes(":")) {
        const url = await getOrganizationFileUrl(payment.receiptId);
        if (!url) throw new Error("Receipt URL is missing.");
        window.open(url, "_blank", "noopener,noreferrer");
      } else {
        const receipt = await openStoredReceipt(payment.receiptId);
        const url = URL.createObjectURL(receipt);
        window.open(url, "_blank", "noopener,noreferrer");
        window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      }
    } catch {
      onNotify(remoteMode ? "Could not open the private receipt file." : "Could not open the local receipt file.");
    }
  };

  const updateStatus = (id: string, status: PaymentRecord["status"]) => {
    const next = payments.map((payment) => payment.id === id ? { ...payment, status } : payment);
    setPayments(next);
    if (remoteMode) void updateOrganizationPaymentStatus(id, status).catch((cause: unknown) => { setPayments(payments); onNotify(cause instanceof Error ? cause.message : "Could not update payment status."); });
    else savePayments(next);
  };

  return <div className="module-workspace payment-workspace">
    <Heading eyebrow="FINANCE / CLIENT BILLING" title="Payments & invoices" subtitle="Record client payments, attach receipts, and prepare card payment requests." action={<button className="primary-button" onClick={() => setShowForm((open) => !open)}><Plus size={16} /> Record payment</button>} />
    <div className="payment-summary-grid"><article><span>{remoteMode ? "Recorded as paid" : "Paid in this browser"}</span><strong>{currency(totalPaid)}</strong><small><CircleDollarSign size={13} /> From {payments.filter((payment) => payment.status === "Paid").length} recorded payments</small></article><article><span>Outstanding</span><strong>{currency(outstanding)}</strong><small><Clock3 size={13} /> {payments.filter((payment) => payment.status === "Unpaid" || payment.status === "Partially paid").length} unpaid or partial</small></article><article><span>Receipts attached</span><strong>{payments.filter((payment) => payment.receiptName).length}</strong><small><ReceiptText size={13} /> {remoteMode ? "Private studio storage" : "Stored locally in this browser"}</small></article></div>
    {showForm && <form className="payment-create-card" onSubmit={submitPayment}>
      <div className="payment-form-heading"><div><span className="payment-form-icon"><ReceiptText size={17} /></span><span><strong>Record client payment</strong><small>Link an invoice to a client and document how it will be paid.</small></span></div><button type="button" className="modal-close-inline" aria-label="Close payment form" onClick={() => setShowForm(false)}><X size={17} /></button></div>
      <div className="payment-form-grid">
        <label className="field-label">Client<select value={selectedClientId} onChange={(event) => setSelectedClientId(event.target.value)} required><option value="" disabled>Select a client</option>{clients.map((client) => <option value={client.id} key={client.id}>{client.name} · {client.company}</option>)}</select></label>
        <label className="field-label">Invoice number<input name="invoice" required defaultValue={`INV-${new Date().getFullYear()}-${String(payments.length + 1025).padStart(4, "0")}`} /></label>
        <label className="field-label">Amount (AED)<div className="amount-input-wrap"><span>AED</span><input name="amount" type="number" min="0.01" step="0.01" required placeholder="0.00" /></div></label>
        <label className="field-label">Payment status<select name="status" value={paymentStatus} onChange={(event) => setPaymentStatus(event.target.value as PaymentRecord["status"])}><option>Paid</option><option>Unpaid</option><option>Partially paid</option><option>Refunded</option></select></label>
      </div>
      <div className="payment-method-section"><div className="payment-method-label">Payment method</div><div className="payment-method-options"><button type="button" className={`payment-method-option ${method === "Cash" ? "payment-method-active" : ""}`} onClick={() => { setMethod("Cash"); setPaymentStatus("Paid"); }}><span><Banknote size={18} /></span><strong>Cash</strong><small>In-person payment</small>{method === "Cash" && <Check size={15} />}</button><button type="button" className={`payment-method-option ${method === "Card" ? "payment-method-active" : ""}`} onClick={() => { setMethod("Card"); setPaymentStatus("Unpaid"); }}><span><CreditCard size={18} /></span><strong>Card</strong><small>External payment link</small>{method === "Card" && <Check size={15} />}</button></div></div>
      {method === "Card" && <div className="payment-link-panel"><div className="payment-link-title"><CreditCard size={16} /><span><strong>Card payment link</strong><small>Paste a checkout link created in your approved payment provider.</small></span></div><label className="field-label">Provider checkout URL<input type="url" value={paymentLink} onChange={(event) => setPaymentLink(event.target.value)} placeholder="https://…" /></label><div className="payment-link-actions"><button type="button" className="secondary-button" disabled={!paymentLink} onClick={copyPaymentLink}><Copy size={14} /> Copy link</button><button type="button" className="secondary-button" disabled={!selectedClient?.email || !paymentLink} onClick={sendPaymentEmail}><Mail size={14} /> Prepare email</button>{selectedClient && <small>To: {selectedClient.email || "No email address on file"}</small>}</div><p className="payment-safety-note">This prototype does not create a provider link or send email. You must create the checkout link with your payment provider; Prepare email opens a draft for you to review.</p></div>}
      <div className="receipt-upload-section"><label className="field-label">Receipt attachment <span className="optional-label">Optional · PDF, JPG or PNG · max 8 MB</span></label><label className={`receipt-dropzone ${receiptFile ? "receipt-file-selected" : ""}`}><input type="file" accept="application/pdf,image/jpeg,image/png" onChange={(event) => setReceiptFile(event.target.files?.[0] ?? null)} /><span className="receipt-upload-icon">{receiptFile ? <Check size={18} /> : <Upload size={18} />}</span><span><strong>{receiptFile ? receiptFile.name : "Choose a receipt to attach"}</strong><small>{receiptFile ? `${(receiptFile.size / 1024).toFixed(0)} KB · ${remoteMode ? "Private studio storage" : "Stored only in this browser"}` : "Browse files or use the file picker"}</small></span><Paperclip size={16} /></label></div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="payment-form-footer"><span><CircleDollarSign size={14} /> {remoteMode ? "Payment record only · card provider is not connected" : "Prototype record only · no charge will be made"}</span><div><button type="button" className="secondary-button" disabled={processing} onClick={() => setShowForm(false)}>Cancel</button><button className="primary-button" disabled={processing}><Check size={15} /> {processing ? "Saving…" : "Save payment record"}</button></div></div>
    </form>}
    {loadError && <div className="database-error-banner" role="alert">Database connection: {loadError}</div>}
    <section className="module-card payment-ledger"><div className="module-toolbar"><div><strong className="toolbar-title">Payment ledger</strong><span className="toolbar-count">{payments.length} records</span></div><div className="module-tools"><label className="module-search"><Search size={15} /><input aria-label="Search payments" placeholder="Search invoice or client" value={query} onChange={(event) => setQuery(event.target.value)} /></label><label className="filter-select"><select value={filter} onChange={(event) => setFilter(event.target.value)}><option>All payments</option><option>Paid</option><option>Unpaid</option><option>Partially paid</option><option>Refunded</option></select><ChevronDown size={13} /></label></div></div>{filtered.length ? <div className="booking-list-table"><table className="module-table payment-ledger-table"><thead><tr><th>INVOICE</th><th>CLIENT</th><th>DATE</th><th>METHOD</th><th>AMOUNT</th><th>STATUS</th><th>RECEIPT</th><th /></tr></thead><tbody>{filtered.map((payment) => <tr key={payment.id}><td><strong>{payment.invoice}</strong></td><td><button className="payment-client-link" onClick={() => router.push(`/clients/${payment.clientId}`)}>{payment.clientName}<ExternalLink size={12} /></button></td><td>{new Date(payment.createdAt).toLocaleDateString("en-AE")}</td><td><span className="payment-method-badge">{payment.method === "Cash" ? <Banknote size={14} /> : <CreditCard size={14} />}{payment.method}</span></td><td><strong>{currency(payment.amount)}</strong></td><td><select className={`status-select payment-status-${payment.status.toLowerCase().replaceAll(" ", "-")}`} value={payment.status} onChange={(event) => updateStatus(payment.id, event.target.value as PaymentRecord["status"])} aria-label={`Status for ${payment.invoice}`}><option>Paid</option><option>Unpaid</option><option>Partially paid</option><option>Refunded</option></select></td><td>{payment.receiptName ? <button className="receipt-open-button" onClick={() => void openReceipt(payment)}><ReceiptText size={14} /> Open</button> : <span className="no-receipt">—</span>}</td><td>{payment.paymentLink && <button className="small-text-button" onClick={() => { void navigator.clipboard.writeText(payment.paymentLink ?? "").then(() => onNotify("Payment link copied."), () => onNotify("Select and copy the payment link from the client record.")); }}><Copy size={13} /></button>}</td></tr>)}</tbody></table></div> : <div className="payment-empty-state"><span><ReceiptText size={21} /></span><strong>{payments.length ? "No payments match those filters" : "No payment records yet"}</strong><p>Record a cash or card payment to add it to the client-linked ledger.</p>{!payments.length && <button className="secondary-button" onClick={() => setShowForm(true)}><Plus size={14} /> Record the first payment</button>}</div>}</section>
    <div className="module-note"><CircleDollarSign size={14} /> {remoteMode ? "Payment records and receipts are saved to this studio workspace. No cash/card provider is connected; entries only document payment status." : "Payment and receipt data is kept in this browser only. Cash/card provider processing and receipt cloud storage are not connected."}</div>
  </div>;
}
