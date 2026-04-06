export type AdapterRuntimeKind = "local_cli" | "gateway" | "builtin";

export interface AdapterCatalogEntry {
  type: string;
  label: string;
  runtimeKind: AdapterRuntimeKind;
  description: string;
  supportsLocalAgentJwt: boolean;
  supportsModelDiscovery: boolean;
  supportsEnvironmentTest: boolean;
  supportsIssueOverrides: boolean;
  availableInAgentCreationUi: boolean;
}

export interface AdapterCatalogDetail extends AdapterCatalogEntry {
  configurationDoc: string;
}
