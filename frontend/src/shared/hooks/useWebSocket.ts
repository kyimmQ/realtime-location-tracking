import { useEffect, useRef } from 'react';
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

  // Store latest callbacks in refs so the connection is never torn down
  // when they change — only when url/authToken/orderId/driverId change.
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;
  const onOpenRef = useRef(onOpen);
  onOpenRef.current = onOpen;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Stable connection key: only reconnect when these truly change
  const connectKey = `${url}|${authToken}|${orderId}|${driverId}`;

  useEffect(() => {
    if (!enabled) return;

    let disposed = false;

    const connect = () => {
      if (disposed) return;
      console.log('[WS] Connecting to', url, 'authToken:', !!authToken);
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        if (disposed) return;
        console.log('[WS] Connected');
        retryCountRef.current = 0;

        if (authToken) {
          ws.send(JSON.stringify({ action: 'auth', token: authToken }));
        } else {
          const msg = orderId
            ? { action: 'subscribe', order_id: orderId }
            : { action: 'subscribe', driver_id: driverId || 'D001' };
          ws.send(JSON.stringify(msg));
          onOpenRef.current?.(ws);
        }
      };

      ws.onmessage = (event) => {
        if (disposed) return;
        const data = JSON.parse(event.data);

        if (data.type === 'auth_success' && authToken) {
          const msg = orderId
            ? { action: 'subscribe', order_id: orderId }
            : { action: 'subscribe', driver_id: driverId || 'D001' };
          ws.send(JSON.stringify(msg));
          onOpenRef.current?.(ws);
          return;
        }

        if (data.type === 'auth_error') {
          console.error('[WS] Auth failed:', data.error);
          ws.close();
          return;
        }

        onMessageRef.current(data);
      };

      ws.onclose = (e) => {
        if (disposed) return;
        console.log('[WS] Closed', e.code, e.reason);
        onCloseRef.current?.();
        if (!disposed && enabled) {
          const delay = Math.min(1000 * 2 ** retryCountRef.current, 30000);
          retryCountRef.current++;
          retryTimeoutRef.current = setTimeout(connect, delay);
        }
      };

      ws.onerror = () => {
        // onclose will fire after onerror
      };
    };

    connect();

    return () => {
      disposed = true;
      clearTimeout(retryTimeoutRef.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectKey, enabled]);
}
