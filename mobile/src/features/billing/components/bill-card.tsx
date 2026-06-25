import { StyleSheet, View } from 'react-native';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { AppText } from '@/shared/components/app-text';
import { formatCurrency, formatDate } from '@/shared/utils/format';

import type { BillSummary } from '../types';

const STATUS_LABEL: Record<string, string> = {
  OVERDUE: 'Quá hạn',
  PAID: 'Đã thanh toán',
  PARTIAL: 'Thanh toán một phần',
  UNPAID: 'Chưa thanh toán',
};

type BillCardProps = {
  bill: BillSummary;
};

export function BillCard({ bill }: BillCardProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];
  const total = bill.totalAmount ?? bill.amount ?? 0;
  const status = bill.status ? STATUS_LABEL[bill.status] ?? bill.status : 'Đang cập nhật';

  return (
    <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
      <View style={styles.header}>
        <View style={styles.titleBlock}>
          <AppText variant="label">
            {bill.month && bill.year ? `Tháng ${bill.month}/${bill.year}` : `Hóa đơn #${bill.id}`}
          </AppText>
          <AppText muted>{bill.roomName || 'Phòng đang cập nhật'}</AppText>
        </View>
        <View style={[styles.badge, { backgroundColor: palette.softWarning }]}>
          <AppText variant="eyebrow">{status}</AppText>
        </View>
      </View>
      <View style={styles.footer}>
        <View>
          <AppText muted>Hạn thanh toán</AppText>
          <AppText variant="label">{formatDate(bill.dueDate)}</AppText>
        </View>
        <View style={styles.amount}>
          <AppText muted>Tổng tiền</AppText>
          <AppText variant="label">{formatCurrency(total)}</AppText>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 8,
    borderWidth: 1,
    gap: 14,
    padding: 16,
  },
  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  titleBlock: {
    flex: 1,
    gap: 4,
  },
  badge: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  amount: {
    alignItems: 'flex-end',
  },
});
