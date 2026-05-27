"use client";

import { useState, FormEvent, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { 
  User, 
  Lock, 
  Eye, 
  EyeOff, 
  Rocket, 
  Mail, 
  Compass, 
  ShieldAlert, 
  Sparkles,
  Leaf
} from "lucide-react";
import { register } from "@/lib/api";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Dynamic mascot interaction states
  const [bubbleText, setBubbleText] = useState("Greetings! Ready to register your Ranger license?");
  const [mascotMood, setMascotMood] = useState<"neutral" | "happy" | "focused">("neutral");

  const getPasswordStrength = (pwd: string) => {
    let score = 0;
    if (!pwd) return 0;
    if (pwd.length >= 8) score += 1;
    if (/[A-Z]/.test(pwd)) score += 1;
    if (/[a-z]/.test(pwd)) score += 1;
    if (/[0-9]/.test(pwd)) score += 1;
    if (/[^A-Za-z0-9]/.test(pwd)) score += 1;
    return score;
  };

  const pwStrength = getPasswordStrength(password);
  
  const getStrengthColor = () => {
    if (pwStrength <= 2) return "#ef4444"; // Red (Tailwind text-red-500)
    if (pwStrength <= 4) return "#fdd400"; // Yellow (Dashboard theme yellow)
    return "#10b981"; // Emerald green
  };

  // React to password strength changes dynamically
  useEffect(() => {
    if (password.length > 0) {
      if (pwStrength <= 2) {
        setBubbleText("Watch out! That passkey is as weak as a dry leaf! Add numbers and capitals.");
        setMascotMood("neutral");
      } else if (pwStrength <= 4) {
        setBubbleText("Getting warmer! Your defense against the Mathwood brambles is growing.");
        setMascotMood("focused");
      } else {
        setBubbleText("Sss-pectacular! That password has legendary, ranger-grade protection!");
        setMascotMood("happy");
      }
    }
  }, [password, pwStrength]);

  useEffect(() => {
    if (error) {
      setBubbleText("Sss-omething went wrong! Let's check the registry details again.");
      setMascotMood("neutral");
    }
  }, [error]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    setBubbleText("Writing your name into the Forest Archives... please wait!");

    try {
      // Omit grade_level from input form but pass a safe default payload for backward-compatibility
      await register({ name, email, grade_level: 6, password });
      router.push("/dashboard");
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Registration failed");
      }
    } finally {
      setLoading(false);
    }
  }

  // Determine which mascot version to render based on page state
  let mascotSrc = "/suri-snake-right.png";
  if (error) {
    mascotSrc = "/suri-snake-sad.png";
  } else if (loading) {
    mascotSrc = "/suri-snake-happy.png";
  } else if (mascotMood === "focused") {
    mascotSrc = "/suri-snake-right.png"; 
  } else if (mascotMood === "happy") {
    mascotSrc = "/suri-snake-happy.png";
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-[#1b261c] to-[#2e3e2d] flex flex-col items-center justify-center p-4 relative overflow-hidden font-['Manrope']">
      
      {/* Inline styles for custom gamified animations */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes floatFirefly {
          0% { transform: translateY(110%) translateX(0); opacity: 0; }
          20% { opacity: 0.8; }
          80% { opacity: 0.8; }
          100% { transform: translateY(-20px) translateX(30px); opacity: 0; }
        }
        @keyframes pulseGlow {
          0%, 100% { transform: scale(1); opacity: 0.3; }
          50% { transform: scale(1.15); opacity: 0.6; }
        }
        @keyframes bounceJelly {
          0%, 100% { transform: translateY(0) scale(1); }
          30% { transform: translateY(-6px) scale(0.95, 1.05); }
          50% { transform: translateY(0) scale(1.05, 0.95); }
          70% { transform: translateY(-2px) scale(0.98, 1.02); }
        }
        .firefly {
          position: absolute;
          background: #fdd400;
          border-radius: 50%;
          filter: drop-shadow(0 0 5px #ffe170);
          pointer-events: none;
        }
        .animate-jelly {
          animation: bounceJelly 2.5s ease-in-out infinite;
        }
        .cartoon-tooltip {
          filter: drop-shadow(4px 4px 0px #1F2720);
        }
      ` }} />

      {/* Background Forest Blur Overlay */}
      <div className="absolute inset-0 opacity-20 bg-cover bg-bottom mix-blend-overlay pointer-events-none" 
           style={{ backgroundImage: "url('/bg.png')" }} />

      {/* Floating Magic Fireflies */}
      <div className="firefly w-2 h-2" style={{ left: "6%", bottom: "14%", animation: "floatFirefly 8s ease-in-out infinite" }} />
      <div className="firefly w-2.5 h-2.5" style={{ left: "18%", bottom: "8%", animation: "floatFirefly 10s ease-in-out infinite 1.5s" }} />
      <div className="firefly w-1.5 h-1.5" style={{ left: "40%", bottom: "18%", animation: "floatFirefly 6s ease-in-out infinite 0.5s" }} />
      <div className="firefly w-3 h-3" style={{ left: "65%", bottom: "10%", animation: "floatFirefly 9s ease-in-out infinite 2s" }} />
      <div className="firefly w-2 h-2" style={{ left: "85%", bottom: "16%", animation: "floatFirefly 7s ease-in-out infinite 3.5s" }} />

      {/* Main Grid Wrapper */}
      <main className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10 py-6">
        
        {/* Left Column: Mascot Interaction (Displays above form on mobile) */}
        <div className="lg:col-span-5 flex flex-col items-center justify-center text-center lg:text-left px-4">
          
          {/* Interactive Speech Bubble */}
          <div className="relative bg-[#ffe170] text-[#1F2720] font-black text-xs md:text-sm p-5 rounded-3xl border-[4px] border-[#1F2720] shadow-[6px_6px_0px_0px_#1F2720] max-w-[280px] lg:max-w-xs mb-6 cartoon-tooltip transform hover:scale-[1.02] transition-transform">
            <span className="leading-relaxed">💬 "{bubbleText}"</span>
            
            {/* Speech bubble arrow keys */}
            <div className="absolute top-[100%] left-1/2 -translate-x-1/2 lg:top-1/2 lg:left-[100%] lg:-translate-y-1/2 lg:translate-x-0 w-0 h-0 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-t-[10px] border-t-[#1F2720] lg:border-t-transparent lg:border-l-[12px] lg:border-l-[#1F2720] lg:border-b-[10px] lg:border-b-transparent lg:border-r-0" />
            <div className="absolute top-[98%] left-1/2 -translate-x-1/2 lg:top-1/2 lg:left-[99%] lg:-translate-y-1/2 lg:translate-x-0 w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[8px] border-t-[#ffe170] lg:border-t-transparent lg:border-l-[10px] lg:border-l-[#ffe170] lg:border-b-[8px] lg:border-b-transparent lg:border-r-0" />
          </div>

          {/* Glowing Aura and Bouncing Mascot */}
          <div className="relative w-44 h-44 flex items-center justify-center">
            <div className="absolute w-36 h-36 rounded-full bg-[#fdd400]/25 blur-xl pointer-events-none" style={{ animation: "pulseGlow 2.5s infinite" }} />
            <img 
              alt="Suri Ranger Mascot" 
              src={mascotSrc} 
              className="h-36 w-auto object-contain select-none z-10 animate-jelly"
            />
          </div>

          <div className="mt-4 hidden lg:block">
            <h1 className="font-['Hanken_Grotesk'] text-3xl font-black text-white drop-shadow-[2px_2px_0px_#1F2720]">
              The Mathwood Trails
            </h1>
            <p className="text-emerald-300 text-xs font-bold tracking-wider uppercase mt-1">
              Ranger Guild Registry 🌿
            </p>
          </div>
        </div>

        {/* Right Column: Comic-style Neobrutalist Form Container */}
        <div className="lg:col-span-7">
          <div className="bg-[#faf8f5] rounded-[32px] p-6 md:p-8 border-[4px] border-[#1F2720] shadow-[8px_8px_0px_0px_#1F2720] transition-all">
            
            {/* Header Area */}
            <div className="flex items-center justify-between border-b-4 border-[#1F2720] pb-4 mb-6">
              <div>
                <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[10px] font-black tracking-widest text-[#1F2720] bg-[#fdd400] uppercase border-[3.5px] border-[#1F2720] shadow-[2px_2px_0px_0px_#1F2720]">
                  <Compass className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: "12s" }} /> Registry Office
                </span>
                <h2 className="font-['Hanken_Grotesk'] text-2xl font-black text-[#1F2720] mt-2">
                  Draft New License
                </h2>
              </div>
              
              {/* Suri Seal Icon */}
              <div className="shrink-0 bg-white p-2 rounded-2xl border-[3.5px] border-[#1F2720] shadow-[3px_3px_0px_0px_#1F2720] hover:rotate-6 transition-transform">
                <img src="/SURI.png" alt="SURI seal" className="w-11 h-11 object-contain" />
              </div>
            </div>

            {/* Error Notification */}
            {error && (
              <div className="mb-5 border-[3px] border-[#1F2720] bg-red-100 p-3.5 text-xs text-red-900 font-black rounded-2xl flex items-center gap-2 shadow-[3px_3px_0px_0px_#1F2720]">
                <ShieldAlert className="w-4.5 h-4.5 text-[#ba1a1a] shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Registration Form */}
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              
              {/* Ranger Name Field */}
              <div>
                <label className="font-black text-[#1F2720] uppercase text-xs tracking-wider mb-2 block">
                  Ranger Moniker (Name)
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#1F2720] pointer-events-none z-10">
                    <User className="w-5 h-5" />
                  </span>
                  <input
                    id="register-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onFocus={() => {
                      setBubbleText("What name should we log on your Mathwood badge?");
                      setMascotMood("neutral");
                    }}
                    required
                    className="w-full px-4 py-3.5 pl-12 rounded-2xl border-[3.5px] border-[#1F2720] shadow-[3px_3px_0px_0px_#1F2720] focus:shadow-[5px_5px_0px_0px_#1F2720] focus:translate-y-[-1px] focus:translate-x-[-1px] transition-all bg-white font-semibold text-[#1F2720] outline-none placeholder:text-slate-400 focus:border-[#fdd400]"
                    placeholder="E.g., Ranger Robin"
                  />
                </div>
              </div>

              {/* Coordinates (Email) Field */}
              <div>
                <label className="font-black text-[#1F2720] uppercase text-xs tracking-wider mb-2 block">
                  Ranger Coordinates (Email)
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#1F2720] pointer-events-none z-10">
                    <Mail className="w-5 h-5" />
                  </span>
                  <input
                    id="register-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onFocus={() => {
                      setBubbleText("Where should we sss-end your expedition reports?");
                      setMascotMood("neutral");
                    }}
                    required
                    className="w-full px-4 py-3.5 pl-12 rounded-2xl border-[3.5px] border-[#1F2720] shadow-[3px_3px_0px_0px_#1F2720] focus:shadow-[5px_5px_0px_0px_#1F2720] focus:translate-y-[-1px] focus:translate-x-[-1px] transition-all bg-white font-semibold text-[#1F2720] outline-none placeholder:text-slate-400 focus:border-[#fdd400]"
                    placeholder="name@forest.com"
                  />
                </div>
              </div>

              {/* Password Field */}
              <div>
                <label className="font-black text-[#1F2720] uppercase text-xs tracking-wider mb-2 block">
                  Secure Passkey
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#1F2720] pointer-events-none z-10">
                    <Lock className="w-5 h-5" />
                  </span>
                  <input
                    id="register-password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onFocus={() => {
                      setBubbleText("Enter a passkey with strong defensive spells!");
                      setMascotMood("focused");
                    }}
                    required
                    className="w-full px-4 py-3.5 pl-12 pr-14 rounded-2xl border-[3.5px] border-[#1F2720] shadow-[3px_3px_0px_0px_#1F2720] focus:shadow-[5px_5px_0px_0px_#1F2720] focus:translate-y-[-1px] focus:translate-x-[-1px] transition-all bg-white font-semibold text-[#1F2720] outline-none placeholder:text-slate-400 focus:border-[#fdd400]"
                    placeholder="Min. 8 characters"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const updatedVis = !showPassword;
                      setShowPassword(updatedVis);
                      setBubbleText(updatedVis ? "Checking behind the leaves!" : "Secured back in your backpack!");
                    }}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 p-2 rounded-xl bg-slate-100 hover:bg-slate-200 border-[2.5px] border-[#1F2720] shadow-[2px_2px_0px_0px_#1F2720] hover:translate-y-[-1px] hover:shadow-[3px_3px_0px_0px_#1F2720] active:translate-y-[1px] active:shadow-[1px_1px_0px_0px_#1F2720] transition-all cursor-pointer text-[#1F2720]"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {/* Password Strength Metres */}
                {password.length > 0 && (
                  <div className="mt-4 p-3.5 bg-white border-[3px] border-[#1F2720] rounded-2xl shadow-[3px_3px_0px_0px_#1F2720]">
                    <div className="flex gap-2">
                      {[1, 2, 3, 4, 5].map((level) => (
                        <div
                          key={level}
                          className="h-3 rounded-lg border-2 border-[#1F2720] transition-all flex-1"
                          style={{
                            backgroundColor: level <= pwStrength ? getStrengthColor() : "#e6e8ea",
                          }}
                        />
                      ))}
                    </div>
                    <p className="text-[10px] font-black text-slate-500 mt-2.5 leading-relaxed">
                      💡 To qualify for legendary status, use: at least 8 letters, capitals, numbers, and special symbols (!@#$).
                    </p>
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <button
                id="register-submit"
                type="submit"
                disabled={loading || pwStrength < 5}
                className="w-full py-4 mt-2 rounded-2xl bg-[#fdd400] text-[#1F2720] font-black tracking-wider uppercase border-[3.5px] border-[#1F2720] shadow-[5px_5px_0px_0px_#1F2720] hover:-translate-y-0.5 hover:shadow-[7px_7px_0px_0px_#1F2720] active:translate-y-1 active:translate-x-1 active:shadow-[1px_1px_0px_0px_#1F2720] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-[5px_5px_0px_0px_#1F2720]"
              >
                {loading ? (
                  <>
                    <span>Drafting badge...</span>
                    <Sparkles className="w-5 h-5 animate-spin" />
                  </>
                ) : (
                  <>
                    <span>Begin Adventure</span>
                    <Rocket className="w-5 h-5 stroke-[2.5px]" />
                  </>
                )}
              </button>
            </form>

            {/* Footer Options */}
            <p className="text-center font-bold text-xs text-slate-500 mt-6 pt-5 border-t-2 border-[#1F2720]/10 mb-0">
              Already have an adventure badge?{" "}
              <Link
                href="/login"
                className="text-[#1F2720] font-black underline hover:text-emerald-800 transition-colors ml-1"
              >
                Sign in instead
              </Link>
            </p>

          </div>
        </div>

      </main>
    </div>
  );
}