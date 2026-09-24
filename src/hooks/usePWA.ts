"use client";

import { useState, useEffect, useCallback } from "react";

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(true);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    const updateOnlineStatus = () => {
      const online = navigator.onLine;
      setIsOnline(online);
      if (!online) setWasOffline(true);
    };

    window.addEventListener("online", updateOnlineStatus);
    window.addEventListener("offline", updateOnlineStatus);
    updateOnlineStatus();

    return () => {
      window.removeEventListener("online", updateOnlineStatus);
      window.removeEventListener("offline", updateOnlineStatus);
    };
  }, []);

  return { isOnline, wasOffline };
}

export function usePendingSync() {
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const checkPending = async () => {
      try {
        if ("serviceWorker" in navigator && "sync" in window.ServiceWorkerRegistration.prototype) {
          const reg = await navigator.serviceWorker.ready;
          // This would need a custom sync implementation
          // For now, check localStorage for pending items
          const pending = JSON.parse(localStorage.getItem("pending-diagnostics") || "[]");
          setPendingCount(pending.length);
        }
      } catch {
        // Ignore
      }
    };

    checkPending();
    window.addEventListener("focus", checkPending);
    return () => window.removeEventListener("focus", checkPending);
  }, []);

  return { pendingCount };
}