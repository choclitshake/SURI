"use client";

import Image from "next/image";
import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { User, GraduationCap, ChevronDown, Lock, Eye, EyeOff, Rocket, Mail } from "lucide-react";
import { register } from "@/lib/api";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [gradeLevel, setGradeLevel] = useState(6);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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
    if (pwStrength <= 2) return "#dc2626";
    if (pwStrength <= 4) return "#eab308";
    return "#16a34a";
  };

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await register({ name, email, grade_level: gradeLevel, password });
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

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "#f8f9ff",
        color: "#0b1c30",
        overflow: "hidden",
      }}
    >
      <div style={{
        position: "fixed",
        top: 0, left: 0, width: "100%", height: "100%",
        overflow: "hidden", pointerEvents: "none", opacity: 0.3,
        zIndex: 0,
      }}>
        <div style={{
          position: "absolute", top: "-10%", left: "-10%",
          width: "40%", height: "40%", borderRadius: "9999px",
          background: "#2563eb", filter: "blur(120px)",
        }} />
        <div style={{
          position: "absolute", top: "60%", right: "-10%",
          width: "40%", height: "40%", borderRadius: "9999px",
          background: "#ffc329", filter: "blur(120px)",
        }} />
      </div>

      <main
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "16px",
          position: "relative",
          zIndex: 1,
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: "440px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <div style={{ marginBottom: "12px" }}>
            <Image src="/SURI.png" alt="SURI" width={80} height={80} priority />
          </div>

          <div
            style={{
              width: "100%",
              background: "rgba(255,255,255,0.85)",
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
              border: "1px solid rgba(226,232,240,0.6)",
              borderRadius: "24px",
              padding: "20px 28px",
              boxShadow: "0 20px 50px rgba(0,0,0,0.08)",
              boxSizing: "border-box",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
              <div>
                <h2 style={{
                  fontSize: "22px", fontWeight: 700,
                  lineHeight: "28px", color: "#0b1c30",
                  margin: 0,
                }}>
                  Get started
                </h2>
                <p style={{
                  fontSize: "14px", lineHeight: "20px",
                  color: "#434655", marginTop: "4px", marginBottom: 0,
                }}>
                  Create your SURI account to start mastering math.
                </p>
              </div>

              {error && (
                <p style={{
                  color: "#dc2626", fontSize: "13px", margin: 0,
                  padding: "8px 12px", background: "#fef2f2",
                  borderRadius: "8px",
                }}>
                  {error}
                </p>
              )}

              <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div>
                  <label style={{
                    fontSize: "13px", fontWeight: 600,
                    lineHeight: "18px", color: "#0b1c30",
                    display: "block", marginBottom: "5px",
                  }}>
                    Name
                  </label>
                  <div style={{ position: "relative" }}>
                    <span
                      style={{
                        position: "absolute", left: "14px", top: "50%",
                        transform: "translateY(-50%)", color: "#737686",
                        display: "flex", pointerEvents: "none",
                      }}
                    >
                      <User size={18} />
                    </span>
                    <input
                      id="register-name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      style={{
                        width: "100%", padding: "11px 14px 11px 44px",
                        background: "#fff", border: "1.5px solid #c3c6d7",
                        borderRadius: "12px", fontSize: "14px",
                        outline: "none", boxSizing: "border-box",
                      }}
                      className="focus:ring-2 focus:ring-[#004ac6] focus:border-transparent"
                      placeholder="Your name"
                    />
                  </div>
                </div>

                <div>
                  <label style={{
                    fontSize: "13px", fontWeight: 600,
                    lineHeight: "18px", color: "#0b1c30",
                    display: "block", marginBottom: "5px",
                  }}>
                    Email
                  </label>
                  <div style={{ position: "relative" }}>
                    <span
                      style={{
                        position: "absolute", left: "14px", top: "50%",
                        transform: "translateY(-50%)", color: "#737686",
                        display: "flex", pointerEvents: "none",
                      }}
                    >
                      <Mail size={18} />
                    </span>
                    <input
                      id="register-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      style={{
                        width: "100%", padding: "11px 14px 11px 44px",
                        background: "#fff", border: "1.5px solid #c3c6d7",
                        borderRadius: "12px", fontSize: "14px",
                        outline: "none", boxSizing: "border-box",
                      }}
                      className="focus:ring-2 focus:ring-[#004ac6] focus:border-transparent"
                      placeholder="Your email"
                    />
                  </div>
                </div>

                <div>
                  <label style={{
                    fontSize: "13px", fontWeight: 600,
                    lineHeight: "18px", color: "#0b1c30",
                    display: "block", marginBottom: "5px",
                  }}>
                    Grade Level
                  </label>
                  <div style={{ position: "relative" }}>
                    <span
                      style={{
                        position: "absolute", left: "14px", top: "50%",
                        transform: "translateY(-50%)", color: "#737686",
                        display: "flex", pointerEvents: "none",
                      }}
                    >
                      <GraduationCap size={18} />
                    </span>
                    <select
                      id="register-grade"
                      value={gradeLevel}
                      onChange={(e) => setGradeLevel(Number(e.target.value))}
                      style={{
                        width: "100%", padding: "11px 44px 11px 44px",
                        background: "#fff", border: "1.5px solid #c3c6d7",
                        borderRadius: "12px", fontSize: "14px",
                        outline: "none", boxSizing: "border-box",
                        appearance: "none",
                        WebkitAppearance: "none",
                        MozAppearance: "none",
                        color: "#0b1c30",
                      }}
                      className="focus:ring-2 focus:ring-[#004ac6] focus:border-transparent"
                    >
                      <option value={6}>Grade 6</option>
                      <option value={7}>Grade 7</option>
                      <option value={8}>Grade 8</option>
                      <option value={9}>Grade 9</option>
                      <option value={10}>Grade 10</option>
                    </select>
                    <span
                      style={{
                        position: "absolute", right: "10px", top: "50%",
                        transform: "translateY(-50%)",
                        color: "#737686",
                        display: "flex", pointerEvents: "none",
                      }}
                    >
                      <ChevronDown size={20} />
                    </span>
                  </div>
                </div>

                <div>
                  <label style={{
                    fontSize: "13px", fontWeight: 600,
                    lineHeight: "18px", color: "#0b1c30",
                    display: "block", marginBottom: "5px",
                  }}>
                    Password
                  </label>
                  <div style={{ position: "relative" }}>
                    <span
                      style={{
                        position: "absolute", left: "14px", top: "50%",
                        transform: "translateY(-50%)", color: "#737686",
                        display: "flex", pointerEvents: "none",
                      }}
                    >
                      <Lock size={18} />
                    </span>
                    <input
                      id="register-password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      style={{
                        width: "100%", padding: "11px 44px 11px 44px",
                        background: "#fff", border: "1.5px solid #c3c6d7",
                        borderRadius: "12px", fontSize: "14px",
                        outline: "none", boxSizing: "border-box",
                      }}
                      className="focus:ring-2 focus:ring-[#004ac6] focus:border-transparent"
                      placeholder="Min. 8 characters"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      style={{
                        position: "absolute", right: "10px", top: "50%",
                        transform: "translateY(-50%)",
                        background: "none", border: "none",
                        cursor: "pointer", padding: "4px",
                        display: "flex", alignItems: "center",
                        color: "#737686",
                      }}
                    >
                      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                  {password.length > 0 && (
                    <>
                      <div style={{ marginTop: "8px", display: "flex", gap: "4px" }}>
                        {[1, 2, 3, 4, 5].map((level) => (
                          <div
                            key={level}
                            style={{
                              height: "4px", flex: 1, borderRadius: "2px",
                              background: level <= pwStrength ? getStrengthColor() : "#e2e8f0",
                              transition: "all 0.3s",
                            }}
                          />
                        ))}
                      </div>
                      <p style={{ fontSize: "11px", color: "#64748b", margin: "4px 0 0 0", lineHeight: "1.4" }}>
                        Must contain at least 8 characters, uppercase, lowercase, number, and special character.
                      </p>
                    </>
                  )}
                </div>

                <button
                  id="register-submit"
                  type="submit"
                  disabled={loading || pwStrength < 5}
                  style={{
                    width: "100%", padding: "13px 20px",
                    background: "#007e37", color: "#fff",
                    fontWeight: 600, fontSize: "14px",
                    border: "none", borderRadius: "12px",
                    cursor: "pointer", display: "flex",
                    alignItems: "center", justifyContent: "center",
                    gap: "6px", boxShadow: "0 6px 18px rgba(0,126,55,0.2)",
                    opacity: (loading || pwStrength < 5) ? 0.6 : 1,
                  }}
                  className={(loading || pwStrength < 5) ? "" : "hover:bg-[#006229] active:scale-[0.98]"}
                >
                  {loading ? "Creating account\u2026" : "Create Account"}
                  <Rocket size={18} />
                </button>
              </form>

              <p style={{
                textAlign: "center", fontSize: "14px",
                color: "#434655", margin: 0,
              }}>
                Already have an account?{" "}
                <Link
                  href="/login"
                  style={{
                    color: "#004ac6", fontWeight: 600,
                    fontSize: "14px", textDecoration: "none",
                  }}
                  className="hover:underline"
                >
                  Sign in instead
                </Link>
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
