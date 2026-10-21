import { getStore } from "@netlify/blobs";
import type { Config, Context } from "@netlify/functions";
import { createApp } from "../lib/app.mjs";

let handle: ((req: Request) => Promise<Response>) | null = null;

export default async (req: Request, _context: Context) => {
  handle ||= createApp({
    data: getStore({ name: "pahina-rentals", consistency: "strong" }),
    files: getStore({ name: "pahina-uploads", consistency: "strong" }),
    env: (k: string) => Netlify.env.get(k),
  });
  return handle(req);
};

export const config: Config = {
  path: "/api/*",
  rateLimit: { action: "rate_limit", aggregateBy: ["ip", "domain"], windowSize: 60, windowLimit: 120 },
};
