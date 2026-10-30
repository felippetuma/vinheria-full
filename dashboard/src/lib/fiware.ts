import { Device, Metric, Reading, Settings } from './types';

export const PORTS = { iota: 4041, orion: 1026, comet: 8666 };

export const METRICS: Metric[] = ['temperature', 'humidity', 'luminosity'];

export const METRIC_INFO: Record<Metric, { label: string; unit: string; objectId: string }> = {
  temperature: { label: 'Temperatura', unit: '°C', objectId: 't' },
  humidity: { label: 'Umidade', unit: '%', objectId: 'h' },
  luminosity: { label: 'Luminosidade', unit: '%', objectId: 'l' },
};

// Comandos que o ESP32 precisa implementar
export const COMMANDS = {
  temperature: 'alertTemp', // LED azul piscando + buzzer padrão 1
  humidity: 'alertHum',     // LED azul piscando + buzzer padrão 2
  luminosity: 'alertLum',   // LED azul piscando + buzzer padrão 3
  off: 'alertOff',          // desliga LED
};

const base = (s: Settings, port: number) => `http://${s.host}:${port}`;

const headers = (s: Settings, json = false): Record<string, string> => ({
  'fiware-service': s.service,
  'fiware-servicepath': s.servicePath,
  ...(json ? { 'Content-Type': 'application/json' } : {}),
});

async function request(url: string, init: RequestInit = {}, timeoutMs = 8000): Promise<any> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    const text = await res.text();
    if (!res.ok) throw new Error(`${res.status} ${text.slice(0, 120)}`);
    try {
      return text ? JSON.parse(text) : null;
    } catch {
      return text;
    }
  } catch (e: any) {
    if (e?.name === 'AbortError') throw new Error(`Tempo esgotado: ${url}`);
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

export async function listDevices(s: Settings): Promise<Device[]> {
  const json = await request(`${base(s, PORTS.iota)}/iot/devices`, { headers: headers(s) });
  return (json?.devices ?? []) as Device[];
}

export async function registerDevice(
  s: Settings,
  rawId: string
): Promise<{ device: Device; warning?: string }> {
  const id = rawId.trim().replace(/\s+/g, '');
  const device = {
    device_id: `${s.entityType.toLowerCase()}${id}`,
    entity_name: `urn:ngsi-ld:${s.entityType}:${id}`,
    entity_type: s.entityType,
    protocol: 'PDI-IoTA-UltraLight',
    transport: 'MQTT',
    attributes: METRICS.map((m) => ({
      object_id: METRIC_INFO[m].objectId,
      name: m,
      type: 'Float',
    })),
    commands: Object.values(COMMANDS).map((name) => ({ name, type: 'command' })),
  };

  await request(`${base(s, PORTS.iota)}/iot/devices`, {
    method: 'POST',
    headers: headers(s, true),
    body: JSON.stringify({ devices: [device] }),
  });

  try {
    await request(`${base(s, PORTS.orion)}/v2/subscriptions`, {
      method: 'POST',
      headers: headers(s, true),
      body: JSON.stringify({
        description: `STH-Comet ${device.entity_name}`,
        subject: {
          entities: [{ id: device.entity_name, type: device.entity_type }],
          condition: { attrs: METRICS },
        },
        notification: {
          http: { url: s.cometNotifyUrl },
          attrs: METRICS,
          attrsFormat: 'legacy',
        },
        throttling: 0,
      }),
    });
  } catch (e: any) {
    return { device, warning: `Dispositivo criado, mas a assinatura do STH falhou: ${e.message}` };
  }
  return { device };
}

export async function deleteDevice(s: Settings, device: Device) {
  await request(`${base(s, PORTS.iota)}/iot/devices/${device.device_id}`, {
    method: 'DELETE',
    headers: headers(s),
  });

  try {
    await request(`${base(s, PORTS.orion)}/v2/entities/${encodeURIComponent(device.entity_name)}`, {
      method: 'DELETE',
      headers: headers(s),
    });
  } catch {}
}

export async function getLatest(s: Settings, entity: string): Promise<Partial<Record<Metric, number>>> {
  const json = await request(
    `${base(s, PORTS.orion)}/v2/entities/${encodeURIComponent(entity)}?options=keyValues&attrs=${METRICS.join(',')}`,
    { headers: headers(s) }
  );
  const out: Partial<Record<Metric, number>> = {};
  METRICS.forEach((m) => {
    const v = Number(json?.[m]);
    if (json?.[m] !== undefined && Number.isFinite(v)) out[m] = v;
  });
  return out;
}

export async function getHistory(
  s: Settings,
  entity: string,
  type: string,
  metric: Metric,
  lastN: number
): Promise<Reading[]> {
  try {
    const json = await request(
      `${base(s, PORTS.comet)}/STH/v1/contextEntities/type/${type}/id/${encodeURIComponent(
        entity
      )}/attributes/${metric}?lastN=${lastN}`,
      { headers: headers(s) }
    );
    const values = json?.contextResponses?.[0]?.contextElement?.attributes?.[0]?.values ?? [];
    return values
      .map((v: any) => ({ time: v.recvTime as string, value: Number(v.attrValue) }))
      .filter((r: Reading) => Number.isFinite(r.value))
      .sort((a: Reading, b: Reading) => +new Date(a.time) - +new Date(b.time));
  } catch (e: any) {
    if (String(e.message).startsWith('404')) return []; // ainda sem dados
    throw e;
  }
}


export async function sendCommand(s: Settings, entity: string, command: string) {
  await request(`${base(s, PORTS.orion)}/v2/entities/${encodeURIComponent(entity)}/attrs`, {
    method: 'PATCH',
    headers: headers(s, true),
    body: JSON.stringify({ [command]: { type: 'command', value: '' } }),
  });
}

export async function ping(s: Settings) {
  const targets: [string, string][] = [
    ['IoT Agent (4041)', `${base(s, PORTS.iota)}/iot/about`],
    ['Orion (1026)', `${base(s, PORTS.orion)}/version`],
    ['STH-Comet (8666)', `${base(s, PORTS.comet)}/version`],
  ];
  return Promise.all(
    targets.map(async ([name, url]) => {
      try {
        await request(url, { headers: headers(s) }, 4000);
        return { name, ok: true };
      } catch {
        return { name, ok: false };
      }
    })
  );
}