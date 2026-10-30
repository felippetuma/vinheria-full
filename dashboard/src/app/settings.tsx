import { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { Btn, Card, Field, Label, Screen } from '../components/ui';
import { useApp } from '../lib/AppProvider';
import { ping } from '../lib/fiware';
import { colors } from '../lib/theme';
import { Settings } from '../lib/types';

export default function SettingsScreen() {
  const { state, update } = useApp();
  const [form, setForm] = useState<Settings>(state.settings);
  const [result, setResult] = useState<{ name: string; ok: boolean; error?: string }[]>([]);
  const [testing, setTesting] = useState(false);

  useEffect(() => setForm(state.settings), [state.settings]);

  const set = (k: keyof Settings, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = () => update({ settings: { ...form, host: form.host.trim() } });

  const test = async () => {
    save();
    setTesting(true);
    setResult(await ping({ ...form, host: form.host.trim() }));
    setTesting(false);
  };

  return (
    <Screen title="Config" subtitle="Celular e FIWARE precisam estar na mesma rede">
      <Card>
        <Field label="IP do FIWARE" placeholder="192.168.0.10" keyboardType="numbers-and-punctuation" value={form.host} onChangeText={(v) => set('host', v)} />
        <Field label="fiware-service" value={form.service} onChangeText={(v) => set('service', v)} />
        <Field label="fiware-servicepath" value={form.servicePath} onChangeText={(v) => set('servicePath', v)} />
        <Field label="Tipo da entidade" value={form.entityType} onChangeText={(v) => set('entityType', v)} />
        <Field label="URL de notificação do STH-Comet" value={form.cometNotifyUrl} onChangeText={(v) => set('cometNotifyUrl', v)} />
        <Btn label="Salvar" onPress={save} variant="outline" style={{ marginBottom: 10 }} />
        <Btn label={testing ? 'Testando…' : 'Salvar e testar conexão'} onPress={test} disabled={testing} />
      </Card>

      {result.length > 0 && (
        <Card>
          <Label>Resultado</Label>
          {result.map((r) => (
            <Text key={r.name} style={s.line}>
              {r.ok ? '✓' : '✗'}  {r.name}
              {r.error ? `\n    ${r.error}` : ''}
            </Text>
          ))}
        </Card>
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  line: { color: colors.text, fontSize: 14, marginTop: 6 },
});