"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, KeyRound, LockKeyhole, Mail, ShieldCheck } from "lucide-react";

type User = { id: string; email: string; fullName: string; role: string; mustChangePassword: boolean };

export default function LoginPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nextPassword, setNextPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch(user ? "/api/auth/password" : "/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(user ? { currentPassword: password, newPassword: nextPassword } : { email, password }) });
      const result = await response.json() as { user?: User; error?: string };
      if (!response.ok || !result.user) throw new Error(result.error || "Sign in failed.");
      if (result.user.mustChangePassword) {
        setUser(result.user);
        setPassword("");
        return;
      }
      router.replace("/");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not sign in.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="auth-page"><section className="auth-card"><div className="auth-brand-mark">s</div><div className="module-eyebrow">STUDIO OPERATIONS</div><h1>{user ? "Set your password" : "Welcome back"}</h1><p className="auth-subtitle">{user ? "Your temporary password worked. Choose a private password to continue." : "Sign in with the studio account your administrator created."}</p><form className="auth-form" onSubmit={submit}>{!user && <label className="field-label">Email address<span className="auth-input-wrap"><Mail size={16} /><input type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></span></label>}<label className="field-label">{user ? "Temporary password" : "Password"}<span className="auth-input-wrap"><LockKeyhole size={16} /><input type="password" autoComplete={user ? "current-password" : "current-password"} minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" /></span></label>{user && <label className="field-label">New password<span className="auth-input-wrap"><KeyRound size={16} /><input type="password" autoComplete="new-password" minLength={12} required value={nextPassword} onChange={(event) => setNextPassword(event.target.value)} placeholder="At least 12 characters" /></span></label>}{error && <p className="auth-error" role="alert">{error}</p>}<button className="primary-button auth-submit" disabled={busy}>{busy ? "Please wait…" : user ? "Save password" : "Sign in"}<ArrowRight size={16} /></button></form><div className="auth-security"><ShieldCheck size={15} /> Accounts and permissions are managed by your studio administrator</div></section></main>;
}
