-- ============================================================
-- RPC Helper Functions for Edge Functions
-- Run this AFTER the initial schema migration
-- ============================================================

-- Increment balance atomically
CREATE OR REPLACE FUNCTION public.increment_balance(p_user_id UUID, p_amount NUMERIC)
RETURNS VOID AS $$
BEGIN
    UPDATE public.user_profiles
    SET balance = balance + p_amount
    WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Increment comfort count atomically
CREATE OR REPLACE FUNCTION public.increment_comfort_count(story_uuid UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE public.stories
    SET comfort_count = comfort_count + 1
    WHERE id = story_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Withdraw balance (for future use)
CREATE OR REPLACE FUNCTION public.withdraw_balance(p_user_id UUID, p_amount NUMERIC)
RETURNS BOOLEAN AS $$
DECLARE
    current_balance NUMERIC;
BEGIN
    SELECT balance INTO current_balance FROM public.user_profiles WHERE id = p_user_id;
    
    IF current_balance >= p_amount THEN
        UPDATE public.user_profiles
        SET balance = balance - p_amount
        WHERE id = p_user_id;
        RETURN true;
    END IF;
    
    RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
