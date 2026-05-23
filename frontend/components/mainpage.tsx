"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Calculator,
  ChevronRight,
  LayoutGrid,
  LineChart,
  LogOut,
  PencilLine,
} from "lucide-react";
import { logout } from "@/lib/api";

const NAV_ITEMS = [
  { label: "Dashboard", icon: LayoutGrid },
  { label: "Practice", icon: PencilLine },
  { label: "Progress", icon: LineChart },
  { label: "Calculator", icon: Calculator },
];

type MainPageProps = {
  children: React.ReactNode;
};

export default function MainPage({ children }: MainPageProps) {
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(true);

  const handleLogout = async () => {
    try {
      await logout();
      router.push("/login");
    } catch {
      // ignore
    }
  };

  const sidebarWidth = collapsed ? "w-[60px]" : "w-48";

  return (
    <div className="h-screen flex gap-5 p-4 bg-[radial-gradient(ellipse_at_top,#ffffff_0%,#f5f7ff_35%,#e4edff_55%,#9dc8ff_90%)]">
      <div className="flex flex-col gap-3 h-full">
        <aside className={`${sidebarWidth} bg-[#001a54] rounded-[18px] flex flex-col items-center py-4 shadow-[0_10px_28px_rgba(0,26,84,0.25)] transition-all duration-300`}>
          <img alt="SURI" src="/SURI_white.png" className="w-12 h-12 object-contain" />
        </aside>

        <aside className={`${sidebarWidth} bg-[#001a54] rounded-[18px] flex flex-col py-3 shadow-[0_10px_28px_rgba(0,26,84,0.25)] transition-all duration-300 flex-1 ${collapsed ? "items-center justify-center" : "items-start justify-center"}`}>
          <nav className={`flex flex-col gap-[25px] ${collapsed ? "items-center" : "items-start w-full px-3"}`}>
            {NAV_ITEMS.map(({ label, icon: Icon }) => (
              <span
                key={label}
                className={`flex items-center gap-3 rounded-[14px] text-white/60 hover:bg-white/20 transition-all duration-200 cursor-pointer ${collapsed ? "w-10 h-10 justify-center" : "w-full h-10 px-3"}`}
              >
                <Icon className="w-6 h-6 shrink-0" />
                {!collapsed && <span className="text-sm font-medium whitespace-nowrap">{label}</span>}
              </span>
            ))}
            <button
              onClick={() => setCollapsed((v) => !v)}
              className={`flex items-center gap-3 rounded-[14px] text-white/60 hover:text-white hover:bg-white/20 transition-all duration-200 ${collapsed ? "w-10 h-10 justify-center" : "w-full h-10 px-3"}`}
            >
              <ChevronRight className={`w-6 h-6 shrink-0 transition-transform duration-300 ${collapsed ? "" : "rotate-180"}`} />
              {!collapsed && <span className="text-sm font-medium whitespace-nowrap">Collapse</span>}
            </button>
          </nav>
        </aside>

        <aside className={`${sidebarWidth} bg-[#001a54] rounded-[18px] flex flex-col items-center py-[14px] shadow-[0_10px_28px_rgba(0,26,84,0.25)] hover:bg-red-600 transition-all duration-300`}>
          <button
            onClick={handleLogout}
            title="Logout"
            className={`flex items-center gap-3 rounded-[12px] text-white ${collapsed ? "w-10 h-10 justify-center" : "w-full h-10 px-3 justify-start"}`}
          >
            <LogOut className="w-6 h-6 shrink-0" />
            {!collapsed && <span className="text-sm font-medium whitespace-nowrap">Logout</span>}
          </button>
        </aside>
      </div>

      <main className="flex-1 bg-white rounded-[22px] border border-[rgba(195,197,217,0.4)] shadow-[0_24px_48px_rgba(0,0,0,0.12)] flex flex-col relative overflow-hidden max-h-[calc(100vh-32px)]">
        <div className="flex-1 p-8 overflow-y-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
