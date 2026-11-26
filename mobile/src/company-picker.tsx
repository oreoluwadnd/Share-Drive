// The insurance company dropdown: at sign-up, and in Profile for a driver who has none.

import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FONT } from './brand';
import { insuranceCompanies, InsuranceCompany } from './fairdrive';
import { T } from './theme';
import { ui } from './ui';

/** A dropdown of the insurance companies that use FairDrive. It opens in place, under the row. */
export function CompanyPicker({ value, onChange }: { value: InsuranceCompany | null; onChange: (company: InsuranceCompany) => void }) {
  const [companies, setCompanies] = useState<InsuranceCompany[] | null>(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);

  useEffect(() => { insuranceCompanies().then(setCompanies).catch((e) => setError((e as Error).message)); }, []);

  return (
    <View style={ui.field}>
      <Text style={ui.label}>Insurance company</Text>
      <Pressable onPress={() => setOpen(!open)} disabled={!companies?.length} style={s.row} accessibilityRole="button">
        <Text style={[ui.input, s.flex, !value && s.placeholder]}>
          {value?.name ?? (companies === null ? 'Loading…' : companies.length ? 'Choose your insurer' : 'No insurers use FairDrive yet')}
        </Text>
        <MaterialCommunityIcons name={open ? 'chevron-up' : 'chevron-down'} size={22} color={T.muted} />
      </Pressable>
      {error !== '' && <Text style={ui.error}>{error}</Text>}
      {open && companies?.map((c) => (
        <Pressable key={c.company_id} onPress={() => { onChange(c); setOpen(false); }} style={({ pressed }) => [s.option, pressed && s.optionPressed]}>
          <Text style={[s.optionText, c.company_id === value?.company_id && s.optionChosen]}>{c.name}</Text>
          {c.company_id === value?.company_id && <MaterialCommunityIcons name="check" size={18} color={T.primary} />}
        </Pressable>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  flex: { flex: 1 },
  placeholder: { color: T.faint },
  option: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderTopWidth: 1, borderTopColor: T.track },
  optionPressed: { opacity: 0.6 },
  optionText: { color: T.text, fontSize: 16, fontFamily: FONT.body },
  optionChosen: { fontFamily: FONT.bodyBold },
});
