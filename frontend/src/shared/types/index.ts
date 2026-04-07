export interface LocationUpdate {
  type: 'location_update';
  driver_id: string;
  latitude: number;
  longitude: number;
  speed: number;
  eta_seconds: number;
  distance_km: number;
}

export interface AlertMessage {
  type: 'alert';
  alert_id: string;
  driver_id: string;
  trip_id: string;
  timestamp: string;
  alert_type: string;
  severity: string;
  message: string;
  requires_action: boolean;
}

export interface WebSocketLocationMessage {
  type: 'location_update';
  payload: LocationUpdate;
}

export interface WebSocketAlertMessage {
  type: 'alert';
  payload: AlertMessage;
}

export type WebSocketMessage = WebSocketLocationMessage | WebSocketAlertMessage;

export interface Order {
  id: string;
  user_id: string;
  driver_id: string | null;
  status: string;
  restaurant_location: string;
  delivery_location: string;
  gpx_file?: string;
  route_points?: [number, number][];
  created_at?: string;
  updated_at?: string;
}
