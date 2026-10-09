"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowDownToLine, ArrowRight, CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, CircleCheck, Clock3, Plus, Search, Sparkles, UserCheck, Users, X } from "lucide-react";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createOrganizationMembership, createOrganizationTask, listOrganizationBookings, listOrganizationMemberships, listOrganizationTasks, updateOrganizationTask } from "@/lib/supabase/actions";

type Booking = { id: string; client: string; session: string; studio: string; date: string; start: string; end: string; status: string; initials: string };
type Client = { id: string; name: string; company?: string; sessions?: number };
type Props = { onNotify: (message: string) => void };

const sampleBookings: Booking[] = [
  { id: "MPL-1048", client: "Sara Khalid", session: "The Founder’s Table · Episode 18", studio: "Studio A", date: "2026-10-09", start: "09:00", end: "11:00", status: "In session", initials: "SK" },
  { id: "MPL-1049", client: "Omar Al Nuaimi", session: "Brand Story Podcast · Interview", studio: "Studio B", date: "2026-10-09", start: "11:30", end: "13:00", status: "Confirmed", initials: "OA" },
  { id: "MPL-1050", client: "Noura Creative", session: "Campaign voice-over recording", studio: "Studio A", date: "2026-10-09", start: "14:00", end: "16:00", status: "Confirmed", initials: "NC" },
  { id: "MPL-1051", client: "Majid Fahad", session: "Creator membership session", studio: "Studio B", date: "2026-10-09", start: "16:30", end: "17:30", status: "Pending", initials: "MF" },
];
const pad = (number: number) => String(number).padStart(2, "0");
const displayBookingId = (id: string) => id.replace(/^MPL-/, "BK-");
const isoDate = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const formatTime = (value: string) => {
  const [hours, minutes] = value.split(":").map(Number);
  return `${hours % 12 || 12}:${pad(minutes)} ${hours >= 12 ? "PM" : "AM"}`;
};
function Heading({ eyebrow, title, subtitle, action }: { eyebrow: string; title: string; subtitle: string; action?: ReactNode }) {
  return <div className="module-heading"><div><div className="module-eyebrow">{eyebrow}</div><h1>{title}</h1><p>{subtitle}</p></div>{action}</div>;
}

export function CalendarWorkspace({ onNotify }: Props) {
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[]>(sampleBookings);
  const [month, setMonth] = useState(new Date(2026, 9, 1));
  const [mode, setMode] = useState("Month");
  const [studio, setStudio] = useState("All studios");
  const [selectedDate, setSelectedDate] = useState(new Date(2026, 9, 9));
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [databaseError, setDatabaseError] = useState("");
  useEffect(() => {
    if (isSupabaseConfigured()) {
      let active = true;
      const timeout = window.setTimeout(() => {
        void listOrganizationBookings().then((rows) => { if (active) setBookings(rows); }).catch((cause: unknown) => { if (active) setDatabaseError(cause instanceof Error ? cause.message : "Could not load bookings from the database."); });
      }, 0);
      return () => { active = false; window.clearTimeout(timeout); };
    }
    const saved = window.localStorage.getItem("mpl-bookings");
    if (saved) {
      try {
        const additions = JSON.parse(saved) as Booking[];
        const timeout = window.setTimeout(() => setBookings([...additions, ...sampleBookings]), 0);
        return () => window.clearTimeout(timeout);
      } catch {
        window.localStorage.removeItem("mpl-bookings");
      }
    }
  }, []);

  const displayedBookings = bookings.filter((booking) => studio === "All studios" || booking.studio === studio);
  const monthDays = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const start = new Date(first);
    start.setDate(first.getDate() - first.getDay());
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      return date;
    });
  }, [month]);
  const selectedBookings = displayedBookings.filter((booking) => booking.date === isoDate(selectedDate));
  const createFromDate = (date: Date) => {
    window.sessionStorage.setItem("mpl-booking-date", isoDate(date));
    onNotify(`New booking date set to ${date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}.`);
    router.push("/bookings/new");
  };
  const changeMonth = (offset: number) => setMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  const goToday = () => { const today = new Date(2026, 9, 9); setMonth(new Date(today.getFullYear(), today.getMonth(), 1)); setSelectedDate(today); };

  return <div className="module-workspace calendar-workspace">
    <Heading eyebrow="STUDIO SCHEDULE" title="Studio calendar" subtitle="See every session, client, and studio at a glance." action={<button className="primary-button" onClick={() => router.push("/bookings/new")}><Plus size={16} /> New booking</button>} />
    {databaseError && <div className="database-error-banner" role="alert">Database connection: {databaseError}</div>}
    <section className="module-card calendar-card">
      <div className="calendar-toolbar">
        <div className="calendar-month-controls"><div className="calendar-stepper"><button aria-label="Previous month" onClick={() => changeMonth(-1)}><ChevronLeft size={17} /></button><button aria-label="Next month" onClick={() => changeMonth(1)}><ChevronRight size={17} /></button></div><h2>{month.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</h2><button className="today-button" onClick={goToday}>Today</button></div>
        <div className="calendar-toolbar-right"><label className="calendar-studio"><span className="studio-color-dot" /><select aria-label="Filter by studio" value={studio} onChange={(event) => setStudio(event.target.value)}><option>All studios</option><option>Studio A</option><option>Studio B</option></select><ChevronDown size={14} /></label><div className="module-tabs">{["Day", "Week", "Month"].map((item) => <button key={item} className={mode === item ? "module-tab-active" : ""} onClick={() => setMode(item)}>{item}</button>)}</div></div>
      </div>
      {mode === "Month" && <div className="calendar-month-view"><div className="calendar-weekdays">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <div key={day}>{day}</div>)}</div><div className="calendar-month-grid">{monthDays.map((date) => {
        const dateKey = isoDate(date);
        const items = displayedBookings.filter((booking) => booking.date === dateKey);
        return <button key={dateKey} className={`calendar-day ${date.getMonth() !== month.getMonth() ? "calendar-outside" : ""} ${dateKey === isoDate(selectedDate) ? "calendar-selected" : ""}`} onClick={() => setSelectedDate(date)} onDoubleClick={() => createFromDate(date)}><span className={`calendar-day-number ${dateKey === "2026-10-09" ? "calendar-today-number" : ""}`}>{date.getDate()}</span><span className="calendar-day-appointments">{items.slice(0, 3).map((item) => <span key={item.id} className={`calendar-appointment ${item.studio === "Studio B" ? "appointment-blue" : "appointment-purple"}`} onClick={(event) => { event.stopPropagation(); setSelectedBooking(item); }}><strong>{formatTime(item.start)}</strong><span>{item.client}</span></span>)}{items.length > 3 && <small className="calendar-more">+{items.length - 3} more</small>}</span><span className="calendar-add" onClick={(event) => { event.stopPropagation(); createFromDate(date); }}>+</span></button>;
      })}</div></div>}
      {mode === "Week" && <div className="calendar-week-view">
        <div className="week-time-spacer" />
        <div className="week-day-headings">{Array.from({ length: 7 }, (_, index) => {
          const date = new Date(selectedDate);
          date.setDate(selectedDate.getDate() - selectedDate.getDay() + index);
          return <button key={isoDate(date)} className={isoDate(date) === isoDate(selectedDate) ? "week-day-selected" : ""} onClick={() => setSelectedDate(date)}><span>{date.toLocaleDateString("en-US", { weekday: "short" })}</span><strong>{date.getDate()}</strong></button>;
        })}</div>
        <div className="week-time-grid">{Array.from({ length: 12 }, (_, index) => index + 8).map((hour) => {
          const cells = Array.from({ length: 7 }, (_, dayIndex) => {
            const date = new Date(selectedDate);
            date.setDate(selectedDate.getDate() - selectedDate.getDay() + dayIndex);
            const items = displayedBookings.filter((booking) => booking.date === isoDate(date) && Number(booking.start.slice(0, 2)) === hour);
            return <div className="week-slot" key={dayIndex}>{items.map((item) => <button key={item.id} className={`week-appointment ${item.studio === "Studio B" ? "appointment-blue" : "appointment-purple"}`} onClick={() => setSelectedBooking(item)}><strong>{item.client}</strong><span>{formatTime(item.start)}</span></button>)}</div>;
          });
          return <div className="week-time-row" key={hour}><span>{formatTime(`${pad(hour)}:00`)}</span>{cells}</div>;
        })}</div>
      </div>}
      {mode === "Day" && <div className="calendar-day-view"><div className="day-view-heading"><div><span>{selectedDate.toLocaleDateString("en-US", { weekday: "long" })}</span><strong>{selectedDate.toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" })}</strong></div><button className="secondary-button" onClick={() => createFromDate(selectedDate)}><Plus size={14} /> Add session</button></div>{Array.from({ length: 12 }, (_, index) => index + 8).map((hour) => { const items = displayedBookings.filter((booking) => booking.date === isoDate(selectedDate) && Number(booking.start.slice(0, 2)) === hour); return <div className="day-time-row" key={hour}><span>{formatTime(`${pad(hour)}:00`)}</span><div>{items.map((item) => <button key={item.id} className={`day-appointment ${item.studio === "Studio B" ? "appointment-blue" : "appointment-purple"}`} onClick={() => setSelectedBooking(item)}><strong>{item.client}</strong><span>{formatTime(item.start)} – {formatTime(item.end)} · {item.studio} · {item.session}</span></button>)}</div></div>; })}</div>}
      <div className="calendar-footer"><span><i className="legend-dot studio-a-dot" /> Studio A <i className="legend-dot studio-b-dot" /> Studio B</span><span><CalendarDays size={14} /> Select a day to see its full schedule · double-click a date to book</span></div>
    </section>
    <section className="calendar-agenda"><div><div className="module-eyebrow">SELECTED DATE</div><h2>{selectedDate.toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long" })}</h2></div><div className="agenda-list">{selectedBookings.length ? selectedBookings.map((booking) => <button className="agenda-item" key={booking.id} onClick={() => setSelectedBooking(booking)}><span className="agenda-time">{formatTime(booking.start)}<small>{formatTime(booking.end)}</small></span><span className={`agenda-accent ${booking.studio === "Studio B" ? "agenda-blue" : ""}`} /><span className="agenda-info"><strong>{booking.client}</strong><small>{booking.session}</small></span><span className="agenda-studio">{booking.studio}</span><ArrowRight size={15} /></button>) : <div className="agenda-empty">No sessions yet. <button onClick={() => createFromDate(selectedDate)}>Add a booking</button></div>}</div></section>
    {selectedBooking && <div className="modal-backdrop" onClick={() => setSelectedBooking(null)}><section className="detail-modal" role="dialog" aria-modal="true" aria-label="Booking details" onClick={(event) => event.stopPropagation()}><button className="modal-close" onClick={() => setSelectedBooking(null)}><X size={18} /></button><div className="module-eyebrow">{displayBookingId(selectedBooking.id)} · {selectedBooking.studio}</div><h2>{selectedBooking.client}</h2><p>{selectedBooking.session}</p><div className="detail-grid"><span>Date<strong>{selectedBooking.date}</strong></span><span>Time<strong>{formatTime(selectedBooking.start)} – {formatTime(selectedBooking.end)}</strong></span></div><button className="primary-button" onClick={() => setSelectedBooking(null)}>Close details</button></section></div>}
  </div>;
}

type Task = { id: string | number; title: string; category: string; assignee: string; due: string; done: boolean };
const teamSeed = [{ name: "Layla Al Ansari", role: "Studio manager", initials: "LA", status: "On shift", time: "09:00 AM – 06:00 PM", tone: "peach" }, { name: "Yousef Khalifa", role: "Editor & videographer", initials: "YK", status: "On shift", time: "10:00 AM – 07:00 PM", tone: "blue" }, { name: "Malik Mansoor", role: "Reception", initials: "MM", status: "On shift", time: "08:30 AM – 05:30 PM", tone: "violet" }, { name: "Rashid Nasser", role: "Production editor", initials: "RN", status: "Off today", time: "Next shift · Sat 10 Oct", tone: "mint" }];
const taskSeed: Task[] = [{ id: 1, title: "Prepare Studio A", category: "Booking prep", assignee: "Layla Al Ansari", due: "10:40 AM", done: false }, { id: 2, title: "Review episode audio", category: "Post-production", assignee: "Yousef Khalifa", due: "12:00 PM", done: false }, { id: 3, title: "Send invoice to Omar", category: "Finance", assignee: "Malik Mansoor", due: "02:00 PM", done: false }, { id: 4, title: "Back up Sara’s raw files", category: "File delivery", assignee: "Yousef Khalifa", due: "03:30 PM", done: true }];
export function TeamTasksWorkspace({ onNotify }: Props) {
  const [tab, setTab] = useState("Tasks");
  const [tasks, setTasks] = useState(taskSeed);
  const [taskForm, setTaskForm] = useState(false);
  const [query, setQuery] = useState("");
  const [checkedIn, setCheckedIn] = useState<string[]>(["Layla Al Ansari", "Yousef Khalifa", "Malik Mansoor"]);
  const [filter, setFilter] = useState("All tasks");
  const [loadError, setLoadError] = useState("");
  const remoteMode = isSupabaseConfigured();

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    let active = true;
    const timeout = window.setTimeout(() => {
      void listOrganizationTasks().then((rows) => { if (active) setTasks(rows); }).catch((cause: unknown) => { if (active) setLoadError(cause instanceof Error ? cause.message : "Could not load tasks."); });
    }, 0);
    return () => { active = false; window.clearTimeout(timeout); };
  }, []);
  const filtered = tasks.filter((task) => `${task.title} ${task.category} ${task.assignee}`.toLowerCase().includes(query.toLowerCase()) && (filter === "All tasks" || (filter === "Completed" ? task.done : !task.done)));
  return <div className="module-workspace"><Heading eyebrow="PEOPLE & OPERATIONS" title="Staff & tasks" subtitle="Coordinate today’s studio team, check-ins, and production to-dos." action={<button className="primary-button" onClick={() => tab === "Tasks" ? setTaskForm((open) => !open) : onNotify("Staff details are managed in the team roster.")}><Plus size={16} /> {tab === "Tasks" ? "New task" : "Add team member"}</button>} />
    <div className="team-summary-row"><div className="team-summary-card"><span>Team on shift</span><strong>{checkedIn.length}<small> / 4 today</small></strong><i className="summary-green" /></div><div className="team-summary-card"><span>Open tasks</span><strong>{tasks.filter((task) => !task.done).length}<small> to complete</small></strong><i className="summary-purple" /></div><div className="team-summary-card"><span>Completed today</span><strong>{tasks.filter((task) => task.done).length}<small> tasks</small></strong><i className="summary-amber" /></div></div>
    <section className="module-card"><div className="team-page-toolbar"><div className="module-tabs">{["Tasks", "Team & attendance"].map((value) => <button key={value} className={tab === value ? "module-tab-active" : ""} onClick={() => setTab(value)}>{value}</button>)}</div>{tab === "Tasks" && <div className="module-tools"><label className="module-search"><Search size={15} /><input aria-label="Search tasks" placeholder="Search tasks or assignee" value={query} onChange={(event) => setQuery(event.target.value)} /></label><label className="filter-select"><select value={filter} onChange={(event) => setFilter(event.target.value)}><option>All tasks</option><option>Open</option><option>Completed</option></select><ChevronDown size={13} /></label></div>}</div>
      {loadError && <div className="database-error-banner" role="alert">Database connection: {loadError}</div>}
      {taskForm && tab === "Tasks" && <form className="task-create-form" onSubmit={async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const form = new FormData(event.currentTarget); const title = String(form.get("title")); const category = String(form.get("category")); const assignee = String(form.get("assignee")); const due = String(form.get("due")); try { const task = remoteMode ? await createOrganizationTask({ title, category, due, assigneeName: assignee }) : { id: Date.now(), title, category, assignee, due, done: false }; setTasks((current) => [task, ...current]); setTaskForm(false); onNotify("Task added to today’s list."); } catch (cause) { setLoadError(cause instanceof Error ? cause.message : "Could not create task."); } }}><label className="field-label">Task<input name="title" required placeholder="What needs to be done?" /></label><label className="field-label">Category<select name="category"><option>Booking prep</option><option>Post-production</option><option>Finance</option><option>File delivery</option></select></label><label className="field-label">Assign to<select name="assignee">{teamSeed.map((person) => <option key={person.name}>{person.name}</option>)}</select></label><label className="field-label">Due<input name="due" type="time" defaultValue="15:00" /></label><button className="primary-button"><Check size={15} /> Save task</button></form>}
      {tab === "Tasks" ? <div className="task-workspace-list">{filtered.map((task) => <div className={`task-workspace-row ${task.done ? "task-is-done" : ""}`} key={task.id}><button className={`task-toggle ${task.done ? "task-toggle-done" : ""}`} aria-label={task.done ? "Mark task open" : "Complete task"} onClick={() => { const done = !task.done; setTasks((current) => current.map((item) => item.id === task.id ? { ...item, done } : item)); if (remoteMode && typeof task.id === "string") void updateOrganizationTask(task.id, done).catch((cause: unknown) => setLoadError(cause instanceof Error ? cause.message : "Could not update task.")); }}>{task.done && <Check size={14} />}</button><span className="task-workspace-copy"><strong>{task.title}</strong><small>{task.category}</small></span><span className="task-assignee"><Users size={14} />{task.assignee}</span><span className="task-deadline"><Clock3 size={14} />{task.due}</span><span className={`task-state ${task.done ? "task-state-done" : ""}`}>{task.done ? "Complete" : "In progress"}</span></div>)}{!filtered.length && <div className="empty-state">No tasks match that filter.</div>}</div> : <div className="staff-roster">{teamSeed.map((person) => <article className="staff-card" key={person.name}><div className={`staff-avatar ${person.tone}`}>{person.initials}</div><div className="staff-name"><strong>{person.name}</strong><small>{person.role}</small></div><span className={`staff-presence ${checkedIn.includes(person.name) ? "presence-on" : "presence-off"}`}><i />{checkedIn.includes(person.name) ? "On shift" : person.status === "Off today" ? "Off today" : "Not checked in"}</span><small className="staff-hours">{person.time}</small><button className={`attendance-button ${checkedIn.includes(person.name) ? "attendance-out" : ""}`} disabled={person.status === "Off today"} onClick={() => setCheckedIn((current) => current.includes(person.name) ? current.filter((name) => name !== person.name) : [...current, person.name])}><UserCheck size={14} />{checkedIn.includes(person.name) ? "Check out" : "Check in"}</button></article>)}</div>}</section>
    <div className="module-note"><CircleCheck size={15} /> Tasks and attendance are prototype UI state and are not synced to a server.</div>
  </div>;
}

const memberSeed = [{ client: "Sara Khalid", plan: "Professional", start: "01 Sep 2026", renewal: "01 Oct 2026", included: 10, used: 6, status: "Active" }, { client: "Omar Al Nuaimi", plan: "Starter", start: "15 Sep 2026", renewal: "15 Oct 2026", included: 4, used: 2.5, status: "Active" }, { client: "Noura Creative", plan: "Enterprise", start: "01 Aug 2026", renewal: "01 Nov 2026", included: 99, used: 22, status: "Active" }, { client: "Majid Fahad", plan: "Starter", start: "20 Aug 2026", renewal: "20 Sep 2026", included: 4, used: 4, status: "Renewal due" }];
type Member = (typeof memberSeed)[number] & { id?: string };
export function MembershipWorkspace({ onNotify, clients }: Props & { clients: Client[] }) {
  const [members, setMembers] = useState<Member[]>(memberSeed);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState("All members");
  const [search, setSearch] = useState("");
  const [loadError, setLoadError] = useState("");
  const remoteMode = isSupabaseConfigured();
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    let active = true;
    const timeout = window.setTimeout(() => {
      void listOrganizationMemberships().then((rows) => { if (active) setMembers(rows); }).catch((cause: unknown) => { if (active) setLoadError(cause instanceof Error ? cause.message : "Could not load memberships."); });
    }, 0);
    return () => { active = false; window.clearTimeout(timeout); };
  }, []);
  const active = members.filter((member) => member.status === "Active").length;
  return <div className="module-workspace"><Heading eyebrow="STUDIO PRIVILEGES" title="Memberships" subtitle="Manage monthly studio-hour plans, credits, and renewals." action={<button className="primary-button" onClick={() => setShowForm((open) => !open)}><Plus size={16} /> Add membership</button>} />
    <div className="membership-plan-grid">{[{ name: "Starter", hours: "4 hours", price: "AED 680", note: "per month", style: "plan-starter" }, { name: "Professional", hours: "10 hours", price: "AED 1,500", note: "per month", style: "plan-pro" }, { name: "Enterprise", hours: "Unlimited", price: "Custom", note: "monthly access", style: "plan-enterprise" }].map((plan) => <article className={`membership-plan-card ${plan.style}`} key={plan.name}><div><span>{plan.name}</span><Sparkles size={17} /></div><strong>{plan.hours}</strong><small>studio time included</small><p>{plan.price}<span> {plan.note}</span></p></article>)}</div>
    {loadError && <div className="database-error-banner" role="alert">Database connection: {loadError}</div>}
    {showForm && <form className="membership-create-form" onSubmit={async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const form = new FormData(event.currentTarget); const clientId = String(form.get("client")); const client = clients.find((item) => item.id === clientId); const plan = String(form.get("plan")) as "Starter" | "Professional" | "Enterprise"; const start = String(form.get("start")); const renewal = String(form.get("renewal")); if (!client) { setLoadError("Select a client from the database-backed client list."); return; } try { const included = plan === "Starter" ? 4 : plan === "Professional" ? 10 : 0; const member = remoteMode ? await createOrganizationMembership({ clientId, plan, start, renewal }) : { client: client.name, plan, start, renewal, included, used: 0, status: "Active" }; setMembers((current) => [member, ...current]); setShowForm(false); onNotify("Membership activated."); } catch (cause) { setLoadError(cause instanceof Error ? cause.message : "Could not create membership."); } }}><label className="field-label">Client<select name="client" defaultValue="" required><option value="" disabled>Select a client</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label><label className="field-label">Plan<select name="plan"><option>Starter</option><option>Professional</option><option>Enterprise</option></select></label><label className="field-label">Start date<input type="date" name="start" defaultValue="2026-10-09" /></label><label className="field-label">Renewal date<input type="date" name="renewal" defaultValue="2026-11-09" /></label><button className="primary-button"><Check size={15} /> Activate membership</button></form>}
    <section className="module-card"><div className="module-toolbar"><div><strong className="toolbar-title">Member accounts</strong><span className="toolbar-count">{active} active</span></div><div className="module-tools"><label className="module-search"><Search size={15} /><input aria-label="Search members" placeholder="Search members" value={search} onChange={(event) => setSearch(event.target.value)} /></label><label className="filter-select"><select value={filter} onChange={(event) => setFilter(event.target.value)}><option>All members</option><option>Active</option><option>Renewal due</option></select><ChevronDown size={13} /></label></div></div><div className="booking-list-table"><table className="module-table membership-table"><thead><tr><th>MEMBER</th><th>PLAN</th><th>STARTED</th><th>RENEWS</th><th>HOURS LEFT</th><th>STATUS</th></tr></thead><tbody>{members.filter((member) => member.client.toLowerCase().includes(search.toLowerCase()) && (filter === "All members" || member.status === filter)).map((member) => { const remaining = member.plan === "Enterprise" ? "Unlimited" : `${Math.max(0, member.included - member.used)} / ${member.included} hrs`; const percent = member.plan === "Enterprise" ? 100 : Math.max(0, (member.included - member.used) / member.included * 100); return <tr key={`${member.client}-${member.start}`}><td><strong>{member.client}</strong></td><td><span className={`member-plan-tag ${member.plan === "Professional" ? "member-plan-pro" : member.plan === "Enterprise" ? "member-plan-enterprise" : ""}`}>{member.plan}</span></td><td>{member.start}</td><td>{member.renewal}</td><td><strong>{remaining}</strong><span className="hours-progress"><i style={{ width: `${percent}%` }} /></span></td><td><span className={`member-status ${member.status === "Active" ? "" : "member-status-due"}`}>{member.status}</span></td></tr>; })}</tbody></table></div></section>
    <div className="module-note"><Clock3 size={14} /> Membership hours reset on each renewal date. Enterprise includes unlimited studio hours.</div>
  </div>;
}

export function ReportsWorkspace({ onNotify }: Props) {
  const [period, setPeriod] = useState("October 2026");
  const [report, setReport] = useState("Revenue");
  const exportCsv = () => {
    const csv = 'Metric,Value\nRevenue,"AED 48,250"\nBookings,186\nNew clients,32\nReturning clients,68%\nStudio utilization,71%';
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const link = document.createElement("a"); link.href = url; link.download = "studio-report.csv"; link.click(); URL.revokeObjectURL(url); onNotify("Report exported as CSV.");
  };
  const values = report === "Revenue" ? [35, 52, 44, 69, 61, 83, 72, 92, 66, 78, 57, 88] : report === "Bookings" ? [45, 58, 51, 74, 63, 82, 70, 91, 68, 77, 55, 84] : [30, 49, 42, 56, 64, 72, 61, 80, 57, 75, 63, 89];
  return <div className="module-workspace"><Heading eyebrow="STUDIO PERFORMANCE" title="Reports & analytics" subtitle="Understand the studio’s revenue, bookings, and client growth." action={<button className="secondary-button report-export" onClick={exportCsv}><ArrowDownToLine size={15} /> Export CSV</button>} />
    <div className="report-toolbar"><div className="report-tabs">{["Revenue", "Bookings", "Clients"].map((item) => <button key={item} className={report === item ? "report-tab-active" : ""} onClick={() => setReport(item)}>{item}</button>)}</div><label className="calendar-studio"><CalendarDays size={15} /><select aria-label="Report period" value={period} onChange={(event) => setPeriod(event.target.value)}><option>October 2026</option><option>September 2026</option><option>Q3 2026</option><option>Year to date</option></select><ChevronDown size={14} /></label></div>
    <div className="report-kpi-grid"><article><span>Total revenue</span><strong>AED 48,250</strong><small className="report-positive">↑ 12.8% vs previous period</small></article><article><span>Bookings completed</span><strong>186</strong><small className="report-positive">↑ 8.4% vs previous period</small></article><article><span>New clients</span><strong>32</strong><small className="report-positive">↑ 6.2% vs previous period</small></article><article><span>Returning clients</span><strong>68%</strong><small>127 returning of 186 total</small></article></div>
    <section className="module-card report-chart-card"><div className="report-chart-heading"><div><strong>{report} over time</strong><small>{period} · AED unless noted</small></div><span className="chart-legend"><i className="legend-dot studio-a-dot" /> Studio operations</span></div><div className="report-chart"><div className="report-axis"><span>50k</span><span>40k</span><span>30k</span><span>20k</span><span>10k</span></div><div className="report-bars">{values.map((value, index) => <div className="report-bar-column" key={index}><span className="report-bar-value">{report === "Revenue" ? `${Math.round(value * 520)}k` : value * 3}</span><i style={{ height: `${value}%` }} /><small>{new Date(2026, index, 1).toLocaleDateString("en-US", { month: "short" })}</small></div>)}</div></div></section>
    <div className="report-bottom-grid"><section className="module-card report-breakdown"><div className="report-card-heading"><strong>Revenue by service</strong><span>October</span></div>{[{ label: "Studio rental", amount: "AED 22,840", percent: 47, tone: "break-purple" }, { label: "Editing & production", amount: "AED 13,510", percent: 28, tone: "break-blue" }, { label: "Memberships", amount: "AED 8,203", percent: 17, tone: "break-green" }, { label: "Workshops", amount: "AED 3,697", percent: 8, tone: "break-orange" }].map((item) => <div className="revenue-break-row" key={item.label}><div><span>{item.label}</span><strong>{item.amount}</strong></div><i><b className={item.tone} style={{ width: `${item.percent}%` }} /></i></div>)}</section><section className="module-card report-breakdown"><div className="report-card-heading"><strong>Booking sources</strong><span>186 total</span></div>{[{ source: "Website", count: 74, percent: 40 }, { source: "Instagram", count: 51, percent: 27 }, { source: "Returning clients", count: 38, percent: 20 }, { source: "Referral & other", count: 23, percent: 13 }].map((item) => <div className="source-row" key={item.source}><span>{item.source}</span><i><b style={{ width: `${item.percent}%` }} /></i><strong>{item.count}</strong></div>)}</section></div>
    <div className="module-note"><CircleCheck size={15} /> Report figures are illustrative prototype data. <button onClick={() => onNotify("Your date range is set to " + period + ".")}>About this report</button></div>
  </div>;
}
