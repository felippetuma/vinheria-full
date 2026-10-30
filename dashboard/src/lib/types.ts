export type Metric = 'temperature' | 'humidity' | 'luminosity';

export type Range = { min: number; max: number };
export type Triggers = Record<Metric, Range>;

export type Settings = {
  host: string;           // IP da máquina/VM com o FIWARE
  service: string;        // header fiware-service
  servicePath: string;    // header fiware-servicepath
  entityType: string;     // tipo da entidade (ex.: Vinheria)
  cometNotifyUrl: string; // URL que o Orion usa para notificar o STH-Comet
};

export type Device = {
  device_id: string;
  entity_name: string;
  entity_type: string;
};

export type Selected = { entity: string; type: string } | null;

export type AppState = {
  settings: Settings;
  triggers: Triggers;
  selected: Selected;
  autoAlerts: boolean;
};

export type Reading = { time: string; value: number };