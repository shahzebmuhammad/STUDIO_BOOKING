"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { CalendarWorkspace, MembershipWorkspace, ReportsWorkspace, TeamTasksWorkspace } from "@/components/OperationsWorkspaces";
import { ClientProfileWorkspace, PaymentsWorkspace } from "@/components/CustomerFinanceWorkspaces";
import LocalPhoto from "@/components/LocalPhoto";
import { loadClients, saveClients, seedClients, storeMedia } from "@/lib/prototype-data";
import type { ClientRecord } from "@/lib/prototype-data";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createOrganizationBooking, createOrganizationClient, createOrganizationEpisode, createOrganizationEquipment, listOrganizationBookings, listOrganizationClients, listOrganizationEquipment, listOrganizationEpisodes, updateOrganizationBookingStatus, updateOrganizationEpisodeStatus, updateOrganizationEquipmentStatus } from "@/lib/supabase/actions";
import { uploadOrganizationFile } from "@/lib/supabase/storage";
import {
  ArrowLeft, ArrowRight, CalendarDays, Check, ChevronDown, Clock3,
  FileAudio2, Filter, Headphones, LayoutGrid, List, Plus, Search, Wrench, X,
} from "lucide-react";

type Booking = {
  id: string;
  client: string;
  session: string;
  studio: string;
  date: string;
  start: string;
  end: string;
  status: string;
  initials: string;
  package?: string;
  assignedStaff?: string;
  requests?: string;
};

type Props = { activePage: string; pathname: string; onNotify: (message: string) => void };

const seedBookings: Booking[] = [
  { id: "MPL-1048", client: "Sara Khalid", session: "The Founder’s Table · Episode 18", studio: "Studio A", date: "2026-10-09", start: "09:00", end: "11:00", status: "In session", initials: "SK" },
  { id: "MPL-1049", client: "Omar Al Nuaimi", session: "Brand Story Podcast · Interview", studio: "Studio B", date: "2026-10-09", start: "11:30", end: "13:00", status: "Confirmed", initials: "OA" },
  { id: "MPL-1050", client: "Noura Creative", session: "Campaign voice-over recording", studio: "Studio A", date: "2026-10-09", start: "14:00", end: "16:00", status: "Confirmed", initials: "NC" },
  { id: "MPL-1051", client: "Majid Fahad", session: "Creator membership session", studio: "Studio B", date: "2026-10-09", start: "16:30", end: "17:30", status: "Pending", initials: "MF" },
];

const clients = seedClients;

const initialEquipment = [
  { name: "Sony FX3 Cinema Line", category: "Camera · Studio A", serial: "CAM-04-8821", status: "In Use" },
  { name: "Shure SM7B", category: "Microphone · Studio A", serial: "MIC-12-0439", status: "Available" },
  { name: "RØDECaster Pro II", category: "Mixer · Studio B", serial: "MIX-02-1904", status: "Available" },
  { name: "Aputure 300D II", category: "Lighting · Studio B", serial: "LGT-07-2318", status: "Maintenance" },
  { name: "Beyerdynamic DT 770 Pro", category: "Headphones · Studio A", serial: "HP-18-0127", status: "Available" },
  { name: "Canon EOS R6 Mark II", category: "Camera · Studio B", serial: "CAM-09-5512", status: "Available" },
];

type EquipmentRecord = (typeof initialEquipment)[number] & { id?: string; photoId?: string };

const EQUIPMENT_KEY = "mpl-equipment";
function saveEquipment(items: EquipmentRecord[]) {
  window.localStorage.setItem(EQUIPMENT_KEY, JSON.stringify(items));
}

const initialEpisodes = [
  { name: "Building Brands That Last", show: "The Founder’s Table", client: "Sara Khalid", editor: "Yousef K.", date: "Oct 8, 2026", status: "Editing" },
  { name: "A Different Kind of Growth", show: "Brand Story Podcast", client: "Omar Al Nuaimi", editor: "Layla A.", date: "Oct 7, 2026", status: "Review" },
  { name: "Designing for Real Life", show: "Noura Creative Sessions", client: "Noura Creative", editor: "Yousef K.", date: "Oct 6, 2026", status: "Recorded" },
  { name: "The Creator Economy in 2026", show: "The Founder’s Table", client: "Sara Khalid", editor: "Layla A.", date: "Oct 5, 2026", status: "Approved" },
];
type EpisodeRecord = (typeof initialEpisodes)[number] & { id?: string };

const statusOptions = ["Inquiry", "Quote Sent", "Pending Payment", "Confirmed", "Completed", "Cancelled", "No Show"];
const bookingDurations = [30, 60, 90, 120, 180, 240];
const displayBookingId = (id: string) => id.replace(/^MPL-/, "BK-");

function PageHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return <div className="module-heading"><div><div className="module-eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>{action}</div>;
}

function ViewSwitcher({ value, onChange }: { value: "cards" | "list"; onChange: (view: "cards" | "list") => void }) {
  return <div className="floating-view-switch" role="group" aria-label="Change layout"><button className={value === "cards" ? "view-switch-active" : ""} aria-label="Card view" onClick={() => onChange("cards")}><LayoutGrid size={15} /></button><button className={value === "list" ? "view-switch-active" : ""} aria-label="List view" onClick={() => onChange("list")}><List size={15} /></button></div>;
}

function TimePicker({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  const toLabel = (time: string) => {
    const [hour, minute] = time.split(":").map(Number);
    return `${hour % 12 || 12}:${String(minute).padStart(2, "0")} ${hour >= 12 ? "PM" : "AM"}`;
  };
  return <label className="field-label time-picker-field"><span>{label}</span><span className="time-picker-control"><span className="time-picker-clock"><Clock3 size={17} /></span><select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} disabled={!options.length}><option value="" disabled>{options.length ? "Select time" : "No available time"}</option>{options.map((time) => <option key={time} value={time}>{toLabel(time)}</option>)}</select><ChevronDown size={15} /></span></label>;
}

function NewBooking({ onSaved, clients: clientOptions, bookings, useDatabase }: { onSaved: (booking: Booking) => void; clients: ClientRecord[]; bookings: Booking[]; useDatabase: boolean }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [start, setStart] = useState("10:00");
  const [end, setEnd] = useState("12:00");
  const [date, setDate] = useState("2026-10-10");
  const [selectedClientName, setSelectedClientName] = useState("");
  const [duration, setDuration] = useState<number | null>(120);
  const [studio, setStudio] = useState("Studio A");
  const [confirmedBooking, setConfirmedBooking] = useState<Booking | null>(null);
  const [saving, setSaving] = useState(false);

  const overlaps = (startTime: string, endTime: string) => bookings.some((booking) => booking.date === date && booking.studio === studio && !["Cancelled", "No Show"].includes(booking.status) && startTime < booking.end && endTime > booking.start);
  const validDurations = useCallback((startTime: string) => bookingDurations.filter((minutes) => {
    if (!/^\d{2}:\d{2}$/.test(startTime)) return false;
    const [hours, mins] = startTime.split(":").map(Number);
    const endMinutes = hours * 60 + mins + minutes;
    if (endMinutes > 22 * 60) return false;
    const endTime = `${String(Math.floor(endMinutes / 60)).padStart(2, "0")}:${String(endMinutes % 60).padStart(2, "0")}`;
    return !bookings.some((booking) => booking.date === date && booking.studio === studio && !["Cancelled", "No Show"].includes(booking.status) && startTime < booking.end && endTime > booking.start);
  }), [bookings, date, studio]);
  const startOptions = useMemo(() => Array.from({ length: 29 }, (_, index) => {
    const total = 8 * 60 + index * 30;
    return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
  }).filter((slot) => validDurations(slot).includes(duration ?? 30)), [duration, validDurations]);
  const endOptions = useMemo(() => start ? validDurations(start).map((minutes) => {
    const [hours, mins] = start.split(":").map(Number);
    const total = hours * 60 + mins + minutes;
    return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
  }) : [], [start, validDurations]);

  useEffect(() => {
    const nextStart = startOptions.includes(start) ? start : startOptions[0] ?? "";
    const nextDuration = nextStart ? validDurations(nextStart).includes(duration ?? 30) ? (duration ?? 30) : validDurations(nextStart)[0] : null;
    const nextEnd = nextStart && nextDuration ? (() => {
      const [hours, mins] = nextStart.split(":").map(Number);
      const total = hours * 60 + mins + nextDuration;
      return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
    })() : "";
    const timeout = window.setTimeout(() => {
      if (nextStart !== start) setStart(nextStart);
      if (nextDuration !== duration) setDuration(nextDuration);
      if (nextEnd !== end) setEnd(nextEnd);
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [date, studio, startOptions, duration, start, end, validDurations]);

  useEffect(() => {
    const chosenDate = window.sessionStorage.getItem("mpl-booking-date");
    const chosenClientId = window.sessionStorage.getItem("mpl-booking-client");
    const selectedClient = chosenClientId ? clientOptions.find((client) => client.id === chosenClientId) : undefined;
    if (chosenClientId && !selectedClient && useDatabase) return;
    if (chosenDate) window.sessionStorage.removeItem("mpl-booking-date");
    if (chosenClientId) window.sessionStorage.removeItem("mpl-booking-client");
    if (!chosenDate && !selectedClient) return;
    const timeout = window.setTimeout(() => {
      if (chosenDate) setDate(chosenDate);
      if (selectedClient) setSelectedClientName(selectedClient.name);
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [clientOptions, useDatabase]);

  const applyDuration = (minutes: number, baseStart = start) => {
    const [hours, mins] = baseStart.split(":").map(Number);
    const endMinutes = (hours * 60 + mins + minutes) % (24 * 60);
    setEnd(`${String(Math.floor(endMinutes / 60)).padStart(2, "0")}:${String(endMinutes % 60).padStart(2, "0")}`);
    setDuration(minutes);
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    if (end <= start) {
      setError("Choose an end time later than the start time.");
      return;
    }
    if (!start || !end || overlaps(start, end)) { setError("That slot is no longer available. Choose another open time."); return; }
    const clientName = String(form.get("client")).trim();
    const selectedClient = clientOptions.find((client) => client.name === clientName);
    if (!selectedClient) { setError("Choose a client from the list."); return; }
    if (useDatabase) {
      setSaving(true);
      try {
        const booking = await createOrganizationBooking({ clientId: selectedClient.id, session: String(form.get("session")), studio, date, start, end, packageName: String(form.get("package")), specialRequests: String(form.get("requests") || "") });
        onSaved(booking);
        setConfirmedBooking(booking);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Could not save booking to the database.");
      } finally {
        setSaving(false);
      }
      return;
    }
    const savedBookings = JSON.parse(window.localStorage.getItem("mpl-bookings") ?? "[]") as Booking[];
    const latestBookings = [...bookings, ...savedBookings.filter((saved) => !bookings.some((booking) => booking.id === saved.id))];
    const slotTaken = latestBookings.some((booking) => booking.date === date && booking.studio === studio && !["Cancelled", "No Show"].includes(booking.status) && start < booking.end && end > booking.start);
    if (slotTaken) {
      setError("That slot was just booked. Please choose another available time.");
      return;
    }
    const client = clientName;
    const [first, last = ""] = client.split(/\s+/);
    const booking: Booking = {
      id: `BK-${Date.now().toString().slice(-6)}`,
      client,
      session: String(form.get("session")),
      studio,
      date,
      start,
      end,
      status: "Confirmed",
      initials: `${first?.[0] ?? "C"}${last?.[0] ?? ""}`.toUpperCase(),
      package: String(form.get("package")),
      assignedStaff: String(form.get("staff")),
      requests: String(form.get("requests") || "None"),
    };
    const existing = JSON.parse(window.localStorage.getItem("mpl-bookings") ?? "[]") as Booking[];
    window.localStorage.setItem("mpl-bookings", JSON.stringify([booking, ...existing]));
    onSaved(booking);
    setConfirmedBooking(booking);
  };

  return <>
    <PageHeading eyebrow="STUDIO SCHEDULE / NEW" title="Create a booking" description="Add a recording session to the studio calendar." />
    <form className="module-form booking-form" onSubmit={onSubmit}>
      <div className="form-section-title"><span className="form-section-icon"><CalendarDays size={16} /></span><div><strong>Session details</strong><small>Choose a client, studio, and time for this session.</small></div></div>
      <div className="form-grid">
        <label className="field-label field-wide">Client<select name="client" value={selectedClientName} onChange={(event) => setSelectedClientName(event.target.value)} required autoFocus><option value="" disabled>Select a client</option>{clientOptions.map((client) => <option key={client.id} value={client.name}>{client.name}{client.company ? ` · ${client.company}` : ""}</option>)}</select></label>
        <label className="field-label field-wide">Session / episode name<input name="session" placeholder="e.g. The Founder’s Table · Episode 19" required /></label>
        <label className="field-label">Studio<select name="studio" value={studio} onChange={(event) => setStudio(event.target.value)}><option>Studio A</option><option>Studio B</option></select></label>
        <label className="field-label">Session type<select name="type" defaultValue="Podcast recording"><option>Podcast recording</option><option>Video recording</option><option>Voice-over</option><option>Studio rental</option><option>Editing session</option></select></label>
        <label className="field-label">Date<input name="date" type="date" value={date} min="2026-10-09" onChange={(event) => setDate(event.target.value)} required /></label>
        <div className="time-picker-section"><div className="field-pair"><TimePicker label="Available start" value={start} options={startOptions} onChange={(value) => { setStart(value); const choices = validDurations(value); const selected = choices.includes(duration ?? 30) ? duration ?? 30 : choices[0]; if (selected) applyDuration(selected, value); else { setEnd(""); setDuration(null); } }} /><TimePicker label="Available end" value={end} options={endOptions} onChange={(value) => { setEnd(value); const difference = (Number(value.slice(0, 2)) * 60 + Number(value.slice(3))) - (Number(start.slice(0, 2)) * 60 + Number(start.slice(3))); setDuration(difference); }} /></div><div className="duration-tools"><span>OPEN DURATIONS</span>{[{ label: "30 min", value: 30 }, { label: "1 hour", value: 60 }, { label: "90 min", value: 90 }, { label: "2 hours", value: 120 }, { label: "3 hours", value: 180 }, { label: "4 hours", value: 240 }].map((item) => <button type="button" key={item.value} disabled={!validDurations(start).includes(item.value)} className={duration === item.value ? "duration-active" : ""} onClick={() => applyDuration(item.value)}>{item.label}</button>)}<strong><Clock3 size={13} /> {duration === null ? "No open slot" : duration >= 60 ? `${duration / 60} ${duration === 60 ? "hour" : "hours"}` : `${duration} min`}</strong></div><input type="hidden" name="start" value={start} /><input type="hidden" name="end" value={end} /><p className="availability-note"><Check size={13} /> Only available times for {studio} on this date are shown.</p></div>
        <label className="field-label">Package<select name="package" defaultValue="Standard studio session"><option>Standard studio session</option><option>Podcast production package</option><option>Membership hours</option><option>Custom quote</option></select></label>
        <label className="field-label">Assigned staff<select name="staff" defaultValue="Layla Al Ansari"><option>Layla Al Ansari</option><option>Yousef Khalifa</option><option>Malik Mansoor</option></select></label>
        <label className="field-label field-wide">Special requests<textarea name="requests" placeholder="Equipment, accessibility, or other session notes" rows={3} /></label>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="form-footer"><button type="button" className="secondary-button" onClick={() => router.push("/bookings")}><ArrowLeft size={15} /> Cancel</button><button type="submit" className="primary-button" disabled={!start || !end || saving}><Check size={15} /> {saving ? "Saving…" : "Confirm booking"}</button></div>
    </form>
    {confirmedBooking && <div className="booking-success-overlay"><section className="booking-success-dialog" role="dialog" aria-modal="true" aria-labelledby="booking-success-title"><button className="modal-close-inline" aria-label="Close confirmation" onClick={() => router.push("/bookings")}><X size={18} /></button><div className="success-confetti"><span>✦</span><span>✦</span><span>✦</span><span>✦</span><span className="success-check"><Check size={25} /></span></div><div className="module-eyebrow">STUDIO SESSION RESERVED</div><h2 id="booking-success-title">Booking confirmed!</h2><p>Your session is on the calendar. A confirmation can be sent from the booking record.</p><div className="success-booking-summary"><strong>{confirmedBooking.client}</strong><span>{confirmedBooking.session}</span><small><CalendarDays size={14} /> {confirmedBooking.date} <i /> <Clock3 size={14} /> {confirmedBooking.start}–{confirmedBooking.end}</small><small><Wrench size={14} /> {confirmedBooking.studio} <i /> {displayBookingId(confirmedBooking.id)}</small></div><div className="success-dialog-actions"><button className="secondary-button" onClick={() => router.push("/bookings")}>Back to bookings</button><button className="primary-button" onClick={() => router.push("/bookings/calendar")}>View calendar <ArrowRight size={15} /></button></div></section></div>}
  </>;
}

export default function ModuleWorkspace({ activePage, pathname, onNotify }: Props) {
  const router = useRouter();
  const [bookingRows, setBookingRows] = useState<Booking[]>(seedBookings);
  const [query, setQuery] = useState("");
  const [bookingFilter, setBookingFilter] = useState("All bookings");
  const [calendarMode, setCalendarMode] = useState("Day");
  const [equipment, setEquipment] = useState<EquipmentRecord[]>(initialEquipment);
  const [episodes, setEpisodes] = useState<EpisodeRecord[]>(initialEpisodes);
  const [clientRows, setClientRows] = useState<ClientRecord[]>(clients);
  const [clientView, setClientView] = useState<"cards" | "list">("cards");
  const [equipmentView, setEquipmentView] = useState<"cards" | "list">("cards");
  const [showClientForm, setShowClientForm] = useState(false);
  const [showEpisodeForm, setShowEpisodeForm] = useState(false);
  const [showEquipmentForm, setShowEquipmentForm] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [databaseError, setDatabaseError] = useState("");
  const remoteMode = isSupabaseConfigured();

  useEffect(() => {
    if (isSupabaseConfigured()) {
      let active = true;
      const timeout = window.setTimeout(() => {
        void listOrganizationBookings().then((rows) => { if (active) setBookingRows(rows); }).catch((cause: unknown) => { if (active) setDatabaseError(cause instanceof Error ? cause.message : "Could not load bookings from the database."); });
      }, 0);
      return () => { active = false; window.clearTimeout(timeout); };
    }
    const saved = window.localStorage.getItem("mpl-bookings");
    if (saved) {
      try {
        const additions = JSON.parse(saved) as Booking[];
        const timeout = window.setTimeout(() => setBookingRows([...additions, ...seedBookings]), 0);
        return () => window.clearTimeout(timeout);
      } catch {
        window.localStorage.removeItem("mpl-bookings");
      }
    }
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    let active = true;
    const timeout = window.setTimeout(() => {
      void listOrganizationEpisodes().then((rows) => { if (active) setEpisodes(rows); }).catch((cause: unknown) => { if (active) setDatabaseError(cause instanceof Error ? cause.message : "Could not load production episodes."); });
    }, 0);
    return () => { active = false; window.clearTimeout(timeout); };
  }, []);

  useEffect(() => {
    let active = true;
    const timeout = window.setTimeout(() => {
      const load = isSupabaseConfigured() ? listOrganizationClients() : Promise.resolve(loadClients());
      void load.then((rows) => { if (active) setClientRows(rows); }).catch((cause: unknown) => { if (active) setDatabaseError(cause instanceof Error ? cause.message : "Could not load clients from the database."); });
    }, 0);
    return () => { active = false; window.clearTimeout(timeout); };
  }, []);

  useEffect(() => {
    if (isSupabaseConfigured()) {
      let active = true;
      const timeout = window.setTimeout(() => {
        void listOrganizationEquipment().then((rows) => { if (active) setEquipment(rows); }).catch((cause: unknown) => { if (active) setDatabaseError(cause instanceof Error ? cause.message : "Could not load equipment from the database."); });
      }, 0);
      return () => { active = false; window.clearTimeout(timeout); };
    }
    const timeout = window.setTimeout(() => {
      try {
        const saved = JSON.parse(window.localStorage.getItem(EQUIPMENT_KEY) ?? "[]") as EquipmentRecord[];
        if (saved.length) setEquipment([...saved, ...initialEquipment.filter((item) => !saved.some((entry) => entry.serial === item.serial))]);
      } catch {
        window.localStorage.removeItem(EQUIPMENT_KEY);
      }
    }, 0);
    return () => window.clearTimeout(timeout);
  }, []);

  const filteredBookings = useMemo(() => bookingRows.filter((booking) => {
    const matchesSearch = `${booking.client} ${booking.session} ${booking.studio} ${booking.id}`.toLowerCase().includes(query.toLowerCase());
    const matchesFilter = bookingFilter === "All bookings" || booking.status === bookingFilter;
    return matchesSearch && matchesFilter;
  }), [bookingRows, bookingFilter, query]);

  const updateStatus = (id: string, status: string) => {
    const next = bookingRows.map((booking) => booking.id === id ? { ...booking, status } : booking);
    setBookingRows(next);
    if (remoteMode) {
      void updateOrganizationBookingStatus(id, status).catch((cause: unknown) => {
        setBookingRows(bookingRows);
        setDatabaseError(cause instanceof Error ? cause.message : "Could not update booking status.");
      });
      return;
    }
    const saved = next.filter((booking) => !seedBookings.some((seed) => seed.id === booking.id));
    window.localStorage.setItem("mpl-bookings", JSON.stringify(saved));
  };

  const totalClientSessions = clientRows.reduce((total, client) => total + client.sessions, 0);
  const clientsWithSessions = clientRows.filter((client) => client.sessions > 0);
  const returningClientPercent = clientsWithSessions.length ? Math.round(clientsWithSessions.filter((client) => client.sessions > 1).length / clientsWithSessions.length * 100) : 0;

  const changeEquipmentStatus = (item: EquipmentRecord, status: string) => {
    const recordId = item.id ?? item.serial;
    const updated = equipment.map((entry) => (entry.id ?? entry.serial) === recordId ? { ...entry, status } : entry);
    setEquipment(updated);
    if (remoteMode && item.id) {
      void updateOrganizationEquipmentStatus(item.id, status).catch((cause: unknown) => {
        setEquipment(equipment);
        setDatabaseError(cause instanceof Error ? cause.message : "Could not update equipment status.");
      });
    } else {
      saveEquipment(updated);
    }
  };

  if (pathname === "/bookings/new") return <div className="module-workspace"><NewBooking clients={clientRows} bookings={bookingRows} useDatabase={remoteMode} onSaved={(booking) => setBookingRows((current) => [booking, ...current])} /></div>;

  if (pathname === "/bookings/calendar") return <CalendarWorkspace onNotify={onNotify} />;

  if (pathname === "/tasks") return <TeamTasksWorkspace onNotify={onNotify} />;

  if (pathname === "/reports") return <ReportsWorkspace onNotify={onNotify} />;

  if (pathname === "/memberships") return <MembershipWorkspace clients={clientRows} onNotify={onNotify} />;

  if (pathname === "/payments") return <PaymentsWorkspace clients={clientRows} onNotify={onNotify} />;

  if (pathname.startsWith("/clients/")) return <ClientProfileWorkspace clientId={decodeURIComponent(pathname.slice("/clients/".length))} onNotify={onNotify} />;

  if (pathname === "/bookings") return <div className="module-workspace">
    <PageHeading eyebrow="STUDIO SCHEDULE" title="Bookings" description="Manage studio sessions, availability, and client reservations." action={<div className="heading-actions"><button className="secondary-button" onClick={() => router.push("/bookings/calendar")}><CalendarDays size={15} /> View calendar</button><button className="primary-button" onClick={() => router.push("/bookings/new")}><Plus size={16} /> New booking</button></div>} />
    {databaseError && <div className="database-error-banner" role="alert">Database connection: {databaseError}</div>}
    <div className="module-summary-grid"><div className="module-summary"><span>Today</span><strong>08 <small>sessions</small></strong><i className="summary-purple" /></div><div className="module-summary"><span>Awaiting confirmation</span><strong>03 <small>inquiries</small></strong><i className="summary-amber" /></div><div className="module-summary"><span>Studio utilization</span><strong>68<small>% this week</small></strong><i className="summary-green" /></div></div>
    <section className="module-card"><div className="module-toolbar"><div className="module-tabs">{["Day", "Week", "Month"].map((mode) => <button key={mode} className={calendarMode === mode ? "module-tab-active" : ""} onClick={() => setCalendarMode(mode)}>{mode}</button>)}</div><div className="module-tools"><label className="module-search"><Search size={15} /><input aria-label="Search bookings" placeholder="Search bookings" value={query} onChange={(event) => setQuery(event.target.value)} /></label><label className="filter-select"><Filter size={14} /><select value={bookingFilter} onChange={(event) => setBookingFilter(event.target.value)}><option>All bookings</option>{statusOptions.map((status) => <option key={status}>{status}</option>)}<option>In session</option></select><ChevronDown size={13} /></label></div></div>
      <div className="booking-list-table"><table className="module-table"><thead><tr><th>BOOKING</th><th>CLIENT & SESSION</th><th>STUDIO</th><th>DATE & TIME</th><th>STATUS</th><th /></tr></thead><tbody>{filteredBookings.map((booking) => <tr key={booking.id}><td><strong className="booking-id">{displayBookingId(booking.id)}</strong></td><td><div className="module-client"><span className="module-avatar">{booking.initials}</span><span><strong>{booking.client}</strong><small>{booking.session}</small></span></div></td><td>{booking.studio}</td><td><strong>{booking.date}</strong><small className="table-subline">{booking.start} – {booking.end}</small></td><td><select className={`status-select status-${booking.status.toLowerCase().replaceAll(" ", "-")}`} value={booking.status} onChange={(event) => updateStatus(booking.id, event.target.value)} aria-label={`Status for ${displayBookingId(booking.id)}`}><option>In session</option>{statusOptions.map((status) => <option key={status}>{status}</option>)}</select></td><td><button className="small-text-button" onClick={() => setSelectedBooking(booking)}>Details</button></td></tr>)}</tbody></table>{filteredBookings.length === 0 && <div className="empty-state">No bookings match your search.</div>}</div>
    </section>
    <div className="module-note"><CalendarDays size={15} /> Showing {calendarMode.toLowerCase()} schedule <span>·</span> Studio local time (GST)</div>
    {selectedBooking && <div className="modal-backdrop" onClick={() => setSelectedBooking(null)}><section className="detail-modal" role="dialog" aria-modal="true" aria-label="Booking details" onClick={(event) => event.stopPropagation()}><button className="modal-close" onClick={() => setSelectedBooking(null)}>×</button><div className="module-eyebrow">BOOKING DETAILS · {displayBookingId(selectedBooking.id)}</div><h2>{selectedBooking.client}</h2><p>{selectedBooking.session}</p><div className="detail-grid"><span>Studio<strong>{selectedBooking.studio}</strong></span><span>Date<strong>{selectedBooking.date}</strong></span><span>Time<strong>{selectedBooking.start} – {selectedBooking.end}</strong></span><span>Status<strong>{selectedBooking.status}</strong></span><span>Package<strong>{selectedBooking.package ?? "Standard session"}</strong></span><span>Assigned staff<strong>{selectedBooking.assignedStaff ?? "Studio team"}</strong></span><span className="detail-wide">Special requests<strong>{selectedBooking.requests ?? "None"}</strong></span></div><button className="primary-button" onClick={() => { setSelectedBooking(null); onNotify("Booking details closed."); }}>Done</button></section></div>}
  </div>;

  if (pathname === "/clients") return <div className="module-workspace">
    <PageHeading eyebrow="CUSTOMER RELATIONSHIPS" title="Clients" description="Keep client contacts, companies, and studio history in one place." action={<button className="primary-button" onClick={() => setShowClientForm((open) => !open)}><Plus size={16} /> Add client</button>} />
    {databaseError && <div className="database-error-banner" role="alert">Database connection: {databaseError}</div>}
    <div className="module-summary-grid"><div className="module-summary"><span>Total clients</span><strong>{clientRows.length} <small>profiles</small></strong></div><div className="module-summary"><span>Recorded sessions</span><strong>{totalClientSessions} <small>sessions</small></strong></div><div className="module-summary"><span>Returning clients</span><strong>{returningClientPercent}<small>% of clients with sessions</small></strong></div></div>
    {showClientForm && <form className="inline-client-form client-create-form" onSubmit={async (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const name = String(form.get("name")).trim();
      const photo = form.get("photo");
      if (!name) return;
      if (photo instanceof File && photo.size > 5 * 1024 * 1024) { onNotify("Client photos must be smaller than 5 MB."); return; }
      const [first, last = ""] = name.split(/\s+/);
      let photoId: string | undefined;
      try { if (photo instanceof File && photo.size) photoId = remoteMode ? await uploadOrganizationFile("client-media", photo) : await storeMedia(photo); }
      catch (cause) { onNotify(cause instanceof Error ? cause.message : "The client photo could not be stored."); return; }
      const clientInput = { name, company: String(form.get("company") || "Independent client"), email: String(form.get("email") || ""), phone: String(form.get("phone") || "") };
      try {
        const newClient: ClientRecord = remoteMode
          ? await createOrganizationClient({ ...clientInput, ...(photoId ? { photoPath: photoId } : {}) })
          : { id: `CL-${Date.now().toString().slice(-4)}`, ...clientInput, sessions: 0, createdAt: new Date().toISOString(), initials: `${first[0]}${last[0] ?? ""}`.toUpperCase(), tone: "violet", ...(photoId ? { photoId } : {}) };
        const updatedClients = [newClient, ...clientRows];
        setClientRows(updatedClients);
        if (!remoteMode) saveClients(updatedClients);
        setShowClientForm(false); onNotify(`${name} added to the client directory.`);
      } catch (cause) { onNotify(cause instanceof Error ? cause.message : "Could not save the client."); }
    }}><label className="field-label">Client name<input name="name" required placeholder="Full name" /></label><label className="field-label">Company<input name="company" placeholder="Company name" /></label><label className="field-label">Email<input name="email" type="email" placeholder="name@example.com" /></label><label className="field-label">Phone<input name="phone" placeholder="+971" /></label><label className="field-label photo-field">Client photo<input name="photo" type="file" accept="image/png,image/jpeg,image/webp" /><small>JPG, PNG or WebP · max 5 MB</small></label><button className="primary-button"><Check size={15} /> Save client</button></form>}
    <section className="module-card client-directory-module"><div className="module-toolbar"><div><strong className="toolbar-title">All clients</strong><span className="toolbar-count">{clientRows.length} profiles</span></div><div className="module-tools"><label className="module-search"><Search size={15} /><input aria-label="Search clients" placeholder="Search clients" value={query} onChange={(event) => setQuery(event.target.value)} /></label><ViewSwitcher value={clientView} onChange={setClientView} /></div></div>{clientView === "list" ? <div className="booking-list-table"><table className="module-table"><thead><tr><th>CLIENT</th><th>COMPANY</th><th>EMAIL</th><th>PHONE</th><th>SESSIONS</th><th /></tr></thead><tbody>{clientRows.filter((client) => `${client.name} ${client.company} ${client.email}`.toLowerCase().includes(query.toLowerCase())).map((client) => <tr key={client.id}><td><div className="module-client"><LocalPhoto mediaId={client.photoId} alt={`${client.name} photo`} className={`module-avatar ${client.tone} client-list-photo`} fallback={client.initials} /><span><strong>{client.name}</strong><small>{client.id}</small></span></div></td><td>{client.company}</td><td>{client.email}</td><td>{client.phone}</td><td>{client.sessions}</td><td><button className="small-text-button" onClick={() => router.push(`/clients/${client.id}`)}>View profile <ArrowRight size={13} /></button></td></tr>)}</tbody></table></div> : <div className="client-card-grid">{clientRows.filter((client) => `${client.name} ${client.company} ${client.email}`.toLowerCase().includes(query.toLowerCase())).map((client) => <button className="client-directory-card" key={client.id} onClick={() => router.push(`/clients/${client.id}`)}><LocalPhoto mediaId={client.photoId} alt={`${client.name} photo`} className={`client-card-photo ${client.tone}`} fallback={client.initials} /><span className="client-card-copy"><strong>{client.name}</strong><small>{client.company}</small><small>{client.email}</small></span><span className="client-card-meta"><span>{client.sessions} sessions</span><span className="client-profile-action">View profile <ArrowRight size={13} /></span></span></button>)}</div>}{!clientRows.length && <div className="empty-state">Add a client profile to start your directory.</div>}</section>
  </div>;

  if (pathname === "/production") return <div className="module-workspace">
    <PageHeading eyebrow="PODCAST PRODUCTION" title="Production" description="Track every episode from recording through client approval and delivery." action={<button className="primary-button" onClick={() => setShowEpisodeForm((open) => !open)}><Plus size={16} /> Add episode</button>} />
    <div className="production-status-grid">{["Recorded", "Editing", "Review", "Approved"].map((status, index) => <div key={status} className="production-status-card"><span>{status}</span><strong>{[5, 7, 4, 12][index].toString().padStart(2, "0")}</strong><small>{["Ready for editing", "With production team", "Awaiting client feedback", "Ready to deliver"][index]}</small></div>)}</div>
    {databaseError && <div className="database-error-banner" role="alert">Database connection: {databaseError}</div>}
    {showEpisodeForm && <form className="inline-client-form" onSubmit={async (event) => { event.preventDefault(); const form = new FormData(event.currentTarget); const name = String(form.get("episode")).trim(); const show = String(form.get("show") || "New production"); const clientName = String(form.get("client")); const editor = String(form.get("editor") || "Unassigned"); const client = clientRows.find((row) => row.name === clientName); if (!client) { setDatabaseError("Select a client from the list."); return; } try { const episode: EpisodeRecord = remoteMode ? await createOrganizationEpisode({ name, show, clientId: client.id, editorName: editor }) : { name, show, client: clientName, editor, date: new Date().toLocaleDateString("en-AE"), status: "Recorded" }; setEpisodes((rows) => [episode, ...rows]); setShowEpisodeForm(false); onNotify(`Episode “${name}” added to production.`); } catch (cause) { setDatabaseError(cause instanceof Error ? cause.message : "Could not create episode."); } }}><label className="field-label">Episode name<input name="episode" required placeholder="Episode title" /></label><label className="field-label">Show<input name="show" placeholder="Podcast or series" /></label><label className="field-label">Client<select name="client" defaultValue=""><option value="" disabled>Select a client</option>{clientRows.map((client) => <option key={client.id}>{client.name}</option>)}</select></label><label className="field-label">Editor<input name="editor" placeholder="Assign editor" /></label><button className="primary-button"><Check size={15} /> Save episode</button></form>}
    <section className="module-card"><div className="module-toolbar"><div><strong className="toolbar-title">Recent episodes</strong><span className="toolbar-count">{episodes.length} episodes</span></div><label className="module-search"><Search size={15} /><input aria-label="Search episodes" placeholder="Search episodes" value={query} onChange={(event) => setQuery(event.target.value)} /></label></div><div className="booking-list-table"><table className="module-table"><thead><tr><th>EPISODE</th><th>CLIENT / SHOW</th><th>RECORDING DATE</th><th>EDITOR</th><th>STATUS</th></tr></thead><tbody>{episodes.filter((episode) => `${episode.name} ${episode.show} ${episode.client}`.toLowerCase().includes(query.toLowerCase())).map((episode) => <tr key={episode.id ?? episode.name}><td><div className="episode-title"><span className="episode-icon"><FileAudio2 size={15} /></span><strong>{episode.name}</strong></div></td><td><strong>{episode.client}</strong><small className="table-subline">{episode.show}</small></td><td>{episode.date}</td><td>{episode.editor}</td><td><select className="status-select" value={episode.status} onChange={(event) => { const status = event.target.value; setEpisodes((current) => current.map((item) => (item.id ?? item.name) === (episode.id ?? episode.name) ? { ...item, status } : item)); if (remoteMode && episode.id) void updateOrganizationEpisodeStatus(episode.id, status).catch((cause: unknown) => setDatabaseError(cause instanceof Error ? cause.message : "Could not update episode status.")); }} aria-label={`Status for ${episode.name}`}><option>Recorded</option><option>Editing</option><option>Review</option><option>Approved</option><option>Published</option></select></td></tr>)}</tbody></table></div></section>
    <div className="production-hint"><div><Headphones size={17} /></div><span><strong>Assets & delivery</strong><small>Raw audio, edited audio, video, thumbnails, and transcripts are tracked in the episode workflow.</small></span><ArrowRight size={15} /></div>
  </div>;

  if (pathname === "/equipment") return <div className="module-workspace">
    <PageHeading eyebrow="STUDIO RESOURCES" title="Equipment" description="Know what’s ready, in use, or due for maintenance across both studios." action={<button className="primary-button" onClick={() => setShowEquipmentForm((open) => !open)}><Plus size={16} /> Add equipment</button>} />
    {databaseError && <div className="database-error-banner" role="alert">Database connection: {databaseError}</div>}
    <div className="module-summary-grid"><div className="module-summary"><span>Total inventory</span><strong>{42 + equipment.length} <small>items</small></strong><i className="summary-purple" /></div><div className="module-summary"><span>Available now</span><strong>{equipment.filter((item) => item.status === "Available").length} <small>items</small></strong><i className="summary-green" /></div><div className="module-summary"><span>Needs attention</span><strong>{equipment.filter((item) => item.status === "Maintenance" || item.status === "Damaged").length} <small>items</small></strong><i className="summary-amber" /></div></div>
    {showEquipmentForm && <form className="inline-client-form equipment-create-form" onSubmit={async (event) => { event.preventDefault(); const form = new FormData(event.currentTarget); const name = String(form.get("item")).trim(); const serial = String(form.get("serial")).trim(); const photo = form.get("photo"); if (equipment.some((item) => item.serial.toLowerCase() === serial.toLowerCase())) { onNotify("That serial number is already registered."); return; } if (photo instanceof File && photo.size > 5 * 1024 * 1024) { onNotify("Equipment photos must be smaller than 5 MB."); return; } const category = String(form.get("category"));
      const studio = String(form.get("studio"));
      let photoId: string | undefined;
      try { if (photo instanceof File && photo.size) photoId = remoteMode ? await uploadOrganizationFile("equipment-media", photo) : await storeMedia(photo); }
      catch (cause) { onNotify(cause instanceof Error ? cause.message : "The equipment photo could not be stored."); return; }
      try { const item: EquipmentRecord = remoteMode ? await createOrganizationEquipment({ name, category, serialNumber: serial, studio, ...(photoId ? { photoPath: photoId } : {}) }) : { name, category: `${category} · ${studio}`, serial, status: "Available", ...(photoId ? { photoId } : {}) }; const updated = [item, ...equipment]; setEquipment(updated); if (!remoteMode) saveEquipment(updated); setShowEquipmentForm(false); onNotify(`${name} added to the equipment register.`); } catch (cause) { onNotify(cause instanceof Error ? cause.message : "Could not save equipment."); } }}><label className="field-label">Equipment name<input name="item" required placeholder="Item name" /></label><label className="field-label">Category<input name="category" required placeholder="Camera, microphone…" /></label><label className="field-label">Serial number<input name="serial" required placeholder="Serial ID" /></label><label className="field-label">Studio<select name="studio"><option>Studio A</option><option>Studio B</option><option>Shared inventory</option></select></label><label className="field-label photo-field">Equipment photo<input name="photo" type="file" accept="image/png,image/jpeg,image/webp" /><small>JPG, PNG or WebP · max 5 MB</small></label><button className="primary-button"><Check size={15} /> Add item</button></form>}
    <section className="module-card equipment-directory-card"><div className="module-toolbar"><div><strong className="toolbar-title">Equipment register</strong><span className="toolbar-count">Cameras, audio & lighting</span></div><div className="module-tools"><label className="module-search"><Search size={15} /><input aria-label="Search equipment" placeholder="Search equipment" value={query} onChange={(event) => setQuery(event.target.value)} /></label><ViewSwitcher value={equipmentView} onChange={setEquipmentView} /></div></div>{equipmentView === "cards" ? <div className="equipment-grid">{equipment.filter((item) => `${item.name} ${item.category} ${item.serial}`.toLowerCase().includes(query.toLowerCase())).map((item) => <article className="equipment-card" key={item.serial}><div className="equipment-image-wrap"><LocalPhoto mediaId={item.photoId} alt={`${item.name} photo`} className="equipment-photo" fallback={<Wrench size={23} />} /><select className={`equipment-status equipment-${item.status.toLowerCase().replaceAll(" ", "-")}`} value={item.status} onChange={(event) => changeEquipmentStatus(item, event.target.value)} aria-label={`Status for ${item.name}`}><option>Available</option><option>In Use</option><option>Maintenance</option><option>Damaged</option></select></div><h3>{item.name}</h3><p>{item.category}</p><div className="equipment-serial">SERIAL NUMBER <strong>{item.serial}</strong></div></article>)}</div> : <div className="booking-list-table"><table className="module-table equipment-list-table"><thead><tr><th>ITEM</th><th>CATEGORY / STUDIO</th><th>SERIAL NUMBER</th><th>STATUS</th></tr></thead><tbody>{equipment.filter((item) => `${item.name} ${item.category} ${item.serial}`.toLowerCase().includes(query.toLowerCase())).map((item) => <tr key={item.serial}><td><div className="module-client"><LocalPhoto mediaId={item.photoId} alt={`${item.name} photo`} className="equipment-list-photo" fallback={<Wrench size={15} />} /><span><strong>{item.name}</strong></span></div></td><td>{item.category}</td><td>{item.serial}</td><td><select className={`equipment-status equipment-${item.status.toLowerCase().replaceAll(" ", "-")}`} value={item.status} onChange={(event) => changeEquipmentStatus(item, event.target.value)} aria-label={`Status for ${item.name}`}><option>Available</option><option>In Use</option><option>Maintenance</option><option>Damaged</option></select></td></tr>)}</tbody></table></div>}</section>
  </div>;

  return <div className="module-workspace"><PageHeading eyebrow="STUDIO OPERATIONS" title={activePage} description="This workspace section is ready to be connected to your studio operations." /><section className="module-card coming-soon"><span className="coming-soon-icon"><Clock3 size={20} /></span><h2>{activePage} workspace</h2><p>Payment processing, memberships, staff operations, and reporting will appear here as the corresponding workflows are configured.</p><button className="secondary-button" onClick={() => router.push("/")}><ArrowLeft size={15} /> Back to overview</button></section></div>;
}
