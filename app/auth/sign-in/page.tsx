"use client";

import { useState } from "react";
import { getAuthClient } from "@/lib/auth/client";
import { safeReturnTo } from "@/lib/auth/return-to";

export default function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [mode, setMode] = useState<"signin" | "signup" | "verify">("signin");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function sendCode() {
    const authClient = await getAuthClient();
    const result = await authClient.emailOtp.sendVerificationOtp({ email, type: "email-verification" });
    if (result.error) throw new Error(result.error.message || "Could not send a verification code.");
    setMode("verify");
    setMessage("Check your email for a verification code.");
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      const authClient = await getAuthClient();
      if (mode === "verify") {
        const result = await authClient.emailOtp.verifyEmail({ email, otp: code });
        if (result.error) throw new Error(result.error.message || "Could not verify your email.");
        setMode("signin"); setMessage("Email verified. Sign in to continue."); return;
      }
      const result = mode === "signup"
        ? await authClient.signUp.email({ email, password, name })
        : await authClient.signIn.email({ email, password });
      if (result.error) throw new Error(result.error.message || "Could not sign in.");
      if (mode === "signup") { await sendCode(); return; }
      const session = await authClient.getSession();
      if (!session.data?.user.emailVerified) { await sendCode(); return; }
      const access = await fetch("/api/session", { cache: "no-store" });
      if (!access.ok) throw new Error("This account is not approved for the workspace.");
      const returnTo = new URLSearchParams(window.location.search).get("return_to") || "/";
      window.location.assign(safeReturnTo(returnTo));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not sign in. Please retry."); }
    finally { setBusy(false); }
  }
  return <main className="auth-shell" data-auth-mode={mode}>
    <div className="auth-backdrop" aria-hidden="true">
      <img className="auth-photo auth-photo-signin" src="/images/auth/creative-portrait.jpg" alt="" fetchPriority="high" />
      <img className="auth-photo auth-photo-signup" src="/images/auth/creative-future.jpg" alt="" />
      <img className="auth-photo auth-photo-verify" src="/images/auth/creative-lightbulb.jpg" alt="" />
      <div className="auth-overlay" />
    </div>
    <section className="auth-card" aria-labelledby="auth-heading">
    <img src="/favicon.svg" width="48" height="48" alt="Mainstream House" />
    <p className="auth-eyebrow">MAINSTREAM HOUSE MANAGER</p>
    <h1 id="auth-heading">{mode === "signup" ? "Create your account" : mode === "verify" ? "Verify your email" : "Welcome back"}</h1>
    <p>{mode === "signup" ? "Join your private team workspace." : mode === "verify" ? "Confirm your email to access your workspace." : "Sign in to your private team workspace."}</p>
    <form onSubmit={submit}>
      {mode === "signup" && <label>Name<input autoComplete="name" value={name} onChange={e => setName(e.target.value)} required maxLength={160} /></label>}
      <label>Email<input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required /></label>
      {mode !== "verify" ? <label>Password<input type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} value={password} onChange={e => setPassword(e.target.value)} minLength={8} required /></label>
        : <label>Verification code<input inputMode="numeric" autoComplete="one-time-code" value={code} onChange={e => setCode(e.target.value)} required /></label>}
      {error && <p role="alert" className="auth-error">{error}</p>}
      {message && <p role="status">{message}</p>}
      <button type="submit" disabled={busy}>{busy ? "Please wait…" : mode === "signup" ? "Create account" : mode === "verify" ? "Verify email" : "Sign in"}</button>
    </form>
    <button className="auth-link" disabled={busy} onClick={() => { setMode(mode === "signup" ? "signin" : "signup"); setError(""); setMessage(""); }}>{mode === "signup" ? "Already have an account? Sign in" : "First time here? Create an account"}</button>
    {mode === "signin" && <button className="auth-link" disabled={busy || !email} onClick={async () => { setBusy(true); setError(""); try { await sendCode(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not send code."); } finally { setBusy(false); } }}>Verify an existing account</button>}
  </section></main>;
}
