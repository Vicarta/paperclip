# Bright Data Instagram Full-Account Tool

## Date

2026-04-04

## Purpose

Document the validated Bright Data retrieval recipe for full-account Instagram post coverage so Paperclip plugins, skills, and downstream agent contracts all use the same method.

## Validated Finding

For `https://www.instagram.com/astrogen.com.ua/`, full account coverage is reachable through a composite Bright Data-only path.

The validated recipe is:
1. `gd_l1vikfch901nx3by4` with:
   - `type: discover_new`
   - `discoverBy: user_name`
   - input `[{ "user_name": "astrogen.com.ua" }]`
2. Read authoritative profile metadata and embedded profile posts from that response.
3. `gd_lk5ns7kz21pck8jpis` on the profile URL as supplemental canonical-URL discovery.
4. Keep only supplemental rows where `user_posted == "astrogen.com.ua"`.
5. Union:
   - owner-authored supplemental URLs;
   - embedded profile-post URLs from step 1.
6. For any remaining canonical URLs without full details, call `gd_lk5ns7kz21pck8jpis` on those exact post URLs.
7. Use the resulting detailed item set as the whole-account evidence base.

## Proof Summary

Observed result during validation:
- visible profile `posts_count`: `49`
- embedded profile posts: `12`
- owner-authored canonical URLs from supplemental collector: `43`
- canonical URL union: `49`
- remaining missing URLs after union: `6`
- recovered detailed records for missing URLs: `6`
- final detailed record set: `49`

The final detailed set included mixed content types and at least one collaborator-authored post still visible in the profile-level canonical set. That collaborator content remains in scope when its canonical URL is present in the resolved account set.

## Important Constraints

- `gd_l1vikfch901nx3by4` alone is not sufficient for whole-account historical coverage on this account.
- `gd_l1vikfch901nx3by4` rejects account-URL discovery here; use `discoverBy: user_name`.
- `gd_lk5ns7kz21pck8jpis` on the profile URL is not a clean profile source by itself; it must be owner-filtered.
- `web_data_instagram_posts` must not be called on an account URL.
- Paperclip plugin-tool execution expects parameter key `arguments`, not `args`, when calling remote Bright Data MCP tools through `call-tool`.

## Productization Decision

Paperclip should expose a single agent tool for this method:
- `resolve-instagram-account-post-set`

That tool should be the preferred path for whole-account Instagram audits instead of asking agents to manually reconstruct the composite flow in every run.
