// ============================================================
// Edge Function: send-comfort
// 发送安慰剂，更新故事的安慰数
// ============================================================

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VALID_COMFORT_TYPES = ["tea", "flower", "bandage"];

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

    const { story_id, type } = await req.json();

    // Validation
    if (!story_id) {
      return new Response(
        JSON.stringify({ message: "缺少 story_id", code: "VALIDATION_ERROR" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }
    if (!VALID_COMFORT_TYPES.includes(type)) {
      return new Response(
        JSON.stringify({ message: "无效的安慰类型", code: "VALIDATION_ERROR" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Check story exists
    const { data: story, error: storyError } = await supabase
      .from("stories")
      .select("id, author_id")
      .eq("id", story_id)
      .eq("is_published", true)
      .single();

    if (storyError || !story) {
      return new Response(
        JSON.stringify({ message: "故事不存在", code: "STORY_NOT_FOUND" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
      );
    }

    // Check if already sent a comfort for this story (per type)
    const { data: existingComfort } = await supabase
      .from("comforts")
      .select("id")
      .eq("story_id", story_id)
      .eq("sender_id", user.id)
      .eq("type", type)
      .maybeSingle();

    if (existingComfort) {
      return new Response(
        JSON.stringify({ message: "已经送过这种安慰了", code: "ALREADY_SENT" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Insert comfort
    const { data, error: insertError } = await supabase
      .from("comforts")
      .insert({
        story_id,
        sender_id: user.id,
        type,
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // Update comfort_count on the story
    const { error: updateError } = await supabase
      .from("stories")
      .update({ comfort_count: story ? undefined : 0 })
      .eq("id", story_id);

    // Use RPC for atomic increment if available, fallback to select-update
    await supabase.rpc("increment_comfort_count", { story_uuid: story_id }).then(({ error }) => {
      if (error) {
        // Fallback: manual increment
        supabase
          .from("stories")
          .select("comfort_count")
          .eq("id", story_id)
          .single()
          .then(({ data: s }) => {
            if (s) {
              supabase
                .from("stories")
                .update({ comfort_count: s.comfort_count + 1 })
                .eq("id", story_id);
            }
          });
      }
    });

    return new Response(
      JSON.stringify({ data, message: "安慰已送达" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 201,
      }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "安慰发送失败";
    return new Response(
      JSON.stringify({ message, code: "COMFORT_ERROR" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
