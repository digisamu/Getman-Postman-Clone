import type { PreparedRequest } from "./request";

export type SnippetLanguage = "curl" | "javascript" | "python" | "java";

export const SNIPPET_LANGUAGES: Array<{ id: SnippetLanguage; label: string }> = [
  { id: "curl", label: "cURL" },
  { id: "javascript", label: "JavaScript – fetch" },
  { id: "python", label: "Python – requests" },
  { id: "java", label: "Java – HttpClient" }
];

const shell = (value: string) => `'${value.replace(/'/g, "'\\''")}'`;
const quote = (value: string) => JSON.stringify(value);

function curl({ method, url, headers, body }: PreparedRequest) {
  const parts = [`curl${method === "GET" ? "" : ` -X ${method}`} ${shell(url)}`];
  headers.forEach(([key, value]) => parts.push(`-H ${shell(`${key}: ${value}`)}`));
  if (body?.kind === "text") parts.push(`--data-raw ${shell(body.text)}`);
  if (body?.kind === "multipart") body.fields.forEach(([key, value]) => parts.push(`-F ${shell(`${key}=${value}`)}`));
  return parts.join(" \\\n  ");
}

function javascript({ method, url, headers, body }: PreparedRequest) {
  const lines: string[] = [];
  if (body?.kind === "multipart") {
    lines.push("const form = new FormData();");
    body.fields.forEach(([key, value]) => lines.push(`form.append(${quote(key)}, ${quote(value)});`));
    lines.push("");
  }
  const sentHeaders = body?.kind === "multipart" ? headers.filter(([key]) => key.toLowerCase() !== "content-type") : headers;
  const options = [`  method: ${quote(method)}`];
  if (sentHeaders.length) {
    options.push(`  headers: {\n${sentHeaders.map(([key, value]) => `    ${quote(key)}: ${quote(value)}`).join(",\n")}\n  }`);
  }
  if (body?.kind === "text") options.push(`  body: ${quote(body.text)}`);
  if (body?.kind === "multipart") options.push("  body: form");
  lines.push(`const response = await fetch(${quote(url)}, {\n${options.join(",\n")}\n});`, "", "console.log(response.status, await response.text());");
  return lines.join("\n");
}

function python({ method, url, headers, body }: PreparedRequest) {
  const lines = ["import requests", "", `url = ${quote(url)}`];
  const sentHeaders = body?.kind === "multipart" ? headers.filter(([key]) => key.toLowerCase() !== "content-type") : headers;
  if (sentHeaders.length) lines.push(`headers = {\n${sentHeaders.map(([key, value]) => `    ${quote(key)}: ${quote(value)}`).join(",\n")}\n}`);
  const args = [quote(method), "url"];
  if (sentHeaders.length) args.push("headers=headers");
  if (body?.kind === "text") {
    lines.push(`payload = ${quote(body.text)}`);
    args.push("data=payload.encode(\"utf-8\")");
  }
  if (body?.kind === "multipart") {
    lines.push(`files = {\n${body.fields.map(([key, value]) => `    ${quote(key)}: (None, ${quote(value)})`).join(",\n")}\n}`);
    args.push("files=files");
  }
  lines.push("", `response = requests.request(${args.join(", ")})`, "print(response.status_code, response.text)");
  return lines.join("\n");
}

const JAVA_RESTRICTED = new Set(["host", "connection", "content-length", "expect", "upgrade"]);

function java({ method, url, headers, body }: PreparedRequest) {
  let publisher = "HttpRequest.BodyPublishers.noBody()";
  const extraHeaders: Array<[string, string]> = [];
  if (body?.kind === "text") publisher = `HttpRequest.BodyPublishers.ofString(${quote(body.text)})`;
  if (body?.kind === "multipart") {
    // HttpClient has no multipart builder; send the fields as urlencoded form data instead.
    const encoded = body.fields.map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`).join("&");
    publisher = `HttpRequest.BodyPublishers.ofString(${quote(encoded)})`;
    extraHeaders.push(["Content-Type", "application/x-www-form-urlencoded"]);
  }
  const headerLines = [...headers.filter(([key]) => !(body?.kind === "multipart" && key.toLowerCase() === "content-type")), ...extraHeaders]
    .filter(([key]) => !JAVA_RESTRICTED.has(key.toLowerCase()))
    .map(([key, value]) => `    .header(${quote(key)}, ${quote(value)})`);
  return [
    "import java.net.URI;",
    "import java.net.http.HttpClient;",
    "import java.net.http.HttpRequest;",
    "import java.net.http.HttpResponse;",
    "",
    "HttpClient client = HttpClient.newHttpClient();",
    "HttpRequest request = HttpRequest.newBuilder()",
    `    .uri(URI.create(${quote(url)}))`,
    ...headerLines,
    `    .method(${quote(method)}, ${publisher})`,
    "    .build();",
    "HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());",
    "System.out.println(response.statusCode() + \" \" + response.body());"
  ].join("\n");
}

export function generateSnippet(language: SnippetLanguage, prepared: PreparedRequest) {
  switch (language) {
    case "curl":
      return curl(prepared);
    case "javascript":
      return javascript(prepared);
    case "python":
      return python(prepared);
    case "java":
      return java(prepared);
  }
}
