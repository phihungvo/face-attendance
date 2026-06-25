/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

const tintColorLight = '#176B87';
const tintColorDark = '#7DD3FC';

export const Colors = {
  light: {
    text: '#172026',
    mutedText: '#66737D',
    background: '#F6F8FA',
    surface: '#FFFFFF',
    border: '#E1E7EC',
    softWarning: '#FFF1D6',
    segmentBackground: '#EAF0F4',
    success: '#12805C',
    successSoft: '#E6F6EF',
    tintSoft: '#E7F3F7',
    tint: tintColorLight,
    warning: '#B7791F',
    warningSoft: '#FFF3D6',
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: '#ECEDEE',
    mutedText: '#A8B3BD',
    background: '#101417',
    surface: '#182026',
    border: '#2B3942',
    softWarning: '#3B2D16',
    segmentBackground: '#202A31',
    success: '#5EE2A0',
    successSoft: '#123D2D',
    tintSoft: '#143241',
    tint: tintColorDark,
    warning: '#F4C15D',
    warningSoft: '#3B2D16',
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,
  },
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
