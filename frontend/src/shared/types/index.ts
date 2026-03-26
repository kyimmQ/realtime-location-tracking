export interface LocationUpdate {
  type: 'location_update';
  driver_id: string;
  latitude: number;
  longitude: number;
  speed: number;
  eta_seconds: number;
  distance_km: number;
}

export interface WebSocketMessage {
  type: 'location_update';
  payload: LocationUpdate;
}
