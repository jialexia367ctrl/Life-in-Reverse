// ============================================================
// API: Stories - Frontend wrapper for story-related operations
// ============================================================

import { supabase } from '../supabase';
import type { Story, PaginatedResponse, StoryCategory, StorySortBy } from '../types';

interface FetchStoriesParams {
  category?: StoryCategory | 'all';
  sort?: StorySortBy;
  page?: number;
  page_size?: number;
}

/**
 * Fetch published stories with filtering, sorting, and pagination.
 * Uses edge function for complex queries.
 */
export async function fetchStories(
  params: FetchStoriesParams = {}
): Promise<PaginatedResponse<Story>> {
  const {
    category = 'all',
    sort = 'newest',
    page = 1,
    page_size = 20,
  } = params;

  const queryParams = new URLSearchParams();
  if (category && category !== 'all') queryParams.set('category', category);
  queryParams.set('sort', sort);
  queryParams.set('page', String(page));
  queryParams.set('page_size', String(page_size));

  const { data, error } = await supabase.functions.invoke(
    `get-stories?${queryParams.toString()}`,
    { method: 'GET' }
  );

  if (error) {
    throw new Error(error.message || '获取故事列表失败');
  }

  return data as PaginatedResponse<Story>;
}

/**
 * Direct Supabase query alternative (bypasses edge function, uses RLS).
 * Use this for real-time subscriptions or simpler queries.
 */
export async function fetchStoriesDirect(
  params: FetchStoriesParams = {}
): Promise<PaginatedResponse<Story>> {
  const {
    category = 'all',
    sort = 'newest',
    page = 1,
    page_size = 20,
  } = params;

  const from = (page - 1) * page_size;
  const to = from + page_size - 1;

  let query = supabase
    .from('stories')
    .select(
      `
      *,
      author:user_profiles!stories_author_id_fkey (nickname, avatar_url)
      `,
      { count: 'exact' }
    )
    .eq('is_published', true);

  if (category && category !== 'all') {
    query = query.eq('category', category);
  }

  switch (sort) {
    case 'pain_high':
      query = query.order('pain_level', { ascending: false });
      break;
    case 'most_bought':
      query = query.order('buy_count', { ascending: false });
      break;
    case 'most_comforted':
      query = query.order('comfort_count', { ascending: false });
      break;
    case 'newest':
    default:
      query = query.order('created_at', { ascending: false });
      break;
  }

  query = query.range(from, to);

  const { data, error, count } = await query;

  if (error) throw new Error(error.message);

  const total = count || 0;
  return {
    data: (data as Story[]) || [],
    total,
    page,
    page_size,
    has_more: from + page_size < total,
  };
}

/**
 * Publish a new story.
 */
export async function publishStory(story: {
  title: string;
  content: string;
  category: StoryCategory;
  pain_level: number;
  price: number;
}): Promise<Story> {
  const { data, error } = await supabase.functions.invoke('publish-story', {
    method: 'POST',
    body: story,
  });

  if (error) throw new Error(error.message || '发布失败');
  return data.data as Story;
}

/**
 * Fetch a single story by ID.
 */
export async function fetchStoryById(id: string): Promise<Story> {
  const { data, error } = await supabase
    .from('stories')
    .select(
      `
      *,
      author:user_profiles!stories_author_id_fkey (nickname, avatar_url)
      `
    )
    .eq('id', id)
    .single();

  if (error) throw new Error('故事不存在');
  return data as Story;
}

/**
 * Delete a story (author only).
 */
export async function deleteStory(id: string): Promise<void> {
  const { error } = await supabase.from('stories').delete().eq('id', id);
  if (error) throw new Error('删除失败');
}

/**
 * Subscribe to real-time story changes.
 */
export function subscribeToStories(callback: (story: Story) => void) {
  return supabase
    .channel('stories-changes')
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'stories' },
      (payload) => callback(payload.new as Story)
    )
    .subscribe();
}
