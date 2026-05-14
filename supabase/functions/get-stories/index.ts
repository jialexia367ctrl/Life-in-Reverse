// ============================================================
// Edge Function: get-stories
// 获取故事列表，支持分类、排序、分页
// ============================================================

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse query parameters
    const url = new URL(req.url);
    const category = url.searchParams.get("category") || null;
    const sort = url.searchParams.get("sort") || "newest";
    const page = parseInt(url.searchParams.get("page") || "1", 10);
    const pageSize = Math.min(parseInt(url.searchParams.get("page_size") || "20", 10), 50);
    const offset = (page - 1) * pageSize;

    // Build query
    let query = supabase
      .from("stories")
      .select(
        `
        *,
        author:user_profiles!stories_author_id_fkey (nickname, avatar_url)
        `,
        { count: "exact" }
      )
      .eq("is_published", true);

    // Filter by category
    if (category && category !== "all") {
      query = query.eq("category", category);
    }

    // Apply sorting
    switch (sort) {
      case "pain_high":
        query = query.order("pain_level", { ascending: false });
        break;
      case "most_bought":
        query = query.order("buy_count", { ascending: false });
        break;
      case "most_comforted":
        query = query.order("comfort_count", { ascending: false });
        break;
      case "newest":
      default:
        query = query.order("created_at", { ascending: false });
        break;
    }

    // Apply pagination
    query = query.range(offset, offset + pageSize - 1);

    const { data, error, count } = await query;

    if (error) throw error;

    const total = count || 0;

    return new Response(
      JSON.stringify({
        data: data || [],
        total,
        page,
        page_size: pageSize,
        has_more: offset + pageSize < total,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return new Response(
      JSON.stringify({ message, code: "STORIES_FETCH_ERROR" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
