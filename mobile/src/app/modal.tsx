import { Link } from 'expo-router';
import { StyleSheet } from 'react-native';

import { AuthRouteGuard } from '@/features/auth/components/auth-route-guard';
import { AppText } from '@/shared/components/app-text';
import { Screen } from '@/shared/components/screen';

export default function ModalScreen() {
  return (
    <AuthRouteGuard>
      <Screen contentContainerStyle={styles.container}>
        <AppText variant="title">Face Attendance Mobile</AppText>
        <AppText muted style={styles.description}>
          Ứng dụng dùng phiên đăng nhập bảo mật để truy cập dữ liệu chấm công.
        </AppText>
        <Link href="/" dismissTo style={styles.link}>
          <AppText variant="link">Quay lại tổng quan</AppText>
        </Link>
      </Screen>
    </AuthRouteGuard>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  description: {
    textAlign: 'center',
  },
  link: {
    marginTop: 15,
    paddingVertical: 15,
  },
});
