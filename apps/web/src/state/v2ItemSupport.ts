import { useAtomValue } from "@effect/atom-react";
import {
  EMPTY_V2_ITEM_SUPPORT,
  resolveV2ItemSupport,
  v2ItemSupportEqual,
  type V2ItemSupport,
} from "@t3tools/client-runtime/state/item-support";
import type { EnvironmentId, ThreadId, TurnItemId } from "@t3tools/contracts";
import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import { Atom } from "effect/reactivity";

import { environmentThreadDetails } from "./threads";

const EMPTY_ITEM_SUPPORT_ATOM = Atom.make(EMPTY_V2_ITEM_SUPPORT);

function supportKey(input: {
  readonly environmentId: EnvironmentId;
  readonly threadId: ThreadId;
  readonly itemId: TurnItemId;
}): string {
  return JSON.stringify(input);
}

function parseSupportKey(key: string): {
  readonly environmentId: EnvironmentId;
  readonly threadId: ThreadId;
  readonly itemId: TurnItemId;
} {
  return JSON.parse(key) as {
    readonly environmentId: EnvironmentId;
    readonly threadId: ThreadId;
    readonly itemId: TurnItemId;
  };
}

const itemSupportAtomFamily = Atom.family((key: string) => {
  const target = parseSupportKey(key);
  const ref = scopeThreadRef(target.environmentId, target.threadId);
  let previous = EMPTY_V2_ITEM_SUPPORT;
  return Atom.make((get): V2ItemSupport => {
    const scoped = get(environmentThreadDetails.threadAtom(ref));
    if (scoped === null) return EMPTY_V2_ITEM_SUPPORT;
    const next = resolveV2ItemSupport(scoped.projection, target.itemId);
    if (v2ItemSupportEqual(previous, next)) return previous;
    previous = next;
    return next;
  }).pipe(Atom.withLabel(`web-v2-item-support:${key}`));
});

export function useV2ItemSupport(input: {
  readonly environmentId: EnvironmentId | null;
  readonly sourceThreadId: ThreadId | null;
  readonly sourceItemId: TurnItemId | null;
}): V2ItemSupport {
  const targetKey =
    input.environmentId === null || input.sourceThreadId === null || input.sourceItemId === null
      ? null
      : supportKey({
          environmentId: input.environmentId,
          threadId: input.sourceThreadId,
          itemId: input.sourceItemId,
        });
  return useAtomValue(
    targetKey === null ? EMPTY_ITEM_SUPPORT_ATOM : itemSupportAtomFamily(targetKey),
  );
}
