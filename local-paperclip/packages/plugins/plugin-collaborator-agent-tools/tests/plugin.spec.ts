import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestHarness } from "@paperclipai/plugin-sdk/testing";
import manifest from "../src/manifest.js";
import plugin from "../src/worker.js";
import { TOOL_NAMES } from "../src/constants.js";
import {
  buildCreatorListQuery,
  fetchCreatorList,
  fetchDictionary,
} from "../src/collaborator-client.js";

vi.mock("../src/collaborator-client.js", async () => {
  const actual = await vi.importActual<typeof import("../src/collaborator-client.js")>(
    "../src/collaborator-client.js",
  );
  return {
    ...actual,
    fetchCreatorList: vi.fn(),
    fetchDictionary: vi.fn(),
  };
});

const fetchCreatorListMock = vi.mocked(fetchCreatorList);
const fetchDictionaryMock = vi.mocked(fetchDictionary);

describe("plugin-collaborator-agent-tools", () => {
  beforeEach(() => {
    fetchCreatorListMock.mockReset();
    fetchDictionaryMock.mockReset();
  });

  it("registers the Collaborator creator catalog tool", async () => {
    const harness = createTestHarness({
      manifest,
      config: {
        collaboratorApiKeySecretRef: "secret-collaborator",
      },
    });
    await plugin.definition.setup(harness.ctx);

    fetchCreatorListMock.mockResolvedValueOnce({
      content: "Collaborator creator catalog results",
      data: { rows: [{ id: 1, url: "example.ua" }] },
    });

    const result = await harness.executeTool(TOOL_NAMES.creatorList, {
      keywords: ["compatibility", "astrology"],
      countries: [1],
      languages: [2],
      formatId: 1,
      nofollow: 0,
      limit: 5,
    });

    expect(fetchCreatorListMock).toHaveBeenCalledWith(
      expect.objectContaining({
        params: {
          keywords: ["compatibility", "astrology"],
          countries: [1],
          languages: [2],
          formatId: 1,
          nofollow: 0,
          limit: 5,
        },
        config: {
          collaboratorApiKeySecretRef: "secret-collaborator",
        },
      }),
    );
    expect(result.content).toBe("Collaborator creator catalog results");
  });

  it("registers dictionary tools", async () => {
    const harness = createTestHarness({
      manifest,
      config: {
        collaboratorApiKeySecretRef: "secret-collaborator",
      },
    });
    await plugin.definition.setup(harness.ctx);

    fetchDictionaryMock.mockResolvedValue({
      content: "Collaborator dictionary fetched.",
      data: { rows: [{ id: 1, name: "Ukraine" }] },
    });

    await harness.executeTool(TOOL_NAMES.dictionaryCountries, {});
    await harness.executeTool(TOOL_NAMES.dictionaryRegions, { countryId: 1 });
    await harness.executeTool(TOOL_NAMES.dictionaryCities, { regionId: 10 });
    await harness.executeTool(TOOL_NAMES.dictionaryLanguages, {});
    await harness.executeTool(TOOL_NAMES.testConnection, {});

    expect(fetchDictionaryMock).toHaveBeenCalledWith(
      expect.objectContaining({ type: "countries" }),
    );
    expect(fetchDictionaryMock).toHaveBeenCalledWith(
      expect.objectContaining({ type: "regions", params: { countryId: 1 } }),
    );
    expect(fetchDictionaryMock).toHaveBeenCalledWith(
      expect.objectContaining({ type: "cities", params: { regionId: 10 } }),
    );
    expect(fetchDictionaryMock).toHaveBeenCalledWith(
      expect.objectContaining({ type: "languages" }),
    );
  });

  it("maps safe tool parameter names to Collaborator query parameters", () => {
    const query = buildCreatorListQuery({
      keywords: ["relationships"],
      countries: [1],
      regions: [2],
      cities: [3],
      languages: [4],
      url: "example.ua",
      priceMin: 1000,
      priceMax: 5000,
      priceWithWriting: true,
      spelling: 1,
      withInsurance: true,
      trafficMin: 10,
      isTrafficGrown: true,
      formatId: 1,
      speedMaxDays: 7,
      uniqueSitesOnly: true,
      cfMin: 10,
      tfMin: 12,
      trMin: 15,
      mozDaMin: 25,
      ahrefsDrMin: 30,
      ahrefsRefdomainsMin: 100,
      ahrefsTrafficMin: 1000,
      serpSdrMin: 20,
      serpKeywordsMin: 200,
      indexGoogleMin: 100,
      googleNews: 1,
      domainAgeMin: 2,
      maxAnchors: [1, 2],
      nofollow: 0,
      advertisingMark: false,
      siteTypes: [3, 5, 6],
      sort: "traffic",
    });

    expect(query.getAll("keywords")).toEqual(["relationships"]);
    expect(query.getAll("countries")).toEqual(["1"]);
    expect(query.getAll("_regions")).toEqual(["2"]);
    expect(query.getAll("_city")).toEqual(["3"]);
    expect(query.getAll("_language")).toEqual(["4"]);
    expect(query.get("_url")).toBe("example.ua");
    expect(query.get("_price_min")).toBe("1000");
    expect(query.get("_price_max")).toBe("5000");
    expect(query.get("_price_with_writing")).toBe("1");
    expect(query.get("spelling")).toBe("1");
    expect(query.get("with_insurance")).toBe("1");
    expect(query.get("_traffic")).toBe("10");
    expect(query.get("is_traffic_grown")).toBe("1");
    expect(query.get("format_id")).toBe("1");
    expect(query.get("_speed")).toBe("7");
    expect(query.get("exchange")).toBe("1");
    expect(query.get("_cf_min")).toBe("10");
    expect(query.get("_tf_min")).toBe("12");
    expect(query.get("_tr_min")).toBe("15");
    expect(query.get("_moz_da_min")).toBe("25");
    expect(query.get("ahrefs_dr_min")).toBe("30");
    expect(query.get("ahrefs_refdomains_min")).toBe("100");
    expect(query.get("ahrefs_traffic_min")).toBe("1000");
    expect(query.get("serp_sdr_min")).toBe("20");
    expect(query.get("serp_keywords_min")).toBe("200");
    expect(query.get("_index_google_min")).toBe("100");
    expect(query.get("googleNews")).toBe("1");
    expect(query.get("_domain_age")).toBe("2");
    expect(query.getAll("max_anchors[]")).toEqual(["1", "2"]);
    expect(query.get("nofollow")).toBe("0");
    expect(query.get("advertising_mark")).toBe("0");
    expect(query.getAll("_cre_type_id")).toEqual(["3", "5", "6"]);
    expect(query.get("sort")).toBe("traffic");
  });

  it("does not store plaintext API keys in manifest defaults", () => {
    const serialized = JSON.stringify(manifest);
    expect(serialized).not.toContain("mZ84");
    expect(serialized).toContain("collaboratorApiKeySecretRef");
  });
});
