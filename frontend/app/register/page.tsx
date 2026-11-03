"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, GraduationCap, Lock, Mail, ShieldAlert, User } from "lucide-react";
import { register } from "@/lib/api";

const REGISTER_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Bree+Serif&family=Nunito:wght@600;700;800;900&display=swap');

  .quest-register {
    min-height: 100vh;
    position: relative;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: clamp(118px, 14vh, 150px) 22px 34px;
    font-family: "Nunito", sans-serif;
    background: #83c3ff url("/login/math-quest-academy.png") center / cover no-repeat;
    color: #3b1766;
  }

  .quest-register::before {
    content: "";
    position: absolute;
    inset: 0;
    background:
      radial-gradient(circle at 50% 39%, rgba(255, 239, 185, .36), transparent 28%),
      linear-gradient(90deg, rgba(19, 13, 38, .34), transparent 26%, transparent 72%, rgba(31, 15, 44, .24)),
      linear-gradient(180deg, rgba(255, 255, 255, .06), transparent 45%, rgba(43, 29, 40, .18));
    pointer-events: none;
  }

  .quest-shell {
    width: min(780px, 100%);
    position: relative;
    z-index: 1;
  }

  .quest-crest {
    position: absolute;
    width: min(560px, 92vw);
    left: 50%;
    top: 0;
    transform: translate(-50%, -57%);
    z-index: 3;
    filter: drop-shadow(0 18px 16px rgba(42, 18, 24, .38));
    pointer-events: none;
  }

  .parchment-frame {
    position: relative;
    padding: 24px;
    border-radius: 32px 28px 34px 30px;
    background:
      linear-gradient(90deg, #70411f 0 18px, transparent 18px calc(100% - 18px), #70411f calc(100% - 18px)),
      linear-gradient(180deg, #8b5527 0 18px, transparent 18px calc(100% - 18px), #8b5527 calc(100% - 18px)),
      #70411f;
    box-shadow:
      0 28px 46px rgba(42, 24, 20, .36),
      inset 0 0 0 4px #3b1d13,
      inset 0 0 0 10px rgba(255, 198, 92, .22);
  }

  .parchment-frame::before {
    content: "";
    position: absolute;
    inset: 12px;
    border-radius: 24px;
    pointer-events: none;
    background:
      radial-gradient(circle at 3% 12%, #4a2413 0 16px, transparent 17px),
      radial-gradient(circle at 97% 13%, #4a2413 0 16px, transparent 17px),
      radial-gradient(circle at 4% 91%, #4a2413 0 15px, transparent 16px),
      radial-gradient(circle at 96% 90%, #4a2413 0 15px, transparent 16px);
    opacity: .76;
  }

  .parchment-panel {
    position: relative;
    border-radius: 22px 20px 24px 22px;
    padding: clamp(72px, 9vw, 94px) clamp(26px, 7vw, 74px) clamp(26px, 5vw, 46px);
    background:
      radial-gradient(circle at 18% 24%, rgba(255, 255, 255, .34), transparent 26%),
      radial-gradient(circle at 80% 76%, rgba(174, 102, 34, .12), transparent 31%),
      linear-gradient(135deg, rgba(129, 73, 24, .08) 0 14%, transparent 14% 28%, rgba(129, 73, 24, .06) 28% 42%, transparent 42% 57%, rgba(129, 73, 24, .06) 57% 70%, transparent 70%),
      #f6ddaa;
    box-shadow:
      inset 0 0 0 2px rgba(124, 70, 28, .2),
      inset 0 0 34px rgba(116, 65, 22, .18);
    text-align: center;
    overflow: hidden;
  }

  .parchment-panel::before {
    content: "";
    position: absolute;
    inset: 14px;
    border: 2px solid rgba(111, 61, 28, .13);
    border-radius: 18px;
    pointer-events: none;
  }

  .quest-title {
    font-family: "Bree Serif", Georgia, serif;
    font-size: clamp(36px, 5.4vw, 54px);
    line-height: 1;
    color: #3c126b;
    text-shadow: 0 2px 0 rgba(255, 255, 255, .55);
  }

  .quest-subtitle {
    margin-top: 12px;
    color: #4e3477;
    font-size: clamp(16px, 2vw, 21px);
    font-weight: 900;
  }

  .ornament {
    display: flex;
    align-items: center;
    gap: 18px;
    margin: 22px auto 24px;
    max-width: 470px;
    color: #7d36bb;
  }

  .ornament::before,
  .ornament::after {
    content: "";
    height: 2px;
    flex: 1;
    background: linear-gradient(90deg, transparent, currentColor);
    box-shadow: 0 1px 0 rgba(255, 255, 255, .55);
  }

  .ornament::after {
    background: linear-gradient(90deg, currentColor, transparent);
  }

  .ornament span {
    width: 23px;
    height: 23px;
    background: currentColor;
    clip-path: polygon(50% 0, 64% 36%, 100% 50%, 64% 64%, 50% 100%, 36% 64%, 0 50%, 36% 36%);
    filter: drop-shadow(0 1px 0 rgba(255, 255, 255, .7));
  }

  .quest-form {
    width: min(560px, 100%);
    margin: 0 auto;
  }

  .quest-input-row {
    position: relative;
    display: flex;
    align-items: center;
    min-height: 66px;
    margin-bottom: 14px;
    border: 2px solid #8749b7;
    border-radius: 15px;
    background: linear-gradient(180deg, rgba(81, 39, 120, .96), rgba(55, 27, 91, .98));
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, .15),
      0 3px 0 rgba(72, 31, 94, .44);
    overflow: hidden;
  }

  .quest-input-row:focus-within {
    border-color: #d7a7ff;
    box-shadow: 0 0 0 4px rgba(125, 54, 187, .18), inset 0 1px 0 rgba(255, 255, 255, .2);
  }

  .quest-input-icon {
    width: 74px;
    height: 66px;
    display: grid;
    place-items: center;
    color: #ffe79f;
    border-right: 2px solid rgba(145, 88, 188, .62);
  }

  .quest-input {
    width: 100%;
    min-width: 0;
    height: 66px;
    padding: 0 56px 0 18px;
    border: 0;
    outline: 0;
    background: transparent;
    color: #fff8e8;
    font-size: 23px;
    font-weight: 800;
  }

  .quest-input::placeholder {
    color: rgba(217, 190, 237, .62);
  }

  .quest-input option {
    background: #fff;
    color: #2b1646;
  }

  .password-toggle {
    position: absolute;
    right: 14px;
    top: 50%;
    transform: translateY(-50%);
    width: 42px;
    height: 42px;
    display: grid;
    place-items: center;
    border-radius: 50%;
    color: #c7a2e9;
    transition: background .18s ease, color .18s ease;
  }

  .password-toggle:hover {
    background: rgba(255, 255, 255, .09);
    color: #fff4c3;
  }

  .quest-button-wrap {
    width: min(400px, 100%);
    margin: 26px auto 20px;
    padding: 8px;
    clip-path: polygon(9% 0, 91% 0, 100% 50%, 91% 100%, 9% 100%, 0 50%);
    background: linear-gradient(180deg, #ffcf66, #9a541f);
    filter: drop-shadow(0 8px 0 rgba(72, 34, 16, .72));
  }

  .quest-button {
    width: 100%;
    min-height: 66px;
    clip-path: polygon(9% 0, 91% 0, 100% 50%, 91% 100%, 9% 100%, 0 50%);
    background:
      linear-gradient(90deg, rgba(255,255,255,.12), transparent 18%, transparent 82%, rgba(255,255,255,.12)),
      linear-gradient(180deg, #9232cc, #58158f 52%, #391071);
    color: #fffaf6;
    font-family: "Bree Serif", Georgia, serif;
    font-size: clamp(25px, 3.7vw, 34px);
    font-weight: 900;
    letter-spacing: 0;
    text-shadow: 0 3px 0 #32104d;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 13px;
    transition: transform .12s ease, filter .12s ease;
  }

  .quest-button:hover:not(:disabled) {
     background:
    linear-gradient(90deg, rgba(255,255,255,.18), transparent 18%, transparent 82%, rgba(255,255,255,.18)),
    linear-gradient(180deg, #a940e0, #6c1cab 52%, #451387);
  box-shadow: 0 0 20px rgba(146, 50, 204, 0.6);
  transform: translateY(-2px);
  }

  .quest-button:active:not(:disabled) {
    transform: translateY(3px);
  }

  .quest-button:disabled {
    cursor: not-allowed;
    filter: saturate(.45) brightness(.86);
  }

  .quest-error {
    width: min(560px, 100%);
    margin: 0 auto 14px;
    padding: 12px 14px;
    display: flex;
    align-items: flex-start;
    gap: 10px;
    border: 2px solid #bb3d42;
    border-radius: 14px;
    background: rgba(111, 20, 45, .14);
    color: #6f1430;
    text-align: left;
    font-weight: 900;
  }

  .quest-login-link {
    color: #50306c;
    font-size: 17px;
    font-weight: 900;
  }

  .quest-login-link a {
    margin-left: 6px;
    color: #6b10d0;
    font-size: 20px;
    text-decoration: underline;
    text-underline-offset: 3px;
    text-decoration-thickness: 2px;
  }

  @media (max-width: 720px) {
    .quest-register {
      min-height: 100svh;
      padding: 112px 12px 18px;
      background-position: 44% center;
    }

    .quest-crest {
      width: min(430px, 94vw);
      transform: translate(-50%, -55%);
    }

    .parchment-frame {
      padding: 14px;
      border-radius: 24px;
    }

    .parchment-panel {
      padding: 58px 17px 24px;
      border-radius: 18px;
    }

    .quest-title {
      font-size: 34px;
    }

    .quest-subtitle {
      font-size: 15px;
    }

    .quest-input-row,
    .quest-input,
    .quest-input-icon {
      min-height: 56px;
      height: 56px;
    }

    .quest-input-icon {
      width: 58px;
    }

    .quest-input {
      font-size: 18px;
      padding-left: 14px;
    }

    .quest-button {
      min-height: 58px;
      font-size: 25px;
    }
  }
`;

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [gradeLevel, setGradeLevel] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await register({
        name,
        email,
        password,
        grade_level: Number(gradeLevel),
      });
      router.push("/dashboard");
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Sign up failed");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="quest-register">
      <style dangerouslySetInnerHTML={{ __html: REGISTER_CSS }} />

      <section className="quest-shell" aria-labelledby="register-heading">
        <img
          className="quest-crest"
          src="/login/suri-math-quest-crest.svg"
          alt="SURI Math Quest"
        />

        <div className="parchment-frame">
          <div className="parchment-panel">
            <h1 id="register-heading" className="quest-title">
              Start Your Quest!
            </h1>
            <p className="quest-subtitle">Create your account to begin the math journey.</p>
            <div className="ornament" aria-hidden="true">
              <span />
            </div>

            {error && (
              <div className="quest-error" role="alert">
                <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="quest-form">
              <label className="quest-input-row" htmlFor="register-name">
                <span className="quest-input-icon" aria-hidden="true">
                  <User className="h-8 w-8" />
                </span>
                <input
                  id="register-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="quest-input"
                  placeholder="Name"
                  autoComplete="name"
                />
              </label>

              <label className="quest-input-row" htmlFor="register-email">
                <span className="quest-input-icon" aria-hidden="true">
                  <Mail className="h-8 w-8" />
                </span>
                <input
                  id="register-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="quest-input"
                  placeholder="Email"
                  autoComplete="email"
                />
              </label>

              <label className="quest-input-row" htmlFor="register-grade">
                <span className="quest-input-icon" aria-hidden="true">
                  <GraduationCap className="h-8 w-8" />
                </span>
                <select
                  id="register-grade"
                  value={gradeLevel}
                  onChange={(e) => setGradeLevel(e.target.value)}
                  required
                  className="quest-input"
                >
                  <option value="" disabled>Grade level</option>
                  {[7, 8, 9, 10].map((g) => (
                    <option key={g} value={g}>Grade {g}</option>
                  ))}
                </select>
              </label>

              <label className="quest-input-row" htmlFor="register-password">
                <span className="quest-input-icon" aria-hidden="true">
                  <Lock className="h-8 w-8" />
                </span>
                <input
                  id="register-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="quest-input"
                  placeholder="Password"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  className="password-toggle"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-6 w-6" /> : <Eye className="h-6 w-6" />}
                </button>
              </label>

              <div className="quest-button-wrap">
                <button id="register-submit" type="submit" disabled={loading} className="quest-button">
                  <span>{loading ? "CREATING" : "SIGN UP"}</span>
                  <span aria-hidden="true">→</span>
                </button>
              </div>
            </form>

            <div className="ornament" aria-hidden="true">
              <span />
            </div>

            <p className="quest-login-link">
              Already have an account?
              <Link href="/login" prefetch>Log In</Link>
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
