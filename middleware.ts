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
          // Update request cookies
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          
          // Create new response with updated cookies
          supabaseResponse = NextResponse.next({
            request,
          });
          
          // Set cookies on response with proper options
          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, {
              httpOnly: options?.httpOnly ?? false,
              secure: options?.secure ?? process.env.NODE_ENV === "production",
              sameSite: (options?.sameSite as "lax" | "strict" | "none") ?? "lax",
              path: options?.path ?? "/",
              ...(options?.maxAge && { maxAge: options.maxAge }),
              ...(options?.expires && { expires: options.expires }),
              ...(options?.domain && { domain: options.domain }),
            });
          });
        },
      },
    }
  );

  // Get user - this automatically refreshes the session if needed
  // We call getUser first as it handles session refresh automatically
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  // Get session after getUser (which may have refreshed it)
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // Only log auth errors
  if (authError) {
    console.error("[Middleware] Auth error:", authError.message);
  }

  if (
    !user &&
    !request.nextUrl.pathname.startsWith("/login") &&
    !request.nextUrl.pathname.startsWith("/signup") &&
    request.nextUrl.pathname !== "/manifest.json"
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
