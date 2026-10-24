import { METHODS, createRequest, createRow } from "./factory";
import { syncRowsFromUrl } from "./url";
import type { ApiRequest, HttpMethod, KeyValueRow } from "../types/api";

/** Splits a shell command into arguments, honouring single/double quotes, escapes and line continuations. */
function tokenize(command: string) {
  const tokens: string[] = [];
  let current = "";
  let quote: "'" | '"' | null = null;
  let hasToken = false;
  for (let i = 0; i < command.length; i++) {
    const char = command[i];
    if (quote === "'") {
      if (char === "'") quote = null;
      else current += char;
    } else if (quote === '"') {
      if (char === '"') quote = null;
      else if (char === "\\" && i + 1 < command.length && '"\\$`'.includes(command[i + 1])) current += command[++i];
      else current += char;
    } else if (char === "'" || char === '"') {
      quote = char;
      hasToken = true;
    } else if (char === "\\" && i + 1 < command.length) {
      const next = command[++i];
      if (next !== "\n" && next !== "\r") {
        current += next;
        hasToken = true;
      }
    } else if (/\s/.test(char)) {
      if (hasToken || current) tokens.push(current);
      current = "";
      hasToken = false;
    } else {
      current += char;
      hasToken = true;
    }
  }
  if (hasToken || current) tokens.push(current);
  return tokens;
}

export function looksLikeCurl(text: string) {
  return /^\s*curl\s/i.test(text);
}

export function parseCurl(command: string): ApiRequest {
  const args = tokenize(command.trim());
  if (args[0]?.toLowerCase() !== "curl") throw new Error("Not a cURL command");

  let method: string | null = null;
  let url = "";
  const headers: KeyValueRow[] = [];
  const data: string[] = [];
  const form: KeyValueRow[] = [];
  let user: string | null = null;
  let getMode = false;

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    const next = () => args[++i] ?? "";
    if (arg === "-X" || arg === "--request") method = next().toUpperCase();
    else if (arg.startsWith("-X") && arg.length > 2) method = arg.slice(2).toUpperCase();
    else if (arg === "-H" || arg === "--header") {
      const header = next();
      const colon = header.indexOf(":");
      if (colon > 0) headers.push(createRow(header.slice(0, colon).trim(), header.slice(colon + 1).trim()));
    } else if (["-d", "--data", "--data-raw", "--data-binary", "--data-ascii", "--data-urlencode", "--json"].includes(arg)) {
      data.push(next());
      if (arg === "--json") headers.push(createRow("Content-Type", "application/json"));
    } else if (arg === "-F" || arg === "--form") {
      const field = next();
      const eq = field.indexOf("=");
      form.push(createRow(eq >= 0 ? field.slice(0, eq) : field, eq >= 0 ? field.slice(eq + 1) : ""));
    } else if (arg === "-u" || arg === "--user") user = next();
    else if (arg === "-G" || arg === "--get") getMode = true;
    else if (arg === "--url") url = next();
    else if (arg === "-A" || arg === "--user-agent") headers.push(createRow("User-Agent", next()));
    else if (arg === "-e" || arg === "--referer") headers.push(createRow("Referer", next()));
    else if (arg === "-b" || arg === "--cookie") headers.push(createRow("Cookie", next()));
    else if (["-o", "--output", "-m", "--max-time", "--connect-timeout", "-w", "--write-out"].includes(arg)) next();
    else if (!arg.startsWith("-") && !url) url = arg;
  }

  if (getMode && data.length) {
    url += (url.includes("?") ? "&" : "?") + data.join("&");
    data.length = 0;
  }

  const resolvedMethod = (method ?? (data.length || form.length ? "POST" : "GET")) as HttpMethod;
  const request = createRequest({
    name: url.replace(/^https?:\/\//, "").split("?")[0] || "Imported request",
    method: METHODS.includes(resolvedMethod) ? resolvedMethod : "GET",
    url,
    headers,
    queryParams: syncRowsFromUrl(url, [])
  });

  if (form.length) {
    request.body = { type: "form-data", content: "", fields: form };
  } else if (data.length) {
    const text = data.join("&");
    const contentType = headers.find((row) => row.key.toLowerCase() === "content-type")?.value.toLowerCase() ?? "";
    const looksJson = contentType.includes("json") || /^\s*[[{]/.test(text);
    if (contentType.includes("x-www-form-urlencoded") || (!looksJson && /^[^=&\s]+=/.test(text))) {
      const fields = [...new URLSearchParams(text)].map(([key, value]) => createRow(key, value));
      request.body = { type: "urlencoded", content: "", fields };
      request.headers = headers.filter((row) => row.key.toLowerCase() !== "content-type");
    } else {
      request.body = { type: looksJson ? "json" : "raw", content: text, fields: [] };
    }
  }

  if (user !== null) {
    const colon = user.indexOf(":");
    request.auth = { type: "basic", token: "", username: colon >= 0 ? user.slice(0, colon) : user, password: colon >= 0 ? user.slice(colon + 1) : "" };
  } else {
    const authHeader = headers.find((row) => row.key.toLowerCase() === "authorization" && /^bearer\s+/i.test(row.value));
    if (authHeader) {
      request.auth = { type: "bearer", token: authHeader.value.replace(/^bearer\s+/i, ""), username: "", password: "" };
      request.headers = request.headers.filter((row) => row !== authHeader);
    }
  }
  return request;
}
