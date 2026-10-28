import type { ReactNode } from "react";

export default function AuthFrame({title,description,children}:{title:string;description:string;children:ReactNode}) {
  return <main className="auth-shell" data-auth-mode="signin">
    <div className="auth-backdrop" aria-hidden="true">
      <img className="auth-photo auth-photo-signin" src="/images/auth/creative-portrait.jpg" alt="" fetchPriority="high"/>
      <div className="auth-overlay"/>
    </div>
    <section className="auth-card" aria-labelledby="auth-heading">
      <img src="/favicon.svg" width="48" height="48" alt="Mainstream House"/>
      <p className="auth-eyebrow">MAINSTREAM HOUSE MANAGER</p>
      <h1 id="auth-heading">{title}</h1><p>{description}</p>{children}
    </section>
  </main>;
}
