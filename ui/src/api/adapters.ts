import type { AdapterCatalogDetail, AdapterCatalogEntry } from "@paperclipai/shared";
import { api } from "./client";

export const adaptersApi = {
  list: () => api.get<AdapterCatalogEntry[]>("/adapters"),
  get: (type: string) => api.get<AdapterCatalogDetail>(`/adapters/${encodeURIComponent(type)}`),
};
