import { ScrollView, StyleSheet, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type ScreenProps = {
  children: React.ReactNode;
  contentContainerStyle?: ViewStyle;
};

export function Screen({ children, contentContainerStyle }: ScreenProps) {
  const colorScheme = useColorScheme() ?? 'light';

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: Colors[colorScheme].background }]}>
      <ScrollView contentContainerStyle={[styles.content, contentContainerStyle]}>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    gap: 18,
    padding: 20,
  },
});
