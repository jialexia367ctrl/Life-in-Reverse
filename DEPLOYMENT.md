# 反向人生交易所上线清单

## 1. Supabase

1. 创建 Supabase 项目。
2. Authentication > Providers > Anonymous Sign-ins：开启匿名登录。
3. SQL Editor 依次执行：
   - `supabase/migrations/20260514000000_initial_schema.sql`
   - `supabase/migrations/20260514000001_rpc_functions.sql`
4. 部署 Edge Functions：

```bash
supabase login
supabase link --project-ref <your-project-ref>
supabase functions deploy get-stories
supabase functions deploy publish-story
supabase functions deploy create-payment-intent
supabase functions deploy handle-payment-webhook
supabase functions deploy send-comfort
supabase functions deploy get-user-center
supabase functions deploy get-tragedy-rank
```

## 2. Stripe

1. Stripe Dashboard 创建 Webhook Endpoint：
   `https://<your-project-ref>.supabase.co/functions/v1/handle-payment-webhook`
2. 监听事件：
   - `checkout.session.completed`
   - `checkout.session.expired`
   - `charge.refunded`
3. 写入 Supabase secrets：

```bash
supabase secrets set STRIPE_SECRET_KEY=sk_live_xxx
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_xxx
supabase secrets set STRIPE_SUCCESS_URL=https://your-domain.com/payment/success
supabase secrets set STRIPE_CANCEL_URL=https://your-domain.com/payment/cancel
```

## 3. Vercel 前端

1. 将代码推到 GitHub。
2. Vercel 导入仓库。
3. Framework：Vite。
4. Build Command：`npm run build`。
5. Output Directory：`dist`。
6. Vercel 环境变量：

```env
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-supabase-anon-key>
```

不要在 Vercel 里设置 `VITE_BACKEND_MODE=local`，否则线上会继续连本地后端。

## 4. 本地预览

本地仍然可以使用演示后端：

```bash
npm run backend
npm run frontend
```

打开：`http://localhost:5173`

## 5. 上线前检查

- 匿名登录能创建 `user_profiles`。
- 故事发布后 `stories.author_id = auth.uid()`。
- 购买自己的故事会失败。
- Stripe 支付成功后 webhook 能写入交易并给卖家加余额。
- `transactions` 只能交易双方读取。
- `user_profiles` 只能本人读取。
