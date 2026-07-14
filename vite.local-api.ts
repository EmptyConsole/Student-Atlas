import type { Connect, Plugin, ViteDevServer } from "vite";
import { loadEnv } from "vite";

type ApiHandler = (request: Request) => Promise<Response>;

const API_HANDLERS: Record<string, () => Promise<ApiHandler>> = {
  "/api/send-email-verification": async () =>
    (await import("./api/send-email-verification")).POST,
  "/api/verify-email-code": async () =>
    (await import("./api/verify-email-code")).POST,
  "/api/send-elective-registration": async () =>
    (await import("./api/send-elective-registration")).POST,
};

function readBody(req: Connect.IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

/**
 * Serves Vercel-style `api/*.ts` POST handlers during `vite` so email OTP
 * works locally without `vercel dev`.
 */
export function localApiPlugin(): Plugin {
  return {
    name: "local-api",
    configureServer(server: ViteDevServer) {
      // Load .env / .env.local into process.env for serverless-style reads.
      const env = loadEnv(server.config.mode, server.config.root, "");
      for (const [key, value] of Object.entries(env)) {
        if (process.env[key] === undefined) process.env[key] = value;
      }

      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split("?")[0] ?? "";
        const loader = API_HANDLERS[url];
        if (!loader || req.method !== "POST") {
          next();
          return;
        }

        try {
          const handler = await loader();
          const body = await readBody(req);
          const request = new Request(`http://localhost${url}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: body.length > 0 ? body : undefined,
          });
          const response = await handler(request);
          const text = await response.text();
          res.statusCode = response.status;
          res.setHeader(
            "Content-Type",
            response.headers.get("Content-Type") ?? "application/json",
          );
          res.end(text);
        } catch (err) {
          console.error("local-api error:", err);
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Local API handler failed" }));
        }
      });
    },
  };
}
