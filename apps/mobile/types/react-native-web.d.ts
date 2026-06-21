// =============================================================================
// react-native-web Pressable state augmentation (Phase 3a, Unit C1)
//
// react-native-web's <Pressable> passes `{ hovered, focused, pressed }` to its
// style/children callbacks, but the base `react-native` types only declare
// `pressed`. The Design System's interaction contract (DS-4: web hover + the
// portable visible-focus mechanism) relies on `hovered`/`focused`, so we
// augment the type here. Both are optional (undefined on native, where they
// simply never fire — safe cross-platform).
// =============================================================================

import 'react-native';

declare module 'react-native' {
  interface PressableStateCallbackType {
    readonly hovered?: boolean;
    readonly focused?: boolean;
  }
}
