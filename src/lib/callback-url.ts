export function safeCallbackUrl(raw: string): string {
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) {
    return "/";
  }
  if (raw.includes("\\") || raw.includes("://")) return "/";
  return raw;
}
