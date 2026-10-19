declare namespace Cloudflare {
  interface Env {
    DATABASE_URL?: string;
    DATABASE_URL_UNPOOLED?: string;
    NEON_AUTH_BASE_URL?: string;
    NEON_AUTH_JWKS_URL?: string;
    NEON_AUTH_COOKIE_SECRET?: string;
    WORKSPACE_ALLOWED_EMAILS?: string;
    OPENAI_API_KEY?: string;
    OPENAI_MODEL?: string;
  }
}
