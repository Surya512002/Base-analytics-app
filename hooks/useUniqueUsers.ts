"use client";

import { useState, useEffect } from "react";

export function useUniqueUsers(connectedAddress?: string | null) {
  const [count, setCount] = useState<number>(1420);
  const [formatted, setFormatted] = useState<string>("1,420+");
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let alive = true;

    async function fetchUsers() {
      try {
        let res: Response;
        const cleanAddr = connectedAddress?.trim().toLowerCase();
        const sessionKey = cleanAddr ? `base_user_pinged_${cleanAddr}` : null;
        const alreadyPinged =
          sessionKey && typeof window !== "undefined"
            ? sessionStorage.getItem(sessionKey)
            : false;

        if (cleanAddr && !alreadyPinged) {
          res = await fetch("/api/app/unique-users", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ address: cleanAddr }),
          });
          if (sessionKey && typeof window !== "undefined") {
            try {
              sessionStorage.setItem(sessionKey, "1");
            } catch {
              /* ignore */
            }
          }
        } else {
          res = await fetch("/api/app/unique-users");
        }

        if (res.ok) {
          const data = await res.json();
          if (alive && data.ok) {
            setCount(data.count);
            setFormatted(data.formatted || `${data.count.toLocaleString()}+`);
          }
        }
      } catch {
        /* fallback to baseline */
      } finally {
        if (alive) setLoading(false);
      }
    }

    void fetchUsers();

    return () => {
      alive = false;
    };
  }, [connectedAddress]);

  return { count, formatted, loading };
}
