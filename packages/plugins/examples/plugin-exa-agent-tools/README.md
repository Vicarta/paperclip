# Exa Agent Tools

Paperclip plugin that exposes Exa-backed agent tools:

- web search
- page crawling
- code-context lookup

The plugin is intended for local-path installs during development.

Configuration happens through the plugin settings page:

- the Exa API key is entered once as plaintext;
- Paperclip stores it in Company Secrets;
- plugin config keeps only the secret reference;
- the current key is never shown again in the UI;
- operators can only replace/rotate it.
