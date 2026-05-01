import { describe, expect, it } from "vitest";
import { parsePageSnapshot } from "../src/page-snapshot.js";

describe("page snapshot parser", () => {
  it("extracts safe metadata without storing full HTML", () => {
    const snapshot = parsePageSnapshot({
      finalUrl: "https://www.diskinternals.com/vmfs-recovery/",
      httpStatus: 200,
      html: `
        <html>
          <head>
            <link rel="canonical" href="https://www.diskinternals.com/vmfs-recovery/">
            <meta name="robots" content="index,follow">
            <title>VMFS Recovery</title>
          </head>
          <body><h1>Recover VMFS datastore</h1></body>
        </html>
      `,
    });

    expect(snapshot).toMatchObject({
      httpStatus: 200,
      canonicalDetected: "https://www.diskinternals.com/vmfs-recovery/",
      noindexDetected: false,
      title: "VMFS Recovery",
      h1: "Recover VMFS datastore",
    });
    expect(snapshot.contentHash).toHaveLength(64);
  });
});
