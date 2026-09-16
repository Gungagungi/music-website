'use client';

import { useEffect } from 'react';

/**
 * Signals that the page is hydrated, hence actually interactive.
 *
 * Between the arrival of the server-rendered HTML and the end of hydration,
 * controlled inputs accept typing but React resets them on the first re-render,
 * and event handlers are not attached yet. An automated browser is fast enough
 * to fall into that window; so is a human on a slow connection.
 *
 * The attribute set here gives an explicit point to wait on, instead of the
 * arbitrary timeouts that always end up being written — and lengthened — when
 * no signal exists. It is inert in production: `document.documentElement`
 * carries one more attribute, nothing else.
 */
export function HydrationMarker() {
  useEffect(() => {
    document.documentElement.dataset.hydrated = 'true';
  }, []);

  return null;
}
