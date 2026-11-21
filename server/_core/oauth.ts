
import type { Express } from "express";

/**
 * Manus OAuth has been replaced by Supabase Auth.
 * Google sign-in is handled directly by the Supabase client.
 * This empty registration function keeps the existing server import
 * compatible while disabling the old Manus callback route.
 */
export function registerOAuthRoutes(_app: Express): void {
  // No legacy OAuth routes are registered.
}
