"use client";
let client: ReturnType<typeof import("@neondatabase/auth/next").createAuthClient> | undefined;
// The SDK generates a UUID at module load. Defer its import until a browser
// interaction so Cloudflare's server renderer does not evaluate it globally.
export async function getAuthClient() {
  if (!client) {
    const { createAuthClient } = await import("@neondatabase/auth/next");
    client = createAuthClient();
  }
  return client;
}
