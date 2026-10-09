"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Database, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function LoginWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const supabase = createClient();
      if (mode === "sign-up") {
        const { data, error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
        });
        if (authError) throw authError;
        if (!data.session) {
          setMessage("Check your email and confirm the address before signing in.");
          return;
        }
      } else {
        const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
        if (authError) throw authError;
      }
      const { data: verifiedToken } = await supabase.auth.getClaims();
      const claims = verifiedToken?.claims;
      const { data: membership, error: membershipError } = await supabase.from("organization_members").select("organization_id").eq("user_id", claims?.sub ?? "").limit(1).maybeSingle();
      if (membershipError) throw membershipError;
      const requestedNext = searchParams.get("next");
      const next = requestedNext?.startsWith("/") && !requestedNext.startsWith("//") ? requestedNext : "/";
      router.replace(membership ? next : "/setup");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Authentication failed. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return <main className="auth-page"><section className="auth-card"><div className="auth-brand-mark">s</div><div className="module-eyebrow">STUDIO OPERATIONS</div><h1>{mode === "sign-in" ? "Welcome back" : "Create your account"}</h1><p className="auth-subtitle">{mode === "sign-in" ? "Sign in to manage your studio workspace." : "Register the workspace owner account to get started."}</p>
    <form className="auth-form" onSubmit={onSubmit}><label className="field-label">Email address<span className="auth-input-wrap"><Mail size={16} /><input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></span></label><label className="field-label">Password<span className="auth-input-wrap"><LockKeyhole size={16} /><input type={showPassword ? "text" : "password"} autoComplete={mode === "sign-in" ? "current-password" : "new-password"} minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" /><button type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword((value) => !value)}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></span></label>{error && <p className="auth-error" role="alert">{error}</p>}{message && <p className="auth-success" role="status">{message}</p>}<button className="primary-button auth-submit" disabled={busy}>{busy ? "Please wait…" : mode === "sign-in" ? "Sign in" : "Create account"}<ArrowRight size={16} /></button></form>
    <div className="auth-switch">{mode === "sign-in" ? "New to the workspace?" : "Already have an account?"}<button onClick={() => { setMode(mode === "sign-in" ? "sign-up" : "sign-in"); setError(""); setMessage(""); }}>{mode === "sign-in" ? "Create account" : "Sign in"}</button></div><div className="auth-security"><ShieldCheck size={15} /> Secured by Supabase Auth · workspace data is role-protected</div>
  </section></main>;
}

export function OrganizationSetupWorkspace() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const createOrganization = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const supabase = createClient();
      const { error: rpcError } = await supabase.rpc("create_organization", { org_name: name });
      if (rpcError) throw rpcError;
      setSuccess(true);
      router.replace("/");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create the studio workspace.");
    } finally {
      setBusy(false);
    }
  };

  return <main className="auth-page"><section className="auth-card setup-card"><div className="auth-brand-mark"><Database size={22} /></div><div className="module-eyebrow">DATABASE CONNECTED</div><h1>Set up your studio</h1><p className="auth-subtitle">Create the first workspace. Your account becomes its owner.</p><form className="auth-form" onSubmit={createOrganization}><label className="field-label">Studio or organization name<input autoFocus required minLength={2} maxLength={120} value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. City Studio" /></label>{error && <p className="auth-error" role="alert">{error}</p>}{success && <p className="auth-success" role="status">Workspace created. Opening dashboard…</p>}<button className="primary-button auth-submit" disabled={busy}>{busy ? "Creating…" : "Create workspace"}<ArrowRight size={16} /></button></form><div className="auth-security"><ShieldCheck size={15} /> Organization data is isolated by database row-level security</div></section></main>;
}
