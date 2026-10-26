import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../out/", import.meta.url));
const port = Number(process.env.SPECSCOPE_PORT || 4173);
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
};
const headers = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "Content-Security-Policy":
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self'; form-action 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
};

const server = createServer(async (request, response) => {
  if (!["GET", "HEAD"].includes(request.method)) {
    response.writeHead(405, { ...headers, Allow: "GET, HEAD" });
    response.end();
    return;
  }
  try {
    const pathname = decodeURIComponent(
      new URL(request.url, "http://127.0.0.1").pathname,
    );
    let path = resolve(root, "." + pathname);
    const fromRoot = relative(root, path);
    if (fromRoot.startsWith("..") || isAbsolute(fromRoot)) {
      response.writeHead(403, headers);
      response.end("Forbidden");
      return;
    }
    try {
      if ((await stat(path)).isDirectory()) path = resolve(path, "index.html");
    } catch {
      if (!extname(path)) path += ".html";
    }
    const content = await readFile(path);
    response.writeHead(200, {
      ...headers,
      "Content-Type": types[extname(path)] || "application/octet-stream",
    });
    response.end(request.method === "HEAD" ? undefined : content);
  } catch {
    response.writeHead(404, {
      ...headers,
      "Content-Type": "text/html; charset=utf-8",
    });
    response.end(
      request.method === "HEAD"
        ? undefined
        : await readFile(resolve(root, "404.html")).catch(
            () => "Not found. Run npm run build first.",
          ),
    );
  }
});
server.listen(port, "127.0.0.1", () =>
  process.stdout.write(
    "SpecScope static preview: http://127.0.0.1:" + port + "\n",
  ),
);
