"use client";

import { useRouter } from "next/navigation";
import {
  BookOpen,
  Calculator,
  LayoutGrid,
  LineChart,
  PencilLine,
  LogOut,
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

  const handleLogout = async () => {
    try {
      await logout();
      router.push("/login");
    } catch {
      // ignore
    }
  };

  return (
    <div className="h-screen flex gap-5 p-4 bg-[radial-gradient(ellipse_at_top,#ffffff_0%,#f5f7ff_35%,#e4edff_55%,#9dc8ff_90%)]">
      <div className="flex flex-col gap-3 h-full">
        <aside className="w-[60px] bg-[#001a54] rounded-[18px] flex flex-col items-center py-4 shadow-[0_10px_28px_rgba(0,26,84,0.25)]">
          <img alt="SURI" src="/SURI_white.png" className="w-10 h-10 object-contain" />
        </aside>

        <aside className="w-[60px] bg-[#001a54] rounded-[18px] flex flex-col items-center py-3 flex-1 justify-center shadow-[0_10px_28px_rgba(0,26,84,0.25)]">
          <nav className="flex flex-col gap-[25px] items-center">
            {NAV_ITEMS.map(({ label, icon: Icon }) => (
              <span
                key={label}
                className="w-10 h-10 rounded-[14px] grid place-items-center text-white/60 hover:bg-white/20 transition-colors duration-200"
              >
                <Icon className="w-6 h-6" />
              </span>
            ))}
          </nav>
        </aside>

        <aside className="w-[60px] bg-[#001a54] rounded-[18px] flex flex-col items-center py-[14px] shadow-[0_10px_28px_rgba(0,26,84,0.25)] hover:bg-red-600 transition-colors duration-200">
          <button
            onClick={handleLogout}
            title="Logout"
            className="w-10 h-10 rounded-[12px] grid place-items-center text-white"
          >
            <LogOut className="w-6 h-6" />
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
