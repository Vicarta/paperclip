const LOCAL_AUTH_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "0.0.0.0"]);

function isLocalAuthHost(hostname: string): boolean {
  return LOCAL_AUTH_HOSTS.has(hostname.trim().toLowerCase());
}

export function rewriteLocalAuthUrlPort(rawUrl: string | undefined, port: number): string | undefined {
  if (!rawUrl) return undefined;
  try {
    const parsed = new URL(rawUrl);
    if (!isLocalAuthHost(parsed.hostname)) return rawUrl;
    parsed.port = String(port);
    return parsed.toString();
  } catch {
    return rawUrl;
  }
}
