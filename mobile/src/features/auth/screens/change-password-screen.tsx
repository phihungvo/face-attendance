import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Colors } from '@/constants/theme';
import { useAuth } from '@/features/auth/context/auth-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { AppText } from '@/shared/components/app-text';
import { Screen } from '@/shared/components/screen';

type PasswordField = 'current' | 'next' | 'confirm';

export function ChangePasswordScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];
  const { changePassword, errorMessage, isSubmitting, logout } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [nextPassword, setNextPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [visibleField, setVisibleField] = useState<PasswordField | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const canSubmit =
    currentPassword.length >= 8 &&
    nextPassword.length >= 8 &&
    confirmPassword.length >= 8 &&
    !isSubmitting;

  async function handleSubmit() {
    if (!canSubmit) {
      setLocalError('Mật khẩu phải có ít nhất 8 ký tự.');
      return;
    }

    if (nextPassword !== confirmPassword) {
      setLocalError('Mật khẩu mới và xác nhận mật khẩu không khớp.');
      return;
    }

    if (currentPassword === nextPassword) {
      setLocalError('Mật khẩu mới phải khác mật khẩu hiện tại.');
      return;
    }

    setLocalError(null);
    setSuccessMessage(null);

    try {
      await changePassword({
        current_password: currentPassword,
        new_password: nextPassword,
      });
      setSuccessMessage('Đổi mật khẩu thành công. Vui lòng đăng nhập lại.');
      await logout();
    } catch {
      // Auth context exposes the API message for the form.
    }
  }

  return (
    <Screen contentContainerStyle={styles.screen}>
      <View style={styles.header}>
        <AppText variant="eyebrow">Bảo mật</AppText>
        <AppText variant="title">Đổi mật khẩu</AppText>
        <AppText muted>Sau khi đổi mật khẩu, phiên trên thiết bị này sẽ được đăng xuất.</AppText>
      </View>

      <View style={[styles.form, { backgroundColor: palette.surface, borderColor: palette.border }]}>
        <PasswordInput
          label="Mật khẩu hiện tại"
          onChangeText={setCurrentPassword}
          onToggleVisible={() => setVisibleField(visibleField === 'current' ? null : 'current')}
          palette={palette}
          returnKeyType="next"
          secureTextEntry={visibleField !== 'current'}
          value={currentPassword}
          visible={visibleField === 'current'}
        />
        <PasswordInput
          label="Mật khẩu mới"
          onChangeText={setNextPassword}
          onToggleVisible={() => setVisibleField(visibleField === 'next' ? null : 'next')}
          palette={palette}
          returnKeyType="next"
          secureTextEntry={visibleField !== 'next'}
          value={nextPassword}
          visible={visibleField === 'next'}
        />
        <PasswordInput
          label="Nhập lại mật khẩu mới"
          onChangeText={setConfirmPassword}
          onSubmitEditing={handleSubmit}
          onToggleVisible={() => setVisibleField(visibleField === 'confirm' ? null : 'confirm')}
          palette={palette}
          returnKeyType="done"
          secureTextEntry={visibleField !== 'confirm'}
          value={confirmPassword}
          visible={visibleField === 'confirm'}
        />

        {localError || errorMessage ? (
          <View style={styles.errorBox}>
            <AppText style={styles.errorText}>{localError || errorMessage}</AppText>
          </View>
        ) : null}

        {successMessage ? (
          <View style={styles.successBox}>
            <AppText style={styles.successText}>{successMessage}</AppText>
          </View>
        ) : null}

        <Pressable
          disabled={!canSubmit}
          onPress={handleSubmit}
          style={[styles.submitButton, !canSubmit ? styles.submitButtonDisabled : undefined]}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <AppText variant="label" style={styles.submitText}>
              Đổi mật khẩu
            </AppText>
          )}
        </Pressable>
      </View>
    </Screen>
  );
}

function PasswordInput({
  label,
  onChangeText,
  onSubmitEditing,
  onToggleVisible,
  palette,
  returnKeyType,
  secureTextEntry,
  value,
  visible,
}: {
  label: string;
  onChangeText: (value: string) => void;
  onSubmitEditing?: () => void;
  onToggleVisible: () => void;
  palette: (typeof Colors)['light'];
  returnKeyType: 'done' | 'next';
  secureTextEntry: boolean;
  value: string;
  visible: boolean;
}) {
  return (
    <View style={styles.field}>
      <AppText variant="label">{label}</AppText>
      <View style={[styles.passwordInputWrap, { borderColor: palette.border }]}>
        <TextInput
          autoCapitalize="none"
          autoComplete="password"
          autoCorrect={false}
          onChangeText={onChangeText}
          onSubmitEditing={onSubmitEditing}
          placeholder={label}
          placeholderTextColor={palette.mutedText}
          returnKeyType={returnKeyType}
          secureTextEntry={secureTextEntry}
          style={[styles.passwordInput, { color: palette.text }]}
          textContentType="password"
          value={value}
        />
        <Pressable
          accessibilityLabel={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
          accessibilityRole="button"
          hitSlop={10}
          onPress={onToggleVisible}
          style={styles.passwordToggle}
        >
          <Ionicons name={visible ? 'eye-off-outline' : 'eye-outline'} size={20} color={palette.mutedText} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    justifyContent: 'center',
  },
  header: {
    gap: 8,
  },
  form: {
    borderRadius: 8,
    borderWidth: 1,
    gap: 16,
    padding: 18,
  },
  field: {
    gap: 8,
  },
  passwordInputWrap: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 48,
  },
  passwordInput: {
    flex: 1,
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  passwordToggle: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  errorBox: {
    backgroundColor: '#FEECEC',
    borderRadius: 8,
    padding: 12,
  },
  errorText: {
    color: '#B42318',
  },
  successBox: {
    backgroundColor: '#E6F6EF',
    borderRadius: 8,
    padding: 12,
  },
  successText: {
    color: '#12805C',
  },
  submitButton: {
    alignItems: 'center',
    backgroundColor: '#176B87',
    borderRadius: 8,
    justifyContent: 'center',
    minHeight: 50,
  },
  submitButtonDisabled: {
    opacity: 0.55,
  },
  submitText: {
    color: '#FFFFFF',
  },
});
