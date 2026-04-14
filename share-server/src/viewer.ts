import { existsSync } from "node:fs";
import { join } from "node:path";
import { artifactsDir, mimeTypeFor, readAlias } from "./storage";
import { safeResolveArtifactFile } from "./publish";

function htmlResponse(status: number, title: string, body: string): Response {
  return new Response(
    `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title></head><body><h1>${title}</h1><p>${body}</p></body></html>`,
    {
      status,
      headers: { "content-type": "text/html; charset=utf-8" },
    },
  );
}

export function createViewerHandler(dataRoot: string) {
  return async function handleViewer(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname;

    if (pathname === "/") {
      return htmlResponse(200, "Heart of Gold Share Server", "Viewer surface is running.");
    }

    if (pathname.startsWith("/s/")) {
      const parts = pathname.split("/").filter(Boolean);
      const slug = parts[1];
      const artifactRoot = join(artifactsDir(dataRoot), slug);
      if (!slug || !existsSync(artifactRoot)) {
        return htmlResponse(404, "Not Found", "Artifact not found.");
      }

      const relativePath = parts.length <= 2 ? "index.html" : parts.slice(2).join("/");
      const filePath = safeResolveArtifactFile(artifactRoot, relativePath);
      if (!filePath || !existsSync(filePath)) {
        return htmlResponse(404, "Not Found", "Requested file not found.");
      }

      return new Response(Bun.file(filePath), {
        headers: { "content-type": mimeTypeFor(filePath) },
      });
    }

    if (pathname.startsWith("/latest/")) {
      const parts = pathname.split("/").filter(Boolean);
      const alias = parts[1];
      if (!alias) return htmlResponse(404, "Not Found", "Alias not found.");
      const slug = readAlias(dataRoot, alias);
      if (!slug) return htmlResponse(404, "Not Found", "Alias not found.");
      const remainder = parts.length <= 2 ? "" : `/${parts.slice(2).join("/")}`;
      return Response.redirect(`/s/${slug}${remainder || "/"}`, 302);
    }

    return htmlResponse(404, "Not Found", "Unknown route.");
  };
}
