import {NextResponse, type NextRequest} from "next/server";

import {ACTIVE_ACCOUNT_COOKIE} from "@/lib/cookie-names";

export function middleware(request: NextRequest): NextResponse {
  const hasAccount = request.cookies.get(ACTIVE_ACCOUNT_COOKIE)?.value;
  if (!hasAccount) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/app/:path*"],
};
