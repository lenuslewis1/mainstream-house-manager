"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getAuthClient } from "@/lib/auth/client";
import AuthFrame from "../auth-frame";

function ResetForm() {
  const params=useSearchParams();const token=params.get("token");
  const [password,setPassword]=useState(""),[confirmation,setConfirmation]=useState("");
  const [busy,setBusy]=useState(false),[done,setDone]=useState(false),[error,setError]=useState("");
  async function submit(event:React.FormEvent) {
    event.preventDefault();if(busy||!token)return;setError("");
    if(password!==confirmation){setError("Passwords do not match.");return;}
    setBusy(true);
    try {
      const client=await getAuthClient();
      const result=await client.resetPassword({token,newPassword:password});
      if(result.error)throw new Error("This reset link may have expired or already been used. Request a new link and try again.");
      setPassword("");setConfirmation("");setDone(true);
      window.history.replaceState(null,"","/auth/reset-password");
    }catch(cause){setError(cause instanceof Error?cause.message:"Could not reset your password. Please retry.");}
    finally{setBusy(false);}
  }
  return <AuthFrame title={done?"Password updated":"Set a new password"} description={done?"Your password has been changed. Sign in with your new password.":"Choose a password with at least 8 characters."}>
    {done?<p role="status">Your new password is ready.</p>:!token||params.has("error")?<p role="alert" className="auth-error">This reset link is missing or invalid. Request a new link to continue.</p>:<form onSubmit={submit}>
      <label>New password<input autoFocus type="password" autoComplete="new-password" minLength={8} maxLength={128} required disabled={busy} value={password} onChange={e=>setPassword(e.target.value)}/></label>
      <label>Confirm new password<input type="password" autoComplete="new-password" minLength={8} maxLength={128} required disabled={busy} value={confirmation} onChange={e=>setConfirmation(e.target.value)}/></label>
      {error&&<p role="alert" className="auth-error">{error}</p>}
      <button type="submit" disabled={busy}>{busy?"Updating…":"Reset password"}</button>
    </form>}
    {!done&&<a className="auth-link" href="/auth/forgot-password">Request a new reset link</a>}
    <a className="auth-link" href="/auth/sign-in">Back to sign in</a>
  </AuthFrame>;
}
export default function ResetPassword(){return <Suspense fallback={<AuthFrame title="Reset password" description="Loading your reset link…">Loading…</AuthFrame>}><ResetForm/></Suspense>;}
