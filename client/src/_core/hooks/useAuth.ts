
import {
  adminSignIn,
  adminSignOut,
  getAdminUser,
  AUTH_CHANGE_EVENT,
} from "@/lib/supabase";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

type AdminUser = {
  id: string;
  email: string;
  name: string;
  role: "admin";
};

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

export function useAuth(options?: UseAuthOptions) {
  const {
    redirectOnUnauthenticated = false,
    redirectPath,
  } = options ?? {};

  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const currentUser = await getAdminUser();

      setUser(currentUser as AdminUser | null);

      return currentUser;
    } catch (err) {
      setUser(null);

      setError(
        err instanceof Error
          ? err
          : new Error("حدث خطأ أثناء التحقق من تسجيل الدخول")
      );

      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();

    const handleAuthChange = () => {
      void refresh();
    };

    window.addEventListener(
      AUTH_CHANGE_EVENT,
      handleAuthChange
    );

    return () => {
      window.removeEventListener(
        AUTH_CHANGE_EVENT,
        handleAuthChange
      );
    };
  }, [refresh]);

  const login = useCallback(
    async (email: string, password: string) => {
      if (!email || !password) {
        throw new Error(
          "من فضلك أدخل البريد الإلكتروني وكلمة المرور"
        );
      }

      const result = await adminSignIn(email, password);

      const currentUser = await getAdminUser();

      if (!currentUser) {
        throw new Error(
          "تم تسجيل الدخول لكن تعذر التحقق من حساب المدير"
        );
      }

      setUser(currentUser as AdminUser);
      setError(null);

      return result;
    },
    []
  );

  const logout = useCallback(async () => {
    try {
      await adminSignOut();
    } finally {
      setUser(null);
      setError(null);
    }
  }, []);

  useEffect(() => {
    if (
      !redirectOnUnauthenticated ||
      loading ||
      user
    ) {
      return;
    }

    if (typeof window === "undefined") return;

    if (redirectPath) {
      if (window.location.pathname !== redirectPath) {
        window.location.href = redirectPath;
      }
    }
  }, [
    redirectOnUnauthenticated,
    redirectPath,
    loading,
    user,
  ]);

  const state = useMemo(
    () => ({
      user,
      loading,
      error,
      isAuthenticated: Boolean(user),
    }),
    [user, loading, error]
  );

  return {
    ...state,
    login,
    logout,
    refresh,
  };
}
