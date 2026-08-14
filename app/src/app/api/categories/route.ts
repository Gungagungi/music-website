import { ok } from '@/lib/api';
import { CATEGORIES } from '@/data/categories';
import { categoryCounts } from '@/lib/catalog';

export const dynamic = 'force-dynamic';

export async function GET() {
  const counts = new Map(categoryCounts().map((entry) => [entry.slug, entry.count]));
  return ok({
    items: CATEGORIES.map((category) => ({
      ...category,
      productCount: counts.get(category.slug) ?? 0,
    })),
  });
}
