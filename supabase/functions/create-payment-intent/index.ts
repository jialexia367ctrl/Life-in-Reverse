// ============================================================
// Edge Function: create-payment-intent
// 创建Stripe Checkout Session，生成支付链接
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
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY")!;
    const stripeSuccessUrl = Deno.env.get("STRIPE_SUCCESS_URL") || `${supabaseUrl}/payment/success`;
    const stripeCancelUrl = Deno.env.get("STRIPE_CANCEL_URL") || `${supabaseUrl}/payment/cancel`;

    if (!stripeSecretKey) {
      throw new Error("STRIPE_SECRET_KEY is not configured");
    }

    // Auth check
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

    const { story_id } = await req.json();
    if (!story_id) {
      return new Response(
        JSON.stringify({ message: "缺少 story_id", code: "VALIDATION_ERROR" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Fetch the story
    const { data: story, error: storyError } = await supabase
      .from("stories")
      .select("*, author:user_profiles!stories_author_id_fkey(nickname)")
      .eq("id", story_id)
      .single();

    if (storyError || !story) {
      return new Response(
        JSON.stringify({ message: "故事不存在", code: "STORY_NOT_FOUND" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
      );
    }

    // Prevent self-purchase
    if (story.author_id === user.id) {
      return new Response(
        JSON.stringify({ message: "不能购买自己的故事", code: "SELF_PURCHASE" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Check if already purchased
    const { data: existingTx } = await supabase
      .from("transactions")
      .select("id")
      .eq("story_id", story_id)
      .eq("buyer_id", user.id)
      .maybeSingle();

    if (existingTx) {
      return new Response(
        JSON.stringify({ message: "已购买过此故事", code: "ALREADY_PURCHASED" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Create a pending transaction record
    const { data: tx, error: txError } = await supabase
      .from("transactions")
      .insert({
        story_id,
        buyer_id: user.id,
        seller_id: story.author_id,
        price: story.price,
      })
      .select()
      .single();

    if (txError) throw txError;

    // Create Stripe Checkout Session
    const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeSecretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        "payment_method_types[0]": "card",
        "line_items[0][price_data][currency]": "cny",
        "line_items[0][price_data][product_data][name]": `「${story.title}」`,
        "line_items[0][price_data][product_data][description]": `购买匿名故事 - 痛苦等级 ${story.pain_level}`,
        "line_items[0][price_data][unit_amount]": String(Math.round(story.price * 100)),
        "line_items[0][quantity]": "1",
        mode: "payment",
        success_url: `${stripeSuccessUrl}?transaction_id=${tx.id}`,
        cancel_url: `${stripeCancelUrl}?transaction_id=${tx.id}`,
        metadata[transaction_id]: tx.id,
        metadata[story_id]: story_id,
        metadata[buyer_id]: user.id,
        metadata[seller_id]: story.author_id,
      }).toString(),
    });

    const session = await stripeRes.json();

    if (session.error) {
      // Rollback transaction
      await supabase.from("transactions").delete().eq("id", tx.id);
      throw new Error(session.error.message);
    }

    return new Response(
      JSON.stringify({
        checkout_url: session.url,
        transaction_id: tx.id,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "支付创建失败";
    return new Response(
      JSON.stringify({ message, code: "PAYMENT_ERROR" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
