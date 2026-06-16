import { useState, useEffect } from "react";
import * as Sentry from "@sentry/react";
import { auth, ApiError } from "../api/client";
import type { User } from "../types";

interface AuthState {
  user: User | null;
  loading: boolean;
  /** true only when /auth/me returned 401 — user is definitely not logged in */
  unauthenticated: boolean;
  /** set when /auth/me failed for a non-auth reason (network error, 5xx, etc.) */
  error: Error | null;
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [unauthenticated, setUnauthenticated] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    auth
      .me()
      .then(setUser)
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 401) {
          setUnauthenticated(true);
        } else {
          Sentry.captureException(err);
          setError(
            err instanceof Error ? err : new Error("Failed to verify session"),
          );
        }
      })
      .finally(() => setLoading(false));
  }, []);

  return { user, loading, unauthenticated, error };
}
