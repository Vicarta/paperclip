import express from "express";

export const PAPERCLIP_JSON_BODY_LIMIT = "2mb";

export function createJsonBodyParser(): express.RequestHandler {
  return express.json({
    limit: PAPERCLIP_JSON_BODY_LIMIT,
    verify: (req, _res, buf) => {
      (req as unknown as { rawBody: Buffer }).rawBody = buf;
    },
  });
}
