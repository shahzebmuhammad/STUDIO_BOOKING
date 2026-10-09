"use client";

import { createClient } from "@/lib/supabase/client";

export async function uploadOrganizationFile(bucket: "client-media" | "equipment-media" | "payment-receipts", file: File) {
  const supabase = createClient();
  const { data: verifiedToken, error: authError } = await supabase.auth.getClaims();
  const claims = verifiedToken?.claims;
  if (authError || !claims?.sub) throw new Error("Sign in before uploading files.");
  const { data: membership, error: membershipError } = await supabase.from("organization_members").select("organization_id").eq("user_id", claims.sub).order("created_at", { ascending: true }).limit(1).single();
  if (membershipError || !membership) throw new Error("A studio workspace is required before uploading files.");
  const safeName = file.name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").slice(-100) || "upload";
  const path = `${membership.organization_id}/${crypto.randomUUID()}-${safeName}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new Error(`Upload failed: ${error.message}`);
  return `${bucket}:${path}`;
}

export async function getOrganizationFileUrl(reference: string) {
  const separator = reference.indexOf(":");
  if (separator < 1) return null;
  const bucket = reference.slice(0, separator);
  if (!["client-media", "equipment-media", "payment-receipts"].includes(bucket)) return null;
  const path = reference.slice(separator + 1);
  const supabase = createClient();
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 10);
  if (error) throw error;
  return data.signedUrl;
}
