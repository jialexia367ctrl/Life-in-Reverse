// ============================================================
// API: Auth - Authentication wrapper
// ============================================================

import { supabase, signInAnonymously as _signIn } from '../supabase';
import type { UserProfile } from '../types';

/**
 * Initialize anonymous authentication.
 * Signs in or restores existing session. Auto-creates profile via DB trigger.
 */
export async function initAuth(): Promise<string | null> {
  // Check for existing session
  const { data: { session } } = await supabase.auth.getSession();

  if (session?.user) {
    return session.user.id;
  }

  // Create new anonymous session
  const { data, error } = await _signIn();
  if (error) throw new Error('匿名登录失败');
  return data.user?.id || null;
}

/**
 * Get the current user ID (returns null if not authenticated).
 */
export function getCurrentUserId(): string | null {
  return supabase.auth.getUser().then(({ data: { user } }) => user?.id || null) as any;
}

/**
 * Synchronously get current user from cached session.
 */
export async function ensureAuth(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();

  if (session?.user) {
    return session.user.id;
  }

  // Sign in
  const userId = await initAuth();
  if (!userId) throw new Error('无法建立匿名会话');
  return userId;
}

/**
 * Sign out.
 */
export async function logout(): Promise<void> {
  await supabase.auth.signOut();
}

/**
 * Subscribe to auth state changes.
 */
export function onAuthStateChange(
  callback: (userId: string | null) => void
) {
  return supabase.auth.onAuthStateChange((event, session) => {
    callback(session?.user?.id || null);
  });
}
