import { useCallback, useEffect, useState } from 'react';
import { Alert, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Btn, Card, Field, Label, Screen } from '../components/ui';
import { useApp } from '../lib/AppProvider';
import { deleteDevice, listDevices, registerDevice } from '../lib/fiware';
import { colors } from '../lib/theme';
import { Device } from '../lib/types';

export default function Devices() {
  const { state, update } = useApp();
  const { settings, selected } = state;

  const [devices, setDevices] = useState<Device[]>([]);
  const [id, setId] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!settings.host) {
      setMsg('Configure o IP do FIWARE na aba Config.');
      return;
    }
    try {
      setDevices(await listDevices(settings));
      setMsg(null);
    } catch (e: any) {
      setMsg(e.message);
    }
  }, [settings]);

  useEffect(() => {
    load();
  }, [load]);

  const create = async () => {
    if (!id.trim()) return;
    setBusy(true);
    try {
      const { device, warning } = await registerDevice(settings, id);
      setId('');
      update({ selected: { entity: device.entity_name, type: device.entity_type } });
      await load();
      setMsg(warning ?? null);
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = (d: Device) =>
    Alert.alert('Excluir dispositivo', `Remover ${d.device_id}?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteDevice(settings, d);
            if (selected?.entity === d.entity_name) update({ selected: null });
            await load();
          } catch (e: any) {
            setMsg(e.message);
          }
        },
      },
    ]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <Screen
      title="Dispositivos"
      subtitle="Cadastro e gerenciamento (IoT Agent)"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}
    >
      <Card>
        <Field label="ID do novo dispositivo" placeholder="001" value={id} onChangeText={setId} />
        <Text style={s.hint}>
          Será criado: urn:ngsi-ld:{settings.entityType}:{id.trim() || '…'}
        </Text>
        <Btn label={busy ? 'Cadastrando…' : 'Cadastrar dispositivo'} onPress={create} disabled={busy} />
      </Card>

      {msg && <Text style={s.msg}>{msg}</Text>}

      <Label>Dispositivos cadastrados ({devices.length})</Label>
      {devices.length === 0 && <Text style={s.hint}>Nenhum dispositivo encontrado.</Text>}

      {devices.map((d) => {
        const active = selected?.entity === d.entity_name;
        return (
          <Card key={d.device_id} inverted={active}>
            <Text style={[s.name, active && { color: colors.onInverse }]}>{d.device_id}</Text>
            <Text style={[s.sub, active && { color: colors.onInverse }]}>{d.entity_name}</Text>
            <View style={s.row}>
              <Btn
                small
                label={active ? '● Ativo' : 'Selecionar'}
                variant={active ? 'outline' : 'solid'}
                onPress={() => update({ selected: { entity: d.entity_name, type: d.entity_type } })}
                style={[{ flex: 1 }, active && { borderColor: colors.onInverse }]}
              />
              <Btn small label="Excluir" variant="outline" onPress={() => remove(d)} style={{ flex: 1 }} />
            </View>
          </Card>
        );
      })}
    </Screen>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, marginTop: 12 },
  hint: { color: colors.muted, fontSize: 12, marginBottom: 12 },
  msg: { color: colors.text, fontSize: 12, marginBottom: 12 },
  name: { color: colors.text, fontSize: 17, fontWeight: '700' },
  sub: { color: colors.muted, fontSize: 12, marginTop: 2 },
});