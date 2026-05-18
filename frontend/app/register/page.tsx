"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { register } from "@/lib/api";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [gradeLevel, setGradeLevel] = useState(6);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await register({ name, grade_level: gradeLevel, password });
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
    <div className="flex items-center justify-center min-h-screen p-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold mb-6">Register</h1>

        {error && (
          <p className="text-red-600 mb-4 text-sm">{error}</p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="register-name" className="block text-sm font-medium mb-1">
              Name
            </label>
            <input
              id="register-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full border border-black px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label htmlFor="register-grade" className="block text-sm font-medium mb-1">
              Grade Level
            </label>
            <select
              id="register-grade"
              value={gradeLevel}
              onChange={(e) => setGradeLevel(Number(e.target.value))}
              className="w-full border border-black px-3 py-2 text-sm"
            >
              <option value={6}>Grade 6</option>
              <option value={7}>Grade 7</option>
              <option value={8}>Grade 8</option>
              <option value={9}>Grade 9</option>
              <option value={10}>Grade 10</option>
            </select>
          </div>

          <div>
            <label htmlFor="register-password" className="block text-sm font-medium mb-1">
              Password
            </label>
            <input
              id="register-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full border border-black px-3 py-2 text-sm"
            />
          </div>

          <button
            id="register-submit"
            type="submit"
            disabled={loading}
            className="w-full bg-black text-white py-2 text-sm font-medium disabled:opacity-50"
          >
            {loading ? "Registering…" : "Register"}
          </button>
        </form>

        <p className="mt-4 text-sm">
          Already have an account?{" "}
          <Link href="/login" className="underline">
            Log In
          </Link>
        </p>
      </div>
    </div>
  );
}
