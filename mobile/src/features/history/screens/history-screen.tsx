import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors } from '@/constants/theme';
import { useAuth } from '@/features/auth/context/auth-context';
import { HistoryItem } from '@/features/history/components/history-item';
import type { AttendanceHistoryFilter } from '@/features/history/hooks/use-attendance-history';
import { useAttendanceHistory } from '@/features/history/hooks/use-attendance-history';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { AppText } from '@/shared/components/app-text';
import { EmptyState } from '@/shared/components/empty-state';

const filters: { label: string; value: AttendanceHistoryFilter }[] = [
  { label: 'Tất cả', value: 'all' },
  { label: 'Vào ca', value: 'checkin' },
  { label: 'Ra ca', value: 'checkout' },
];

export function HistoryScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];
  const { session } = useAuth();
  const { errorMessage, filter, isLoading, isRefreshing, records, refresh, setFilter, summary } =
    useAttendanceHistory({ token: session?.token });

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: palette.background }]}>
      <FlatList
        data={records}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => <HistoryItem record={item} />}
        contentContainerStyle={styles.content}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.headingRow}>
              <View style={[styles.headingIcon, { backgroundColor: palette.tintSoft }]}>
                <Ionicons name="time-outline" size={24} color={palette.tint} />
              </View>
              <View style={styles.headingText}>
                <AppText variant="eyebrow">Chấm công</AppText>
                <AppText variant="title">Lịch sử của tôi</AppText>
              </View>
            </View>

            <View style={[styles.summaryCard, { backgroundColor: palette.surface, borderColor: palette.border }]}>
              <SummaryMetric label="Tổng lượt" value={summary.totalCount} />
              <SummaryMetric label="Vào ca" value={summary.checkinCount} />
              <SummaryMetric label="Ra ca" value={summary.checkoutCount} />
            </View>

            <View style={[styles.segment, { backgroundColor: palette.segmentBackground }]}>
              {filters.map((item) => {
                const selected = item.value === filter;

                return (
                  <Pressable
                    key={item.value}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => setFilter(item.value)}
                    style={[styles.segmentButton, selected ? { backgroundColor: palette.surface } : undefined]}
                  >
                    <AppText variant="label" style={{ color: selected ? palette.tint : palette.mutedText }}>
                      {item.label}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>
          </View>
        }
        ListEmptyComponent={
          isLoading ? (
            <View style={styles.loading}>
              <ActivityIndicator color={palette.tint} />
              <AppText muted>Đang tải lịch sử...</AppText>
            </View>
          ) : (
            <EmptyState
              title="Chưa có lịch sử"
              description={errorMessage || 'Các lần vào ca và ra ca sẽ hiển thị tại đây.'}
            />
          )
        }
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={refresh}
            tintColor={palette.tint}
            colors={[palette.tint]}
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

function SummaryMetric({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.summaryMetric}>
      <AppText variant="subtitle">{String(value)}</AppText>
      <AppText muted style={styles.summaryLabel}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    padding: 20,
    paddingBottom: 28,
  },
  header: {
    gap: 16,
    paddingBottom: 18,
  },
  headingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  headingIcon: {
    alignItems: 'center',
    borderRadius: 8,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  headingText: {
    flex: 1,
    minWidth: 0,
  },
  summaryCard: {
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    paddingVertical: 14,
  },
  summaryMetric: {
    alignItems: 'center',
    flex: 1,
    gap: 2,
  },
  summaryLabel: {
    fontSize: 12,
    lineHeight: 16,
  },
  segment: {
    borderRadius: 8,
    flexDirection: 'row',
    padding: 4,
  },
  segmentButton: {
    alignItems: 'center',
    borderRadius: 7,
    flex: 1,
    justifyContent: 'center',
    minHeight: 38,
    paddingHorizontal: 8,
  },
  separator: {
    height: 10,
  },
  loading: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 48,
  },
});
