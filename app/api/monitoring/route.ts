import { NextResponse } from "next/server";
import { serverLogger } from "@/lib/logger";

function parseDsn(dsn: string) {
  const match = dsn.match(/^https?:\/\/([^@]+)@([^/]+)\/(\d+)/);
  if (!match) throw new Error("Invalid DSN");
  return { publicKey: match[1], host: match[2], projectId: match[3] };
}

export async function POST(req: Request) {
  try {
    const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

    // Gracefully handle missing DSN (e.g., development without Sentry)
    if (!dsn) {
      serverLogger.warn('Sentry tunnel called without DSN configured', { path: '/api/monitoring' });
      return new NextResponse(null, { status: 204 }); // No Content - silent success
    }

    const { publicKey, host, projectId } = parseDsn(dsn);
    const url = `https://${host}/api/${projectId}/envelope/?sentry_key=${publicKey}&sentry_version=7`;

    const body = await req.arrayBuffer();
    const res = await fetch(url, { method: "POST", body });
    return new NextResponse(null, { status: res.status });
  } catch (err) {
    serverLogger.error(
      "Sentry tunnel failed",
      err instanceof Error ? err : undefined,
      { path: "/api/monitoring" }
    );
    return new NextResponse("error", { status: 500 });
  }
}
