function base64UrlDecode(part: string) {
  const normalized = part.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const bytes = Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function decodeJwt(token: string) {
  const parts = token.trim().replace(/^Bearer\s+/i, "").split(".");
  if (parts.length < 2) throw new Error("A JWT has three parts separated by dots.");
  let header: unknown;
  let payload: Record<string, unknown>;
  try {
    header = JSON.parse(base64UrlDecode(parts[0]));
    payload = JSON.parse(base64UrlDecode(parts[1]));
  } catch {
    throw new Error("The header or payload is not valid base64url-encoded JSON.");
  }
  const exp = typeof payload.exp === "number" ? new Date(payload.exp * 1000) : null;
  return { header, payload, expiresAt: exp, expired: exp ? exp.getTime() < Date.now() : false };
}

export function base64Encode(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  bytes.forEach((byte) => (binary += String.fromCharCode(byte)));
  return btoa(binary);
}

export function base64Decode(value: string) {
  try {
    return base64UrlDecode(value.trim());
  } catch {
    throw new Error("The input is not valid Base64.");
  }
}
