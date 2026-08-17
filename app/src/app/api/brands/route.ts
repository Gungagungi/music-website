import { ok } from '@/lib/api';
import { listBrands } from '@/lib/catalog';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const category = new URL(request.url).searchParams.get('category') ?? undefined;
  return ok({ items: await listBrands(category) });
}
