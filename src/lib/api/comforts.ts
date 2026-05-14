// ============================================================
// API: Comforts - Send emotional support tokens
// ============================================================

import { supabase } from '../supabase';
import type { Comfort, ComfortType } from '../types';

/**
 * Send a comfort to a story.
 * Each user can send each type (tea/flower/bandage) once per story.
 */
export async function sendComfort(
  storyId: string,
  type: ComfortType
): Promise<Comfort> {
  const { data, error } = await supabase.functions.invoke('send-comfort', {
    method: 'POST',
    body: { story_id: storyId, type },
  });

  if (error) throw new Error(error.message || '安慰发送失败');
  return data.data as Comfort;
}

/**
 * Fetch all comforts for a story.
 */
export async function fetchStoryComforts(storyId: string): Promise<Comfort[]> {
  const { data, error } = await supabase
    .from('comforts')
    .select(
      `
      *,
      sender:user_profiles!comforts_sender_id_fkey (nickname, avatar_url)
      `
    )
    .eq('story_id', storyId)
    .order('created_at', { ascending: false });

  if (error) throw new Error('获取安慰列表失败');
  return (data as Comfort[]) || [];
}

/**
 * Check which comforts the current user has already sent for a story.
 */
export async function fetchUserComforts(
  storyId: string
): Promise<ComfortType[]> {
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) return [];

  const { data } = await supabase
    .from('comforts')
    .select('type')
    .eq('story_id', storyId)
    .eq('sender_id', user.id);

  return (data || []).map((c) => c.type as ComfortType);
}

/**
 * Fetch comforts summary (count per type) for a story.
 */
export async function fetchComfortsSummary(
  storyId: string
): Promise<Record<ComfortType, number>> {
  const { data } = await supabase
    .from('comforts')
    .select('type')
    .eq('story_id', storyId);

  const summary: Record<ComfortType, number> = { tea: 0, flower: 0, bandage: 0 };
  (data || []).forEach((c) => {
    summary[c.type as ComfortType]++;
  });

  return summary;
}
