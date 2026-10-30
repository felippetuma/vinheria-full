import { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';
import LineChart from '../components/LineChart';
import MetricCard from '../components/MetricCard';
import { Btn, Card, Label, Screen } from '../components/ui';
import { useApp } from '../lib/AppProvider';
import { COMMANDS, METRICS, METRIC_INFO, getHistory, getLatest, sendCommand } from '../lib/fiware';
import { colors } from '../lib/theme';
import { Metric, Reading } from '../lib/types';

const POLL_MS = 5000; // atualização automática a cada 5s
const RANGES = [10, 30, 60];

export default function Dashboard() {
  const { state, ready } = useApp();
  const { settings, triggers, selected, autoAlerts } = state;

  const [latest, setLatest] = useState<Partial<Record<Metric, number>>>({});
  const [history, setHistory] = useState<Record<Metric, Reading[]>>({
    temperature: [],
    humidity: [],
    luminosity: [],
  });
  const [lastN, setLastN] = useState(30);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const lastKey = useRef(''); // anomalias já enviadas ao hardware

  // Busca valor atual + histórico
  const load = useCallback(async () => {
    if (!settings.host || !selected) return;
    try {
      const [cur, t, h, l] = await Promise.all([
        getLatest(settings, selected.entity),
        getHistory(settings, selected.entity, selected.type, 'temperature', lastN),
        getHistory(settings, selected.entity, selected.type, 'humidity', lastN),
        getHistory(settings, selected.entity, selected.type, 'luminosity', lastN),
      ]);
      setLatest(cur);
      setHistory({ temperature: t, humidity: h, luminosity: l });
      setUpdatedAt(new Date());
      setError(null);
    } catch (e: any) {
      setError(e.message);
    }
  }, [settings, selected, lastN]);

  // Polling
  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  // Quais métricas estão fora dos limites. Os triggers são do app: o firmware tem
  // limites próprios e fixos (ver docs/alertas-e-triggers.md).
  const anomalies = METRICS.filter((m) => {
    const v = latest[m];
    return v !== undefined && (v < triggers[m].min || v > triggers[m].max);
  });
  const key = autoAlerts ? anomalies.join(',') : '';

  // Dispara comandos ao ESP32 (LED azul + buzzer) quando o conjunto de anomalias muda.
  // Só reage a mudanças (comparando com lastKey) para não reenviar o mesmo comando a cada
  // polling de 5 s. O alertOff antes dos novos comandos evita deixar ligado um alerta
  // de métrica que já normalizou. O firmware também derruba o alerta sozinho quando
  // a leitura local volta ao normal.
  useEffect(() => {
    if (!selected || key === lastKey.current) return;
    const prev = lastKey.current;
    (async () => {
      try {
        if (prev !== '') await sendCommand(settings, selected.entity, COMMANDS.off); // limpa estado anterior
        for (const m of key.split(',').filter(Boolean)) {
          await sendCommand(settings, selected.entity, COMMANDS[m as Metric]);
        }
        lastKey.current = key; // só marca como enviado se deu certo (senão tenta de novo)
      } catch (e: any) {
        setError(`Falha ao enviar comando: ${e.message}`);
      }
    })();
  }, [key, latest, selected, settings]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  // Teste manual de comandos (útil no hands-on)
  const manual = async (cmd: string) => {
    if (!selected) return;
    try {
      await sendCommand(settings, selected.entity, cmd);
      setError(null);
    } catch (e: any) {
      setError(`Falha ao enviar comando: ${e.message}`);
    }
  };

  if (!ready) return null;

  if (!settings.host || !selected) {
    return (
      <Screen title="Vinheria Visionists" subtitle="Monitoramento em tempo real">
        <Card>
          <Text style={s.text}>
            {!settings.host
              ? 'Informe o IP do FIWARE na aba Config.'
              : 'Cadastre ou selecione um dispositivo na aba Dispositivos.'}
          </Text>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen
      title="Vinheria"
      subtitle={`${selected.entity}${updatedAt ? `  ·  atualizado ${updatedAt.toLocaleTimeString()}` : ''}`}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}
    >
      {anomalies.length > 0 && (
        <Card inverted>
          <Text style={s.alertTitle}>⚠ ALERTA</Text>
          <Text style={s.alertText}>
            Fora do limite: {anomalies.map((m) => METRIC_INFO[m].label).join(', ')}
          </Text>
          <Text style={s.alertText}>
            {autoAlerts ? 'LED azul + buzzer acionados.' : 'Alertas automáticos desligados.'}
          </Text>
        </Card>
      )}

      {/* Valores atuais */}
      <View style={s.row}>
        {METRICS.map((m) => (
          <MetricCard
            key={m}
            label={METRIC_INFO[m].label}
            unit={METRIC_INFO[m].unit}
            value={latest[m]}
            min={triggers[m].min}
            max={triggers[m].max}
          />
        ))}
      </View>

      {/* Janela do histórico */}
      <View style={[s.row, { marginTop: 16, marginBottom: 12, alignItems: 'center' }]}>
        <Label>Histórico (últimas leituras)</Label>
      </View>
      <View style={[s.row, { marginBottom: 12 }]}>
        {RANGES.map((n) => (
          <Btn
            key={n}
            small
            label={String(n)}
            variant={lastN === n ? 'solid' : 'outline'}
            onPress={() => setLastN(n)}
            style={{ flex: 1 }}
          />
        ))}
      </View>

      {/* Gráficos dinâmicos */}
      {METRICS.map((m) => (
        <Card key={m}>
          <LineChart
            title={METRIC_INFO[m].label}
            unit={METRIC_INFO[m].unit}
            data={history[m]}
            min={triggers[m].min}
            max={triggers[m].max}
          />
        </Card>
      ))}

      {/* Teste manual dos alertas */}
      <Card>
        <Label>Teste manual (LED azul + buzzer)</Label>
        <View style={[s.row, { flexWrap: 'wrap' }]}>
          <Btn small variant="outline" label="Temp." onPress={() => manual(COMMANDS.temperature)} style={s.half} />
          <Btn small variant="outline" label="Umid." onPress={() => manual(COMMANDS.humidity)} style={s.half} />
          <Btn small variant="outline" label="Lumin." onPress={() => manual(COMMANDS.luminosity)} style={s.half} />
          <Btn small label="Desligar" onPress={() => manual(COMMANDS.off)} style={s.half} />
        </View>
      </Card>

      {error && <Text style={s.error}>{error}</Text>}
    </Screen>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  half: { flexGrow: 1, flexBasis: '22%' },
  text: { color: colors.text, fontSize: 14, lineHeight: 20 },
  error: { color: colors.muted, fontSize: 12, marginTop: 4 },
  alertTitle: { color: colors.onInverse, fontWeight: '900', fontSize: 16, letterSpacing: 1 },
  alertText: { color: colors.onInverse, fontSize: 13, marginTop: 4 },
});