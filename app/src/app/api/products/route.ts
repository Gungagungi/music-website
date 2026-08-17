import { ok, parseQuery } from '@/lib/api';
import { queryProducts } from '@/lib/catalog';
import { productQuerySchema } from '@/lib/schemas';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const parsed = parseQuery(new URL(request.url).searchParams, productQuerySchema);
  if (!parsed.ok) return parsed.response;

  const { brand, ...rest } = parsed.data;
  const brands = brand === undefined ? undefined : Array.isArray(brand) ? brand : [brand];

  const result = await queryProducts({ ...rest, brands });
  return ok(result);
}
