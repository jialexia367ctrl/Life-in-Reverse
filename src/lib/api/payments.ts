// ============================================================
// API: Payments - Stripe checkout integration
// ============================================================

import { supabase } from '../supabase';
import type { PaymentIntentResult, Transaction } from '../types';

/**
 * Create a payment intent for purchasing a story.
 * Returns a Stripe Checkout URL.
 */
export async function createPayment(storyId: string): Promise<PaymentIntentResult> {
  const { data, error } = await supabase.functions.invoke('create-payment-intent', {
    method: 'POST',
    body: { story_id: storyId },
  });

  if (error) throw new Error(error.message || '支付创建失败');

  return {
    checkout_url: data.checkout_url,
    transaction_id: data.transaction_id,
  };
}

/**
 * Redirect to Stripe Checkout.
 * Call this after createPayment succeeds.
 */
export function redirectToCheckout(checkoutUrl: string): void {
  window.location.href = checkoutUrl;
}

/**
 * Verify a payment after returning from Stripe.
 * Checks if the transaction exists and is valid.
 */
export async function verifyPayment(transactionId: string): Promise<Transaction> {
  const { data, error } = await supabase
    .from('transactions')
    .select('*, story:stories(title)')
    .eq('id', transactionId)
    .single();

  if (error) throw new Error('交易记录不存在');
  return data as Transaction;
}

/**
 * Fetch user's purchase history.
 */
export async function fetchPurchaseHistory(): Promise<Transaction[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select(
      `
      *,
      story:stories (id, title, content, category, pain_level, author_id)
      `
    )
    .eq('buyer_id', (await supabase.auth.getUser()).data.user?.id)
    .order('created_at', { ascending: false });

  if (error) throw new Error('获取购买记录失败');
  return (data as Transaction[]) || [];
}

/**
 * Fetch user's sales history.
 */
export async function fetchSalesHistory(): Promise<Transaction[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select(
      `
      *,
      story:stories (id, title, category, pain_level),
      buyer:user_profiles!transactions_buyer_id_fkey (nickname, avatar_url)
      `
    )
    .eq('seller_id', (await supabase.auth.getUser()).data.user?.id)
    .order('created_at', { ascending: false });

  if (error) throw new Error('获取销售记录失败');
  return (data as Transaction[]) || [];
}
