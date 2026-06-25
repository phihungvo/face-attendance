const DEFAULT_API_URL = 'http://localhost:8080/api/v1';

export const env = {
  apiBaseUrl: (process.env.EXPO_PUBLIC_API_URL || DEFAULT_API_URL).replace(/\/+$/, ''),
};
