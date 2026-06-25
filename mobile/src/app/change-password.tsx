import { AuthRouteGuard } from '@/features/auth/components/auth-route-guard';
import { ChangePasswordScreen } from '@/features/auth/screens/change-password-screen';

export default function ChangePasswordRoute() {
  return (
    <AuthRouteGuard>
      <ChangePasswordScreen />
    </AuthRouteGuard>
  );
}
