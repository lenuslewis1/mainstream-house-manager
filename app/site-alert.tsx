"use client";

import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, ArrowRight, CheckCircle2, Trash2, X } from "lucide-react";

type ConfirmOptions = { title: string; message: string; confirmLabel?: string; tone?: "danger" | "default" };
type PendingConfirm = ConfirmOptions & { resolve: (accepted: boolean) => void };

const ConfirmContext = createContext<((options: ConfirmOptions) => Promise<boolean>) | null>(null);

function SiteDialog({ title, message, confirmLabel, tone = "default", onConfirm, onClose, secondaryLabel = "Cancel" }: ConfirmOptions & { onConfirm: () => void; onClose: () => void; secondaryLabel?: string }) {
  const titleId = useId();
  const messageId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    if (!mounted) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialogRef.current?.querySelector<HTMLButtonElement>("[data-initial-focus]")?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") { event.preventDefault(); onClose(); return; }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const buttons = Array.from(dialogRef.current.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"));
      if (!buttons.length) return;
      const first = buttons[0], last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => { document.removeEventListener("keydown", onKeyDown); previous?.focus(); };
  }, [mounted, onClose]);
  if (!mounted) return null;
  return createPortal(<div className="site-alert-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div ref={dialogRef} className={`site-alert-modal ${tone === "danger" ? "site-alert-danger" : ""}`} role="alertdialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={messageId}>
      <button type="button" className="site-alert-close" onClick={onClose} aria-label="Close dialog"><X size={18}/></button>
      <div className="site-alert-icon" aria-hidden="true">{tone === "danger" ? <Trash2 size={23}/> : <AlertCircle size={23}/>}</div>
      <span className="section-number">MAINSTREAM HOUSE / NOTICE</span>
      <h2 id={titleId}>{title}</h2>
      <p id={messageId}>{message}</p>
      <div className="site-alert-actions">
        {secondaryLabel && <button data-initial-focus type="button" className="site-alert-secondary" onClick={onClose}>{secondaryLabel}</button>}
        <button data-initial-focus={!secondaryLabel ? true : undefined} type="button" className="site-alert-primary" onClick={onConfirm}>{tone === "danger" ? <Trash2 size={16}/> : <CheckCircle2 size={16}/>} {confirmLabel || "Continue"} <ArrowRight size={15}/></button>
      </div>
    </div>
  </div>, document.body);
}

export function SiteAlertProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const confirm = useCallback((options: ConfirmOptions) => new Promise<boolean>(resolve => setPending({ ...options, resolve })), []);
  function close(accepted: boolean) { pending?.resolve(accepted); setPending(null); }
  return <ConfirmContext.Provider value={confirm}>{children}{pending && <SiteDialog title={pending.title} message={pending.message} confirmLabel={pending.confirmLabel} tone={pending.tone} onConfirm={() => close(true)} onClose={() => close(false)}/>}</ConfirmContext.Provider>;
}

export function useSiteConfirm() {
  const confirm = useContext(ConfirmContext);
  if (!confirm) throw new Error("SiteAlertProvider is missing.");
  return confirm;
}

export function AlertMessage({ message, onRetry }: { message: string; onRetry?: () => void | Promise<void> }) {
  const [open, setOpen] = useState(true);
  useEffect(() => { setOpen(true); }, [message]);
  if (!message || !open) return null;
  return <SiteDialog title="Something went wrong" message={message} confirmLabel={onRetry ? "Try again" : "Got it"} secondaryLabel="" onClose={() => setOpen(false)} onConfirm={() => { setOpen(false); if (onRetry) void onRetry(); }}/>
}
