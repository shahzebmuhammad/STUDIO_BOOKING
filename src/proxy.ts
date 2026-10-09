import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseConfig } from "@/lib/supabase/config";

export async function proxy(request: NextRequest) {
  const config = getSupabaseConfig();
  // Preserve the current prototype experience until project env vars are configured.
  if (!config) return NextResponse.next({ request });

  let response = NextResponse.next({ request });
  const supabase = createServerClient(config.url, config.publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, cacheHeaders) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(cacheHeaders).forEach(([name, value]) => response.headers.set(name, value));
      },
    },
  });

  const { data: verifiedToken, error: claimsError } = await supabase.auth.getClaims();
  const claims = verifiedToken?.claims;
  const pathname = request.nextUrl.pathname;
  const isLogin = pathname === "/login";
  const isSetup = pathname === "/setup";
  const isAuthCallback = pathname === "/auth/callback";

  if (isLogin || isAuthCallback) {
    if (!claimsError && claims?.sub && isLogin) return NextResponse.redirect(new URL("/", request.url));
    return response;
  }

  if (claimsError || !claims?.sub) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    const redirect = NextResponse.redirect(loginUrl);
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  }

  if (!isSetup) {
    const { data: membership, error } = await supabase
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", claims.sub)
      .limit(1)
      .maybeSingle();

    if (error || !membership) {
      const setupUrl = new URL("/setup", request.url);
      if (error) setupUrl.searchParams.set("database", "not-ready");
      const redirect = NextResponse.redirect(setupUrl);
      response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
      return redirect;
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
