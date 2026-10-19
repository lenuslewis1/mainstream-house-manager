"use client";
import { getAuthClient } from "@/lib/auth/client";
import { useState } from "react";
export default function SignOut() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return <><button className="auth-signout" disabled={busy} onClick={async () => {
    setBusy(true); setError("");
    try { const result = await (await getAuthClient()).signOut(); if (result.error) throw new Error("Sign out failed. Please retry."); window.location.assign("/auth/sign-in"); }
    catch { setError("Sign out failed. Please retry."); setBusy(false); }
  }}>{busy ? "Signing out…" : "Sign out"}</button>{error && <p role="alert">{error}</p>}</>;
}
