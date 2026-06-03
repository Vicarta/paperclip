export const PLUGIN_ID = "paperclip.payload-cms-agent-tools";
export const PLUGIN_VERSION = "0.1.0";

export const DEFAULT_PAYLOAD_API_BASE_URL = "https://cms.astrogen.com.ua/api";
export const DEFAULT_BLOG_POSTS_COLLECTION = "blogPosts";
export const DEFAULT_MEDIA_COLLECTION = "media";
export const DEFAULT_CATEGORIES_COLLECTION = "categories";
export const DEFAULT_TAGS_COLLECTION = "tags";
export const DEFAULT_AUTHORS_COLLECTION = "authors";
export const DEFAULT_BUILD_STATE_GLOBAL = "buildState";

export const SLOT_IDS = {
  settingsPage: `${PLUGIN_ID}.settings`,
} as const;

export const EXPORT_NAMES = {
  settingsPage: "PayloadCmsSettingsPage",
} as const;

export const TOOL_NAMES = {
  healthCheck: "payload_cms_health_check",
  getBuildState: "payload_cms_get_build_state",
  getAccess: "payload_cms_get_access",
  findBlogPost: "payload_cms_find_blog_post",
  listBlogPosts: "payload_cms_list_blog_posts",
  listTaxonomy: "payload_cms_list_taxonomy",
  ensureTaxonomyTerm: "payload_cms_ensure_taxonomy_term",
  ensureAuthor: "payload_cms_ensure_author",
  uploadMedia: "payload_cms_upload_media",
  createBlogPostDraft: "payload_cms_create_blog_post_draft",
  updateBlogPostDraft: "payload_cms_update_blog_post_draft",
  publishBlogPost: "payload_cms_publish_blog_post",
} as const;

export type PayloadCmsToolName = (typeof TOOL_NAMES)[keyof typeof TOOL_NAMES];
