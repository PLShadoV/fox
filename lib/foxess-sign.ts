import crypto from "crypto";

/**
 * Generic HMAC-SHA256 signing helper used by wiele chińskich API.
 * This is a scaffold: adjust header names/key order to dokładny format FoxESS (priv).
 */
export function signPrivate(appId: string, appSecret: string) {
  const nonce = crypto.randomBytes(8).toString("hex");
  const timestamp = Date.now().toString();
  const base = `${appId}${timestamp}${nonce}`;
  const sign = crypto.createHmac("sha256", appSecret).update(base).digest("hex");
  return { nonce, timestamp, sign };
}
