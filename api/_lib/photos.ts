// Goal photos live in a PRIVATE Blob store at goals/<spaceId>/photo-<random>.<ext>.
// The database stores that pathname; clients only ever see the proxy URL
// /api/photo?path=<pathname>, which checks the viewer belongs to the space.

export const photoUrl = (path: string) => `/api/photo?path=${encodeURIComponent(path)}`;

// The pathname inside a proxy URL, or null when it isn't one.
export const photoPath = (url: string) => {
  try {
    const parsed = new URL(url, "http://local");
    return parsed.pathname === "/api/photo" ? parsed.searchParams.get("path") : null;
  } catch {
    return null;
  }
};

// Whether a pathname belongs to this space's photo folder.
export const isSpacePhoto = (path: string | null, spaceId: string): path is string =>
  !!path && path.startsWith(`goals/${spaceId}/`) && !path.includes("..");
