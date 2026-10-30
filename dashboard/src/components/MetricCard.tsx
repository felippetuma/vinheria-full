import { StyleSheet, Text } from 'react-native';
import { colors } from '../lib/theme';
import { Card } from './ui';

type Props = {
  label: string;
  value?: number;
  unit: string;
  min: number;
  max: number;
};

export default function MetricCard({ label, value, unit, min, max }: Props) {
  const alert = value !== undefined && (value < min || value > max);
  const fg = alert ? colors.onInverse : colors.text;
  const sub = alert ? colors.onInverse : colors.muted;

  return (
    <Card inverted={alert} style={s.card}>
      <Text style={[s.label, { color: sub }]}>{label}</Text>
      <Text style={[s.value, { color: fg }]}>
        {value === undefined ? '--' : value.toFixed(1)}
        <Text style={s.unit}> {unit}</Text>
      </Text>
      <Text style={[s.status, { color: fg }]}>{value === undefined ? 'SEM DADOS' : alert ? 'ALERTA' : 'OK'}</Text>
      <Text style={[s.range, { color: sub }]}>
        {min}–{max}
      </Text>
    </Card>
  );
}

const s = StyleSheet.create({
  card: { flex: 1, marginBottom: 0, padding: 12 },
  label: { fontSize: 10, textTransform: 'uppercase', letterSpacing: 1 },
  value: { fontSize: 24, fontWeight: '800', marginTop: 8 },
  unit: { fontSize: 12, fontWeight: '500' },
  status: { fontSize: 11, fontWeight: '800', marginTop: 6, letterSpacing: 1 },
  range: { fontSize: 11, marginTop: 2 },
});