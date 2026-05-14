// ============================================================
// Edge Function: get-tragedy-rank
// 获取悲剧榜数据和今日统计数据
// ============================================================

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch top stories by pain_level (descending), then buy_count as tiebreaker
    const { data: topStories, error: topError } = await supabase
      .from("stories")
      .select(
        `
        id, title, content, category, pain_level, price,
        buy_count, comfort_count, created_at,
        author:user_profiles!stories_author_id_fkey(nickname, avatar_url)
        `
      )
      .eq("is_published", true)
      .order("pain_level", { ascending: false })
      .order("buy_count", { ascending: false })
      .limit(20);

    if (topError) throw topError;

    // Today's stats
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString();

    const { data: todayStories } = await supabase
      .from("stories")
      .select("pain_level, buy_count, comfort_count")
      .eq("is_published", true)
      .gte("created_at", todayISO);

    const todayStats = {
      total_stories: todayStories?.length || 0,
      total_buys: (todayStories || []).reduce((sum, s) => sum + (s.buy_count || 0), 0),
      total_comforts: (todayStories || []).reduce((sum, s) => sum + (s.comfort_count || 0), 0),
      avg_pain:
        todayStories && todayStories.length > 0
          ? todayStories.reduce((sum, s) => sum + s.pain_level, 0) / todayStories.length
          : 0,
    };

    // Category distribution
    const categoryCount: Record<string, number> = {};
    (todayStories || []).forEach((s) => {
      // We don't have category in this query, let's add it
    });

    // Re-fetch with category for distribution
    const { data: catStories } = await supabase
      .from("stories")
      .select("category")
      .eq("is_published", true)
      .gte("created_at", todayISO);

    const categoryDistribution: Record<string, number> = {};
    (catStories || []).forEach((s) => {
      categoryDistribution[s.category] = (categoryDistribution[s.category] || 0) + 1;
    });

    return new Response(
      JSON.stringify({
        top_stories: topStories || [],
        today_stats: {
          ...todayStats,
          category_distribution: categoryDistribution,
        },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "获取排行榜失败";
    return new Response(
      JSON.stringify({ message, code: "RANK_ERROR" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
