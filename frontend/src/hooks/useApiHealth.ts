import { useEffect, useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";
const POLL_MS = 20000;

/** Polls the backend health endpoint so connection-status UI reflects reality, not a one-time check. */
export function useApiHealth() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    let mounted = true;
    const check = () => {
      fetch(`${API_BASE}/api/health`)
        .then((r) => mounted && setOnline(r.ok))
        .catch(() => mounted && setOnline(false));
    };
    check();
    const interval = setInterval(check, POLL_MS);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  return online;
}
