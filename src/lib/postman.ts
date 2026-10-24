import { nanoid } from "nanoid";
import { METHODS, createRequest, createRow } from "./factory";
import { normalizeRequest } from "./migrate";
import { syncRowsFromUrl } from "./url";
import type { ApiRequest, Collection, CollectionFolder, CollectionRequest, HttpMethod, KeyValueRow } from "../types/api";

// Import and export collections in the Postman v2.1 format, so work can move between Getman and other clients.

type Loose = Record<string, any>;

const POSTMAN_SCHEMA = "https://schema.getpostman.com/json/collection/v2.1.0/collection.json";

function pmRows(value: unknown): KeyValueRow[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((row) => row && typeof row === "object" && row.type !== "file")
    .map((row: Loose) => createRow(String(row.key ?? ""), String(row.value ?? ""), !row.disabled));
}

function authValue(list: unknown, key: string) {
  return Array.isArray(list) ? String(list.find((item: Loose) => item?.key === key)?.value ?? "") : "";
}

function fromPostmanRequest(item: Loose): CollectionRequest {
  const req: Loose = typeof item.request === "string" ? { url: item.request } : item.request ?? {};
  const url = typeof req.url === "string" ? req.url : String(req.url?.raw ?? "");
  const method = String(req.method ?? "GET").toUpperCase() as HttpMethod;
  const request = createRequest({
    name: String(item.name ?? "Request"),
    method: METHODS.includes(method) ? method : "GET",
    url,
    headers: pmRows(req.header),
    queryParams: syncRowsFromUrl(url, [])
  });

  const body: Loose = req.body ?? {};
  if (body.mode === "raw") {
    const language = body.options?.raw?.language;
    const raw = String(body.raw ?? "");
    request.body = { type: language === "json" || /^\s*[[{]/.test(raw) ? "json" : "raw", content: raw, fields: [] };
  } else if (body.mode === "urlencoded") {
    request.body = { type: "urlencoded", content: "", fields: pmRows(body.urlencoded) };
  } else if (body.mode === "formdata") {
    request.body = { type: "form-data", content: "", fields: pmRows(body.formdata) };
  }

  const auth: Loose = req.auth ?? {};
  if (auth.type === "bearer") request.auth = { type: "bearer", token: authValue(auth.bearer, "token"), username: "", password: "" };
  if (auth.type === "basic") {
    request.auth = { type: "basic", token: "", username: authValue(auth.basic, "username"), password: authValue(auth.basic, "password") };
  }
  return { ...request, kind: "request" };
}

/** Flattens Postman's nested folders into Getman's collection → folder → request structure. */
function collectFolders(items: Loose[], prefix: string, folders: CollectionFolder[], rootRequests: CollectionRequest[]) {
  for (const item of items) {
    if (Array.isArray(item.item)) {
      const name = prefix ? `${prefix} / ${item.name ?? "Folder"}` : String(item.name ?? "Folder");
      const folder: CollectionFolder = { id: nanoid(), kind: "folder", name, requests: [] };
      folders.push(folder);
      collectFolders(item.item, name, folders, folder.requests);
    } else if (item.request !== undefined) {
      rootRequests.push(fromPostmanRequest(item));
    }
  }
}

export function importCollection(text: string): Collection {
  let data: Loose;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("The file is not valid JSON.");
  }

  // A Getman collection exported earlier (or pasted from the workspace file).
  if (Array.isArray(data.folders)) {
    return {
      id: nanoid(),
      name: String(data.name ?? "Imported collection"),
      folders: data.folders.map((folder: Loose) => ({
        id: nanoid(),
        kind: "folder" as const,
        name: String(folder.name ?? "Folder"),
        requests: (Array.isArray(folder.requests) ? folder.requests : []).map((request: Loose) => ({ ...normalizeRequest({ ...request, id: undefined }), kind: "request" as const }))
      }))
    };
  }

  if (!Array.isArray(data.item)) throw new Error("This file is not a Postman v2 or Getman collection.");
  const folders: CollectionFolder[] = [];
  const rootRequests: CollectionRequest[] = [];
  collectFolders(data.item, "", folders, rootRequests);
  if (rootRequests.length) folders.unshift({ id: nanoid(), kind: "folder", name: "Requests", requests: rootRequests });
  return { id: nanoid(), name: String(data.info?.name ?? "Imported collection"), folders };
}

function toPostmanRows(rows: KeyValueRow[]) {
  return rows.filter((row) => row.key).map((row) => ({ key: row.key, value: row.value, ...(row.enabled ? {} : { disabled: true }) }));
}

function toPostmanRequest(request: ApiRequest) {
  const body: Loose | undefined =
    request.body.type === "json" || request.body.type === "raw"
      ? { mode: "raw", raw: request.body.content, ...(request.body.type === "json" ? { options: { raw: { language: "json" } } } : {}) }
      : request.body.type === "urlencoded"
        ? { mode: "urlencoded", urlencoded: toPostmanRows(request.body.fields) }
        : request.body.type === "form-data"
          ? { mode: "formdata", formdata: toPostmanRows(request.body.fields).map((row) => ({ ...row, type: "text" })) }
          : undefined;
  const auth =
    request.auth.type === "bearer"
      ? { type: "bearer", bearer: [{ key: "token", value: request.auth.token, type: "string" }] }
      : request.auth.type === "basic"
        ? {
            type: "basic",
            basic: [
              { key: "username", value: request.auth.username, type: "string" },
              { key: "password", value: request.auth.password, type: "string" }
            ]
          }
        : undefined;
  return {
    name: request.name,
    request: { method: request.method, header: toPostmanRows(request.headers), url: { raw: request.url }, ...(body ? { body } : {}), ...(auth ? { auth } : {}) }
  };
}

export function exportCollection(collection: Collection) {
  return JSON.stringify(
    {
      info: { _postman_id: collection.id, name: collection.name, schema: POSTMAN_SCHEMA },
      item: collection.folders.map((folder) => ({ name: folder.name, item: folder.requests.map(toPostmanRequest) }))
    },
    null,
    2
  );
}
