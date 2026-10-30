import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Switch, Text, View } from 'react-native';
import { Btn, Card, Field, Label, Screen } from '../components/ui';
import { useApp } from '../lib/AppProvider';
import { METRICS, METRIC_INFO } from '../lib/fiware';
import { colors } from '../lib/theme';
import { Metric, Triggers } from '../lib/types';

type Form = Record<Metric, { min: string; max: string }>;

const toForm = (t: Triggers): Form => ({
  temperature: { min: String(t.temperature.min), max: String(t.temperature.max) },
  humidity: { min: String(t.humidity.min), max: String(t.humidity.max) },
  luminosity: { min: String(t.luminosity.min), max: String(t.luminosity.max) },
});

const num = (v: string) => Number(v.replace(',', '.'));

export default function TriggersScreen() {
  const { state, update } = useApp();
  const [form, setForm] = useState<Form>(toForm(state.triggers));

  useEffect(() => setForm(toForm(state.triggers)), [state.triggers]);

  const set = (m: Metric, k: 'min' | 'max', v: string) =>
    setForm((f) => ({ ...f, [m]: { ...f[m], [k]: v } }));

  // Os campos são texto para aceitar vírgula decimal; só viram número ao salvar.
  // min >= max é rejeitado porque a faixa vazia deixaria a métrica sempre em alerta.
  const save = () => {
    const next = {} as Triggers;
    for (const m of METRICS) {
      const min = num(form[m].min);
      const max = num(form[m].max);
      if (!Number.isFinite(min) || !Number.isFinite(max) || min >= max) {
        Alert.alert('Valores inválidos', `Confira os limites de ${METRIC_INFO[m].label} (mín < máx).`);
        return;
      }
      next[m] = { min, max };
    }
    update({ triggers: next });
    Alert.alert('Triggers salvos');
  };

  return (
    <Screen title="Triggers" subtitle="Limites que acionam o LED azul e o buzzer">
      {METRICS.map((m) => (
        <Card key={m}>
          <Label>
            {METRIC_INFO[m].label} ({METRIC_INFO[m].unit})
          </Label>
          <View style={s.row}>
            <View style={{ flex: 1 }}>
              <Field label="Mínimo" keyboardType="numeric" value={form[m].min} onChangeText={(v) => set(m, 'min', v)} />
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Máximo" keyboardType="numeric" value={form[m].max} onChangeText={(v) => set(m, 'max', v)} />
            </View>
          </View>
        </Card>
      ))}

      <Card>
        <View style={s.switchRow}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={s.switchTitle}>Alertas automáticos</Text>
            <Text style={s.switchSub}>
              Envia o comando ao ESP32 quando um valor sai do limite e desliga quando normaliza.
            </Text>
          </View>
          <Switch
            value={state.autoAlerts}
            onValueChange={(v) => update({ autoAlerts: v })}
            trackColor={{ false: colors.border, true: colors.text }}
            thumbColor={state.autoAlerts ? colors.bg : colors.muted}
          />
        </View>
      </Card>

      <Btn label="Salvar triggers" onPress={save} />
    </Screen>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12 },
  switchRow: { flexDirection: 'row', alignItems: 'center' },
  switchTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  switchSub: { color: colors.muted, fontSize: 12, marginTop: 4 },
});