export function getSiteOrigin(requestOrigin?: string): string {
  const configuredOrigin =
    process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? null;
  if (!configuredOrigin) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("NEXT_PUBLIC_APP_URL or APP_URL is required in production");
    }
    return requestOrigin ?? "http://localhost:3000";
  }

  const url = new URL(configuredOrigin);
  if (url.protocol !== "https:" && url.hostname !== "localhost") {
    throw new Error("The configured application URL must use HTTPS");
  }
  return url.origin;
}

export function getSiteUrl(): URL {
  return new URL(getSiteOrigin());
}
