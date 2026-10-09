"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import ModuleWorkspace from "@/components/ModuleWorkspace";
import {
  Activity, ArrowRight, ArrowUpRight, Bell, CalendarDays,
  Check, ChevronDown, CircleDollarSign, Clock3, Command, CreditCard, FileAudio2,
  FileText, Headphones, LayoutDashboard, LifeBuoy, Menu, MoreHorizontal,
  Plus, Search, Settings2, ShieldCheck, Sparkles, Users, Video, Wallet,
  Wrench, X,
} from "lucide-react";

const navigation = [
  { label: "Overview", icon: LayoutDashboard },
  { label: "Bookings", icon: CalendarDays, badge: "8" },
  { label: "Clients", icon: Users },
  { label: "Production", icon: FileAudio2 },
  { label: "Equipment", icon: Wrench },
];

const management = [
  { label: "Payments & invoices", icon: CreditCard },
  { label: "Memberships", icon: ShieldCheck },
  { label: "Staff & tasks", icon: Check },
  { label: "Reports", icon: Activity },
];

const bookings = [
  { time: "09:00 AM", initials: "SK", name: "Sara Khalid", detail: "The Founder’s Table · Episode 18", studio: "Studio A", status: "In session", color: "violet", duration: "2 hrs" },
  { time: "11:30 AM", initials: "OA", name: "Omar Al Nuaimi", detail: "Brand Story Podcast · Interview", studio: "Studio B", status: "Confirmed", color: "blue", duration: "1.5 hrs" },
  { time: "02:00 PM", initials: "NC", name: "Noura Creative", detail: "Campaign voice-over recording", studio: "Studio A", status: "Confirmed", color: "peach", duration: "2 hrs" },
  { time: "04:30 PM", initials: "MF", name: "Majid Fahad", detail: "Creator membership session", studio: "Studio B", status: "Pending", color: "mint", duration: "1 hr" },
];

const chartData = [
  { day: "Sat", value: 36 }, { day: "Sun", value: 50 }, { day: "Mon", value: 43 },
  { day: "Tue", value: 68 }, { day: "Wed", value: 56 }, { day: "Thu", value: 82 }, { day: "Fri", value: 62 },
];

export default function Home() {
  const pathname = usePathname();
  const router = useRouter();
  const routeLabels: Record<string, string> = {
    "/": "Overview",
    "/bookings": "Bookings",
    "/bookings/calendar": "Bookings",
    "/bookings/new": "New booking",
    "/clients": "Clients",
    "/production": "Production",
    "/equipment": "Equipment",
    "/payments": "Payments & invoices",
    "/memberships": "Memberships",
    "/tasks": "Staff & tasks",
    "/reports": "Reports",
  };
  const activePage = pathname.startsWith("/clients/") ? "Client profile" : routeLabels[pathname] ?? "Overview";
  const [session, setSession] = useState<{ fullName: string; email: string; role: string } | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [period, setPeriod] = useState("This week");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState([
    { id: 1, icon: CalendarDays, tone: "notification-purple", title: "New booking confirmed", message: "Sara Khalid · Studio A · 9:00 AM", time: "12 min ago", href: "/bookings", read: false },
    { id: 2, icon: CreditCard, tone: "notification-green", title: "Payment received", message: "AED 1,500 from Omar Al Nuaimi", time: "48 min ago", href: "/payments", read: false },
    { id: 3, icon: FileAudio2, tone: "notification-blue", title: "Episode ready for review", message: "A Different Kind of Growth", time: "2 hours ago", href: "/production", read: true },
  ]);
  const unreadNotifications = notifications.filter((item) => !item.read).length;

  useEffect(() => {
    let active = true;
    void fetch("/api/auth/me", { cache: "no-store" }).then(async (response) => {
      if (!response.ok) { router.replace("/login"); return; }
      const result = await response.json() as { user: { fullName: string; email: string; role: string; mustChangePassword: boolean } };
      if (result.user.mustChangePassword) { router.replace("/login"); return; }
      if (active) setSession(result.user);
    }).catch(() => router.replace("/login")).finally(() => { if (active) setSessionChecked(true); });
    return () => { active = false; };
  }, [router]);

  if (!sessionChecked || !session) return <main className="auth-page"><div className="auth-loading">Loading your studio account…</div></main>;

  const allowedNavigation = (label: string) => {
    if (session.role === "admin") return true;
    const access: Record<string, string[]> = {
      manager: ["Overview", "Bookings", "Clients", "Production", "Equipment", "Memberships", "Staff & tasks", "Reports"],
      reception: ["Overview", "Bookings", "Clients", "Payments & invoices", "Memberships", "Staff & tasks"],
      editor: ["Overview", "Bookings", "Production", "Equipment", "Staff & tasks"],
      finance: ["Overview", "Clients", "Payments & invoices", "Memberships", "Reports"],
    };
    return access[session.role]?.includes(label) ?? false;
  };

  const showNotice = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2800);
  };

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileMenuOpen ? "sidebar-open" : ""}`}>
        <div className="brand-row">
          <div className="brand-mark"><span>s</span></div>
          <div><div className="brand-name">studio<span>.</span></div><div className="brand-caption">OPERATIONS DESK</div></div>
          <button className="mobile-close icon-button" aria-label="Close menu" onClick={() => setMobileMenuOpen(false)}><X size={18} /></button>
        </div>

        <button className="workspace-switcher">
          <div className="workspace-avatar">M</div>
          <div className="workspace-copy"><strong>Studio workspace</strong><span>Dubai, UAE</span></div>
          <ChevronDown size={15} className="muted-icon" />
        </button>

        <div className="nav-section-label">WORKSPACE</div>
        <nav className="nav-list" aria-label="Workspace navigation">
          {navigation.filter(({ label }) => allowedNavigation(label)).map(({ label, icon: Icon, badge }) => (
            <button key={label} className={`nav-item ${activePage === label || (label === "Bookings" && activePage === "New booking") ? "nav-active" : ""}`} onClick={() => { router.push(label === "Overview" ? "/" : `/${label.toLowerCase()}`); setMobileMenuOpen(false); }}>
              <Icon size={18} strokeWidth={1.8} /><span>{label}</span>{badge && <span className="nav-badge">{badge}</span>}
            </button>
          ))}
        </nav>
        <div className="nav-section-label management-label">MANAGE</div>
        <nav className="nav-list" aria-label="Management navigation">
          {management.filter(({ label }) => allowedNavigation(label)).map(({ label, icon: Icon }) => (
            <button key={label} className={`nav-item ${activePage === label ? "nav-active" : ""}`} onClick={() => { router.push(`/${label === "Payments & invoices" ? "payments" : label === "Staff & tasks" ? "tasks" : label.toLowerCase()}`); setMobileMenuOpen(false); }}>
              <Icon size={18} strokeWidth={1.8} /><span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-spacer" />
        <div className="upgrade-card">
          <div className="upgrade-icon"><Sparkles size={16} /></div>
          <strong>Make room for more</strong>
          <p>See how your studio is growing this month.</p>
          <button onClick={() => showNotice("Your monthly studio report is being prepared.")}>View studio report <ArrowRight size={14} /></button>
        </div>
        <button className="nav-item help-link" onClick={() => showNotice("Help center is coming soon.")}><LifeBuoy size={18} /><span>Help & support</span></button>
          <div className="profile-row">
            <div className="profile-avatar">{session.fullName.split(/\s+/).map((part) => part[0] ?? "").join("").slice(0, 2).toUpperCase()}</div>
            <div className="profile-copy"><strong>{session.fullName}</strong><span>{session.role} · {session.email}</span></div>
           <button className="icon-button" aria-label="Sign out" title="Sign out" onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); router.replace("/login"); router.refresh(); }}><MoreHorizontal size={19} /></button>
        </div>
      </aside>

      {mobileMenuOpen && <button className="sidebar-backdrop" aria-label="Close navigation" onClick={() => setMobileMenuOpen(false)} />}

      <main className="main-panel">
        <header className="topbar">
          <button className="mobile-menu icon-button" aria-label="Open menu" onClick={() => setMobileMenuOpen(true)}><Menu size={20} /></button>
          <div className="breadcrumbs"><span>Workspace</span><span className="crumb-divider">/</span><strong>{activePage}</strong></div>
          <div className="topbar-actions">
            <div className="search-box"><Search size={16} /><span>Search anything...</span><kbd>⌘ K</kbd></div>
            <button className="icon-button notification-button" aria-label="Notifications" aria-expanded={notificationsOpen} onClick={() => setNotificationsOpen((open) => !open)}><Bell size={18} />{unreadNotifications > 0 && <i />}</button>
            {notificationsOpen && <section className="notification-popover" aria-label="Notifications"><div className="notification-popover-header"><div><strong>Notifications</strong><small>{unreadNotifications ? `${unreadNotifications} new updates` : "You’re all caught up"}</small></div><button onClick={() => setNotificationsOpen(false)} aria-label="Close notifications"><X size={16} /></button></div>{notifications.map((item) => <button className={`notification-item ${item.read ? "notification-read" : ""}`} key={item.id} onClick={() => { setNotifications((current) => current.map((note) => note.id === item.id ? { ...note, read: true } : note)); setNotificationsOpen(false); if (item.href) router.push(item.href); }}><span className={`notification-mark ${item.tone}`}><item.icon size={15} /></span><span><strong>{item.title}</strong><small>{item.message}</small><em>{item.time}</em></span>{!item.read && <i />}</button>)}<button className="notification-mark-all" onClick={() => setNotifications((current) => current.map((item) => ({ ...item, read: true })))}>Mark all as read</button></section>}
            <div className="topbar-divider" />
            <div className="today-date"><CalendarDays size={16} /><span>Friday, 9 October 2026</span></div>
          </div>
        </header>

        <div className={`dashboard-content ${activePage === "Overview" ? "" : "module-active"}`}>
          {activePage !== "Overview" && (allowedNavigation(activePage === "Client profile" ? "Clients" : activePage) ? <ModuleWorkspace activePage={activePage} pathname={pathname} onNotify={showNotice} /> : <section className="module-card access-denied-card"><ShieldCheck size={24} /><h1>Access restricted</h1><p>Your {session.role} account does not have permission to open this workspace.</p></section>)}
          <section className="welcome-row">
            <div>
              <div className="eyebrow"><span className="live-dot" /> YOUR STUDIO AT A GLANCE</div>
              <h1>Good morning, Malik <span className="wave">✳</span></h1>
              <p className="welcome-subtitle">Here&apos;s what&apos;s happening at your studio today.</p>
            </div>
            <button className="primary-button" onClick={() => router.push("/bookings/new")}><Plus size={17} /> New booking</button>
          </section>

          <section className="stats-grid" aria-label="Today's statistics">
            <article className="stat-card">
              <div className="stat-top"><span className="stat-label">Bookings today</span><span className="stat-icon icon-purple"><CalendarDays size={17} /></span></div>
              <div className="stat-number">08<span className="stat-total"> / 12</span></div>
              <div className="stat-foot"><span className="trend positive"><ArrowUpRight size={14} /> 12.5%</span><span>vs. last Friday</span></div>
              <div className="mini-progress"><i style={{ width: "67%" }} /></div>
            </article>
            <article className="stat-card">
              <div className="stat-top"><span className="stat-label">Revenue today</span><span className="stat-icon icon-green"><CircleDollarSign size={18} /></span></div>
              <div className="stat-number"><span className="currency">AED</span> 4,850</div>
              <div className="stat-foot"><span className="trend positive"><ArrowUpRight size={14} /> 8.2%</span><span>vs. last Friday</span></div>
              <div className="stat-note"><span className="note-dot green-dot" /> AED 1,200 pending</div>
            </article>
            <article className="stat-card">
              <div className="stat-top"><span className="stat-label">Pending payments</span><span className="stat-icon icon-amber"><Wallet size={17} /></span></div>
              <div className="stat-number">AED 3,200</div>
              <div className="stat-foot"><span className="pending-copy">4 invoices</span><span>awaiting payment</span></div>
              <div className="stat-link" onClick={() => router.push("/payments")}>Review invoices <ArrowRight size={13} /></div>
            </article>
            <article className="stat-card">
              <div className="stat-top"><span className="stat-label">Active memberships</span><span className="stat-icon icon-blue"><Users size={17} /></span></div>
              <div className="stat-number">24<span className="stat-total"> members</span></div>
              <div className="stat-foot"><span className="trend positive"><ArrowUpRight size={14} /> 2 new</span><span>this month</span></div>
              <div className="avatar-stack"><span className="stack-one">SK</span><span className="stack-two">OA</span><span className="stack-three">+22</span><small>Growing community</small></div>
            </article>
          </section>

          <section className="middle-grid">
            <article className="panel utilization-panel">
              <div className="panel-heading">
                <div><h2>Studio utilization</h2><p>Hours booked across your studios</p></div>
                <button className="select-button" onClick={() => setPeriod(period === "This week" ? "This month" : "This week")}>{period}<ChevronDown size={14} /></button>
              </div>
              <div className="utilization-summary"><strong>68<span>%</span></strong><span className="trend positive"><ArrowUpRight size={14} /> 6.4%</span><small>vs. previous period</small></div>
              <div className="chart" role="img" aria-label="Bar chart showing studio utilization from Saturday through Friday">
                <div className="chart-grid"><span>100%</span><span>75%</span><span>50%</span><span>25%</span></div>
                <div className="chart-bars">{chartData.map((item) => <div className="chart-column" key={item.day}><div className="bar-track"><div className={`bar-fill ${item.day === "Fri" ? "bar-today" : ""}`} style={{ height: `${item.value}%` }} /></div><span className={item.day === "Fri" ? "day-today" : ""}>{item.day}</span></div>)}</div>
              </div>
              <div className="chart-legend"><span><i className="legend-dot studio-a-dot" /> Studio A <b>72%</b></span><span><i className="legend-dot studio-b-dot" /> Studio B <b>64%</b></span></div>
            </article>

            <article className="panel production-panel">
              <div className="panel-heading"><div><h2>Production pipeline</h2><p>Episodes moving through the studio</p></div><button className="more-button" aria-label="More production options" onClick={() => showNotice("Production overview selected.")}><MoreHorizontal size={20} /></button></div>
              <div className="pipeline-total"><strong>16</strong><span>episodes in progress</span><span className="pipeline-trend"><ArrowUpRight size={14} /> 3 this week</span></div>
              <div className="pipeline-list">
                <div className="pipeline-row"><span className="pipeline-icon recorded"><Headphones size={15} /></span><div className="pipeline-copy"><strong>Recorded</strong><span>Ready for post-production</span></div><b>05</b></div>
                <div className="pipeline-row"><span className="pipeline-icon editing"><Video size={15} /></span><div className="pipeline-copy"><strong>Editing</strong><span>With your production team</span></div><b>07</b></div>
                <div className="pipeline-row"><span className="pipeline-icon review"><FileText size={15} /></span><div className="pipeline-copy"><strong>Client review</strong><span>Waiting for approval</span></div><b>04</b></div>
              </div>
              <button className="panel-link" onClick={() => router.push("/production")}>View production board <ArrowRight size={14} /></button>
            </article>
          </section>

          <section className="bottom-grid">
            <article className="panel bookings-panel">
              <div className="panel-heading bookings-heading"><div><div className="title-with-count"><h2>Today&apos;s bookings</h2><span className="count-pill">8</span></div><p>Your studio schedule for Friday</p></div><button className="text-action" onClick={() => router.push("/bookings/calendar")}>View calendar <ArrowRight size={14} /></button></div>
              <div className="booking-table-wrap"><table className="booking-table"><thead><tr><th>TIME</th><th>CLIENT & SESSION</th><th>STUDIO</th><th>STATUS</th><th>DURATION</th><th /></tr></thead><tbody>{bookings.map((booking) => <tr key={booking.name}><td className="time-cell">{booking.time}</td><td><div className="client-cell"><span className={`client-avatar ${booking.color}`}>{booking.initials}</span><span className="client-info"><strong>{booking.name}</strong><small>{booking.detail}</small></span></div></td><td><span className="studio-label"><span />{booking.studio}</span></td><td><span className={`status-pill ${booking.status === "In session" ? "status-live" : booking.status === "Pending" ? "status-pending" : "status-confirmed"}`}>{booking.status === "In session" && <i />}{booking.status}</span></td><td className="duration-cell"><Clock3 size={13} />{booking.duration}</td><td><button className="row-more" aria-label={`More options for ${booking.name}`} onClick={() => showNotice(`${booking.name}'s booking details selected.`)}><MoreHorizontal size={18} /></button></td></tr>)}</tbody></table></div>
              <button className="mobile-view-calendar" onClick={() => router.push("/bookings/calendar")}>View all bookings <ArrowRight size={14} /></button>
            </article>

            <article className="panel tasks-panel">
              <div className="panel-heading"><div><div className="title-with-count"><h2>Upcoming tasks</h2><span className="count-pill task-count">3</span></div><p>Keep today running smoothly</p></div><button className="more-button" aria-label="More task options" onClick={() => showNotice("Task list options selected.")}><MoreHorizontal size={20} /></button></div>
              <div className="task-list">
                <button className="task-item" onClick={() => showNotice("Studio A prep task opened.")}><span className="task-check"><Check size={12} /></span><span className="task-copy"><strong>Prepare Studio A</strong><small><span className="task-time urgent-time">Due in 20 min</span><i /> Booking prep</small></span><span className="task-avatar avatar-layla">LA</span></button>
                <button className="task-item" onClick={() => showNotice("Audio review task opened.")}><span className="task-check" /><span className="task-copy"><strong>Review episode audio</strong><small><span className="task-time">Due at 12:00 PM</span><i /> Post-production</small></span><span className="task-avatar avatar-yousef">YK</span></button>
                <button className="task-item" onClick={() => showNotice("Invoice task opened.")}><span className="task-check" /><span className="task-copy"><strong>Send invoice to Omar</strong><small><span className="task-time">Due at 2:00 PM</span><i /> Finance</small></span><span className="task-avatar avatar-malik">MM</span></button>
              </div>
              <button className="panel-link task-panel-link" onClick={() => router.push("/tasks")}>Open task manager <ArrowRight size={14} /></button>
            </article>
          </section>

          <footer className="dashboard-footer"><span>© 2026 Studio Operations</span><span><span className="footer-status" /> All systems operational</span><button onClick={() => showNotice("Settings are coming soon.")}><Settings2 size={13} /> Settings</button><span className="footer-shortcut"><Command size={12} /> Made for the work behind the mic</span></footer>
        </div>
      </main>
      {notice && <div className="toast-message"><span><Check size={15} /></span>{notice}<button aria-label="Dismiss message" onClick={() => setNotice("")}><X size={15} /></button></div>}
    </div>
  );
}
