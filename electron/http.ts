import { STATUS_CODES } from "node:http";
import { Agent, FormData, Headers, fetch } from "undici";
import type { HttpRequestPayload, HttpResponsePayload } from "../src/shared/ipc";

// Two pooled keep-alive agents: repeat requests to the same host skip the TCP/TLS handshake.
const strictAgent = new Agent({ keepAliveTimeout: 30_000, connect: { timeout: 15_000 } });
const insecureAgent = new Agent({ keepAliveTimeout: 30_000, connect: { timeout: 15_000, rejectUnauthorized: false } });

const BODYLESS = new Set(["GET", "HEAD"]);
const TEXT_TYPES = /^(text\/|application\/(.+\+)?(json|xml|javascript|ecmascript|x-www-form-urlencoded|graphql|yaml|x-yaml|problem\+json))/i;
const MAX_BINARY_PREVIEW = 25 * 1024 * 1024;

const ERROR_HINTS: Record<string, string> = {
  ENOTFOUND: "The host name could not be resolved. Check the URL or your network connection.",
  ECONNREFUSED: "The connection was refused. Is the server running on that port?",
  ECONNRESET: "The server closed the connection unexpectedly.",
  ETIMEDOUT: "The connection timed out.",
  UND_ERR_CONNECT_TIMEOUT: "Connecting to the server timed out.",
  EHOSTUNREACH: "The host is unreachable from this network.",
  DEPTH_ZERO_SELF_SIGNED_CERT: "The server uses a self-signed certificate. Turn off SSL verification in Settings to allow it.",
  SELF_SIGNED_CERT_IN_CHAIN: "The certificate chain contains a self-signed certificate. Turn off SSL verification in Settings to allow it.",
  UNABLE_TO_VERIFY_LEAF_SIGNATURE: "The server certificate could not be verified. Turn off SSL verification in Settings to allow it.",
  CERT_HAS_EXPIRED: "The server certificate has expired. Turn off SSL verification in Settings to allow it.",
  ERR_TLS_CERT_ALTNAME_INVALID: "The certificate does not match the host name."
};

const inflight = new Map<string, AbortController>();

function describeError(error: unknown): string {
  const cause = (error as { cause?: { code?: string; message?: string } })?.cause;
  const code = cause?.code ?? (error as { code?: string })?.code;
  if (code && ERROR_HINTS[code]) return ERROR_HINTS[code];
  if (cause?.message) return cause.message;
  return error instanceof Error ? error.message : String(error);
}

function isTextual(contentType: string, buffer: Buffer) {
  if (!contentType) {
    // No content type: treat as text unless it contains NUL bytes in the first chunk.
    return !buffer.subarray(0, 1024).includes(0);
  }
  return TEXT_TYPES.test(contentType) || /charset=/i.test(contentType);
}

export function cancelHttpRequest(id: string) {
  inflight.get(id)?.abort("cancelled");
}

export async function executeHttpRequest(id: string, payload: HttpRequestPayload): Promise<HttpResponsePayload> {
  const controller = new AbortController();
  inflight.set(id, controller);
  const startedAt = performance.now();
  let timedOut = false;
  const timer =
    payload.timeoutMs > 0
      ? setTimeout(() => {
          timedOut = true;
          controller.abort("timeout");
        }, payload.timeoutMs)
      : undefined;

  try {
    const method = payload.method.toUpperCase();
    let body: string | FormData | undefined;
    if (payload.body && !BODYLESS.has(method)) {
      if (payload.body.kind === "text") {
        body = payload.body.text;
      } else {
        const form = new FormData();
        payload.body.fields.forEach(([key, value]) => form.append(key, value));
        body = form;
      }
    }

    const headers = new Headers();
    for (const [key, value] of payload.headers) {
      // Let undici generate the multipart boundary.
      if (body instanceof FormData && key.toLowerCase() === "content-type") continue;
      headers.append(key, value);
    }

    const response = await fetch(payload.url, {
      method,
      headers,
      body,
      redirect: payload.followRedirects ? "follow" : "manual",
      signal: controller.signal,
      dispatcher: payload.verifySsl ? strictAgent : insecureAgent
    });

    const buffer = Buffer.from(await response.arrayBuffer());
    const timeMs = Math.round(performance.now() - startedAt);
    const contentType = response.headers.get("content-type") ?? "";
    const textual = method === "HEAD" || isTextual(contentType, buffer);

    return {
      ok: true,
      status: response.status,
      statusText: response.statusText || STATUS_CODES[response.status] || "",
      url: response.url || payload.url,
      headers: [...response.headers.entries()],
      cookies: response.headers.getSetCookie(),
      contentType,
      timeMs,
      sizeBytes: buffer.byteLength,
      bodyText: textual ? buffer.toString("utf8") : null,
      bodyBase64: !textual && buffer.byteLength <= MAX_BINARY_PREVIEW ? buffer.toString("base64") : null
    };
  } catch (error) {
    const timeMs = Math.round(performance.now() - startedAt);
    if (controller.signal.aborted) {
      return timedOut
        ? { ok: false, error: `The request timed out after ${payload.timeoutMs} ms.`, timeMs }
        : { ok: false, error: "Request cancelled.", cancelled: true, timeMs };
    }
    return { ok: false, error: describeError(error), timeMs };
  } finally {
    clearTimeout(timer);
    inflight.delete(id);
  }
}
