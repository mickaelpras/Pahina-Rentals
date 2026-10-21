import { getStore } from "@netlify/blobs";
import type { Config, Context } from "@netlify/functions";
import { servePhoto } from "../lib/app.mjs";

export default async (_req: Request, context: Context) =>
  servePhoto(getStore({ name: "pahina-uploads", consistency: "strong" }), context.params.id);

export const config: Config = { path: "/photo/item/:id", method: "GET" };
