import type { MessageId } from "@t3tools/contracts";

export interface SavedMessageNavigation {
  readonly messageId: MessageId;
  readonly requestId: string;
}

export function readSavedMessageNavigation(
  state: Readonly<{ savedMessageNavigation?: SavedMessageNavigation | undefined }> | undefined,
): SavedMessageNavigation | null {
  return state?.savedMessageNavigation ?? null;
}
