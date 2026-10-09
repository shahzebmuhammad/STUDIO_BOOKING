import { Suspense } from "react";
import { LoginWorkspace } from "@/components/SupabaseAuth";

export default function LoginPage() {
  return <Suspense fallback={<main className="auth-page"><p>Loading sign-in…</p></main>}><LoginWorkspace /></Suspense>;
}
