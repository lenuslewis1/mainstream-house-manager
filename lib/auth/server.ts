import { createNeonAuth } from "@neondatabase/auth/next/server";

// Lazy initialization lets builds run without embedding branch credentials.
export function getAuth() {
  const baseUrl = process.env.NEON_AUTH_BASE_URL;
  const secret = process.env.NEON_AUTH_COOKIE_SECRET;
  if (!baseUrl || !secret) throw new Error("Neon Auth environment is missing. Run neon deploy and configure NEON_AUTH_COOKIE_SECRET.");
  return createNeonAuth({ baseUrl, cookies: { secret, sessionDataTtl: 60 } });
}
