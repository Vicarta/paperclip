import type { AdapterCatalogDetail, AdapterCatalogEntry } from "@paperclipai/shared";
import { api } from "./client";

export interface AdapterCompanySettingsResponse {
  companyId: string;
  adapterType: string;
  settingsJson: Record<string, unknown>;
  configured: boolean;
  updatedAt: string | null;
}

export const adaptersApi = {
  list: () => api.get<AdapterCatalogEntry[]>("/adapters"),
  get: (type: string) => api.get<AdapterCatalogDetail>(`/adapters/${encodeURIComponent(type)}`),
  getSettings: (companyId: string, type: string) =>
    api.get<AdapterCompanySettingsResponse>(`/companies/${encodeURIComponent(companyId)}/adapters/${encodeURIComponent(type)}/settings`),
  saveSettings: (companyId: string, type: string, settingsJson: Record<string, unknown>) =>
    api.patch<AdapterCompanySettingsResponse>(`/companies/${encodeURIComponent(companyId)}/adapters/${encodeURIComponent(type)}/settings`, {
      settingsJson,
    }),
};
