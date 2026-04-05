# CartMate

A shared grocery ordering platform for share houses. Each housemate adds their own items to a shared cart and pays their own portion before the order is confirmed.

## Tech Stack

- **Next.js 14** with App Router
- **Supabase** for database and real-time subscriptions
- **Stripe** for individual payments
- **Tailwind CSS** for styling
- **Vercel** for deployment

## Setup

### 1. Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run the contents of `supabase/schema.sql`
3. Go to **Settings > API** and copy your project URL and keys
4. In **Database > Replication**, ensure `items`, `orders`, and `payments` tables have realtime enabled (the schema SQL does this automatically)

### 2. Stripe

1. Create a Stripe account at [stripe.com](https://stripe.com)
2. Copy your **Publishable key** and **Secret key** from the Stripe Dashboard
3. For local development, install the [Stripe CLI](https://stripe.com/docs/stripe-cli) and run:
   ```bash
   stripe listen --forward-to localhost:3000/api/webhooks/stripe
   ```
   Copy the webhook signing secret that is printed.
4. For production, create a webhook endpoint in the Stripe Dashboard pointing to `https://your-domain.com/api/webhooks/stripe` and listen for `checkout.session.completed` events.

### 3. Environment Variables

Copy `.env.local.example` to `.env.local` and fill in the values:

```bash
cp .env.local.example .env.local
```

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase service role key (keep secret) |
| `STRIPE_SECRET_KEY` | Your Stripe secret key |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Your Stripe publishable key |
| `STRIPE_WEBHOOK_SECRET` | Your Stripe webhook signing secret |
| `NEXT_PUBLIC_BASE_URL` | Your app URL (e.g., `http://localhost:3000`) |

### 4. Run Locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 5. Deploy to Vercel

1. Push the repo to GitHub
2. Import the repo in [Vercel](https://vercel.com)
3. Add all environment variables from `.env.local` to the Vercel project settings
4. Set `NEXT_PUBLIC_BASE_URL` to your Vercel deployment URL
5. Update the Stripe webhook endpoint to use the Vercel URL

## How It Works

1. **Create a house** and share the invite code or link with housemates
2. **Everyone adds items** to the shared cart (real-time updates)
3. **Each person pays** their own subtotal via Stripe
4. **Once everyone has paid**, the order locks and a consolidated shopping list appears
5. **Place the order** and the person doing the shop gets a clean checklist

## Invite Links

Share houses can be joined via invite links: `your-domain.com/join/[invite_code]`
