"use client";
import { useState } from "react";
import { getAuthClient } from "@/lib/auth/client";
import AuthFrame from "../auth-frame";

export default function ForgotPassword() {
  const [email,setEmail]=useState("");
  const [busy,setBusy]=useState(false),[sent,setSent]=useState(false),[error,setError]=useState("");
  async function submit(event:React.FormEvent) {
    event.preventDefault();if(busy)return;setBusy(true);setError("");
    try {
      const client=await getAuthClient();
      const result=await client.requestPasswordReset({email:email.trim(),redirectTo:`${window.location.origin}/auth/reset-password`});
      if(result.error)throw new Error("Could not request a reset. Please wait a moment and try again.");
      setSent(true);
    }catch(cause){setError(cause instanceof Error?cause.message:"Could not request a reset. Please retry.");}
    finally{setBusy(false);}
  }
  return <AuthFrame title="Forgot your password?" description="Enter your account email and we’ll send you a password reset link.">
    {sent?<p role="status">If an account exists for that email, you’ll receive a reset link. Check your inbox and spam folder.</p>:<form onSubmit={submit}>
      <label>Email<input type="email" autoComplete="email" autoFocus required maxLength={254} value={email} disabled={busy} onChange={e=>setEmail(e.target.value)}/></label>
      {error&&<p role="alert" className="auth-error">{error}</p>}
      <button type="submit" disabled={busy}>{busy?"Sending…":"Send reset link"}</button>
    </form>}
    {sent&&<button className="auth-link" onClick={()=>{setSent(false);setError("");}}>Try another email or resend</button>}
    <a className="auth-link" href="/auth/sign-in">Back to sign in</a>
  </AuthFrame>;
}
