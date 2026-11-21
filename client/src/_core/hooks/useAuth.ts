
import {
  signInWithGoogle,
  signOutFromGoogle,
  supabase,
} from "@/lib/supabase";
import { trpc } from "@/lib/trpc";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from "react";

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

export function useAuth(options?: UseAuthOptions) {
  const {
    redirectOnUnauthenticated = false,
    redirectPath,
  } = options ?? {};

  const utils = trpc.useUtils();
  const loginStarted = useRef(false);

  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: true,
  });

  const login = useCallback(async () => {
    await signInWithGoogle();
  }, []);

  const logout = useCallback(async () => {
    try {
      await signOutFromGoogle();
    } finally {
      utils.auth.me.setData(undefined, null);
      await utils.auth.me.invalidate();
    }
  }, [utils]);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (
        event === "SIGNED_IN" ||
        event === "SIGNED_OUT" ||
        event === "TOKEN_REFRESHED" ||
        event === "USER_UPDATED"
      ) {
        void utils.auth.me.invalidate();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [utils]);

  const state = useMemo(() => {
    return {
      user: meQuery.data ?? null,
      loading: meQuery.isLoading,
      error: meQuery.error ?? null,
      isAuthenticated: Boolean(meQuery.data),
    };
  }, [
    meQuery.data,
    meQuery.error,
    meQuery.isLoading,
  ]);

  useEffect(() => {
    if (!redirectOnUnauthenticated) return;
    if (meQuery.isLoading) return;
    if (state.user) {
      loginStarted.current = false;
      return;
    }

    if (typeof window === "undefined") return;
    if (loginStarted.current) return;

    if (
      redirectPath &&
      window.location.pathname === redirectPath
    ) {
      return;
    }

    loginStarted.current = true;

    if (redirectPath) {
      window.location.href = redirectPath;
      return;
    }

    void login().catch((error) => {
      loginStarted.current = false;
      console.error("[Google Login Error]", error);
    });
  }, [
    redirectOnUnauthenticated,
    redirectPath,
    meQuery.isLoading,
    state.user,
    login,
  ]);

  return {
    ...state,
    login,
    logout,
    refresh: () => meQuery.refetch(),
  };
}
