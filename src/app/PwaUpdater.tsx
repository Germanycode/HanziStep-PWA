import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { vi } from '@/i18n/vi';

/** Registers the service worker and asks before switching to a new version (registerType: 'prompt'). */
export function PwaUpdater() {
  const updateRef = useRef<(reloadPage?: boolean) => Promise<void>>(async () => {});

  const { updateServiceWorker } = useRegisterSW({
    onOfflineReady() {
      toast.success(vi.pwa.offlineReady);
    },
    onNeedRefresh() {
      toast(vi.pwa.updateAvailable, {
        id: 'pwa-update',
        duration: Infinity,
        action: { label: vi.pwa.updateAction, onClick: () => void updateRef.current(true) },
      });
    },
  });

  useEffect(() => {
    updateRef.current = updateServiceWorker;
  }, [updateServiceWorker]);

  return null;
}
