import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  if (!isSupabaseConfigured) return NextResponse.next();
  return updateSession(request);
}

export const config = {
  // Skip static files, the widget bundle and public APIs (they don't use cookies).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|widget.js|api/chat|api/widget-config|api/inngest|api/razorpay|.*\\.(?:svg|png|jpg|webp)$).*)"],
};
