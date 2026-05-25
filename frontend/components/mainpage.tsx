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
      <nav className="fixed top-4 left-0 right-0 h-16 bg-transparent z-50 flex items-center justify-between px-4 md:px-8 pointer-events-none">
        <div className="flex items-center bg-white px-6 md:px-8 h-11 rounded-full border border-[#c3c5d9]/30 shadow-[0_4px_20px_rgba(0,0,0,0.04)] pointer-events-auto">
          <img alt="SURI" src="/SURI.png" className="h-9 w-auto object-contain" />
        </div>
        <nav className="hidden md:flex items-center gap-8 bg-white px-8 h-11 rounded-full border border-[#c3c5d9]/30 shadow-[0_4px_20px_rgba(0,0,0,0.04)] pointer-events-auto">
          {NAV_ITEMS.map(({ label, href }) => {
            const isActive = pathname === href || (href !== "/" && pathname.startsWith(href));
            return (
              <button
                key={label}
                onClick={() => router.push(href)}
                className={`font-['Manrope'] text-[12px] font-bold transition-colors cursor-pointer ${
                  isActive ? "text-[#1F2720] border-b-2 border-[#1F2720]" : "text-[#434656] hover:text-[#1F2720]"
                }`}
              >
                {label}
              </button>
            );
          })}
        </nav>
        <div className="flex items-center gap-3 pointer-events-auto">
          <div className="bg-white px-5 h-11 rounded-full border border-[#c3c5d9]/30 shadow-[0_4px_20px_rgba(0,0,0,0.04)] flex items-center">
            <span className="font-['Manrope'] text-[12px] font-bold text-[#191c1e]">{userName || "Student"}</span>
          </div>
          <button
            onClick={() => setShowLogoutConfirm(true)}
            className="w-11 h-11 rounded-full bg-white border border-[#c3c5d9]/30 shadow-[0_4px_20px_rgba(0,0,0,0.04)] flex items-center justify-center text-[#434656] hover:text-red-600 hover:border-red-200 transition-all cursor-pointer"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </nav>

      <main className="pt-24 pb-12 px-4 md:px-8 max-w-[1440px] mx-auto">
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
