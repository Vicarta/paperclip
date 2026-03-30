import { describe, expect, it, vi } from "vitest";
import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { execute } from "@paperclipai/adapter-codex-local/server";

async function writeFakeCodexCommand(commandPath: string): Promise<void> {
  const script = `#!/usr/bin/env node
const fs = require("node:fs");

const capturePath = process.env.PAPERCLIP_TEST_CAPTURE_PATH;
const payload = {
  argv: process.argv.slice(2),
  prompt: fs.readFileSync(0, "utf8"),
  codexHome: process.env.CODEX_HOME || null,
  paperclipEnvKeys: Object.keys(process.env)
    .filter((key) => key.startsWith("PAPERCLIP_"))
    .sort(),
};
if (capturePath) {
  fs.writeFileSync(capturePath, JSON.stringify(payload), "utf8");
}
console.log(JSON.stringify({ type: "thread.started", thread_id: "codex-session-1" }));
console.log(JSON.stringify({ type: "item.completed", item: { type: "agent_message", text: "hello" } }));
console.log(JSON.stringify({ type: "turn.completed", usage: { input_tokens: 1, cached_input_tokens: 0, output_tokens: 1 } }));
`;
  await fs.writeFile(commandPath, script, "utf8");
  await fs.chmod(commandPath, 0o755);
}

type CapturePayload = {
  argv: string[];
  prompt: string;
  codexHome: string | null;
  paperclipEnvKeys: string[];
};

describe("codex execute", () => {
  it("uses a worktree-isolated CODEX_HOME while preserving shared auth and config", async () => {
    const root = await fs.mkdtemp(
      path.join(os.tmpdir(), "paperclip-codex-execute-")
    );
    const workspace = path.join(root, "workspace");
    const commandPath = path.join(root, "codex");
    const capturePath = path.join(root, "capture.json");
    const sharedCodexHome = path.join(root, "shared-codex-home");
    const paperclipHome = path.join(root, "paperclip-home");
    const isolatedCodexHome = path.join(
      paperclipHome,
      "instances",
      "worktree-1",
      "codex-home"
    );
    await fs.mkdir(workspace, { recursive: true });
    await fs.mkdir(sharedCodexHome, { recursive: true });
    await fs.writeFile(
      path.join(sharedCodexHome, "auth.json"),
      '{"token":"shared"}\n',
      "utf8"
    );
    await fs.writeFile(
      path.join(sharedCodexHome, "config.toml"),
      'model = "codex-mini-latest"\n',
      "utf8"
    );
    await writeFakeCodexCommand(commandPath);

    const previousHome = process.env.HOME;
    const previousPaperclipHome = process.env.PAPERCLIP_HOME;
    const previousPaperclipInstanceId = process.env.PAPERCLIP_INSTANCE_ID;
    const previousPaperclipInWorktree = process.env.PAPERCLIP_IN_WORKTREE;
    const previousCodexHome = process.env.CODEX_HOME;
    process.env.HOME = root;
    process.env.PAPERCLIP_HOME = paperclipHome;
    process.env.PAPERCLIP_INSTANCE_ID = "worktree-1";
    process.env.PAPERCLIP_IN_WORKTREE = "true";
    process.env.CODEX_HOME = sharedCodexHome;

    try {
      const result = await execute({
        runId: "run-1",
        agent: {
          id: "agent-1",
          companyId: "company-1",
          name: "Codex Coder",
          adapterType: "codex_local",
          adapterConfig: {},
        },
        runtime: {
          sessionId: null,
          sessionParams: null,
          sessionDisplayId: null,
          taskKey: null,
        },
        config: {
          command: commandPath,
          cwd: workspace,
          env: {
            PAPERCLIP_TEST_CAPTURE_PATH: capturePath,
          },
          promptTemplate: "Follow the paperclip heartbeat.",
        },
        context: {},
        authToken: "run-jwt-token",
        onLog: async () => {},
      });

      expect(result.exitCode).toBe(0);
      expect(result.errorMessage).toBeNull();

      const capture = JSON.parse(
        await fs.readFile(capturePath, "utf8")
      ) as CapturePayload;
      expect(capture.codexHome).toBe(isolatedCodexHome);
      expect(capture.argv).toEqual(
        expect.arrayContaining(["exec", "--json", "-"])
      );
      expect(capture.prompt).toContain("Follow the paperclip heartbeat.");
      expect(capture.paperclipEnvKeys).toEqual(
        expect.arrayContaining([
          "PAPERCLIP_AGENT_ID",
          "PAPERCLIP_API_KEY",
          "PAPERCLIP_API_URL",
          "PAPERCLIP_COMPANY_ID",
          "PAPERCLIP_RUN_ID",
        ])
      );

      const isolatedAuth = path.join(isolatedCodexHome, "auth.json");
      const isolatedConfig = path.join(isolatedCodexHome, "config.toml");
      const isolatedSkill = path.join(isolatedCodexHome, "skills", "paperclip");

      expect((await fs.lstat(isolatedAuth)).isSymbolicLink()).toBe(true);
      expect(await fs.realpath(isolatedAuth)).toBe(
        await fs.realpath(path.join(sharedCodexHome, "auth.json"))
      );
      expect((await fs.lstat(isolatedConfig)).isFile()).toBe(true);
      expect(await fs.readFile(isolatedConfig, "utf8")).toBe(
        'model = "codex-mini-latest"\n'
      );
      expect((await fs.lstat(isolatedSkill)).isSymbolicLink()).toBe(true);
    } finally {
      if (previousHome === undefined) delete process.env.HOME;
      else process.env.HOME = previousHome;
      if (previousPaperclipHome === undefined)
        delete process.env.PAPERCLIP_HOME;
      else process.env.PAPERCLIP_HOME = previousPaperclipHome;
      if (previousPaperclipInstanceId === undefined)
        delete process.env.PAPERCLIP_INSTANCE_ID;
      else process.env.PAPERCLIP_INSTANCE_ID = previousPaperclipInstanceId;
      if (previousPaperclipInWorktree === undefined)
        delete process.env.PAPERCLIP_IN_WORKTREE;
      else process.env.PAPERCLIP_IN_WORKTREE = previousPaperclipInWorktree;
      if (previousCodexHome === undefined) delete process.env.CODEX_HOME;
      else process.env.CODEX_HOME = previousCodexHome;
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it("respects an explicit CODEX_HOME config override even in worktree mode", async () => {
    const root = await fs.mkdtemp(
      path.join(os.tmpdir(), "paperclip-codex-execute-explicit-")
    );
    const workspace = path.join(root, "workspace");
    const commandPath = path.join(root, "codex");
    const capturePath = path.join(root, "capture.json");
    const sharedCodexHome = path.join(root, "shared-codex-home");
    const explicitCodexHome = path.join(root, "explicit-codex-home");
    const paperclipHome = path.join(root, "paperclip-home");
    await fs.mkdir(workspace, { recursive: true });
    await fs.mkdir(sharedCodexHome, { recursive: true });
    await fs.writeFile(
      path.join(sharedCodexHome, "auth.json"),
      '{"token":"shared"}\n',
      "utf8"
    );
    await writeFakeCodexCommand(commandPath);

    const previousHome = process.env.HOME;
    const previousPaperclipHome = process.env.PAPERCLIP_HOME;
    const previousPaperclipInstanceId = process.env.PAPERCLIP_INSTANCE_ID;
    const previousPaperclipInWorktree = process.env.PAPERCLIP_IN_WORKTREE;
    const previousCodexHome = process.env.CODEX_HOME;
    process.env.HOME = root;
    process.env.PAPERCLIP_HOME = paperclipHome;
    process.env.PAPERCLIP_INSTANCE_ID = "worktree-1";
    process.env.PAPERCLIP_IN_WORKTREE = "true";
    process.env.CODEX_HOME = sharedCodexHome;

    try {
      const result = await execute({
        runId: "run-2",
        agent: {
          id: "agent-1",
          companyId: "company-1",
          name: "Codex Coder",
          adapterType: "codex_local",
          adapterConfig: {},
        },
        runtime: {
          sessionId: null,
          sessionParams: null,
          sessionDisplayId: null,
          taskKey: null,
        },
        config: {
          command: commandPath,
          cwd: workspace,
          env: {
            PAPERCLIP_TEST_CAPTURE_PATH: capturePath,
            CODEX_HOME: explicitCodexHome,
          },
          promptTemplate: "Follow the paperclip heartbeat.",
        },
        context: {},
        authToken: "run-jwt-token",
        onLog: async () => {},
      });

      expect(result.exitCode).toBe(0);
      expect(result.errorMessage).toBeNull();

      const capture = JSON.parse(
        await fs.readFile(capturePath, "utf8")
      ) as CapturePayload;
      expect(capture.codexHome).toBe(explicitCodexHome);
      await expect(
        fs.lstat(
          path.join(paperclipHome, "instances", "worktree-1", "codex-home")
        )
      ).rejects.toThrow();
    } finally {
      if (previousHome === undefined) delete process.env.HOME;
      else process.env.HOME = previousHome;
      if (previousPaperclipHome === undefined)
        delete process.env.PAPERCLIP_HOME;
      else process.env.PAPERCLIP_HOME = previousPaperclipHome;
      if (previousPaperclipInstanceId === undefined)
        delete process.env.PAPERCLIP_INSTANCE_ID;
      else process.env.PAPERCLIP_INSTANCE_ID = previousPaperclipInstanceId;
      if (previousPaperclipInWorktree === undefined)
        delete process.env.PAPERCLIP_IN_WORKTREE;
      else process.env.PAPERCLIP_IN_WORKTREE = previousPaperclipInWorktree;
      if (previousCodexHome === undefined) delete process.env.CODEX_HOME;
      else process.env.CODEX_HOME = previousCodexHome;
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it("stages attachment context, passes images natively, and ingests PDFs through markdown.new", async () => {
    const root = await fs.mkdtemp(
      path.join(os.tmpdir(), "paperclip-codex-attachments-")
    );
    const workspace = path.join(root, "workspace");
    const commandPath = path.join(root, "codex");
    const capturePath = path.join(root, "capture.json");
    await fs.mkdir(workspace, { recursive: true });
    await writeFakeCodexCommand(commandPath);

    const requests: Array<{
      method: string;
      url: string;
      authorization: string | undefined;
    }> = [];
    const server = http.createServer((req, res) => {
      requests.push({
        method: req.method ?? "GET",
        url: req.url ?? "",
        authorization: req.headers.authorization,
      });
      if (req.url === "/api/attachments/image-1/content") {
        res.writeHead(200, { "content-type": "image/png" });
        res.end("png-bytes");
        return;
      }
      if (req.url === "/api/attachments/pdf-1/content") {
        res.writeHead(200, { "content-type": "application/pdf" });
        res.end("%PDF-1.4 fake");
        return;
      }
      if (req.url === "/convert" && req.method === "POST") {
        void req.resume();
        req.on("end", () => {
          res.writeHead(200, { "content-type": "application/json" });
          res.end(
            JSON.stringify({
              success: true,
              data: {
                title: "Brief",
                content: "# Brief\n\nConverted PDF body.",
                filename: "brief.pdf",
                file_type: ".pdf",
                tokens: 10,
                processing_time_ms: 30,
              },
            })
          );
        });
        return;
      }
      res.writeHead(404);
      res.end("missing");
    });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", () => resolve())
    );
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("expected TCP server address");
    }
    const apiUrl = `http://127.0.0.1:${address.port}`;

    const previousHome = process.env.HOME;
    process.env.HOME = root;

    try {
      const result = await execute({
        runId: "run-attachments",
        agent: {
          id: "agent-1",
          companyId: "company-1",
          name: "Codex Coder",
          adapterType: "codex_local",
          adapterConfig: {},
        },
        runtime: {
          sessionId: null,
          sessionParams: null,
          sessionDisplayId: null,
          taskKey: null,
        },
        config: {
          command: commandPath,
          cwd: workspace,
          env: {
            PAPERCLIP_TEST_CAPTURE_PATH: capturePath,
            PAPERCLIP_API_URL: apiUrl,
            PAPERCLIP_MARKDOWNNEW_CONVERT_URL: `${apiUrl}/convert`,
          },
          promptTemplate: "Review the available inputs and respond.",
        },
        context: {
          paperclipAttachments: [
            {
              id: "image-1",
              issueId: "issue-1",
              issueCommentId: null,
              originalFilename: "diagram.png",
              contentType: "image/png",
              byteSize: 9,
              contentPath: "/api/attachments/image-1/content",
              source: "issue",
            },
            {
              id: "pdf-1",
              issueId: "issue-1",
              issueCommentId: "comment-1",
              originalFilename: "brief.pdf",
              contentType: "application/pdf",
              byteSize: 13,
              contentPath: "/api/attachments/pdf-1/content",
              source: "comment",
            },
          ],
        },
        authToken: "run-jwt-token",
        onLog: async () => {},
      });

      expect(result.exitCode).toBe(0);
      expect(result.errorMessage).toBeNull();

      const capture = JSON.parse(
        await fs.readFile(capturePath, "utf8")
      ) as CapturePayload;
      const imageArgIndex = capture.argv.indexOf("--image");
      expect(imageArgIndex).toBeGreaterThanOrEqual(0);
      const imageStagedPath = capture.argv[imageArgIndex + 1];
      expect(imageStagedPath).toContain(
        path.join(os.tmpdir(), "paperclip-codex-attachments-run-attachments-")
      );
      expect(capture.argv).not.toContain("brief.pdf");
      expect(capture.prompt).toContain(
        "Paperclip attachment inputs for this run:"
      );
      expect(capture.prompt).toContain(
        "diagram.png (image/png, issue attachment) is attached natively to Codex."
      );
      expect(capture.prompt).toContain(
        "brief.pdf (application/pdf, comment attachment) was converted to Markdown via markdown.new."
      );
      expect(capture.prompt).toContain("Extracted Markdown from brief.pdf:");
      expect(capture.prompt).toContain("# Brief");
      expect(capture.prompt).toContain("Converted PDF body.");
      expect(capture.prompt).toContain(
        "Review the available inputs and respond."
      );
      expect(requests).toEqual([
        {
          method: "GET",
          url: "/api/attachments/image-1/content",
          authorization: "Bearer run-jwt-token",
        },
        {
          method: "GET",
          url: "/api/attachments/pdf-1/content",
          authorization: "Bearer run-jwt-token",
        },
        {
          method: "POST",
          url: "/convert",
          authorization: undefined,
        },
      ]);
      await expect(fs.access(path.dirname(imageStagedPath))).rejects.toThrow();
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve()))
      );
      if (previousHome === undefined) delete process.env.HOME;
      else process.env.HOME = previousHome;
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it("falls back to staged PDF path when markdown.new ingestion fails", async () => {
    const root = await fs.mkdtemp(
      path.join(os.tmpdir(), "paperclip-codex-attachments-")
    );
    const workspace = path.join(root, "workspace");
    const commandPath = path.join(root, "codex");
    const capturePath = path.join(root, "capture.json");
    await fs.mkdir(workspace, { recursive: true });
    await writeFakeCodexCommand(commandPath);

    const originalFetch = globalThis.fetch;
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
          ? input.toString()
          : input.url;
      if (url.endsWith("/api/attachments/image-1/content")) {
        return new Response(Buffer.from("fake-image"), { status: 200 });
      }
      if (url.endsWith("/api/attachments/pdf-1/content")) {
        return new Response(Buffer.from("%PDF-1.4\nfake-pdf"), {
          status: 200,
          headers: { "content-type": "application/pdf" },
        });
      }
      if (url.endsWith("/convert")) {
        return new Response("upstream unavailable", {
          status: 503,
          statusText: "Service Unavailable",
        });
      }
      return new Response("missing", { status: 404 });
    });
    globalThis.fetch = fetchMock as typeof fetch;

    try {
      const result = await execute({
        runId: "run-attachments",
        agent: {
          id: "agent-1",
          companyId: "company-1",
          name: "Codex Coder",
          adapterType: "codex_local",
          adapterConfig: {},
        },
        runtime: {
          sessionId: null,
          sessionParams: null,
          sessionDisplayId: null,
          taskKey: null,
        },
        config: {
          command: commandPath,
          cwd: workspace,
          env: {
            PAPERCLIP_TEST_CAPTURE_PATH: capturePath,
            PAPERCLIP_API_URL: "http://paperclip.test",
            PAPERCLIP_MARKDOWNNEW_CONVERT_URL: "http://paperclip.test/convert",
          },
          promptTemplate: "Inspect the attachments and continue.",
        },
        context: {
          paperclipAttachments: [
            {
              id: "image-1",
              issueId: "issue-1",
              issueCommentId: null,
              originalFilename: "diagram.png",
              contentType: "image/png",
              byteSize: 128,
              contentPath: "/api/attachments/image-1/content",
              source: "issue",
            },
            {
              id: "pdf-1",
              issueId: "issue-1",
              issueCommentId: "comment-1",
              originalFilename: "brief.pdf",
              contentType: "application/pdf",
              byteSize: 256,
              contentPath: "/api/attachments/pdf-1/content",
              source: "comment",
            },
          ],
        },
        authToken: "run-jwt-token",
        onLog: async () => {},
      });

      expect(result.exitCode).toBe(0);
      expect(fetchMock).toHaveBeenCalledTimes(3);

      const capture = JSON.parse(
        await fs.readFile(capturePath, "utf8")
      ) as CapturePayload;
      const imageArgIndex = capture.argv.findIndex(
        (value) => value === "--image"
      );
      expect(imageArgIndex).toBeGreaterThanOrEqual(0);
      expect(capture.argv[imageArgIndex + 1]).toMatch(/diagram\.png$/);
      expect(capture.argv.filter((value) => value === "--image")).toHaveLength(
        1
      );
      expect(capture.prompt).toContain("brief.pdf");
      expect(capture.prompt).toContain(
        "markdown.new ingestion was not available: 503 Service Unavailable"
      );
      expect(capture.prompt).toContain(
        "Current Codex CLI in Paperclip does not accept PDFs as native file input"
      );
      expect(capture.prompt).toContain("diagram.png");
      expect(capture.prompt).toContain("Inspect the attachments and continue.");
    } finally {
      globalThis.fetch = originalFetch;
      await fs.rm(root, { recursive: true, force: true });
    }
  });
});
