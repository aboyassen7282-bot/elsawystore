
const url = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, "");
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

const ADMIN_EMAIL = "aboyassen7282@gmail.com";
const SESSION_KEY = "elsawy_admin_session";

export const AUTH_CHANGE_EVENT = "elsawy-auth-changed";

type AuthSession = {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
};

export const supabaseConfigured = Boolean(url && key);

function notifyAuthChange() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(AUTH_CHANGE_EVENT));
  }
}

function getSession(): AuthSession | null {
  try {
    const saved = localStorage.getItem(SESSION_KEY);
    return saved ? (JSON.parse(saved) as AuthSession) : null;
  } catch {
    return null;
  }
}

// الحصول على Access Token الخاص بجلسة Supabase
export function getSupabaseAccessToken(): string | null {
  return getSession()?.access_token ?? null;
}

// حفظ الجلسة وإبلاغ التطبيق بأي تغيير في حالة الدخول
function saveSession(session: AuthSession | null) {
  if (session) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } else {
    localStorage.removeItem(SESSION_KEY);
  }

  notifyAuthChange();
}

// إرسال طلبات المصادقة إلى Supabase
async function authRequest<T>(
  endpoint: string,
  options: {
    method?: string;
    body?: unknown;
    token?: string;
  } = {}
): Promise<T> {
  if (!url || !key) {
    throw new Error("إعدادات Supabase غير مكتملة");
  }

  const response = await fetch(`${url}/auth/v1/${endpoint}`, {
    method: options.method ?? "GET",
    headers: {
      apikey: key,
      "Content-Type": "application/json",
      ...(options.token
        ? { Authorization: `Bearer ${options.token}` }
        : {}),
    },
    ...(options.body !== undefined
      ? { body: JSON.stringify(options.body) }
      : {}),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      payload.msg ||
        payload.message ||
        payload.error_description ||
        payload.error ||
        "تعذر الاتصال بنظام تسجيل الدخول"
    );
  }

  return payload as T;
}

// تسجيل دخول مدير المتجر
export async function adminSignIn(
  email: string,
  password: string
) {
  if (email.trim().toLowerCase() !== ADMIN_EMAIL) {
    throw new Error(
      "هذا الحساب غير مصرح له بدخول لوحة الإدارة"
    );
  }

  const result = await authRequest<
    AuthSession & {
      user: { email?: string };
      expires_in?: number;
    }
  >("token?grant_type=password", {
    method: "POST",
    body: {
      email: email.trim(),
      password,
    },
  });

  if (result.user?.email?.toLowerCase() !== ADMIN_EMAIL) {
    saveSession(null);

    throw new Error(
      "هذا الحساب غير مصرح له بدخول لوحة الإدارة"
    );
  }

  saveSession({
    access_token: result.access_token,
    refresh_token: result.refresh_token,
    expires_at:
      Math.floor(Date.now() / 1000) +
      (result.expires_in ?? 3600),
  });

  return result.user;
}

// التحقق من المستخدم وتجديد الجلسة عند الحاجة
export async function getAdminUser() {
  let session = getSession();

  if (!session) return null;

  try {
    if (
      session.expires_at &&
      session.expires_at <
        Math.floor(Date.now() / 1000) + 60
    ) {
      const refreshed = await authRequest<
        AuthSession & {
          expires_in?: number;
        }
      >("token?grant_type=refresh_token", {
        method: "POST",
        body: {
          refresh_token: session.refresh_token,
        },
      });

      session = {
        access_token: refreshed.access_token,
        refresh_token: refreshed.refresh_token,
        expires_at:
          Math.floor(Date.now() / 1000) +
          (refreshed.expires_in ?? 3600),
      };

      saveSession(session);
    }

    const user = await authRequest<{
      id: string;
      email?: string;
    }>("user", {
      token: session.access_token,
    });

    if (user.email?.toLowerCase() !== ADMIN_EMAIL) {
      saveSession(null);
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      name: "مدير المتجر",
      role: "admin" as const,
    };
  } catch {
    saveSession(null);
    return null;
  }
}

// تسجيل خروج مدير المتجر
export async function adminSignOut() {
  const session = getSession();

  try {
    if (session?.access_token) {
      await authRequest("logout", {
        method: "POST",
        token: session.access_token,
      });
    }
  } finally {
    saveSession(null);
  }
}

// تنفيذ طلبات قاعدة بيانات Supabase
export async function supabaseRequest<T>(
  table: string,
  options: {
    method?: string;
    query?: string;
    body?: unknown;
    prefer?: string;
  } = {}
): Promise<T> {
  if (!url || !key) {
    throw new Error(
      "أضف VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY في ملف .env أولاً"
    );
  }

  const token = getSupabaseAccessToken() ?? key;

  const response = await fetch(
    `${url}/rest/v1/${table}${
      options.query ? `?${options.query}` : ""
    }`,
    {
      method: options.method ?? "GET",
      headers: {
        apikey: key,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...(options.prefer
          ? { Prefer: options.prefer }
          : {}),
      },
      ...(options.body !== undefined
        ? { body: JSON.stringify(options.body) }
        : {}),
    }
  );

  const payload = await response.text();

  if (!response.ok) {
    let message = payload;

    try {
      const parsed = JSON.parse(payload);
      message =
        parsed.message ||
        parsed.details ||
        parsed.hint ||
        payload;
    } catch {}

    throw new Error(
      `Supabase (${response.status}): ${message}`
    );
  }

  return (payload ? JSON.parse(payload) : null) as T;
}

// رفع صور المنتجات إلى Supabase Storage
export async function uploadProductImage(
  file: File
): Promise<string> {
  if (!url || !key) {
    throw new Error("إعدادات Supabase غير مكتملة");
  }

  const token = getSupabaseAccessToken() ?? key;

  const safeName = file.name.replace(
    /[^a-zA-Z0-9._-]/g,
    "-"
  );

  const path = `products/${Date.now()}-${safeName}`;

  const response = await fetch(
    `${url}/storage/v1/object/product-images/${path}`,
    {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${token}`,
        "Content-Type": file.type,
        "x-upsert": "true",
      },
      body: file,
    }
  );

  if (!response.ok) {
    throw new Error(
      `فشل رفع الصورة: ${await response.text()}`
    );
  }

  return `${url}/storage/v1/object/public/product-images/${path}`;
}
