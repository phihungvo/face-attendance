import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useAuth } from '@/features/auth/context/auth-context';
import { getMyBills } from '@/features/billing/api/billing-service';
import { BillCard } from '@/features/billing/components/bill-card';
import type { BillSummary } from '@/features/billing/types';
import { AppText } from '@/shared/components/app-text';
import { EmptyState } from '@/shared/components/empty-state';
import { Screen } from '@/shared/components/screen';

export default function BillsScreen() {
  const { session } = useAuth();
  const [bills, setBills] = useState<BillSummary[]>([]);
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

    getMyBills({ authToken: session.token, page: 0, size: 10 })
      .then((data) => {
        if (mounted) {
          setBills(data.content);
        }
      })
      .catch((error) => {
        if (mounted) {
          setBills([]);
          setErrorMessage(error instanceof Error ? error.message : 'Không thể tải hóa đơn');
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
        <AppText variant="eyebrow">Thanh toán</AppText>
        <AppText variant="title">Hóa đơn của tôi</AppText>
      </View>

      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator />
          <AppText muted>Đang tải hóa đơn...</AppText>
        </View>
      ) : bills.length ? (
        <View style={styles.list}>
          {bills.map((bill) => (
            <BillCard key={bill.id} bill={bill} />
          ))}
        </View>
      ) : (
        <EmptyState
          title="Không có hóa đơn"
          description={errorMessage || 'Danh sách hóa đơn sẽ hiển thị tại đây sau khi API trả dữ liệu.'}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: 4,
  },
  loading: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 48,
  },
  list: {
    gap: 12,
  },
});
