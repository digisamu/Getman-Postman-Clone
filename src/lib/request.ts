import type { HttpRequestPayload } from "../shared/ipc";
import type { ApiRequest, KeyValueRow, Settings } from "../types/api";
import { normalizeUrl } from "./url";
import { resolveVariables, type VariableMap } from "./variables";

const active = (rows: KeyValueRow[]) => rows.filter((row) => row.enabled && row.key.trim());

const hasHeader = (headers: Array<[string, string]>, name: string) => headers.some(([key]) => key.toLowerCase() === name.toLowerCase());

export const methodSendsBody = (method: string) => method !== "GET" && method !== "HEAD";

function encodeBasic(username: string, password: string) {
  const bytes = new TextEncoder().encode(`${username}:${password}`);
  return btoa(String.fromCharCode(...bytes));
}

export type PreparedRequest = Omit<HttpRequestPayload, "timeoutMs" | "verifySsl" | "followRedirects">;

/** Turns an editable request into exactly what goes over the wire: variables resolved, auth and content type applied. */
export function prepareRequest(request: ApiRequest, variables: VariableMap): PreparedRequest {
  const resolve = (value: string) => resolveVariables(value, variables);
  const rawUrl = resolve(request.url);
  let url: string;
  try {
    url = new URL(normalizeUrl(rawUrl)).toString();
  } catch (error) {
    if (error instanceof TypeError) throw new Error(`"${rawUrl}" is not a valid URL.`);
    throw error;
  }

  const headers: Array<[string, string]> = active(request.headers).map((row) => [row.key.trim(), resolve(row.value)]);

  const { auth } = request;
  if (auth.type === "bearer" && auth.token.trim() && !hasHeader(headers, "authorization")) {
    headers.push(["Authorization", `Bearer ${resolve(auth.token.trim())}`]);
  }
  if (auth.type === "basic" && (auth.username || auth.password) && !hasHeader(headers, "authorization")) {
    headers.push(["Authorization", `Basic ${encodeBasic(resolve(auth.username), resolve(auth.password))}`]);
  }

  let body: PreparedRequest["body"];
  if (methodSendsBody(request.method)) {
    const { type, content, fields } = request.body;
    if (type === "json" || type === "raw") {
      body = { kind: "text", text: resolve(content) };
      if (!hasHeader(headers, "content-type")) headers.push(["Content-Type", type === "json" ? "application/json" : "text/plain"]);
    } else if (type === "urlencoded") {
      const params = new URLSearchParams();
      active(fields).forEach((row) => params.append(row.key.trim(), resolve(row.value)));
      body = { kind: "text", text: params.toString() };
      if (!hasHeader(headers, "content-type")) headers.push(["Content-Type", "application/x-www-form-urlencoded"]);
    } else if (type === "form-data") {
      body = { kind: "multipart", fields: active(fields).map((row) => [row.key.trim(), resolve(row.value)]) };
    }
  }

  return { method: request.method, url, headers, body };
}

export function toPayload(prepared: PreparedRequest, settings: Settings): HttpRequestPayload {
  return { ...prepared, timeoutMs: settings.timeoutMs, verifySsl: settings.verifySsl, followRedirects: settings.followRedirects };
}
