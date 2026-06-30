const OMISE_API = 'https://api.omise.co';

export interface OmiseCharge {
  id: string;
  status: 'pending' | 'successful' | 'failed' | 'expired' | 'reversed';
  amount: number;
  currency: string;
  expires_at: string | null;
  paid_at: string | null;
  source?: {
    type: string;
    scannable_code?: {
      type: string;
      image?: {
        download_uri: string;
      };
    };
  };
}

function authHeader(secretKey: string) {
  return 'Basic ' + Buffer.from(`${secretKey}:`).toString('base64');
}

/** Create a PromptPay QR charge. amount is in THB (not satang). */
export async function createPromptPayCharge(opts: {
  secretKey: string;
  amountTHB: number;
  description?: string;
  metadata?: Record<string, string>;
}): Promise<OmiseCharge> {
  const satang = Math.round(opts.amountTHB * 100);
  const body = new URLSearchParams({
    amount: String(satang),
    currency: 'THB',
    'source[type]': 'promptpay',
  });
  if (opts.description) body.set('description', opts.description.slice(0, 255));
  if (opts.metadata) {
    for (const [k, v] of Object.entries(opts.metadata)) {
      body.set(`metadata[${k}]`, v);
    }
  }

  const res = await fetch(`${OMISE_API}/charges`, {
    method: 'POST',
    headers: {
      Authorization: authHeader(opts.secretKey),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  const json = (await res.json()) as OmiseCharge & { object?: string; code?: string; message?: string };
  if (!res.ok) {
    throw new Error(`Omise error ${json.code ?? res.status}: ${json.message ?? 'unknown'}`);
  }
  return json;
}

/** Retrieve a charge from Omise API (used for webhook verification). */
export async function retrieveCharge(chargeId: string, secretKey: string): Promise<OmiseCharge> {
  const res = await fetch(`${OMISE_API}/charges/${chargeId}`, {
    headers: { Authorization: authHeader(secretKey) },
  });
  const json = (await res.json()) as OmiseCharge & { code?: string; message?: string };
  if (!res.ok) {
    throw new Error(`Omise retrieve error ${json.code ?? res.status}: ${json.message ?? 'unknown'}`);
  }
  return json;
}

/** Resolve which Omise secret key to use: shop-level first, fallback to env. */
export function resolveOmiseSecretKey(shopKey?: string | null): string {
  return shopKey || process.env.OMISE_SECRET_KEY || '';
}

/** Return true if the provided key is a test key. */
export function isTestKey(key: string) {
  return key.startsWith('skey_test_') || key.startsWith('pkey_test_');
}
