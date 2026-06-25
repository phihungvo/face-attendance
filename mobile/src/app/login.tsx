import { AuthRouteGuard } from '@/features/auth/components/auth-route-guard';
import { LoginScreen } from '@/features/auth/screens/login-screen';

export default function LoginRoute() {
  return (
    <AuthRouteGuard requireAuth={false} redirectTo="/">
      <LoginScreen />
    </AuthRouteGuard>
  );
}
