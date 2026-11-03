"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Bell, Castle, ChevronRight, CircleUserRound, LogOut, Music2, Volume2, X } from "lucide-react";
import { getMe, logout, type MeResponse } from "@/lib/api";
import LogoutConfirmModal from "@/components/navigation/LogoutConfirmModal";

type Section = "account" | "audio";
type Props = { me?: MeResponse; opener: HTMLElement | null; onClose: () => void };
const SECTIONS = [
  { id: "account", label: "Account", icon: CircleUserRound, description: "Your personal details" },
  { id: "audio", label: "Audio settings", icon: Volume2, description: "Sound preferences" },
] as const;
const AUDIO_CHANNELS = [
  { id: "master", label: "Master volume", icon: Volume2 },
  { id: "music", label: "Music", icon: Music2 },
  { id: "effects", label: "Sound effects", icon: Bell },
] as const;
const subscribeToMount = () => () => {};
const clientMounted = () => true;
const serverMounted = () => false;

export default function AccountSettingsModal({ me, opener, onClose }: Props) {
  const mounted = useSyncExternalStore(subscribeToMount, clientMounted, serverMounted);
  const router = useRouter();
  const [loadedAccount, setLoadedAccount] = useState<MeResponse>();
  const [loadError, setLoadError] = useState(false);
  const [section, setSection] = useState<Section>("account");
  const [closing, setClosing] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [logoutOpener, setLogoutOpener] = useState<HTMLButtonElement | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<number | null>(null);
  const logoutPendingRef = useRef(false);
  const account = me ?? loadedAccount;

  const requestClose = useCallback(() => {
    if (closing || showLogoutConfirm) return;
    setClosing(true);
    closeTimerRef.current = window.setTimeout(onClose, 180);
  }, [closing, onClose, showLogoutConfirm]);

  const closeLogoutConfirm = useCallback(() => {
    if (!logoutPendingRef.current) setShowLogoutConfirm(false);
  }, []);

  const handleLogout = async () => {
    if (logoutPendingRef.current) return;
    logoutPendingRef.current = true;
    setLoggingOut(true);
    setLogoutError(null);
    try {
      await logout();
      onClose();
      router.replace("/login");
    } catch {
      setLogoutError("Could not log out. Please try again.");
    } finally {
      logoutPendingRef.current = false;
      setLoggingOut(false);
    }
  };

  useEffect(() => {
    if (me) return;
    let cancelled = false;
    void getMe().then(data => { if (!cancelled) setLoadedAccount(data); }).catch(() => { if (!cancelled) setLoadError(true); });
    return () => { cancelled = true; };
  }, [me]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.body.classList.add("suri-overview-open");
    const focusFrame = window.requestAnimationFrame(() => closeButtonRef.current?.focus());
    return () => {
      window.cancelAnimationFrame(focusFrame);
      if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
      document.body.style.overflow = previousOverflow;
      document.body.classList.remove("suri-overview-open");
      opener?.focus();
    };
  }, [opener]);

  useEffect(() => {
    if (showLogoutConfirm) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); requestClose(); return; }
      if (event.key !== "Tab") return;
      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusable = [...dialog.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], [tabindex="0"]')]
        .filter(element => element.getClientRects().length > 0 && !element.closest("[hidden], [inert]"));
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!dialog.contains(document.activeElement)) { event.preventDefault(); (event.shiftKey ? last : first)?.focus(); }
      else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [requestClose, showLogoutConfirm]);

  const joined = account?.created_at ? new Date(account.created_at) : null;
  const memberSince = joined && !Number.isNaN(joined.getTime()) ? new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(joined) : "Not available";

  if (!mounted) return null;

  return createPortal(<>
    <div className={`suri-overview-overlay ${closing ? "is-closing" : ""}`} onMouseDown={event => { if (event.target === event.currentTarget) requestClose(); }}>
      <div ref={dialogRef} className="suri-overview-modal" role="dialog" aria-modal={!showLogoutConfirm} aria-hidden={showLogoutConfirm || undefined} inert={showLogoutConfirm} aria-labelledby="suri-settings-title" aria-describedby="suri-settings-subtitle">
        <header className="suri-overview-header">
          <div className="suri-overview-heading"><span className="suri-overview-castle" aria-hidden="true"><Castle size={25} /></span><div><span className="suri-overview-eyebrow">SURI Account</span><h2 id="suri-settings-title">Account settings</h2><p id="suri-settings-subtitle">Your account details and preferences.</p></div></div>
          <button ref={closeButtonRef} type="button" className="suri-overview-close" onClick={requestClose} aria-label="Close account settings"><X size={21} /></button>
        </header>
        <div className="suri-settings-layout">
          <aside className="suri-settings-sidebar">
            <nav className="suri-settings-nav" aria-label="Account settings sections">{SECTIONS.map(({ id, label, icon: Icon, description }) => <button key={id} type="button" aria-pressed={section === id} aria-controls="suri-settings-panel" onClick={() => setSection(id)}><Icon size={19} /><span><b>{label}</b><small>{description}</small></span><ChevronRight size={15} /></button>)}</nav>
            <button type="button" className="suri-settings-logout" onClick={event => { setLogoutOpener(event.currentTarget); setLogoutError(null); setShowLogoutConfirm(true); }}><LogOut size={18} />Log out</button>
          </aside>
          <section id="suri-settings-panel" className="suri-settings-panel" aria-label={`${section} settings`}>
            {section === "audio" ? <div className="suri-settings-card">
              <div className="suri-settings-section-heading"><Volume2 size={23} /><div><h3>Audio settings</h3><p>Make SURI sound right for you.</p></div></div>
              <p id="suri-audio-status" className="suri-settings-audio-notice">Coming soon · Audio controls are not available yet.</p>
              <div className="suri-settings-audio-channels">{AUDIO_CHANNELS.map(({ id, label, icon: Icon }) => <label key={id} className="suri-settings-audio-channel" htmlFor={`suri-audio-${id}`}><span><Icon size={17} /><strong>{label}</strong><small>Coming soon</small></span><input id={`suri-audio-${id}`} type="range" min={0} max={100} defaultValue={75} disabled aria-describedby="suri-audio-status" /></label>)}</div>
            </div> : account ? <div className="suri-settings-card">
              <div className="suri-settings-section-heading"><CircleUserRound size={23} /><div><h3>Account details</h3><p>Your personal information in SURI.</p></div></div>
              <dl className="suri-settings-details"><div><dt>Username</dt><dd>{account.name}</dd></div><div><dt>Email address</dt><dd>{account.email || "No email available"}</dd></div><div><dt>Grade level</dt><dd>{account.grade_level ? `Grade ${account.grade_level}` : "Not set"}</dd></div><div><dt>Member since</dt><dd>{memberSince}</dd></div></dl>
            </div> : <div className="suri-settings-loading" role={loadError ? "alert" : "status"}>{loadError ? "Could not load your account. Close account settings and try again." : "Loading your account…"}</div>}
          </section>
        </div>
      </div>
    </div>
    {showLogoutConfirm && <LogoutConfirmModal opener={logoutOpener} onClose={closeLogoutConfirm} onConfirm={handleLogout} busy={loggingOut} error={logoutError} />}
  </>, document.body);
}
