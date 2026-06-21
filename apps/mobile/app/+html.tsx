// =============================================================================
// +html.tsx — root HTML shell (web-only, runs in Node during static export)
//
// The right place for <html lang>, charset/viewport, the site-wide DEFAULT
// <title>/<meta description> (per-page <Head> overrides these on web), the
// favicon link, and Expo's ScrollViewStyleReset. NOT a place for per-page meta.
// `<html lang="el">` because the default language is Greek (bilingual EL/EN).
// =============================================================================

import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="el">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />

        {/* Site-wide default — per-page <Head> overrides title/description. */}
        <title>TailsUp — Επαγγελματική Εκπαίδευση Σκύλων</title>
        <meta
          name="description"
          content="Επαγγελματική εκπαίδευση σκύλων στην Αθήνα. Αποδεδειγμένα αποτελέσματα."
        />

        <link rel="icon" href="/favicon.ico" />

        {/* Resets body margins so RN-Web layout fills the viewport correctly. */}
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
