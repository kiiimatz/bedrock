export interface Protocol {
  proto: 'HTTP' | 'HTTPS' | 'TCP' | 'UDP' | 'QUIC';
  ip: string;
  port?: string;
}

export interface HistoryDay {
  pct: number;
  down: number;
  cls?: string;
}

export interface Service {
  id: number;
  name: string;
  group: string;
  status: 'up' | 'degraded' | 'down';
  protocols: Protocol[];
  history: (HistoryDay | null)[];
  uptime: number;
}

export interface Group {
  id: number;
  name: string;
  sort_order: number;
}

export interface Incident {
  id: number;
  title: string;
  svc: string;
  message: string;
  resolved: number;
  created_at: number;
}

export interface MaintenanceWindow {
  id: number;
  title: string;
  svc: string;
  start_at: string;
  end_at: string;
}
