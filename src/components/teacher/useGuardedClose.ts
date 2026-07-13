import { useCallback, useState } from "react";

export function useGuardedClose(
  onClose: () => void,
  dirty: boolean,
  busy = false,
) {
  const [discardOpen, setDiscardOpen] = useState(false);

  const requestClose = useCallback(() => {
    if (busy) return;
    if (dirty) setDiscardOpen(true);
    else onClose();
  }, [busy, dirty, onClose]);

  const cancelDiscard = useCallback(() => setDiscardOpen(false), []);

  const confirmDiscard = useCallback(() => {
    setDiscardOpen(false);
    onClose();
  }, [onClose]);

  return {
    requestClose,
    discardOpen,
    cancelDiscard,
    confirmDiscard,
  };
}
