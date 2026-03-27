import { useEffect, useRef, useCallback } from 'react';
import type { WebSocketMessage } from '../types';

interface UseWebSocketOptions {
  url: string;
  onMessage: (data: WebSocketMessage) => void;
  onOpen?: (ws: WebSocket) => void;
  onClose?: () => void;
}

export function useWebSocket({ url, onMessage, onOpen, onClose }: UseWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const retryCountRef = useRef(0);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const connectRef = useRef<() => void>(() => {});

  const connect = useCallback(() => {
    wsRef.current = new WebSocket(url);

    wsRef.current.onopen = () => {
      retryCountRef.current = 0;
      if (wsRef.current) {
        onOpen?.(wsRef.current);
      }

      // Auto-subscribe to driver after connection
      wsRef.current?.send(JSON.stringify({
        action: 'subscribe',
        driver_id: 'D001',
      }));
    };

    wsRef.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      onMessage(data);
    };

    wsRef.current.onclose = () => {
      onClose?.();
      // Exponential backoff: 1s, 2s, 4s... max 30s
      const delay = Math.min(1000 * 2 ** retryCountRef.current, 30000);
      retryCountRef.current++;
      retryTimeoutRef.current = setTimeout(() => {
        if (connectRef.current) {
          connectRef.current();
        }
      }, delay);
    };

    wsRef.current.onerror = () => {
      wsRef.current?.close();
    };
  }, [url, onMessage, onOpen, onClose]);

  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(retryTimeoutRef.current);
      if (wsRef.current) {
        wsRef.current.onclose = null; // Prevent reconnect loop on unmount
        wsRef.current.close();
      }
    };
  }, [connect]);
}
