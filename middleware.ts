import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: any }>) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session first - this ensures cookies are properly synced
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // Get user - this automatically refreshes the session if needed
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  // Debug logging (remove in production)
  if (process.env.NODE_ENV === "development") {
    const cookies = request.cookies.getAll();
    const authCookies = cookies.filter((c) => c.name.includes("auth-token"));
    console.log("[Middleware] Path:", request.nextUrl.pathname);
    console.log("[Middleware] Auth cookies:", authCookies.map((c) => `${c.name}=${c.value.substring(0, 20)}...`));
    console.log("[Middleware] Session:", session ? `exists (expires: ${new Date(session.expires_at! * 1000).toISOString()})` : "null");
    console.log("[Middleware] User:", user ? user.id : "null");
    if (authError) {
      console.log("[Middleware] Auth error:", authError.message);
    }
  }

  if (
    !user &&
    !request.nextUrl.pathname.startsWith("/login") &&
    !request.nextUrl.pathname.startsWith("/signup")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (
    user &&
    (request.nextUrl.pathname === "/login" ||
      request.nextUrl.pathname === "/signup")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
