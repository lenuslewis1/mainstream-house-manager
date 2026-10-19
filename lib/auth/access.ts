export function canAccessWorkspace(email: string) {
  const emails = (process.env.WORKSPACE_ALLOWED_EMAILS || "lenuslewis40@gmail.com,mainstreammediahouse7@gmail.com")
    .split(",").map(value => value.trim().toLowerCase()).filter(Boolean);
  return emails.includes(email.toLowerCase());
}
