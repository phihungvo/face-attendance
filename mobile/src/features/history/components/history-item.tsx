import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { Colors } from '@/constants/theme';
import type { HistoryAttendanceRecord } from '@/features/history/api/types/attendanceHistory';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { AppText } from '@/shared/components/app-text';
import { formatDate, formatTime } from '@/shared/utils/format';

type HistoryItemProps = {
  record: HistoryAttendanceRecord;
};

const typeCopy = {
  checkin: {
    icon: 'log-in-outline',
    label: 'Vào ca',
  },
  checkout: {
    icon: 'log-out-outline',
    label: 'Ra ca',
  },
} as const;

function getUploadLabel(status: HistoryAttendanceRecord['upload_status']) {
  if (status === 'success' || status === 'uploaded') {
    return 'Đã lưu ảnh';
  }

  if (status === 'pending' || status === 'queued') {
    return 'Đang xử lý ảnh';
  }

  return 'Lỗi ảnh';
}

export function HistoryItem({ record }: HistoryItemProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];
  const meta = typeCopy[record.type];
  const isCheckin = record.type === 'checkin';
  const accentColor = isCheckin ? palette.success : palette.warning;
  const confidence = Math.round((record.confidence_score ?? 0) * 100);

  return (
    <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
      <View style={styles.mainRow}>
        <View style={[styles.iconBox, { backgroundColor: isCheckin ? palette.successSoft : palette.warningSoft }]}>
          <Ionicons name={meta.icon} size={22} color={accentColor} />
        </View>

        <View style={styles.content}>
          <View style={styles.titleRow}>
            <AppText variant="label" style={styles.title}>
              {meta.label}
            </AppText>
            <AppText variant="subtitle" style={{ color: accentColor }}>
              {formatTime(record.check_time)}
            </AppText>
          </View>

          <AppText muted>{formatDate(record.check_time)}</AppText>

          <View style={styles.metaRow}>
            <View style={[styles.chip, { borderColor: palette.border }]}>
              <Ionicons name="scan-outline" size={14} color={palette.mutedText} />
              <AppText muted style={styles.chipText}>
                {confidence}%
              </AppText>
            </View>
            <View style={[styles.chip, { borderColor: palette.border }]}>
              <Ionicons name="image-outline" size={14} color={palette.mutedText} />
              <AppText muted style={styles.chipText}>
                {getUploadLabel(record.upload_status)}
              </AppText>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 14,
  },
  mainRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
  },
  iconBox: {
    alignItems: 'center',
    borderRadius: 8,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  content: {
    flex: 1,
    gap: 6,
    minWidth: 0,
  },
  titleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  title: {
    flex: 1,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingTop: 4,
  },
  chip: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  chipText: {
    fontSize: 12,
    lineHeight: 16,
  },
});
