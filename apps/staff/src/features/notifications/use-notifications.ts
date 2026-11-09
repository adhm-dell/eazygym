"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { notificationsApi, type NotificationItem } from "./api";
import { useToast } from "@gym/ui";

export function useNotifications() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const { toast } = useToast();
  const eventSourceRef = useRef<EventSource | null>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await notificationsApi.getNotifications();
      setItems(res.items || []);
      setUnreadCount(res.unreadCount || 0);
    } catch (err) {
      console.warn("Failed to fetch notifications via polling:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Connect SSE with polling fallback
  useEffect(() => {
    fetchNotifications();

    // SSE setup
    try {
      const es = new EventSource("/api/v1/notifications/stream");
      eventSourceRef.current = es;

      es.onopen = () => {
        setIsConnected(true);
      };

      es.onmessage = (event) => {
        try {
          const raw = JSON.parse(event.data);
          const notif = raw?.data || raw;
          if (notif && notif.id) {
            setItems((prev) => {
              if (prev.some((p) => p.id === notif.id)) return prev;
              return [
                {
                  id: notif.id,
                  type: notif.type,
                  title: notif.title,
                  body: notif.body,
                  createdAt: notif.createdAt || new Date().toISOString(),
                  isRead: false,
                },
                ...prev,
              ];
            });
            setUnreadCount((c) => c + 1);

            toast({
              title: notif.title || "إشعار جديد",
              description: notif.body || "",
              variant: "info",
            });
          }
        } catch (e) {
          console.warn("Error parsing notification stream message:", e);
        }
      };

      es.onerror = () => {
        setIsConnected(false);
      };
    } catch (err) {
      console.warn("EventSource not supported or failed to initialize:", err);
    }

    // Polling fallback every 30 seconds
    const interval = setInterval(() => {
      fetchNotifications();
    }, 30000);

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      clearInterval(interval);
    };
  }, [fetchNotifications, toast]);

  const markRead = async (id: string) => {
    try {
      await notificationsApi.markRead(id);
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, isRead: true } : item))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch (err) {
      console.error("Failed to mark notification as read:", err);
    }
  };

  const markAllRead = async () => {
    try {
      await notificationsApi.markAllRead();
      setItems((prev) => prev.map((item) => ({ ...item, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error("Failed to mark all notifications as read:", err);
    }
  };

  return {
    items,
    unreadCount,
    isLoading,
    isConnected,
    fetchNotifications,
    markRead,
    markAllRead,
  };
}

