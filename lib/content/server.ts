/**
 * Server content client for the public archive.
 */

import { getLocalServerClient } from "@/lib/local-db/server";

/**
 * Get the server-side content client.
 * No cookie handling, authentication, or hosted database is needed.
 */
export function getServerContentClient() {
  return getLocalServerClient();
}
