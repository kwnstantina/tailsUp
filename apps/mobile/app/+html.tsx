// =============================================================================
// +html.tsx — root HTML shell (web-only, runs in Node during static export)
//
// The right place for <html lang>, charset/viewport, the site-wide DEFAULT
// <title>/<meta description>, the favicon link, and Expo's ScrollViewStyleReset.
// `<html lang="el">` because the default language is Greek (bilingual EL/EN).
//
// SDK 58 renders static pages with a streaming renderer that hands everything
// it injects — the JS bundle, React Native Web's stylesheet, and the per-page
// metadata from a route's `generateMetadata` — to this shell through
// useServerDocumentContext(). They MUST be rendered here: without `headNodes`
// and `bodyNodes` the exported pages ship with no scripts and no styles.
//
// Per-page titles come from `generateMetadata` (see lib/page-metadata.ts); the
// default title/description below only apply to pages that have none (the
// authed app screens, /login).
// =============================================================================

import { ScrollViewStyleReset, useServerDocumentContext } from 'expo-router/html';
import { Children, isValidElement, type PropsWithChildren, type ReactNode } from 'react';

function hasTitle(nodes: ReactNode): boolean {
  return Children.toArray(nodes).some((node) => isValidElement(node) && node.type === 'title');
}

export default function Root({ children }: PropsWithChildren) {
  const { htmlAttributes, bodyAttributes, headNodes, bodyNodes } = useServerDocumentContext();

  return (
    <html {...htmlAttributes} lang="el">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />

        {!hasTitle(headNodes) && (
          <>
            <title>TailsUp — Εκπαίδευση σκύλων χωρίς εκφοβισμό</title>
            <meta
              name="description"
              content="Ήρεμη, μεθοδική εκπαίδευση σκύλων στην Αθήνα. Πρώτη γνωριμία χωρίς δέσμευση — και πρόοδος που φαίνεται."
            />
          </>
        )}

        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="icon" href="/favicon.ico" sizes="16x16 32x32 48x48" />

        {/* Resets body margins so RN-Web layout fills the viewport correctly. */}
        <ScrollViewStyleReset />
        {headNodes}
      </head>
      <body {...bodyAttributes}>
        {children}
        {bodyNodes}
      </body>
    </html>
  );
}
