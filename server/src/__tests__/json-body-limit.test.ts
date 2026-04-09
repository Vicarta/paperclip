import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createJsonBodyParser, PAPERCLIP_JSON_BODY_LIMIT } from "../middleware/json-body.js";
import { errorHandler } from "../middleware/error-handler.js";

describe("createJsonBodyParser", () => {
  it("accepts markdown-sized payloads above the old default limit", async () => {
    const app = express();
    app.use(createJsonBodyParser());
    app.post("/echo", (req, res) => {
      res.json({ bodyLength: String(req.body?.body ?? "").length });
    });
    app.use(errorHandler);

    const body = "# Draft\n\n" + "paragraph ".repeat(12_000);
    const res = await request(app).post("/echo").send({
      title: "Large draft",
      body,
    });

    expect(PAPERCLIP_JSON_BODY_LIMIT).toBe("2mb");
    expect(res.status).toBe(200);
    expect(res.body.bodyLength).toBe(body.length);
  });
});
