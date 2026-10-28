import type { Metadata } from 'next';

// Held by the segment rather than by each page: a page added here later is kept
// out of search results without having to remember it. Not a robots.txt rule —
// a crawler barred from fetching the page never reads its noindex, and keeps a
// linked URL indexed with no snippet.
export const metadata: Metadata = { robots: { index: false } };

export default function PrivateSegmentLayout({ children }: { children: React.ReactNode }) {
  return children;
}
