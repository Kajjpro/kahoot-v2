"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Quiz } from "@/shared/types";
import { quizProblem } from "@/shared/validate";
import { request } from "./socket";

export const hostKeyFor = (code: string) => `dash.host.${code}`;

/** Opens a lobby on the server for this quiz and moves to the live screen. */
export function useHostLaunch() {
  const router = useRouter();
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const launch = async (quiz: Quiz) => {
    const problem = quizProblem(quiz);
    if (problem) {
      setError(problem);
      return;
    }
    setLaunching(true);
    setError(null);
    const res = await request<{ code: string; hostKey: string }>("host:create", { quiz }, 20000);
    setLaunching(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    sessionStorage.setItem(hostKeyFor(res.code), res.hostKey);
    router.push(`/host/live?code=${res.code}`);
  };

  return { launch, launching, error };
}
