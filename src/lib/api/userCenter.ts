// ============================================================
// API: User Center - User dashboard data
// ============================================================

import { supabase } from '../supabase';
import type { UserCenterData } from '../types';

/**
 * Fetch complete user center data.
 * Includes published stories, purchased stories, and earnings.
 */
export async function fetchUserCenter(): Promise<UserCenterData> {
  const { data, error } = await supabase.functions.invoke('get-user-center', {
    method: 'GET',
  });

  if (error) throw new Error(error.message || '获取用户中心数据失败');
  return data as UserCenterData;
}
