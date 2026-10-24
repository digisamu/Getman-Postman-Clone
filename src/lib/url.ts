import { createRow } from "./factory";
import type { KeyValueRow } from "../types/api";

const LOCAL_HOST = /^(localhost|127\.\d+\.\d+\.\d+|0\.0\.0\.0|\[::1\]|[\w-]+\.localhost)(:\d+)?(\/|\?|#|$)/i;

/** Adds a scheme when it is missing: http:// for local hosts, https:// for everything else. */
export function normalizeUrl(input: string) {
  const trimmed = input.trim();
  if (!trimmed) throw new Error("Enter a URL to send the request.");
  if (/^[a-z][a-z\d+.-]*:\/\//i.test(trimmed)) return trimmed;
  return LOCAL_HOST.test(trimmed) ? `http://${trimmed}` : `https://${trimmed}`;
}

function splitUrl(url: string) {
  const hashIndex = url.indexOf("#");
  const hash = hashIndex >= 0 ? url.slice(hashIndex) : "";
  const withoutHash = hashIndex >= 0 ? url.slice(0, hashIndex) : url;
  const queryIndex = withoutHash.indexOf("?");
  return {
    base: queryIndex >= 0 ? withoutHash.slice(0, queryIndex) : withoutHash,
    query: queryIndex >= 0 ? withoutHash.slice(queryIndex + 1) : null,
    hash
  };
}

/** Parses the query string without decoding so `{{variables}}` and user formatting survive. */
export function parseQuery(url: string): Array<[string, string]> {
  const { query } = splitUrl(url);
  if (!query) return [];
  return query
    .split("&")
    .filter((part) => part.length > 0)
    .map((part) => {
      const eq = part.indexOf("=");
      return eq >= 0 ? [part.slice(0, eq), part.slice(eq + 1)] : [part, ""];
    });
}

/** Rewrites the query string of `url` from the enabled rows. */
export function buildUrl(url: string, rows: KeyValueRow[]) {
  const { base, hash } = splitUrl(url);
  const query = rows
    .filter((row) => row.enabled && (row.key || row.value))
    .map((row) => (row.value ? `${row.key}=${row.value}` : row.key))
    .join("&");
  return `${base}${query ? `?${query}` : ""}${hash}`;
}

/** Merges the URL's query string into existing rows, keeping row ids stable and disabled rows in place. */
export function syncRowsFromUrl(url: string, rows: KeyValueRow[]): KeyValueRow[] {
  const parsed = parseQuery(url);
  let cursor = 0;
  const next: KeyValueRow[] = [];
  for (const row of rows) {
    if (!row.enabled) {
      next.push(row);
      continue;
    }
    const pair = parsed[cursor++];
    if (!pair) continue;
    next.push(row.key === pair[0] && row.value === pair[1] ? row : { ...row, key: pair[0], value: pair[1] });
  }
  for (; cursor < parsed.length; cursor++) next.push(createRow(parsed[cursor][0], parsed[cursor][1]));
  return next;
}
