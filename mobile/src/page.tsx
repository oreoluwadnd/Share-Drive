// The frame of every phone screen: the soft background, the safe area and a scrolling column.

import { LinearGradient } from 'expo-linear-gradient';
import { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, StyleSheet } from 'react-native';
import { Edge, SafeAreaView } from 'react-native-safe-area-context';

import { T } from './theme';
import { ui } from './ui';

export function Page(p: { children: ReactNode; scroll?: boolean; edges?: Edge[]; refreshing?: boolean; onRefresh?: () => void }) {
  return (
    <LinearGradient colors={T.background} style={s.fill}>
      <SafeAreaView edges={p.edges ?? ['top']} style={s.fill}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.fill}>
          {p.scroll === false ? p.children : (
            <ScrollView
              contentContainerStyle={[ui.page, s.column]}
              keyboardShouldPersistTaps="handled"
              refreshControl={p.onRefresh ? <RefreshControl refreshing={p.refreshing ?? false} onRefresh={p.onRefresh} /> : undefined}
            >
              {p.children}
            </ScrollView>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1 },
  column: { width: '100%', maxWidth: 560, alignSelf: 'center' },
});
