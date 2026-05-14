import { createClient } from '@supabase/supabase-js';

const localApiBase = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const forceLocal = import.meta.env.VITE_BACKEND_MODE === 'local';

const hasSupabaseConfig =
  !!supabaseUrl &&
  !!supabaseAnonKey &&
  !supabaseUrl.includes('your-project') &&
  !supabaseAnonKey.includes('your-anon-key');

export const backendMode = hasSupabaseConfig && !forceLocal ? 'supabase' : 'local';

const supabase =
  backendMode === 'supabase'
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true,
        },
      })
    : null;

function getLocalToken() {
  return localStorage.getItem('rex_token');
}

async function localRequest(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const token = getLocalToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${localApiBase}${path}`, { ...options, headers });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(data?.message || '请求失败');
  }

  return data;
}

async function invokeFunction(name, options = {}) {
  const { data, error } = await supabase.functions.invoke(name, options);
  if (error) throw new Error(error.message || '请求失败');
  return data;
}

async function ensureAuth() {
  if (backendMode === 'local') {
    if (getLocalToken()) {
      try {
        const session = await localRequest('/api/auth/session');
        if (session.user) return session.user;
      } catch {
        localStorage.removeItem('rex_token');
      }
    }

    const auth = await localRequest('/api/auth/sign-in', { method: 'POST', body: '{}' });
    localStorage.setItem('rex_token', auth.session.access_token);
    return auth.user;
  }

  const { data: sessionData } = await supabase.auth.getSession();
  if (sessionData.session?.user) {
    return sessionData.session.user;
  }

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) throw new Error(error.message || '匿名登录失败');
  return data.user;
}

async function getProfile() {
  if (backendMode === 'local') {
    const result = await localRequest('/api/user-profile');
    return result.data;
  }

  const { data, error } = await supabase.from('user_profiles').select('*').single();
  if (error) throw new Error(error.message || '获取用户信息失败');
  return data;
}

async function getStories(params) {
  const search = new URLSearchParams({
    category: params.category || 'all',
    sort: params.sort || 'pain_high',
    page: String(params.page || 1),
    page_size: String(params.page_size || 12),
  });

  if (backendMode === 'local') {
    return localRequest(`/api/stories?${search.toString()}`);
  }

  return invokeFunction(`get-stories?${search.toString()}`, { method: 'GET' });
}

async function getTragedyRank() {
  if (backendMode === 'local') {
    return localRequest('/api/tragedy-rank');
  }

  return invokeFunction('get-tragedy-rank', { method: 'GET' });
}

async function publishStory(story) {
  if (backendMode === 'local') {
    return localRequest('/api/stories', { method: 'POST', body: JSON.stringify(story) });
  }

  return invokeFunction('publish-story', { method: 'POST', body: story });
}

async function sendComfort(storyId, type) {
  const body = { story_id: storyId, type };

  if (backendMode === 'local') {
    return localRequest('/api/comforts', { method: 'POST', body: JSON.stringify(body) });
  }

  return invokeFunction('send-comfort', { method: 'POST', body });
}

async function createPayment(storyId) {
  const body = { story_id: storyId };

  if (backendMode === 'local') {
    return localRequest('/api/payments/checkout', { method: 'POST', body: JSON.stringify(body) });
  }

  return invokeFunction('create-payment-intent', { method: 'POST', body });
}

export const appApi = {
  ensureAuth,
  getProfile,
  getStories,
  getTragedyRank,
  publishStory,
  sendComfort,
  createPayment,
};
