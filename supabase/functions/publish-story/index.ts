// ============================================================
// Edge Function: publish-story
// 发布新故事，自动关联当前用户
// ============================================================

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VALID_CATEGORIES = ["work", "love", "family", "health", "social", "other"];
const MAX_TITLE_LENGTH = 20;
const MIN_CONTENT_LENGTH = 20;
const MAX_CONTENT_LENGTH = 2000;
const MIN_PAIN = 1;
const MAX_PAIN = 10;
const MIN_PRICE = 0.99;
const MAX_PRICE = 9.99;

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Create client with user's auth token for RLS
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

    // Verify user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ message: "未登录", code: "UNAUTHORIZED" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    const body = await req.json();
    const { title, content, category, pain_level, price } = body;

    // Validation
    const errors: string[] = [];
    if (!title || title.length > MAX_TITLE_LENGTH) {
      errors.push(`标题不能为空且不超过${MAX_TITLE_LENGTH}字`);
    }
    if (!content || content.length < MIN_CONTENT_LENGTH || content.length > MAX_CONTENT_LENGTH) {
      errors.push(`内容长度需在${MIN_CONTENT_LENGTH}-${MAX_CONTENT_LENGTH}字之间`);
    }
    if (!VALID_CATEGORIES.includes(category)) {
      errors.push("无效的分类");
    }
    if (typeof pain_level !== "number" || pain_level < MIN_PAIN || pain_level > MAX_PAIN) {
      errors.push(`痛苦等级需在${MIN_PAIN}-${MAX_PAIN}之间`);
    }
    if (typeof price !== "number" || price < MIN_PRICE || price > MAX_PRICE) {
      errors.push(`价格需在${MIN_PRICE}-${MAX_PRICE}之间`);
    }

    if (errors.length > 0) {
      return new Response(
        JSON.stringify({ message: errors.join("; "), code: "VALIDATION_ERROR" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Insert story
    const { data, error: insertError } = await supabase
      .from("stories")
      .insert({
        title,
        content,
        category,
        pain_level,
        price,
        author_id: user.id,
        is_published: true,
      })
      .select()
      .single();

    if (insertError) throw insertError;

    return new Response(
      JSON.stringify({ data, message: "发布成功" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 201,
      }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "发布失败";
    return new Response(
      JSON.stringify({ message, code: "STORY_PUBLISH_ERROR" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
