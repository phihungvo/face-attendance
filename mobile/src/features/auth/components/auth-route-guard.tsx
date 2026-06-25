import { Redirect, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useAuth } from '@/features/auth/context/auth-context';
import { AppText } from '@/shared/components/app-text';

type AuthRouteGuardProps = {
  children: ReactNode;
  loadingMessage?: string;
  redirectTo?: Href;
  requireAuth?: boolean;
};

export function AuthRouteGuard({
  children,
  loadingMessage = 'Đang kiểm tra phiên đăng nhập...',
  redirectTo,
  requireAuth = true,
}: AuthRouteGuardProps) {
  const { isLoading, session } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator />
        <AppText muted>{loadingMessage}</AppText>
      </View>
    );
  }

  if (requireAuth && !session) {
    return <Redirect href={redirectTo ?? '/login'} />;
  }

  if (!requireAuth && session) {
    return <Redirect href={redirectTo ?? '/'} />;
  }

  return children;
}

const styles = StyleSheet.create({
  loading: {
    alignItems: 'center',
    flex: 1,
    gap: 10,
    justifyContent: 'center',
  },
});
