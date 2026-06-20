// =============================================================================
// TailsUp /health connectivity screen (Phase 1, Unit C — AC-9)
//
// Proves app -> API connectivity by calling GET {API_URL}/health and rendering
// the result. Imports HealthDTO from @tailsup/shared to (a) type the response
// and (b) prove the shared workspace package resolves from the Expo app.
//
// -----------------------------------------------------------------------------
// METRO MONOREPO NOTE (fallback — do NOT add preemptively):
// Expo SDK 54 auto-configures Metro for npm workspaces, so this app ships with
// NO metro.config.js. If `@tailsup/shared` fails to resolve at bundle time
// ("Unable to resolve module @tailsup/shared"), create apps/mobile/metro.config.js
// with EXACTLY this content, then restart the bundler:
//
//   const { getDefaultConfig } = require('expo/metro-config');
//   const path = require('path');
//
//   const projectRoot = __dirname;
//   const workspaceRoot = path.resolve(projectRoot, '../..');
//
//   const config = getDefaultConfig(projectRoot);
//   // 1) Watch the whole monorepo so changes in packages/shared trigger reload.
//   config.watchFolders = [workspaceRoot];
//   // 2) Resolve from the app's node_modules first, then the hoisted root's.
//   config.resolver.nodeModulesPaths = [
//     path.resolve(projectRoot, 'node_modules'),
//     path.resolve(workspaceRoot, 'node_modules'),
//   ];
//
//   module.exports = config;
//
// (Do NOT add stale `extraNodeModules` / `disableHierarchicalLookup` — SDK 52+
// guidance drops those when relying on auto-config.)
// =============================================================================

import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { HealthDTO } from '@tailsup/shared';

// Read the API base URL via STATIC dot-access only — Expo inlines EXPO_PUBLIC_*
// at build time and ONLY when accessed this way (no destructuring / dynamic keys).
// Dev default: localhost:3000 (correct for Expo web & iOS simulator). For an
// Android emulator use http://10.0.2.2:3000 and for a physical device the host
// LAN IP — see apps/mobile/.env.example for the full networking matrix.
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

type Status =
  | { kind: 'loading' }
  | { kind: 'success'; data: HealthDTO }
  | { kind: 'error'; message: string };

export default function HealthScreen() {
  const [status, setStatus] = useState<Status>({ kind: 'loading' });

  const checkHealth = useCallback(async () => {
    setStatus({ kind: 'loading' });
    try {
      const res = await fetch(`${API_URL}/health`);
      if (!res.ok) {
        setStatus({
          kind: 'error',
          message: `API responded with HTTP ${res.status}`,
        });
        return;
      }
      const data = (await res.json()) as HealthDTO;
      setStatus({ kind: 'success', data });
    } catch {
      // Network-level failure (server down, wrong host, CORS, etc.)
      setStatus({ kind: 'error', message: 'API unreachable' });
    }
  }, []);

  useEffect(() => {
    void checkHealth();
  }, [checkHealth]);

  return (
    <SafeAreaView style={styles.safe} edges={['bottom', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.heading}>API Health Check</Text>
        <Text style={styles.subheading}>Proving app to API connectivity</Text>

        <View style={styles.endpointBox}>
          <Text style={styles.endpointLabel}>Endpoint</Text>
          <Text style={styles.endpointValue}>{`${API_URL}/health`}</Text>
        </View>

        {status.kind === 'loading' && <LoadingState />}
        {status.kind === 'success' && <SuccessState data={status.data} />}
        {status.kind === 'error' && <ErrorState message={status.message} />}

        <Pressable
          accessibilityRole="button"
          onPress={() => void checkHealth()}
          disabled={status.kind === 'loading'}
          style={({ pressed }) => [
            styles.button,
            status.kind === 'loading' && styles.buttonDisabled,
            pressed && styles.buttonPressed,
          ]}
        >
          <Text style={styles.buttonText}>
            {status.kind === 'loading' ? 'Checking…' : 'Re-check'}
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function LoadingState() {
  return (
    <View style={[styles.card, styles.cardNeutral]}>
      <ActivityIndicator color="#2563eb" />
      <Text style={styles.cardTitle}>Contacting the API…</Text>
    </View>
  );
}

function SuccessState({ data }: { data: HealthDTO }) {
  // The API may return { status: 'ok', db: 'up' } or a degraded
  // { status: 'degraded', db: 'down' } — both are a successful round-trip
  // (the API answered). Surface the difference clearly.
  const healthy = data.status === 'ok';
  return (
    <View style={[styles.card, healthy ? styles.cardSuccess : styles.cardWarning]}>
      <Text style={styles.cardTitle}>
        {healthy ? '✓ Connected' : '⚠ Connected — degraded'}
      </Text>
      <Text style={styles.cardBody}>
        The API responded over HTTP. App to API connectivity is proven.
      </Text>

      <View style={styles.kvRow}>
        <Text style={styles.kvKey}>status</Text>
        <Text style={styles.kvValue}>{data.status}</Text>
      </View>
      <View style={styles.kvRow}>
        <Text style={styles.kvKey}>db</Text>
        <Text style={styles.kvValue}>{data.db ?? '(not reported)'}</Text>
      </View>

      <Text style={styles.payloadLabel}>Raw payload</Text>
      <Text style={styles.payload}>{JSON.stringify(data, null, 2)}</Text>
    </View>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <View style={[styles.card, styles.cardError]}>
      <Text style={styles.cardTitle}>✕ Cannot reach API</Text>
      <Text style={styles.cardBody}>{message}</Text>
      <Text style={styles.hint}>
        Is the API running on {API_URL}? On an Android emulator use
        http://10.0.2.2:3000; on a physical device use your machine&apos;s LAN IP
        (see .env.example). Then tap Re-check.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  container: {
    padding: 20,
    gap: 16,
    maxWidth: 560,
    width: '100%',
    alignSelf: 'center',
    ...Platform.select({ web: { minHeight: '100%' as unknown as number }, default: {} }),
  },
  heading: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0f172a',
  },
  subheading: {
    fontSize: 14,
    color: '#64748b',
    marginTop: -8,
  },
  endpointBox: {
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 12,
  },
  endpointLabel: {
    color: '#94a3b8',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  endpointValue: {
    color: '#e2e8f0',
    fontSize: 14,
    marginTop: 4,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
  },
  card: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    gap: 8,
  },
  cardNeutral: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  cardSuccess: {
    backgroundColor: '#f0fdf4',
    borderColor: '#86efac',
  },
  cardWarning: {
    backgroundColor: '#fffbeb',
    borderColor: '#fcd34d',
  },
  cardError: {
    backgroundColor: '#fef2f2',
    borderColor: '#fca5a5',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  cardBody: {
    fontSize: 14,
    color: '#334155',
  },
  kvRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: 'rgba(15,23,42,0.08)',
    paddingTop: 6,
  },
  kvKey: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '600',
  },
  kvValue: {
    fontSize: 14,
    color: '#0f172a',
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
  },
  payloadLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: '#64748b',
    marginTop: 8,
  },
  payload: {
    fontSize: 13,
    color: '#0f172a',
    backgroundColor: 'rgba(15,23,42,0.05)',
    borderRadius: 8,
    padding: 10,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
  },
  hint: {
    fontSize: 13,
    color: '#7f1d1d',
  },
  button: {
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonPressed: {
    backgroundColor: '#1d4ed8',
  },
  buttonDisabled: {
    backgroundColor: '#93c5fd',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});
