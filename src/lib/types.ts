// ============================================================
// 反向人生交易所 - TypeScript Types
// ============================================================

export interface UserProfile {
  id: string;
  nickname: string;
  avatar_url: string;
  balance: number;
  created_at: string;
}

export interface Story {
  id: string;
  title: string;
  content: string;
  category: StoryCategory;
  pain_level: number; // 1-10
  price: number;      // 0.99-9.99
  author_id: string;
  created_at: string;
  buy_count: number;
  comfort_count: number;
  is_published: boolean;
  // Joined fields (optional)
  author?: UserProfile;
}

export interface Transaction {
  id: string;
  story_id: string;
  buyer_id: string;
  seller_id: string;
  price: number;
  created_at: string;
  // Joined fields
  story?: Story;
  buyer?: UserProfile;
  seller?: UserProfile;
}

export interface Comfort {
  id: string;
  story_id: string;
  sender_id: string;
  type: ComfortType;
  created_at: string;
  // Joined fields
  sender?: UserProfile;
}

export type StoryCategory = 'work' | 'love' | 'family' | 'health' | 'social' | 'other';

export type ComfortType = 'tea' | 'flower' | 'bandage';

export type StorySortBy = 'newest' | 'pain_high' | 'most_bought' | 'most_comforted';

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  page_size: number;
  has_more: boolean;
}

export interface UserCenterData {
  profile: UserProfile;
  published_stories: Story[];
  purchased_stories: Story[];
  earnings: {
    total_earned: number;
    total_sales: number;
    recent_transactions: Transaction[];
  };
}

export interface TragedyRankData {
  top_stories: (Story & { author?: Pick<UserProfile, 'nickname' | 'avatar_url'> })[];
  today_stats: {
    total_stories: number;
    total_buys: number;
    total_comforts: number;
    avg_pain: number;
  };
}

export interface PaymentIntentResult {
  checkout_url: string;
  transaction_id: string;
}

export interface ApiError {
  message: string;
  code: string;
  details?: string;
}
