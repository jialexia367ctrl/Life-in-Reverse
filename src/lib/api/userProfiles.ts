// ============================================================
// API: User Profiles - Profile management
// ============================================================

import { supabase } from '../supabase';
import type { UserProfile } from '../types';

/**
 * Fetch the current user's profile.
 */
export async function fetchMyProfile(): Promise<UserProfile> {
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) throw new Error('未登录');

  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error) throw new Error('获取用户信息失败');
  return data as UserProfile;
}

/**
 * Update the current user's profile.
 * Only nickname and avatar_url can be updated by the user.
 */
export async function updateProfile(updates: {
  nickname?: string;
  avatar_url?: string;
}): Promise<UserProfile> {
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) throw new Error('未登录');

  const { data, error } = await supabase
    .from('user_profiles')
    .update(updates)
    .eq('id', user.id)
    .select()
    .single();

  if (error) throw new Error('更新失败');
  return data as UserProfile;
}

/**
 * Get user balance.
 */
export async function fetchBalance(): Promise<number> {
  const profile = await fetchMyProfile();
  return profile.balance;
}
