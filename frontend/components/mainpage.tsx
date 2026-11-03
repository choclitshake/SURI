"use client";

import { useCallback, useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { HelpCircle, UserRound } from "lucide-react";
import { useLearningData } from "@/components/navigation/LearningShell";
import HelpModal, { getHelpPage } from "@/components/navigation/HelpModal";
import { TutorialButton } from "@/components/tutorial/TutorialProvider";
const AccountSettingsModal = dynamic(() => import("@/components/WorldMap/AccountSettingsModal"), { ssr: false });

export default function MainPage({
  children,
  immersive = false,
}: {
  children: React.ReactNode;
  immersive?: boolean;
}) {
  const pathname = usePathname();
  const {data} = useLearningData();
  const [showAccountSettings, setShowAccountSettings] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [helpOpener, setHelpOpener] = useState<HTMLButtonElement | null>(null);
  const [accountOpener, setAccountOpener] = useState<HTMLButtonElement | null>(null);
  const closeAccountSettings = useCallback(() => setShowAccountSettings(false), []);
  const helpPage = getHelpPage(pathname);

  return (
    <div className={immersive ? "min-h-screen bg-transparent text-white" : "min-h-screen bg-[#DBD4C7] text-[#191c1e]"}>
      {/* This in-flow archive bar begins each page and scrolls away with its content. */}
      <nav className="suri-app-bar" aria-label="SURI navigation">
        <div className="suri-app-bar-frame">
          <div className="suri-app-brand">
            <Image alt="SURI" src="/SURI1.png" width={300} height={100} className="suri-app-brand-logo" priority />
          </div>
          <div className="suri-app-bar-actions">
            <TutorialButton />
            <button
              onClick={(event) => { setHelpOpener(event.currentTarget); setShowHelp(true); }}
              aria-label={helpPage ? `Open ${helpPage[0].toUpperCase() + helpPage.slice(1)} help` : "Open help"}
              className="suri-app-control"
            >
              <HelpCircle className="h-5 w-5" /><span className="suri-app-control-label">Help</span>
            </button>
            <button type="button" className="suri-app-control suri-app-account-control" aria-label={`Open account settings for ${data?.me.name || "Student"}`} aria-haspopup="dialog" onClick={(event) => { setAccountOpener(event.currentTarget); setShowAccountSettings(true); }}>
              <UserRound className="h-5 w-5 shrink-0" /><span className="truncate">{data?.me.name || "Student"}</span>
            </button>
          </div>
        </div>
      </nav>

      <main className={immersive ? "min-h-screen" : "pt-4 pb-12 px-4 md:px-8 max-w-[1440px] mx-auto"}>
        {children}
      </main>

      {showHelp && helpPage && <HelpModal page={helpPage} opener={helpOpener} onClose={() => setShowHelp(false)} />}

      {showAccountSettings && <AccountSettingsModal me={data?.me} opener={accountOpener} onClose={closeAccountSettings} />}
    </div>
  );
}

