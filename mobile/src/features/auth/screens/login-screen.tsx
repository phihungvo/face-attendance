import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Colors } from '@/constants/theme';
import { useAuth } from '@/features/auth/context/auth-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { AppText } from '@/shared/components/app-text';
import { Screen } from '@/shared/components/screen';

export function LoginScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const palette = Colors[colorScheme];
  const { errorMessage, isSubmitting, login } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const canSubmit = identifier.trim().length >= 3 && password.length >= 8 && !isSubmitting;

  async function handleLogin() {
    if (!identifier.trim() || !password) {
      setLocalError('Vui lòng nhập tên đăng nhập và mật khẩu.');
      return;
    }

    setLocalError(null);

    try {
      await login({
        identifier: identifier.trim(),
        password,
      });
    } catch {
      // Auth context exposes the API message for the form.
    }
  }

  return (
    <Screen contentContainerStyle={styles.screen}>
      <KeyboardAvoidingView
        behavior={Platform.select({ ios: 'padding', default: undefined })}
        style={styles.keyboard}
      >
        <View style={styles.header}>
          <AppText variant="eyebrow">Face Attendance Mobile</AppText>
          <AppText variant="title">Đăng nhập</AppText>
          <AppText muted>
            Nhập tài khoản nhân viên hoặc quản lý để truy cập dữ liệu chấm công.
          </AppText>
        </View>

        <View
          style={[styles.form, { backgroundColor: palette.surface, borderColor: palette.border }]}
        >
          <View style={styles.field}>
            <AppText variant="label">Tên đăng nhập</AppText>
            <TextInput
              autoCapitalize="none"
              autoComplete="username"
              autoCorrect={false}
              editable={!isSubmitting}
              onChangeText={setIdentifier}
              placeholder="username, email hoặc mã nhân viên"
              placeholderTextColor={palette.mutedText}
              returnKeyType="next"
              style={[styles.input, { borderColor: palette.border, color: palette.text }]}
              textContentType="username"
              value={identifier}
            />
          </View>

          <View style={styles.field}>
            <AppText variant="label">Mật khẩu</AppText>
            <View style={[styles.passwordInputWrap, { borderColor: palette.border }]}>
              <TextInput
                autoCapitalize="none"
                autoComplete="password"
                autoCorrect={false}
                editable={!isSubmitting}
                onChangeText={setPassword}
                onSubmitEditing={handleLogin}
                placeholder="Mật khẩu"
                placeholderTextColor={palette.mutedText}
                returnKeyType="done"
                secureTextEntry={!showPassword}
                style={[styles.passwordInput, { color: palette.text }]}
                textContentType="password"
                value={password}
              />
              <Pressable
                accessibilityLabel={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                accessibilityRole="button"
                hitSlop={10}
                onPress={() => setShowPassword((current) => !current)}
                style={styles.passwordToggle}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={palette.mutedText}
                />
              </Pressable>
            </View>
          </View>

          {localError || errorMessage ? (
            <View style={styles.errorBox}>
              <AppText style={styles.errorText}>{localError || errorMessage}</AppText>
            </View>
          ) : null}

          <Pressable
            disabled={!canSubmit}
            onPress={handleLogin}
            style={[styles.submitButton, !canSubmit ? styles.submitButtonDisabled : undefined]}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <AppText style={styles.submitText} variant="label">
                Đăng nhập
              </AppText>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    justifyContent: 'center',
  },
  keyboard: {
    gap: 22,
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
  input: {
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 16,
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 10,
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
