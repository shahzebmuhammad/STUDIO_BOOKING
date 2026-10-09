import { Suspense } from "react";
import Home from "@/app/page";

export default function ClientProfilePage() {
  return <Suspense fallback={<main className="dashboard-content"><p>Loading client profile…</p></main>}><Home /></Suspense>;
}
