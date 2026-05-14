// ============================================================
// 反向人生交易所 - Constants
// ============================================================

export const STORY_CATEGORIES = {
  work: '职场',
  love: '情感',
  family: '家庭',
  health: '健康',
  social: '社交',
  other: '其他',
} as const;

export const COMFORT_TYPES = {
  tea: { name: '一杯热茶', emoji: '🍵', description: '暖暖的，喝杯茶吧' },
  flower: { name: '一朵小花', emoji: '🌸', description: '送你一朵花，希望你好一点' },
  bandage: { name: '创可贴', emoji: '🩹', description: '虽然小，但能止疼' },
} as const;

export const PAIN_LEVEL_LABELS: Record<number, string> = {
  1: '微微不适',
  2: '有点难受',
  3: '不太好受',
  4: '挺疼的',
  5: '很难受',
  6: '很痛苦',
  7: '太惨了',
  8: '人间惨剧',
  9: '痛不欲生',
  10: '地狱模式',
};

export const STORY_SORT_OPTIONS = {
  newest: '最新发布',
  pain_high: '最惨排行',
  most_bought: '最热购买',
  most_comforted: '最多安慰',
} as const;

export const PRICE_RANGE = {
  min: 0.99,
  max: 9.99,
  step: 0.5,
} as const;

export const PAIN_LEVEL_RANGE = {
  min: 1,
  max: 10,
} as const;

// Supabase configuration keys
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
