
import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL?.replace(/\/+$/, "");
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

export const supabaseConfigured = Boolean(url && key);

if (!url || !key) {
  console.error(
    "Supabase is not configured. Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY."
  );
}

export const supabase = createClient(
  url || "https://example.supabase.co",
  key || "missing-anon-key",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: "pkce",
    },
  }
);

/**
 * تسجيل الدخول باستخدام Google.
 */
export async function signInWithGoogle() {
  if (!supabaseConfigured) {
    throw new Error("إعدادات Supabase غير مكتملة");
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${window.location.origin}/admin`,
      scopes: "openid email profile",
    },
  });

  if (error) {
    throw error;
  }

  return data;
}

/**
 * تسجيل الخروج من Supabase.
 */
export async function signOutFromGoogle() {
  const { error } = await supabase.auth.signOut();

  if (error) {
    throw error;
  }
}

/**
 * الحصول على Access Token للمستخدم الحالي.
 */
export async function getSupabaseAccessToken(): Promise<string | null> {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) {
    throw error;
  }

  return session?.access_token ?? null;
}

/**
 * تنفيذ طلبات قاعدة بيانات Supabase.
 */
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

  const accessToken = await getSupabaseAccessToken();

  const response = await fetch(
    `${url}/rest/v1/${table}${options.query ? `?${options.query}` : ""}`,
    {
      method: options.method ?? "GET",
      headers: {
        apikey: key,
        Authorization: `Bearer ${accessToken || key}`,
        "Content-Type": "application/json",
        ...(options.prefer ? { Prefer: options.prefer } : {}),
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
    } catch {
      // الاحتفاظ برسالة الخطأ الأصلية
    }

    throw new Error(`Supabase (${response.status}): ${message}`);
  }

  return (payload ? JSON.parse(payload) : null) as T;
}

/**
 * رفع صورة المنتج إلى Storage عن طريق السيرفر.
 */
export async function uploadProductImage(file: File): Promise<string> {
  if (!file) {
    throw new Error("من فضلك اختر صورة أولاً");
  }

  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    throw new Error(
      "نوع الصورة غير مدعوم. استخدم JPG أو PNG أو WEBP أو GIF"
    );
  }

  if (file.size > MAX_IMAGE_SIZE) {
    throw new Error("حجم الصورة أكبر من 5 ميجابايت");
  }

  const accessToken = await getSupabaseAccessToken();

  if (!accessToken) {
    throw new Error("يجب تسجيل الدخول أولاً قبل رفع الصور");
  }

  const response = await fetch("/api/admin/upload-product-image", {
    method: "POST",
    credentials: "include",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/octet-stream",
      "x-file-type": file.type,
    },
    body: file,
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      payload.error || `فشل رفع الصورة (${response.status})`
    );
  }

  if (!payload.url || typeof payload.url !== "string") {
    throw new Error("لم يتم استلام رابط الصورة من السيرفر");
  }

  return payload.url;
}
