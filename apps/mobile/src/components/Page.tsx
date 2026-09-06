// Every public page is a Page: one scroll container, the header pinned above
// the content and the footer below it.

import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../design/tokens';
import { SiteFooter } from './SiteFooter';
import { SiteHeader } from './SiteHeader';

export function Page({ children }: { children: ReactNode }) {
  // Zero on the web; the notch/status bar on a phone.
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top }}
        showsVerticalScrollIndicator={false}
      >
        <SiteHeader />
        <View style={{ flexGrow: 1 }}>{children}</View>
        <SiteFooter />
      </ScrollView>
    </View>
  );
}
