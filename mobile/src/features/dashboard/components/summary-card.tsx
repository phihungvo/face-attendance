import { StyleSheet, View } from 'react-native';

import { Colors } from '@/constants/theme';
import { AppText } from '@/shared/components/app-text';
import { useColorScheme } from '@/hooks/use-color-scheme';

type SummaryCardProps = {
  description?: string | null;
  label: string;
  value: string;
};

export function SummaryCard({ description, label, value }: SummaryCardProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];

  return (
    <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
      <AppText muted variant="eyebrow">
        {label}
      </AppText>
      <AppText variant="subtitle">{value}</AppText>
      {description ? <AppText muted>{description}</AppText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    padding: 16,
  },
});
