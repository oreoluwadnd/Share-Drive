// The frame of every phone screen: the soft background, the safe area and a scrolling column.

import { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Edge, SafeAreaView } from 'react-native-safe-area-context';

import { T } from './theme';
import { ui } from './ui';

export function Page(p: { children: ReactNode; scroll?: boolean; edges?: Edge[]; refreshing?: boolean; onRefresh?: () => void }) {
  return (
    <View style={[s.fill, s.paper]}>
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
    </View>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1 },
  paper: { backgroundColor: T.background[0] },
  column: { width: '100%', maxWidth: 560, alignSelf: 'center' },
});
