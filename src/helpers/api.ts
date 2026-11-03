import { useAuth } from "@clerk/react";

export function useApi() {
  const { getToken } = useAuth();
  return async <T>(path: string, init: RequestInit = {}): Promise<T> => {
    const res = await fetch(`/api${path}`, {
      ...init,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${await getToken()}`,
        ...init.headers,
      },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? res.statusText);
    return data;
  };
}
