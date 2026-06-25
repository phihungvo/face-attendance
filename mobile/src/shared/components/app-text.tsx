import { StyleSheet, Text, type TextProps } from 'react-native';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type TextVariant = 'body' | 'title' | 'subtitle' | 'label' | 'eyebrow' | 'link';

type AppTextProps = TextProps & {
  muted?: boolean;
  variant?: TextVariant;
};

export function AppText({ muted, style, variant = 'body', ...props }: AppTextProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];

  return (
    <Text
      style={[
        styles.base,
        styles[variant],
        { color: muted ? palette.mutedText : palette.text },
        variant === 'link' ? { color: palette.tint } : undefined,
        style,
      ]}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    fontSize: 15,
    lineHeight: 22,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 34,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 24,
  },
  label: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0,
    lineHeight: 16,
    textTransform: 'uppercase',
  },
  link: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 22,
  },
  body: {},
});
