export {
  paperclipConfigSchema,
  configMetaSchema,
  llmConfigSchema,
  databaseBackupConfigSchema,
  databaseConfigSchema,
  runtimeRetentionConfigSchema,
  loggingConfigSchema,
  serverConfigSchema,
  authConfigSchema,
  telemetryConfigSchema,
  storageConfigSchema,
  storageLocalDiskConfigSchema,
  storageS3ConfigSchema,
  secretsConfigSchema,
  secretsLocalEncryptedConfigSchema,
  type PaperclipConfig,
  type LlmConfig,
  type DatabaseBackupConfig,
  type DatabaseConfig,
  type RuntimeRetentionConfig,
  type LoggingConfig,
  type ServerConfig,
  type AuthConfig,
  type TelemetryConfig,
  type StorageConfig,
  type StorageLocalDiskConfig,
  type StorageS3Config,
  type SecretsConfig,
  type SecretsLocalEncryptedConfig,
  type ConfigMeta,
} from "../../../packages/shared/src/config-schema.js";

import type { RuntimeRetentionConfig } from "../../../packages/shared/src/config-schema.js";

export function defaultRuntimeRetentionConfig(): RuntimeRetentionConfig {
  return {
    enabled: true,
    retentionDays: 5,
    runLogRetentionDays: 5,
    runLogCompressAfterHours: 24,
    costRollupEnabled: true,
  };
}
