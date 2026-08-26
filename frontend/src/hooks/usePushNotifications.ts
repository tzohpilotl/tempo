import { useState, useEffect, useCallback } from "react";
import { notifications } from "../api/client";
import { isPushSupported } from "../utils/pushNotifications";
import { logError } from "../utils/logger";

interface PushNotificationsState {
  supported: boolean;
  subscribed: boolean;
  loading: boolean;
  toggle: () => Promise<void>;
}

export function usePushNotifications(): PushNotificationsState {
  const supported = isPushSupported();
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(supported);

  useEffect(() => {
    if (!supported) return;
    notifications
      .isSubscribed()
      .then(setSubscribed)
      .catch(logError)
      .finally(() => setLoading(false));
  }, [supported]);

  const toggle = useCallback(async () => {
    setLoading(true);
    try {
      if (subscribed) {
        await notifications.unsubscribe();
        setSubscribed(false);
      } else {
        await notifications.subscribe();
        setSubscribed(true);
      }
    } catch (err) {
      logError(err);
    } finally {
      setLoading(false);
    }
  }, [subscribed]);

  return { supported, subscribed, loading, toggle };
}
