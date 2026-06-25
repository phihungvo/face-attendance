import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Colors } from '@/constants/theme';
import { useAuth } from '@/features/auth/context/auth-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { AppText } from '@/shared/components/app-text';
import { Screen } from '@/shared/components/screen';

export default function Profile() {
  const { companyName, logout, roleKeys, session } = useAuth();
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];

  return (
    <Screen>
      <View style={styles.header}>
        <AppText variant="eyebrow">Tài khoản</AppText>
        <AppText variant="title">Hồ sơ của tôi</AppText>
      </View>

      <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
        <AppText variant="label">{session?.username || 'Người dùng'}</AppText>
        <AppText muted>{companyName || 'Chưa có công ty'}</AppText>
        <View style={styles.roleRow}>
          {roleKeys.length ? (
            roleKeys.map((roleKey) => (
              <View key={roleKey} style={[styles.roleChip, { borderColor: palette.border }]}>
                <AppText muted style={styles.roleText}>
                  {roleKey}
                </AppText>
              </View>
            ))
          ) : (
            <AppText muted>Chưa có vai trò</AppText>
          )}
        </View>
      </View>

      <Link href="/change-password" asChild>
        <Pressable style={[styles.actionRow, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <View style={styles.actionLabel}>
            <Ionicons name="lock-closed-outline" size={20} color={palette.tint} />
            <AppText variant="label">Đổi mật khẩu</AppText>
          </View>
          <Ionicons name="chevron-forward" size={18} color={palette.mutedText} />
        </Pressable>
      </Link>

      <Pressable style={styles.logoutButton} onPress={logout}>
        <AppText variant="label" style={styles.logoutText}>
          Đăng xuất
        </AppText>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: 4,
  },
  card: {
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
    padding: 16,
  },
  roleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingTop: 4,
  },
  roleChip: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  roleText: {
    fontSize: 12,
    lineHeight: 16,
  },
  actionRow: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 52,
    paddingHorizontal: 14,
  },
  actionLabel: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  logoutButton: {
    alignItems: 'center',
    backgroundColor: '#FDECEC',
    borderRadius: 8,
    justifyContent: 'center',
    minHeight: 46,
    paddingHorizontal: 16,
  },
  logoutText: {
    color: '#B42318',
  },
});
