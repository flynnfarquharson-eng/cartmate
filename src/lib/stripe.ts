import Stripe from "stripe";

export const stripe = process.env.STRIPE_SECRET_KEY?.startsWith("sk_")
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2024-06-20",
    })
  : (null as unknown as Stripe);
