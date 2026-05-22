"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getMe } from "../lib/api";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const checkLogin = async () => {
      try {
        await getMe();
        router.replace("/dashboard");
      } catch {
        router.replace("/login");
      }
    };
    checkLogin();
  }, [router]);

  return null;
}
