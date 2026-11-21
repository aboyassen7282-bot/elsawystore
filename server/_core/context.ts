
import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

type SupabaseUser = {
  id: string;
  email?: string;
  email_confirmed_at?: string | null;
  user_metadata?: {
    full_name?: string;
    name?: string;
  };
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    const authorization = opts.req.get("authorization") || "";
    const match = authorization.match(/^Bearer\s+(.+)$/i);
    const accessToken = match?.[1];

    const supabaseUrl = (
      process.env.SUPABASE_URL ||
      process.env.VITE_SUPABASE_URL ||
      ""
    ).replace(/\/+$/, "");

    const supabaseKey =
      process.env.SUPABASE_ANON_KEY ||
      process.env.VITE_SUPABASE_ANON_KEY ||
      "";

    const adminEmail = (process.env.ADMIN_EMAIL || "")
      .trim()
      .toLowerCase();

    if (accessToken && supabaseUrl && supabaseKey) {
      const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
        method: "GET",
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (response.ok) {
        const supabaseUser =
          (await response.json()) as SupabaseUser;

        const email = (supabaseUser.email || "")
          .trim()
          .toLowerCase();

        if (supabaseUser.id && email) {
          const now = new Date();

          user = {
            id: -1,
            openId: supabaseUser.id,
            name:
              supabaseUser.user_metadata?.full_name ||
              supabaseUser.user_metadata?.name ||
              email,
            email,
            loginMethod: "google",
            role:
              adminEmail && email === adminEmail
                ? "admin"
                : "user",
            createdAt: now,
            updatedAt: now,
            lastSignedIn: now,
          } as User;
        }
      }
    }
  } catch (error) {
    console.error(
      "[Supabase Authentication Error]:",
      error instanceof Error ? error.message : error
    );
    user = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
