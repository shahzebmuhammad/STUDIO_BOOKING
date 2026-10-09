import { createClient } from "@/lib/supabase/server";

export async function getActiveOrganizationId() {
  const supabase = await createClient();
  const { data: verifiedToken, error: claimsError } = await supabase.auth.getClaims();
  const claims = verifiedToken?.claims;
  if (claimsError || !claims?.sub) return { organizationId: null, error: claimsError ?? new Error("Sign in is required.") };

  const { data, error } = await supabase
    .from("organization_members")
    .select("organization_id, created_at")
    .eq("user_id", claims.sub)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  return { organizationId: data?.organization_id ?? null, error };
}
