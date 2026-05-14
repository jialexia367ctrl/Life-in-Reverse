# 反向人生交易所

一个暗色霓虹风的匿名故事交易网站。用户可以匿名发布痛苦经历、购买别人的故事、送出轻量安慰，并接入 Supabase + Stripe 完成正式上线。

## 现在这份仓库是什么状态

这份项目支持两种运行模式：

1. `本地演示模式`
   - 前端：Vite
   - 后端：Express + SQLite
   - 适合本地看效果、演示交互、快速改 UI

2. `生产上线模式`
   - 前端：Vite 部署到 Vercel
   - 后端：Supabase Auth + Postgres + Edge Functions
   - 支付：Stripe Checkout + Webhook

前端已经做成双模式适配：

- 设置 `VITE_BACKEND_MODE=local` 时，走本地 `http://localhost:3001`
- 设置 `VITE_SUPABASE_URL` 和 `VITE_SUPABASE_ANON_KEY` 时，自动切到 Supabase

## 本地运行

安装依赖：

```bash
npm install
```

启动本地演示后端：

```bash
npm run backend
```

启动前端：

```bash
npm run frontend
```

打开：

```text
http://localhost:5173
```

## 生产部署

完整步骤见：

- [DEPLOYMENT.md](C:\Users\Administrator\Documents\Codex\2026-05-14\supabase-react-sql-schema-4-rls\DEPLOYMENT.md)
- [DEPLOY_COMMANDS.md](C:\Users\Administrator\Documents\Codex\2026-05-14\supabase-react-sql-schema-4-rls\DEPLOY_COMMANDS.md)

核心配置如下。

### Vercel 环境变量

```env
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-supabase-anon-key>
```

不要在线上设置：

```env
VITE_BACKEND_MODE=local
```

### Supabase secrets

这些写到 Supabase Edge Functions secrets，不写到前端：

```env
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_SUCCESS_URL=https://your-domain.com/payment/success
STRIPE_CANCEL_URL=https://your-domain.com/payment/cancel
```

## 重要文件

- [src/main.jsx](C:\Users\Administrator\Documents\Codex\2026-05-14\supabase-react-sql-schema-4-rls\src\main.jsx)
  当前主界面，包含交易大厅、挂牌区、榜单、支付成功/取消页

- [src/lib/appApi.js](C:\Users\Administrator\Documents\Codex\2026-05-14\supabase-react-sql-schema-4-rls\src\lib\appApi.js)
  本地 / 生产双模式 API 适配层

- [supabase](C:\Users\Administrator\Documents\Codex\2026-05-14\supabase-react-sql-schema-4-rls\supabase)
  migrations 和 Edge Functions

- [vercel.json](C:\Users\Administrator\Documents\Codex\2026-05-14\supabase-react-sql-schema-4-rls\vercel.json)
  Vercel 部署配置

## 构建

```bash
npx vite build
```

## 上线前检查

- 匿名登录可用
- 发布故事可用
- 榜单和故事大厅可读
- 支付成功回跳到 `/payment/success`
- 支付取消回跳到 `/payment/cancel`
- Stripe webhook 能更新交易状态
- RLS 权限符合预期
