import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Simplified middleware for local-first app
 * No authentication checks - all routes are public
 */
export async function middleware(req: NextRequest) {
  // Simply pass through all requests
  return NextResponse.next({ request: req });
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
