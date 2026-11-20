import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const stub = (name: string) => fileURLToPath(new URL(`./tests/stubs/${name}.ts`, import.meta.url));

export default defineConfig({
  test: { include: ['tests/**/*.test.{ts,tsx}'], globals: false },
  esbuild: { jsx: 'automatic' },
  resolve: {
    alias: {
      'react-native-safe-area-context': stub('safe-area'),
      'react-native': stub('react-native'),
      '@expo/vector-icons/Feather': stub('vector-icons'),
      '@expo/vector-icons/MaterialCommunityIcons': stub('vector-icons'),
      'expo-secure-store': stub('expo-modules'),
      'expo-local-authentication': stub('expo-modules'),
      'expo-crypto': stub('expo-modules'),
    },
  },
  define: { __DEV__: false },
});
