# 发布命令速查

下面这些命令是给正式上线时直接复制用的。

## 1. 初始化 Git 仓库

如果你准备推到 GitHub：

```bash
git init
git add .
git commit -m "Initial release: reverse life exchange"
```

然后在 GitHub 创建空仓库后执行：

```bash
git remote add origin <your-github-repo-url>
git branch -M main
git push -u origin main
```

## 2. Supabase 登录与关联

```bash
supabase login
supabase link --project-ref <your-project-ref>
```

## 3. 部署 Supabase Functions

单条命令：

```bash
npm run supabase:functions:deploy
```

或者逐个部署：

```bash
supabase functions deploy get-stories
supabase functions deploy publish-story
supabase functions deploy create-payment-intent
supabase functions deploy handle-payment-webhook
supabase functions deploy send-comfort
supabase functions deploy get-user-center
supabase functions deploy get-tragedy-rank
```

## 4. 写入 Supabase Secrets

```bash
supabase secrets set STRIPE_SECRET_KEY=sk_live_xxx
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_xxx
supabase secrets set STRIPE_SUCCESS_URL=https://<your-domain>/payment/success
supabase secrets set STRIPE_CANCEL_URL=https://<your-domain>/payment/cancel
```

## 5. 本地构建检查

```bash
npm install
npm run build
```

## 6. Vercel 登录和部署

首次：

```bash
vercel
```

正式发布：

```bash
npm run deploy:vercel
```

预览部署：

```bash
npm run deploy:vercel:preview
```

## 7. Vercel 必填环境变量

```env
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-supabase-anon-key>
```

不要设置：

```env
VITE_BACKEND_MODE=local
```
