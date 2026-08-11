import Stripe from "stripe";

export const STRIPE_API_VERSION = "2024-12-18.acacia" as const;

export function getStripeSecretKey(): string {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error(
      "STRIPE_SECRET_KEY is not set. Add it to your environment to enable Stripe."
    );
  }
  return secretKey;
}

function createStripeClient(): Stripe {
  return new Stripe(getStripeSecretKey(), {
    // @ts-expect-error pinned API version predates the SDK's latest-version type
    apiVersion: STRIPE_API_VERSION,
  });
}

let stripeClient: Stripe | null = null;

export function getStripe(): Stripe {
  if (!stripeClient) {
    stripeClient = createStripeClient();
  }
  return stripeClient;
}

export const stripe: Stripe = new Proxy({} as Stripe, {
  get(_target, prop: string | symbol) {
    const client = getStripe();
    const value = (client as unknown as Record<string | symbol, unknown>)[prop];
    return typeof value === "function" ? value.bind(client) : value;
  },
});
