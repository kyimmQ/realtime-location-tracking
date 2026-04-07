import { useEffect, useRef, useCallback } from 'react';
import type { WebSocketMessage } from '../types';

interface UseWebSocketOptions {
  url: string;
  onMessage: (data: WebSocketMessage) => void;
  onOpen?: (ws: WebSocket) => void;
  onClose?: () => void;
  driverId?: string;
  orderId?: string;
  authToken?: string;
  enabled?: boolean;
}

export function useWebSocket({ url, onMessage, onOpen, onClose, driverId, orderId, authToken, enabled = true }: UseWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const retryCountRef = useRef(0);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const authDoneRef = useRef(false);

  const connectRef = useRef<() => void>(() => {});

  const connect = useCallback(() => {
    console.log('[WS] Connecting to', url, 'enabled:', enabled, 'authToken:', !!authToken);
    wsRef.current = new WebSocket(url);
    authDoneRef.current = false;

    wsRef.current.onopen = () => {
      console.log('[WS] Connected, authToken:', !!authToken);
      retryCountRef.current = 0;

      // If auth token provided, authenticate first
      if (authToken) {
        wsRef.current?.send(JSON.stringify({ action: 'auth', token: authToken }));
      } else {
        // No auth - send subscribe directly
        const msg = orderId
          ? { action: 'subscribe', order_id: orderId }
          : { action: 'subscribe', driver_id: driverId || 'D001' };
        wsRef.current?.send(JSON.stringify(msg));
        onOpen?.(wsRef.current!);
      }
    };

    wsRef.current.onmessage = (event) => {
      const data = JSON.parse(event.data);

      // Handle auth response
      if (data.type === 'auth_success' && authToken) {
        authDoneRef.current = true;
        const msg = orderId
          ? { action: 'subscribe', order_id: orderId }
          : { action: 'subscribe', driver_id: driverId || 'D001' };
        wsRef.current?.send(JSON.stringify(msg));
        onOpen?.(wsRef.current!);
        return;
      }

      if (data.type === 'auth_error') {
        console.error('WebSocket auth failed:', data.error);
        wsRef.current?.close();
        return;
      }

      onMessage(data);
    };

    wsRef.current.onclose = (e) => {
      console.log('[WS] Closed', e.code, e.reason);
      onClose?.();
      // Only retry if enabled and not intentionally closed
      if (enabled !== false && wsRef.current?.readyState === WebSocket.CLOSED) {
        const delay = Math.min(1000 * 2 ** retryCountRef.current, 30000);
        retryCountRef.current++;
        retryTimeoutRef.current = setTimeout(() => {
          if (connectRef.current) {
            connectRef.current();
          }
        }, delay);
      }
    };

    wsRef.current.onerror = (e) => {
      console.log('[WS] Error', e);
    };
  }, [url, onMessage, onOpen, onClose, driverId, orderId, authToken]);

  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  useEffect(() => {
    if (enabled === false) return;
    connect();
    return () => {
      clearTimeout(retryTimeoutRef.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
    };
  }, [connect, enabled]);
}
