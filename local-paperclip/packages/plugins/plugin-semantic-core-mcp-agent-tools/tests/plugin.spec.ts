import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestHarness } from "@paperclipai/plugin-sdk/testing";
import manifest from "../src/manifest.js";
import plugin from "../src/worker.js";
import { TOOL_NAMES } from "../src/constants.js";
import {
  callSemanticCoreMcpTool,
  listSemanticCoreMcpTools,
  prepareSemanticCoreMcpArguments,
  prepareSemanticCoreMcpFallbackArguments,
  runLayerAndWait,
  runSemanticCoreSmoke,
  validateKeywordVolumeContract,
  validatePaperclipImportPayload,
} from "../src/semantic-core-mcp-client.js";

vi.mock("../src/semantic-core-mcp-client.js", async () => {
  const actual =
    await vi.importActual<typeof import("../src/semantic-core-mcp-client.js")>(
      "../src/semantic-core-mcp-client.js",
    );
  return {
    ...actual,
    callSemanticCoreMcpTool: vi.fn(),
    listSemanticCoreMcpTools: vi.fn(),
    runLayerAndWait: vi.fn(),
    runSemanticCoreSmoke: vi.fn(),
  };
});

const callSemanticCoreMcpToolMock = vi.mocked(callSemanticCoreMcpTool);
const listSemanticCoreMcpToolsMock = vi.mocked(listSemanticCoreMcpTools);
const runLayerAndWaitMock = vi.mocked(runLayerAndWait);
const runSemanticCoreSmokeMock = vi.mocked(runSemanticCoreSmoke);

const toolRunCtx = {
  companyId: "11111111-1111-4111-8111-111111111111",
  projectId: "22222222-2222-4222-8222-222222222222",
  agentId: "33333333-3333-4333-8333-333333333333",
  runId: "44444444-4444-4444-8444-444444444444",
};

describe("plugin-semantic-core-mcp-agent-tools", () => {
  beforeEach(() => {
    callSemanticCoreMcpToolMock.mockReset();
    listSemanticCoreMcpToolsMock.mockReset();
    runLayerAndWaitMock.mockReset();
    runSemanticCoreSmokeMock.mockReset();
  });

  it("registers list tools and exact MCP wrapper tools", async () => {
    const harness = createTestHarness({
      manifest,
      config: {
        semanticCoreMcpUrl: "https://semantic.example.test/mcp",
        semanticCoreMcpTokenSecretRef: "secret-semantic",
      },
    });
    await plugin.definition.setup(harness.ctx);

    listSemanticCoreMcpToolsMock.mockResolvedValueOnce({
      content: "[]",
      data: { tools: [] },
    });

    await harness.executeTool(TOOL_NAMES.listTools, {}, toolRunCtx);
    expect(listSemanticCoreMcpToolsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        config: {
          semanticCoreMcpUrl: "https://semantic.example.test/mcp",
          semanticCoreMcpTokenSecretRef: "secret-semantic",
        },
      }),
    );

    callSemanticCoreMcpToolMock.mockResolvedValueOnce({
      content: "{}",
      data: { structuredContent: {}, content: [] },
      isError: false,
    });
    await harness.executeTool(TOOL_NAMES.getPaperclipImportSchema, {}, toolRunCtx);
    expect(callSemanticCoreMcpToolMock).toHaveBeenCalledWith(
      expect.objectContaining({ toolName: "get_paperclip_import_schema" }),
    );

    const expectedWrappers = [
      [TOOL_NAMES.validateProject, "validate_project"],
      [TOOL_NAMES.listRuns, "list_runs"],
      [TOOL_NAMES.getKeywords, "get_keywords"],
      [TOOL_NAMES.getClusters, "get_clusters"],
      [TOOL_NAMES.getSerpSegments, "get_serp_segments"],
      [TOOL_NAMES.getRunCosts, "get_run_costs"],
    ] as const;
    for (const [toolName, mcpToolName] of expectedWrappers) {
      callSemanticCoreMcpToolMock.mockResolvedValueOnce({
        content: "{}",
        data: { structuredContent: {}, content: [] },
        isError: false,
      });
      await harness.executeTool(toolName, { run_id: "run_1" }, toolRunCtx);
      expect(callSemanticCoreMcpToolMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ toolName: mcpToolName }),
      );
    }
  });

  it("allows only configured semantic layers", () => {
    expect(
      prepareSemanticCoreMcpArguments({
        toolName: "run_layer",
        args: {
          project_id: "astrogen-ukraine",
          layer: "core_product_intent",
          mode: "mock",
        },
      }),
    ).toEqual({
      payload: {
        project_id: "astrogen-ukraine",
        layer: "core_product_intent",
        mode: "mock",
      },
      async_job: true,
    });

    expect(() =>
      prepareSemanticCoreMcpArguments({
        toolName: "run_layer",
        args: {
          project_id: "astrogen-ukraine",
          layer: "editorial_growth_intent",
        },
      }),
    ).toThrow(/layer must be one of/);
  });

  it("can fall back from legacy payload-wrapped run_layer args to direct MCP args", () => {
    const prepared = prepareSemanticCoreMcpArguments({
      toolName: "run_layer",
      args: {
        payload: {
          project_id: "diskinternals-us",
          layer: "core_product_intent",
          mode: "live",
        },
      },
    });

    expect(prepared).toEqual({
      payload: {
        project_id: "diskinternals-us",
        layer: "core_product_intent",
        mode: "live",
      },
      async_job: true,
    });
    expect(
      prepareSemanticCoreMcpFallbackArguments({
        toolName: "run_layer",
        preparedArgs: prepared as Record<string, unknown>,
      }),
    ).toEqual({
      project_id: "diskinternals-us",
      layer: "core_product_intent",
      mode: "live",
      async_job: true,
    });
  });

  it("preserves competitor SERP content-parsing expansion options on run_layer calls", () => {
    expect(
      prepareSemanticCoreMcpArguments({
        toolName: "run_layer",
        args: {
          project_id: "astrogen-ukraine",
          layer: "core_product_intent",
          mode: "live",
          semantic_expansion: {
            serp_competitor_expansion: {
              enabled: true,
              enable_content_parsing: true,
              max_representatives_per_cluster: 1,
              max_serp_results_per_representative: 5,
              max_competitor_urls_per_cluster: 3,
              max_ranked_keywords_per_url: 100,
              max_content_terms_per_url: 50,
              content_term_min_words: 2,
              content_term_max_words: 8,
            },
          },
        },
      }),
    ).toEqual({
      payload: {
        project_id: "astrogen-ukraine",
        layer: "core_product_intent",
        mode: "live",
        semantic_expansion: {
          serp_competitor_expansion: {
            enabled: true,
            enable_content_parsing: true,
            max_representatives_per_cluster: 1,
            max_serp_results_per_representative: 5,
            max_competitor_urls_per_cluster: 3,
            max_ranked_keywords_per_url: 100,
            max_content_terms_per_url: 50,
            content_term_min_words: 2,
            content_term_max_words: 8,
          },
        },
      },
      async_job: true,
    });
  });

  it("normalizes get_keywords flat args to the current MCP filters contract", () => {
    expect(
      prepareSemanticCoreMcpArguments({
        toolName: "get_keywords",
        args: {
          project_id: "diskinternals-vmfs-mac",
          run_id: "run_1",
          status: "accepted",
        },
      }),
    ).toEqual({
      filters: {
        project_id: "diskinternals-vmfs-mac",
        run_id: "run_1",
        status: "accepted",
      },
    });

    expect(
      prepareSemanticCoreMcpArguments({
        toolName: "get_keywords",
        args: {
          filters: {
            project_id: "diskinternals-vmfs-mac",
            run_id: "run_1",
          },
        },
      }),
    ).toEqual({
      filters: {
        project_id: "diskinternals-vmfs-mac",
        run_id: "run_1",
      },
    });
  });

  it("enforces optional project and client allowlists", () => {
    expect(
      prepareSemanticCoreMcpArguments({
        toolName: "register_project",
        args: {
          project_id: "diskinternals-us",
          project_config: { client_key: "diskinternals-us" },
        },
        allowedProjectIds: new Set(["diskinternals-us"]),
        allowedClientKeys: new Set(["diskinternals-us"]),
      }),
    ).toEqual({
      payload: {
        project_id: "diskinternals-us",
        inputs: {
          project_config: expect.objectContaining({
            client_key: "diskinternals-us",
            site_id: "diskinternals-us",
            domain: "example.com",
            locale_matrix: expect.any(Array),
            sections: expect.any(Array),
            owner_rules: expect.any(Object),
            thresholds: expect.any(Object),
            title_meta_policy: expect.any(Object),
          }),
          seed_catalog: undefined,
          existing_pages: undefined,
          audience_summary: null,
          gsc_refinement_input: null,
        },
      },
    });

    expect(() =>
      prepareSemanticCoreMcpArguments({
        toolName: "register_project",
        args: {
          project_id: "astrogen-ukraine",
          project_config: { client_key: "astrogen-ukraine" },
        },
        allowedProjectIds: new Set(["diskinternals-us"]),
      }),
    ).toThrow(/project_id is not allowed/);
  });

  it("preserves register_project inputs and normalizes seed_catalog for the live MCP payload contract", () => {
    expect(
      prepareSemanticCoreMcpArguments({
        toolName: "register_project",
        args: {
          project_id: "paperclip-smoke",
          inputs: {
            project_config: { site_domain: "example.com" },
            seed_catalog: [],
            existing_pages: [],
          },
        },
      }),
    ).toEqual({
      payload: {
        project_id: "paperclip-smoke",
        inputs: {
          project_config: expect.objectContaining({
            site_domain: "example.com",
            site_id: "paperclip-smoke",
            domain: "example.com",
            locale_matrix: expect.any(Array),
            sections: expect.any(Array),
            owner_rules: expect.any(Object),
            thresholds: expect.any(Object),
            title_meta_policy: expect.any(Object),
          }),
          seed_catalog: { products: [] },
          existing_pages: [],
        },
      },
    });
  });

  it("nests flat register_project inputs and normalizes array seed catalogs", () => {
    expect(
      prepareSemanticCoreMcpArguments({
        toolName: "register_project",
        args: {
          project_id: "paperclip-smoke",
          project_config: { site_domain: "example.com" },
          seed_catalog: [{ seed: "натальна карта" }],
          existing_pages: [],
        },
      }),
    ).toEqual({
      payload: {
        project_id: "paperclip-smoke",
        inputs: {
          project_config: expect.objectContaining({
            site_domain: "example.com",
            site_id: "paperclip-smoke",
            domain: "example.com",
            locale_matrix: expect.any(Array),
            sections: expect.any(Array),
            owner_rules: expect.any(Object),
            thresholds: expect.any(Object),
            title_meta_policy: expect.any(Object),
          }),
          seed_catalog: {
            products: [
              {
                product_id: "seed-1",
                name: "натальна карта",
                variants: ["натальна карта"],
              },
            ],
          },
          existing_pages: [],
          audience_summary: null,
          gsc_refinement_input: null,
        },
      },
    });
  });

  it("normalizes agent-facing seed catalog aliases to MCP product seeds", () => {
    expect(
      prepareSemanticCoreMcpArguments({
        toolName: "register_project",
        args: {
          project_id: "diskinternals-vmfs-mac",
          project_config: { site_domain: "diskinternals.com" },
          seed_catalog: {
            keywords: [
              "vmfs recovery mac",
              { keyword: "vmdk recovery mac", variants: ["recover vmdk on mac"] },
            ],
          },
        },
      }),
    ).toMatchObject({
      payload: {
        inputs: {
          seed_catalog: {
            products: [
              {
                product_id: "vmfs-recovery-mac",
                name: "vmfs recovery mac",
                variants: ["vmfs recovery mac"],
              },
              {
                product_id: "vmdk-recovery-mac",
                name: "vmdk recovery mac",
                variants: ["recover vmdk on mac"],
              },
            ],
          },
        },
      },
    });
  });

  it("translates legacy agent project_config fields to the current Semantic Core contract", () => {
    const result = prepareSemanticCoreMcpArguments({
      toolName: "register_project",
      args: {
        project_id: "diskinternals-dis-58-vmfs-vmdk-mac-us-en",
        project_config: {
          brand: "DiskInternals",
          target_domain: "diskinternals.com",
          site_mode: "commercial",
          product_scope: "VMFS/VMDK recovery for Mac users",
          route_scope: "future Mac route",
          geo_targets: ["United States"],
          language_code: "en",
          language_name: "English",
          language_targets: ["English"],
          location_code: 2840,
          location_name: "United States",
          market_matrix: [
            {
              language_code: "en",
              language_name: "English",
              location_code: 2840,
              location_name: "United States",
              country_code: "US",
            },
          ],
          business_rules: {
            informational: "blog",
            commercial: "commercial",
          },
        },
        seed_catalog: [],
        existing_pages: [],
      },
    });

    expect(result).toEqual({
      payload: {
        project_id: "diskinternals-dis-58-vmfs-vmdk-mac-us-en",
        inputs: {
          project_config: {
            site_id: "diskinternals-dis-58-vmfs-vmdk-mac-us-en",
            domain: "diskinternals.com",
            locale_matrix: [
              {
                language_code: "en",
                language_name: "English",
                location_code: 2840,
                location_name: "United States",
                country_code: "US",
                device_context: "desktop",
                device_priority: "desktop",
              },
            ],
            sections: [
              {
                section_id: "product",
                allowed_owner_types: ["product", "category", "support", "brand", "blog"],
                allowed_page_types: ["landing_page", "product_page", "guide"],
                forbidden_topics: [],
              },
            ],
            owner_rules: {
              informational: "blog",
              commercial: "product",
              transactional: "product",
              navigational: "brand",
            },
            thresholds: {
              intent_probability_min: 0.5,
              serp_official_vendor_dominance: 0.8,
            },
            intent_rules: {
              ambiguous_secondary_delta: 0.15,
            },
            title_meta_policy: {
              title_length_range: [45, 70],
              description_length_range: [120, 160],
              examples_are_editorial_only: true,
            },
          },
          seed_catalog: { products: [] },
          existing_pages: [],
          audience_summary: null,
          gsc_refinement_input: null,
        },
      },
    });
    const projectConfig = (result as { payload: { inputs: { project_config: Record<string, unknown> } } })
      .payload.inputs.project_config;
    expect(projectConfig).not.toHaveProperty("target_domain");
    expect(projectConfig).not.toHaveProperty("geo_targets");
    expect(projectConfig).not.toHaveProperty("business_rules");
    expect(projectConfig).not.toHaveProperty("market_matrix");
  });

  it("validates paperclip_import.v1 before storing import candidate", async () => {
    const harness = createTestHarness({ manifest });
    await plugin.definition.setup(harness.ctx);

    callSemanticCoreMcpToolMock.mockResolvedValueOnce({
      content: JSON.stringify({
        schema_version: "paperclip_import.v1",
        run_id: "run_1",
        artifacts: {
          accepted_keywords: [
            {
              keyword_text: "vmfs recovery mac",
              competitor_expansion_endpoint: "dataforseo_ranked_keywords",
              serp_result_classification_reason: "Relevant product recovery result.",
            },
          ],
          clusters: [],
          serp_segments: [],
          recall_ledger: [{ keyword_text: "vmfs recovery mac", status: "accepted" }],
          serp_competitor_candidates: [
            {
              keyword_text: "vmfs repair on mac",
              competitor_expansion_endpoint: "dataforseo_content_parsing",
            },
          ],
          competitor_expansion_debug: {
            source_counts: { serp_competitor: 2 },
            endpoint_counts: {
              dataforseo_ranked_keywords: 1,
              dataforseo_content_parsing: 1,
            },
            result_type_counts: { heading: 1, ranked_keyword: 1 },
          },
        },
        cost: {
          total_estimated: 1.23,
          events: [],
        },
      }),
      data: {
        structuredContent: {
          schema_version: "paperclip_import.v1",
          run_id: "run_1",
          artifacts: {
            accepted_keywords: [
              {
                keyword_text: "vmfs recovery mac",
                competitor_expansion_endpoint: "dataforseo_ranked_keywords",
                serp_result_classification_reason: "Relevant product recovery result.",
              },
            ],
            clusters: [],
            serp_segments: [],
            recall_ledger: [{ keyword_text: "vmfs recovery mac", status: "accepted" }],
            serp_competitor_candidates: [
              {
                keyword_text: "vmfs repair on mac",
                competitor_expansion_endpoint: "dataforseo_content_parsing",
              },
            ],
            competitor_expansion_debug: {
              source_counts: { serp_competitor: 2 },
              endpoint_counts: {
                dataforseo_ranked_keywords: 1,
                dataforseo_content_parsing: 1,
              },
              result_type_counts: { heading: 1, ranked_keyword: 1 },
            },
          },
          cost: {
            total_estimated: 1.23,
            events: [],
          },
        },
        content: [],
      },
      isError: false,
    });

    const result = await harness.executeTool(
      TOOL_NAMES.preparePaperclipImport,
      { run_id: "run_1" },
      toolRunCtx,
    );

    expect(result.content).toContain("\"status\": \"validated\"");
    expect(result.content).toContain("dataforseo_content_parsing");
    expect(result.content).toContain("\"recall_ledger_count\": 1");
    expect(harness.costs).toHaveLength(1);
    expect(harness.costs[0]?.provider).toBe("semantic-core-builder");
  });

  it("shows competitor expansion evidence summary when import payload includes recall artifacts", async () => {
    const harness = createTestHarness({ manifest });
    await plugin.definition.setup(harness.ctx);

    callSemanticCoreMcpToolMock.mockResolvedValueOnce({
      content: JSON.stringify({
        schema_version: "paperclip_import.v1",
        run_id: "run_competitor",
        artifacts: {
          accepted_keywords: [
            {
              keyword_text: "натальна карта онлайн",
              serp_result_classification_reason: "product SERP page matched layer owner rules",
              competitor_expansion_endpoint: "dataforseo_url_ranked_keywords",
            },
            {
              keyword_text: "розшифровка натальної карти",
              competitor_expansion_endpoint: "dataforseo_content_parsing",
            },
          ],
          review_keywords: [
            {
              keyword_text: "астрологічний прогноз по даті народження",
              serp_result_classification_reason: "parsed content term requires layer review",
              competitor_expansion_endpoint: "dataforseo_content_parsing",
            },
          ],
          clusters: [],
          serp_segments: [],
          recall_ledger: [],
          serp_competitor_candidates: [],
          competitor_expansion_debug: {
            source_counts: { serp_competitor: 3 },
            endpoint_counts: {
              dataforseo_url_ranked_keywords: 1,
              dataforseo_content_parsing: 2,
            },
            result_type_counts: {
              ranked_keyword: 1,
              content_term: 2,
            },
          },
        },
        cost: {
          events: [],
        },
      }),
      data: {
        structuredContent: null,
        content: [],
      },
      isError: false,
    });

    const result = await harness.executeTool(
      TOOL_NAMES.preparePaperclipImport,
      { run_id: "run_competitor" },
      toolRunCtx,
    );
    const content = JSON.parse(result.content ?? "{}") as Record<string, unknown>;
    expect(content.competitor_expansion).toMatchObject({
      keyword_rows_with_serp_result_classification_reason: 2,
      keyword_rows_with_competitor_expansion_endpoint: 3,
      recall_ledger_present: true,
      serp_competitor_candidates_present: true,
      competitor_expansion_debug_present: true,
      endpoint_counts: {
        dataforseo_url_ranked_keywords: 1,
        dataforseo_content_parsing: 2,
      },
      result_type_counts: {
        ranked_keyword: 1,
        content_term: 2,
      },
    });
  });

  it("rejects malformed import payloads", () => {
    expect(() =>
      validatePaperclipImportPayload({
        schema_version: "paperclip_import.v0",
        artifacts: {},
        cost: {},
      }),
    ).toThrow(/schema_version/);
  });

  it("validates import payloads returned inside MCP wrapper objects", () => {
    const validation = validatePaperclipImportPayload({
      result: {
        data: {
          structuredContent: {
            schemaVersion: "paperclip_import.v1",
            run_id: "run_1",
            artifacts: {
              accepted_keywords: [{ keyword_text: "vmfs reader mac" }],
              clusters: [{ cluster_id: "cluster_1" }],
              serp_segments: [{ serp_segment_id: "serp_1" }],
            },
            cost: {
              events: [{ cost_cents: 1 }],
            },
          },
        },
      },
    });

    expect(validation).toEqual({
      schemaVersion: "paperclip_import.v1",
      acceptedKeywordCount: 1,
      clusterCount: 1,
      serpSegmentCount: 1,
      costEventCount: 1,
    });
  });

  it("validates import payloads returned as stringified JSON inside MCP wrapper objects", () => {
    const importPayload = {
      schema_version: "paperclip_import.v1",
      run_id: "run_1",
      artifacts: {
        accepted_keywords: [{ keyword_text: "vmfs recovery mac" }],
        clusters: [{ cluster_id: "cluster_1" }],
        serp_segments: [{ serp_segment_id: "serp_1" }],
      },
      cost: {
        events: [{ cost_cents: 1 }],
      },
    };

    const validation = validatePaperclipImportPayload({
      result: {
        paperclip_import_json: JSON.stringify(importPayload),
      },
    });

    expect(validation).toEqual({
      schemaVersion: "paperclip_import.v1",
      acceptedKeywordCount: 1,
      clusterCount: 1,
      serpSegmentCount: 1,
      costEventCount: 1,
    });
  });

  it("requires geo and global volume fields on get_keywords rows", () => {
    expect(
      validateKeywordVolumeContract({
        keywords: [
          {
            keyword_text: "vmfs recovery mac",
            search_volume: 49500,
            geo_search_volume: 49500,
            global_search_volume: 9781,
            global_search_volume_status: "known",
            global_search_volume_source: "dataforseo_clickstream_global_search_volume",
            global_search_volume_country_distribution: [],
          },
        ],
      }),
    ).toEqual({
      keywordCount: 1,
      requiredFields: [
        "geo_search_volume",
        "global_search_volume",
        "global_search_volume_status",
        "global_search_volume_source",
        "global_search_volume_country_distribution",
      ],
    });

    const legacyKeyword = {
      keyword_text: "vmfs recovery mac",
      search_volume: 49500,
    };
    expect(validateKeywordVolumeContract({ keywords: [legacyKeyword] })).toEqual({
      keywordCount: 1,
      requiredFields: [
        "geo_search_volume",
        "global_search_volume",
        "global_search_volume_status",
        "global_search_volume_source",
        "global_search_volume_country_distribution",
      ],
    });
    expect(legacyKeyword).toMatchObject({
      search_volume: 49500,
      geo_search_volume: 49500,
      global_search_volume: null,
      global_search_volume_status: "unavailable",
      global_search_volume_source: null,
      global_search_volume_country_distribution: [],
    });

    expect(() =>
      validateKeywordVolumeContract({
        isError: true,
        content: "Error executing tool get_keywords: filters field required",
        data: {
          structuredContent: null,
          content: [
            {
              type: "text",
              text: "Error executing tool get_keywords: filters field required",
            },
          ],
        },
      }),
    ).toThrow(/returned MCP error/);

    expect(() =>
      validateKeywordVolumeContract({
        data: {
          structuredContent: null,
          content: [
            {
              type: "text",
              text: "Error executing tool get_keywords: filters field required",
            },
          ],
        },
      }),
    ).toThrow(/returned no keyword items/);
  });

  it("validates fenced JSON import payload responses", async () => {
    const harness = createTestHarness({ manifest });
    await plugin.definition.setup(harness.ctx);

    callSemanticCoreMcpToolMock.mockResolvedValueOnce({
      content: "```json\n{\"schema_version\":\"paperclip_import.v1\",\"run_id\":\"run_1\",\"artifacts\":{\"accepted_keywords\":[],\"clusters\":[],\"serp_segments\":[]},\"cost\":{\"events\":[]}}\n```",
      data: {
        structuredContent: null,
        content: [],
      },
      isError: false,
    });

    const result = await harness.executeTool(
      TOOL_NAMES.preparePaperclipImport,
      { run_id: "run_1" },
      toolRunCtx,
    );

    expect(result.content).toContain("\"status\": \"validated\"");
  });

  it("stores completed run-layer-and-wait results", async () => {
    const harness = createTestHarness({ manifest });
    await plugin.definition.setup(harness.ctx);

    runLayerAndWaitMock.mockResolvedValueOnce({
      content: JSON.stringify({
        status: "completed",
        job_id: "job_1",
        run_id: "run_1",
      }),
      data: {
        status: "completed",
        job_id: "job_1",
        run_id: "run_1",
      },
    });

    const result = await harness.executeTool(
      TOOL_NAMES.runLayerAndWait,
      {
        project_id: "diskinternals-us",
        layer: "core_product_intent",
        mode: "mock",
      },
      toolRunCtx,
    );

    expect(result.content).toContain("job_1");
  });

  it("runs smoke test through dedicated smoke helper", async () => {
    const harness = createTestHarness({ manifest });
    await plugin.definition.setup(harness.ctx);

    runSemanticCoreSmokeMock.mockResolvedValueOnce({
      content: JSON.stringify({
        status: "ok",
        run_id: "run_smoke",
        schema_version: "paperclip_import.v1",
      }),
      data: {
        project_id: "semantic-smoke",
        run: { data: { run_id: "run_smoke" } },
        validation: { schemaVersion: "paperclip_import.v1" },
      },
    });

    const result = await harness.executeTool(
      TOOL_NAMES.smokeTest,
      { project_id: "semantic-smoke" },
      toolRunCtx,
    );

    expect(JSON.parse(result.content ?? "{}")).toMatchObject({ status: "ok" });
  });
});
