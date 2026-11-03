import { App } from '@capacitor/app';
import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { logError } from '@/core/errorLog';
import { pathFromLink } from './deepLink';
import { isNativeApp } from './platform';

/** Android: follows those links, whether they started the app or arrived while it was open. */
export function DeepLinks() {
  const navigate = useNavigate();
  useEffect(() => {
    if (!isNativeApp()) return;
    const go = (url: string | undefined) => {
      const path = url ? pathFromLink(url) : null;
      if (path) navigate(path);
    };
    App.getLaunchUrl()
      .then((r) => go(r?.url))
      .catch((error: unknown) => logError(error, 'deeplink.launch'));
    const listener = App.addListener('appUrlOpen', ({ url }) => go(url));
    return () => {
      void listener.then((l) => l.remove());
    };
  }, [navigate]);
  return null;
}
