"use client";

import Image from "next/image";
import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Mail, Lock, Eye, EyeOff, ArrowRight } from "lucide-react";
import { login } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await login({ email, password });
      router.push("/dashboard");
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Login failed");
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
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <div>
                <h2 style={{
                  fontSize: "22px", fontWeight: 700,
                  lineHeight: "28px", color: "#0b1c30",
                  margin: 0,
                }}>
                  Welcome back
                </h2>
                <p style={{
                  fontSize: "14px", lineHeight: "20px",
                  color: "#434655", marginTop: "4px", marginBottom: 0,
                }}>
                  Sign in to continue your learning journey.
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
                      id="login-email"
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
                      id="login-password"
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
                      placeholder="••••••••"
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
                </div>

                <button
                  id="login-submit"
                  type="submit"
                  disabled={loading}
                  style={{
                    width: "100%", padding: "13px 20px",
                    background: "#004ac6", color: "#fff",
                    fontWeight: 600, fontSize: "14px",
                    border: "none", borderRadius: "12px",
                    cursor: "pointer", display: "flex",
                    alignItems: "center", justifyContent: "center",
                    gap: "6px", boxShadow: "0 6px 18px rgba(0,74,198,0.2)",
                    opacity: loading ? 0.6 : 1,
                  }}
                  className="hover:bg-[#2563eb] active:scale-[0.98]"
                >
                  {loading ? "Logging in\u2026" : "Login"}
                  <ArrowRight size={18} />
                </button>
              </form>

              <p style={{
                textAlign: "center", fontSize: "14px",
                color: "#434655", margin: 0,
              }}>
                New here?{" "}
                <Link
                  href="/register"
                  style={{
                    color: "#004ac6", fontWeight: 600,
                    fontSize: "14px", textDecoration: "none",
                  }}
                  className="hover:underline"
                >
                  Create an account
                </Link>
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
