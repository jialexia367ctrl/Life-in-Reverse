-- ============================================================
-- 反向人生交易所 - Complete Database Schema & RLS Policies
-- Generated: 2026-05-14
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. TABLES
-- ============================================================

-- User profiles (linked to auth.users, stores only anonymous info)
CREATE TABLE public.user_profiles (
    id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    nickname    VARCHAR(50) NOT NULL,
    avatar_url  VARCHAR(255) NOT NULL,
    balance     NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (balance >= 0),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.user_profiles IS '匿名用户档案，不含任何真实个人信息';

-- Stories (the core content)
CREATE TABLE public.stories (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title         VARCHAR(20) NOT NULL,
    content       TEXT NOT NULL,
    category      VARCHAR(20) NOT NULL,
    pain_level    INT NOT NULL CHECK (pain_level BETWEEN 1 AND 10),
    price         NUMERIC(5,2) NOT NULL CHECK (price BETWEEN 0.99 AND 9.99),
    author_id     UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    buy_count     INT NOT NULL DEFAULT 0,
    comfort_count INT NOT NULL DEFAULT 0,
    is_published  BOOLEAN NOT NULL DEFAULT true
);

COMMENT ON TABLE public.stories IS '用户发布的痛苦故事';

-- Indexes for stories
CREATE INDEX idx_stories_author_id ON public.stories(author_id);
CREATE INDEX idx_stories_category ON public.stories(category);
CREATE INDEX idx_stories_created_at ON public.stories(created_at DESC);
CREATE INDEX idx_stories_pain_level ON public.stories(pain_level DESC);

-- Transactions (purchase records)
CREATE TABLE public.transactions (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    story_id    UUID NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
    buyer_id    UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    seller_id   UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    price       NUMERIC(5,2) NOT NULL CHECK (price > 0),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.transactions IS '购买交易记录，仅交易双方可见';

CREATE INDEX idx_transactions_story_id ON public.transactions(story_id);
CREATE INDEX idx_transactions_buyer_id ON public.transactions(buyer_id);
CREATE INDEX idx_transactions_seller_id ON public.transactions(seller_id);

-- Comforts (emotional support tokens)
CREATE TABLE public.comforts (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    story_id    UUID NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
    sender_id   UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    type        VARCHAR(20) NOT NULL CHECK (type IN ('tea', 'flower', 'bandage')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.comforts IS '安慰剂（茶/花/创可贴）';

CREATE INDEX idx_comforts_story_id ON public.comforts(story_id);
CREATE INDEX idx_comforts_sender_id ON public.comforts(sender_id);

-- ============================================================
-- 2. HELPER FUNCTIONS (used by RLS policies)
-- ============================================================

-- Check if current user is the author of a story
CREATE OR REPLACE FUNCTION public.is_story_author(story_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.stories
        WHERE id = story_uuid AND author_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Check if current user is buyer or seller in a transaction
CREATE OR REPLACE FUNCTION public.is_transaction_party(tx_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.transactions
        WHERE id = tx_uuid
        AND (buyer_id = auth.uid() OR seller_id = auth.uid())
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Check if current user is the sender of a comfort
CREATE OR REPLACE FUNCTION public.is_comfort_sender(comfort_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.comforts
        WHERE id = comfort_uuid AND sender_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================
-- 3. ROW LEVEL SECURITY POLICIES
-- ============================================================

-- ---- user_profiles ----
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- 本人可读
CREATE POLICY "user_profiles_select_own"
    ON public.user_profiles FOR SELECT
    USING (id = auth.uid());

-- 本人可写（更新）
CREATE POLICY "user_profiles_update_own"
    ON public.user_profiles FOR UPDATE
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- 本人可插入（注册时创建profile）
CREATE POLICY "user_profiles_insert_own"
    ON public.user_profiles FOR INSERT
    WITH CHECK (id = auth.uid());

-- ---- stories ----
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;

-- 所有人可读已发布的故事
CREATE POLICY "stories_select_published"
    ON public.stories FOR SELECT
    USING (is_published = true OR author_id = auth.uid());

-- 作者本人可插入
CREATE POLICY "stories_insert_own"
    ON public.stories FOR INSERT
    WITH CHECK (author_id = auth.uid());

-- 作者本人可更新
CREATE POLICY "stories_update_own"
    ON public.stories FOR UPDATE
    USING (author_id = auth.uid())
    WITH CHECK (author_id = auth.uid());

-- 作者本人可删除
CREATE POLICY "stories_delete_own"
    ON public.stories FOR DELETE
    USING (author_id = auth.uid());

-- ---- transactions ----
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- 仅买卖双方可读
CREATE POLICY "transactions_select_party"
    ON public.transactions FOR SELECT
    USING (buyer_id = auth.uid() OR seller_id = auth.uid());

-- 系统写入（通过 service_role / edge function）
CREATE POLICY "transactions_insert_system"
    ON public.transactions FOR INSERT
    WITH CHECK (true);

-- ---- comforts ----
ALTER TABLE public.comforts ENABLE ROW LEVEL SECURITY;

-- 所有人可读
CREATE POLICY "comforts_select_all"
    ON public.comforts FOR SELECT
    USING (true);

-- 仅发送者可插入（每人每故事限1次，由应用层保证）
CREATE POLICY "comforts_insert_own"
    ON public.comforts FOR INSERT
    WITH CHECK (sender_id = auth.uid());

-- ============================================================
-- 4. AUTO-CREATE USER PROFILE ON SIGNUP
-- ============================================================

-- Function to generate random nickname
CREATE OR REPLACE FUNCTION public.generate_nickname()
RETURNS VARCHAR(50) AS $$
DECLARE
    adjectives TEXT[] := ARRAY[
        '安静的','迷路的','勇敢的','沉默的','流浪的','倔强的','柔软的','疲惫的',
        '孤独的','温柔的','迷茫的','执着的','失落的','倔强的','透明的','模糊的'
    ];
    nouns TEXT[] := ARRAY[
        '星星','旅人','影子','风','雨','月光','海浪','尘埃',
        '落叶','萤火','浪花','石头','云','雪','雾','梦'
    ];
BEGIN
    RETURN adjectives[floor(random() * array_length(adjectives, 1) + 1)::int]
        || nouns[floor(random() * array_length(nouns, 1) + 1)::int];
END;
$$ LANGUAGE plpgsql;

-- Function to generate random avatar URL (using DiceBear API)
CREATE OR REPLACE FUNCTION public.generate_avatar_url()
RETURNS VARCHAR(255) AS $$
BEGIN
    RETURN 'https://api.dicebear.com/7.x/bottts-neutral/svg?seed=' || encode(gen_random_bytes(8), 'hex');
END;
$$ LANGUAGE plpgsql;

-- Trigger: auto-create profile when a new user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_profiles (id, nickname, avatar_url, balance)
    VALUES (
        NEW.id,
        public.generate_nickname(),
        public.generate_avatar_url(),
        0
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 5. AUTO-UPDATE BUY_COUNT ON TRANSACTION INSERT
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_transaction()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.stories
    SET buy_count = buy_count + 1
    WHERE id = NEW.story_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_transaction_created
    AFTER INSERT ON public.transactions
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_transaction();

-- ============================================================
-- 6. DAILY TRAGEDY STATS VIEW
-- ============================================================

CREATE OR REPLACE VIEW public.daily_stats AS
SELECT
    DATE(created_at) AS stat_date,
    COUNT(*) AS total_stories,
    COALESCE(SUM(buy_count), 0) AS total_buys,
    COALESCE(SUM(comfort_count), 0) AS total_comforts,
    COALESCE(AVG(pain_level), 0) AS avg_pain
FROM public.stories
WHERE is_published = true
GROUP BY DATE(created_at);
