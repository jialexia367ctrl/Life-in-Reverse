// ============================================================
// Edge Function: get-user-center
// 获取当前用户的发布列表、购买列表和收益
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

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ message: "未登录", code: "UNAUTHORIZED" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ message: "未登录", code: "UNAUTHORIZED" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    // Fetch profile
    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ message: "用户档案不存在", code: "PROFILE_NOT_FOUND" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
      );
    }

    // Fetch published stories
    const { data: publishedStories } = await supabase
      .from("stories")
      .select("*")
      .eq("author_id", user.id)
      .order("created_at", { ascending: false });

    // Fetch purchased story IDs via transactions
    const { data: purchaseTx } = await supabase
      .from("transactions")
      .select("story_id, price, created_at")
      .eq("buyer_id", user.id)
      .order("created_at", { ascending: false });

    // Fetch the actual purchased stories
    let purchasedStories: any[] = [];
    if (purchaseTx && purchaseTx.length > 0) {
      const storyIds = purchaseTx.map((tx) => tx.story_id);
      const { data: stories } = await supabase
        .from("stories")
        .select("*, author:user_profiles!stories_author_id_fkey(nickname, avatar_url)")
        .in("id", storyIds);

      purchasedStories = stories || [];
    }

    // Fetch earnings (as seller)
    const { data: salesTx } = await supabase
      .from("transactions")
      .select("price, created_at")
      .eq("seller_id", user.id)
      .order("created_at", { ascending: false });

    const totalEarned = (salesTx || []).reduce((sum, tx) => sum + Number(tx.price), 0);

    // Fetch recent transactions (both buying and selling)
    const { data: recentAsBuyer } = await supabase
      .from("transactions")
      .select("*, story:stories(title)")
      .eq("buyer_id", user.id)
      .order("created_at", { ascending: false })
      .limit(5);

    const { data: recentAsSeller } = await supabase
      .from("transactions")
      .select("*, story:stories(title)")
      .eq("seller_id", user.id)
      .order("created_at", { ascending: false })
      .limit(5);

    // Merge and deduplicate recent transactions
    const allRecent = [...(recentAsBuyer || []), ...(recentAsSeller || [])];
    const uniqueRecent = allRecent
      .reduce((acc: any[], tx) => {
        if (!acc.find((t) => t.id === tx.id)) acc.push(tx);
        return acc;
      }, [])
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 10);

    return new Response(
      JSON.stringify({
        profile,
        published_stories: publishedStories || [],
        purchased_stories: purchasedStories,
        earnings: {
          total_earned: totalEarned,
          total_sales: (salesTx || []).length,
          recent_transactions: uniqueRecent,
        },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "获取用户中心失败";
    return new Response(
      JSON.stringify({ message, code: "USER_CENTER_ERROR" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
