// ============================================================
// API: Tragedy Rank - Rankings and statistics
// ============================================================

import { supabase } from '../supabase';
import type { TragedyRankData } from '../types';

/**
 * Fetch the tragedy ranking (top stories by pain level).
 * Also includes today's aggregate statistics.
 */
export async function fetchTragedyRank(): Promise<TragedyRankData> {
  const { data, error } = await supabase.functions.invoke('get-tragedy-rank', {
    method: 'GET',
  });

  if (error) throw new Error(error.message || '获取排行榜失败');
  return data as TragedyRankData;
}

/**
 * Direct query alternative: top stories by pain level.
 */
export async function fetchTopStories(limit = 20) {
  const { data, error } = await supabase
    .from('stories')
    .select(
      `
      id, title, content, category, pain_level, price,
      buy_count, comfort_count, created_at,
      author:user_profiles!stories_author_id_fkey (nickname, avatar_url)
      `
    )
    .eq('is_published', true)
    .order('pain_level', { ascending: false })
    .order('buy_count', { ascending: false })
    .limit(limit);

  if (error) throw new Error('获取排行失败');
  return data || [];
}
