import { describe, expect, it } from "vitest";
import { classifyDiskInternalsPage, mapDiskInternalsProduct } from "../src/product-mapping.js";

describe("product mapping", () => {
  it("separates Linux Reader, Linux Writer, and recovery intent", () => {
    expect(mapDiskInternalsProduct({ url: "https://www.diskinternals.com/linux-reader/" })).toMatchObject({
      productId: "linux-reader",
      productFamily: "Linux filesystem utility",
    });
    expect(mapDiskInternalsProduct({ url: "https://www.diskinternals.com/linux-writer/" })).toMatchObject({
      productId: "linux-writer",
      productFamily: "Linux filesystem utility",
    });
    expect(mapDiskInternalsProduct({ url: "https://www.diskinternals.com/linux-recovery/" })).toMatchObject({
      productId: "linux-recovery",
      productFamily: "Linux Recovery",
    });
  });

  it("classifies page type and locale from URL", () => {
    expect(classifyDiskInternalsPage("https://www.diskinternals.com/vmfs-recovery/")).toMatchObject({
      pageType: "product",
      language: "en",
      countryTarget: "US",
    });
    expect(classifyDiskInternalsPage("https://www.diskinternals.com/de/vmfs-recovery/")).toMatchObject({
      pageType: "product",
      language: "de",
      countryTarget: "DE",
    });
    expect(classifyDiskInternalsPage("https://www.diskinternals.com/thank-you/")).toMatchObject({
      pageType: "thank_you",
    });
  });
});
