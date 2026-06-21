// =============================================================================
// (site)/_layout.tsx — public site chrome (Phase 3a, Unit C1)
//
// The public marketing surface. NO auth guard (3a). Renders:
//   - <Head> site-wide defaults (title/description/OG); per-page <Head> in the
//     six pages overrides title/description on web (research §5b).
//   - <SiteChrome> = sticky header/nav (bilingual labels) + deep-green footer,
//     wrapping the page via <Slot/>.
//
// Fonts are loaded once in the ROOT layout (app/_layout.tsx) so they are ready
// for both groups; this layout only owns the site chrome and SEO defaults.
// =============================================================================

import Head from 'expo-router/head';
import { Slot } from 'expo-router';
import { SiteChrome } from '../../components/SiteChrome';

export default function SiteLayout() {
  return (
    <>
      {/*
        Site-wide default Head. Per-page <Head> in child routes overrides
        <title> and <meta name="description"> (deepest wins). OG/Twitter defaults
        live here; pages add page-specific og: tags on top.
      */}
      <Head>
        <title>TailsUp — Επαγγελματική Εκπαίδευση Σκύλων</title>
        <meta
          name="description"
          content="Επαγγελματική εκπαίδευση σκύλων στην Αθήνα. Αποδεδειγμένα αποτελέσματα."
        />
        <meta property="og:site_name" content="TailsUp" />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
      </Head>

      <SiteChrome>
        <Slot />
      </SiteChrome>
    </>
  );
}
