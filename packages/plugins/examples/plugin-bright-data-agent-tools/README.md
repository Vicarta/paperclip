# Bright Data Agent Tools

Paperclip plugin that exposes Bright Data MCP-backed agent tools for social and scraping workflows.

The plugin is intended for local-path installs during development.

Configuration happens through the plugin settings page:

- the Bright Data token is entered once as plaintext;
- Paperclip stores it in Company Secrets;
- plugin config keeps only the secret reference;
- the current token is never shown again in the UI;
- operators can only replace or rotate it.

Important:

- Bright Data is treated as a social-data connector here, not as a generic web-search provider.
- This plugin uses the same secret-backed Streamable MCP transport pattern as the Exa example, but it does not reuse Exa as a fallback data source.

Additional tool surface:

- `list-tools`
- `call-tool`
- `trigger-dataset-request`
- `get-snapshot-progress`
- `download-snapshot`
- `run-dataset-request`
- `resolve-instagram-account-post-set`

The dataset tools use Bright Data's REST async dataset flow (`trigger` -> `progress` -> `snapshot`) with server-side Bearer auth from a Paperclip secret. This is the preferred path for larger Instagram collection jobs where profile-style retrieval returns only a subset of posts.

Validated Instagram account recipe for whole-account collection:

- dataset id: `gd_l1vikfch901nx3by4`
- `type: "discover_new"`
- `discoverBy: "user_name"`
- input shape: `[{"user_name":"astrogen.com.ua"}]`

Important Bright Data behavior:

- account URL + `discoverBy: "url"` is not accepted for this dataset;
- `download-snapshot` should use only the snapshot id and output format, without `include_errors`.
- the profile snapshot returns authoritative account metadata and recent embedded posts, but not the full historical post set for `@astrogen.com.ua`;
- the validated full-account recipe is composite:
  - use `gd_l1vikfch901nx3by4` with `discoverBy: "user_name"` for profile metadata plus embedded posts;
  - use `gd_lk5ns7kz21pck8jpis` with the profile URL as a supplemental discovery collector;
  - keep only rows where `user_posted` matches the target account;
  - union those canonical URLs with the embedded profile URLs;
  - collect detailed records for any remaining missing URLs through `gd_lk5ns7kz21pck8jpis` on exact post URLs.
- `resolve-instagram-account-post-set` packages that composite recipe into a single agent tool and is the preferred Stage 57 path for whole-account audits.
