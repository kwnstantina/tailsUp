// =============================================================================
// Static-export <head> for the public site pages.
//
// Since SDK 58 the static renderer takes per-page metadata ONLY from a route's
// exported `generateMetadata`; `<Head>` from expo-router/head is applied in the
// browser after hydration and never reaches the exported HTML. Each site page
// exports `generateMetadata = () => pageMetadata(copy.el.head)` so crawlers and
// link previews see the Greek (default-language) title, and keeps its `<Head>`
// so the title follows the EL/EN toggle at runtime.
// =============================================================================

import type { Metadata } from 'expo-router/server';

export function pageMetadata(head: { title: string; desc: string }): Metadata {
  return {
    title: head.title,
    description: head.desc,
    openGraph: { title: head.title, description: head.desc },
  };
}
