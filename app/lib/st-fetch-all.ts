import { getSTToken } from "@/app/lib/st-auth";

export async function stFetchAll(
  path: string,
  params: Record<string, string> = {},
  maxPages = 20
): Promise<unknown[]> {
  const tenantId = process.env.ST_TENANT_ID!;
  const appKey = process.env.ST_APP_KEY!;

  const allItems: unknown[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore && page <= maxPages) {
    // Re-fetch token on each page request to handle serverless statelessness
    const token = await getSTToken();

    const url = new URL(`https://api.servicetitan.io${path.replace("{tenant}", tenantId)}`);
    Object.entries({ ...params, page: String(page), pageSize: params.pageSize || "500" }).forEach(
      ([k, v]) => url.searchParams.set(k, v)
    );

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}`, "ST-App-Key": appKey },
      cache: "no-store",
    });

    if (!res.ok) {
      const body = await res.text();
      if (res.status === 401 && page > 1) {
        // Auth expired mid-pagination - return what we have
        console.warn(`[stFetchAll] Auth expired at page ${page}, returning ${allItems.length} items`);
        break;
      }
      throw new Error(`ST API ${res.status} on ${url}: ${body.slice(0, 200)}`);
    }

    const data = await res.json();
    const items = data.data || [];
    allItems.push(...items);

    // ST pagination: hasMore flag or check if full page was returned
    hasMore = data.hasMore === true || items.length >= Number(params.pageSize || 500);
    page++;
  }

  return allItems;
}
