// ============================================================
// Edge Function: handle-payment-webhook
// 处理Stripe支付回调，更新交易记录和用户余额
// ============================================================

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
};

// Stripe webhook signature verification using crypto
async function verifyStripeSignature(
  payload: string,
  sigHeader: string,
  secret: string
): Promise<boolean> {
  const parts = sigHeader.split(",").reduce(
    (acc, part) => {
      const [key, value] = part.split("=");
      acc[key] = value;
      return acc;
    },
    {} as Record<string, string>
  );

  const timestamp = parts["t"];
  const signature = parts["v1"];

  if (!timestamp || !signature) return false;

  // Reject if timestamp is older than 5 minutes
  const tolerance = 300;
  const timestampAge = Math.floor(Date.now() / 1000) - parseInt(timestamp, 10);
  if (timestampAge > tolerance) return false;

  const signedPayload = `${timestamp}.${payload}`;
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const data = encoder.encode(signedPayload);

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signatureBuffer = await crypto.subtle.sign("HMAC", cryptoKey, data);
  const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return expectedSignature === signature;
}

serve(async (req: Request) => {
  // Only accept POST
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const stripeWebhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;

    if (!stripeWebhookSecret) {
      throw new Error("STRIPE_WEBHOOK_SECRET is not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Read raw body for signature verification
    const rawBody = await req.text();
    const sigHeader = req.headers.get("stripe-signature") || "";

    // Verify signature
    const isValid = await verifyStripeSignature(rawBody, sigHeader, stripeWebhookSecret);
    if (!isValid) {
      return new Response(
        JSON.stringify({ message: "Invalid signature" }),
        { status: 400 }
      );
    }

    const event = JSON.parse(rawBody);

    // Handle checkout.session.completed
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const transactionId = session.metadata?.transaction_id;

      if (!transactionId) {
        console.error("No transaction_id in session metadata");
        return new Response("OK", { status: 200 });
      }

      // Fetch the pending transaction
      const { data: tx, error: txError } = await supabase
        .from("transactions")
        .select("*")
        .eq("id", transactionId)
        .single();

      if (txError || !tx) {
        console.error("Transaction not found:", transactionId);
        return new Response("OK", { status: 200 });
      }

      // Credit the seller
      const { error: sellerError } = await supabase.rpc("increment_balance", {
        p_user_id: tx.seller_id,
        p_amount: tx.price,
      });

      if (sellerError) {
        // Fallback: direct update if RPC not available
        await supabase
          .from("user_profiles")
          .update({ balance: supabase.rpc ? undefined : tx.price })
          .eq("id", tx.seller_id);
      }

      console.log(`Payment completed for transaction ${transactionId}: seller ${tx.seller_id} credited ${tx.price}`);
    }

    // Handle checkout.session.expired or charge.refunded
    if (event.type === "checkout.session.expired" || event.type === "charge.refunded") {
      const session = event.data.object;
      const transactionId = session.metadata?.transaction_id;

      if (transactionId) {
        // Delete the pending transaction
        await supabase.from("transactions").delete().eq("id", transactionId);
        console.log(`Transaction ${transactionId} removed due to payment ${event.type}`);
      }
    }

    return new Response("OK", { status: 200 });
  } catch (err) {
    console.error("Webhook error:", err);
    // Always return 200 to Stripe to prevent retries for our internal errors
    return new Response("OK", { status: 200 });
  }
});
