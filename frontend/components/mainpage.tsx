"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { getMe, logout } from "@/lib/api";

const NAV_ITEMS: { label: string; href: string }[] = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Topics", href: "/topics" },
  { label: "Error History", href: "/error-history" },
  { label: "Progress", href: "/progress" },
  { label: "Calculator", href: "/calculator" },
];

export default function MainPage({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [userName, setUserName] = useState("");

  useEffect(() => {
    getMe().then((me) => setUserName(me.name)).catch(() => {});
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
      router.push("/login");
    } catch {
      // ignore
    }
  };

  return (
    <div className="min-h-screen bg-[#DBD4C7] text-[#191c1e]">
      {/* TopAppBar */}
      <nav className="fixed top-0 left-0 right-0 z-50">
        <div className="absolute inset-0" style={{ background: "rgba(219,212,199,0.85)", backdropFilter: "blur(12px)", maskImage: "linear-gradient(to bottom, black 0%, black 60%, transparent 100%)", WebkitMaskImage: "linear-gradient(to bottom, black 0%, black 60%, transparent 100%)" }} />
        <div className="relative flex items-center h-24 px-4 md:px-8">
          <div className="flex items-center bg-white px-7 md:px-10 h-14 rounded-full border border-[#c3c5d9]/30 shadow-[0_4px_20px_rgba(0,0,0,0.04)]">
            <img alt="SURI" src="/SURI.png" className="h-11 w-auto object-contain" />
          </div>
          <nav className="hidden md:flex absolute left-1/2 -translate-x-1/2 items-center gap-10 bg-white px-10 h-14 rounded-full border border-[#c3c5d9]/30 shadow-[0_4px_20px_rgba(0,0,0,0.04)] pointer-events-auto">
          {NAV_ITEMS.map(({ label, href }) => {
            const isActive = pathname === href || (href !== "/" && pathname.startsWith(href));
            return (
              <button
                key={label}
                onClick={() => router.push(href)}
                className={`font-['Manrope'] text-[13px] font-bold transition-colors cursor-pointer ${
                  isActive ? "text-[#1F2720] nav-brush" : "text-[#434656] hover:text-[#1F2720]"
                }`}
              >
                {label}
              </button>
            );
          })}
        </nav>
        <div className="flex items-center gap-3 absolute right-4 md:right-8 top-1/2 -translate-y-1/2 pointer-events-auto">
          <div className="bg-white px-6 h-14 rounded-full border border-[#c3c5d9]/30 shadow-[0_4px_20px_rgba(0,0,0,0.04)] flex items-center">
            <span className="font-['Manrope'] text-[13px] font-bold text-[#191c1e]">{userName || "Student"}</span>
          </div>
          <button
            onClick={() => setShowLogoutConfirm(true)}
            className="w-14 h-14 rounded-full bg-white border border-[#c3c5d9]/30 shadow-[0_4px_20px_rgba(0,0,0,0.04)] flex items-center justify-center text-[#434656] hover:text-white hover:bg-[#ba1a1a] hover:border-[#ba1a1a] transition-all cursor-pointer"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
        </div>
      </nav>

      <main className="pt-28 pb-12 px-4 md:px-8 max-w-[1440px] mx-auto">
        {children}
      </main>

      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 shadow-lg w-80 text-center">
            <h3 className="font-['Hanken_Grotesk'] text-lg font-bold text-[#191c1e] mb-2">Log out</h3>
            <p className="font-['Manrope'] text-sm text-[#434656] mb-6">Are you sure you want to log out?</p>
            <div className="flex gap-3">
              <button onClick={() => setShowLogoutConfirm(false)} className="flex-1 py-2 rounded-xl border border-[#c3c5d9] text-[#434656] font-bold text-sm hover:bg-[#f2f4f6] cursor-pointer">Cancel</button>
              <button onClick={handleLogout} className="flex-1 py-2 rounded-xl bg-[#ba1a1a] text-white font-bold text-sm hover:bg-red-700 cursor-pointer">Log out</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
