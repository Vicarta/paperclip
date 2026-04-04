# Serper Agent Tools

Server-side Paperclip plugin for Google SERP retrieval through [Serper.dev](https://serper.dev).

Configuration happens through the plugin settings page:

- operator pastes the Serper API key once;
- Paperclip stores it in Company Secrets;
- plugin config keeps only the secret reference;
- optional `Flat Cost Per Search (USD)` lets operators attribute external spend into Paperclip billing using decimal USD values such as `0.001`.

Use this plugin for Google search result pages. Do not store the Serper key in frontend code or project repos.
