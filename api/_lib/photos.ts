// Goal photos live in a PRIVATE Blob store at goals/<spaceId>/photo-<random>.<ext>.
// The database stores that pathname; clients only ever see the proxy URL
// /api/photos?path=<pathname>, which checks the viewer belongs to the space.

export const photoUrl = (path: string) => `/api/photos?path=${encodeURIComponent(path)}`;

// The pathname inside a proxy URL, or null when it isn't one. Also accepts the
// old /api/photo URLs, from pages loaded before that endpoint was merged.
export const photoPath = (url: string) => {
  try {
    const parsed = new URL(url, "http://local");
    return ["/api/photos", "/api/photo"].includes(parsed.pathname)
      ? parsed.searchParams.get("path")
      : null;
  } catch {
    return null;
  }
};

// Whether a pathname belongs to this space's photo folder.
export const isSpacePhoto = (path: string | null, spaceId: string): path is string =>
  !!path && path.startsWith(`goals/${spaceId}/`) && !path.includes("..");
