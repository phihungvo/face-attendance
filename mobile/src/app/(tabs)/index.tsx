import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Link } from 'expo-router';

import { useAuth } from '@/features/auth/context/auth-context';
import { getTenantDashboardSummary } from '@/features/dashboard/api/dashboard-service';
import { SummaryCard } from '@/features/dashboard/components/summary-card';
import { AppText } from '@/shared/components/app-text';
import { EmptyState } from '@/shared/components/empty-state';
import { Screen } from '@/shared/components/screen';
import { formatCurrency } from '@/shared/utils/format';
import { DashboardSummary } from '@/features/dashboard/api/types/dashboardSummary';

export default function HomeScreen() {
  const { logout, session } = useAuth();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    if (!session?.token) {
      setIsLoading(false);
      return undefined;
    }

    setIsLoading(true);
    setErrorMessage(null);

    getTenantDashboardSummary(session.token)
      .then((data) => {
        if (mounted) {
          setSummary(data);
        }
      })
      .catch((error) => {
        if (mounted) {
          setSummary(null);
          setErrorMessage(error instanceof Error ? error.message : 'Không thể tải tổng quan');
        }
      })
      .finally(() => {
        if (mounted) {
          setIsLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [session?.token]);

  return (
    <Screen>
      <View style={styles.header}>
        <View>
          <AppText variant="eyebrow">Người thuê</AppText>
          <AppText variant="title">Tổng quan phòng trọ 2</AppText>
          <AppText>Chào mừng bạn đến với ứng dụng EZ Tro Mobile</AppText>
          <AppText muted>{session?.username}</AppText>
        </View>
        <View style={styles.headerActions}>
          <Link href="/modal" asChild>
            <Pressable style={styles.iconButton}>
              <AppText variant="label">i</AppText>
            </Pressable>
          </Link>
          <Pressable style={styles.logoutButton} onPress={logout}>
            <AppText variant="label">Thoát</AppText>
          </Pressable>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator />
          <AppText muted>Đang tải dữ liệu...</AppText>
        </View>
      ) : summary ? (
        <View style={styles.grid}>
          <SummaryCard
            label="Phòng hiện tại"
            value={summary.roomName || 'Chưa có phòng'}
            description={summary.buildingName}
          />
          <SummaryCard
            label="Hóa đơn chưa trả"
            value={`${summary.unpaidBillCount ?? 0}`}
            description={formatCurrency(summary.outstandingAmount ?? 0)}
          />
          <SummaryCard
            label="Hợp đồng"
            value={summary.contractStatus || 'Đang cập nhật'}
            description={summary.contractCode}
          />
        </View>
      ) : (
        <EmptyState
          title="Chưa có dữ liệu tổng quan"
          description={errorMessage || 'Kiểm tra cấu hình API hoặc quyền tài khoản người thuê.'}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  headerActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  iconButton: {
    alignItems: 'center',
    backgroundColor: '#E8F2FF',
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  logoutButton: {
    backgroundColor: '#EEF2F5',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  loading: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 48,
  },
  grid: {
    gap: 12,
  },
});
