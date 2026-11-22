import type { OrchestrationV2SavedMessage } from "@t3tools/contracts";
import { useAtomValue } from "@effect/atom-react";
import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import { useNavigate } from "@tanstack/react-router";
import { BookmarkIcon } from "lucide-react";
import { T, useGT } from "gt-react";
import { assistantCitationHash } from "../../lib/assistantCitationNavigation";
import { randomUUID } from "../../lib/utils";
import { environmentPresentations } from "../../state/presentation";
import { savedMessages } from "../../state/orchestration";
import { readEnvironmentSupportsSavedMessages } from "../../state/entities";
import { useEnvironmentQuery } from "../../state/query";
import { threadEnvironment } from "../../state/threads";
import { useOrchestrationCommand } from "../../state/use-orchestration-command";
import { SavedMessagePreview } from "../chat/SavedMessagePreview";
import { SettingsPageContainer, SettingsSection } from "./settingsLayout";

function SavedMessagesEnvironmentGroup({
  environmentId,
  messages,
  label,
  canSave,
  onOpen,
  onUnsave,
}: {
  readonly environmentId: import("@t3tools/contracts").EnvironmentId;
  readonly messages: ReadonlyArray<OrchestrationV2SavedMessage>;
  readonly label: string;
  readonly canSave: boolean;
  readonly onOpen: (message: OrchestrationV2SavedMessage) => void;
  readonly onUnsave: (message: OrchestrationV2SavedMessage) => Promise<unknown>;
}) {
  return (
    <SettingsSection id={`saved-messages-${environmentId}`} title={label} variant="plain">
      {messages.length === 0 ? (
        <p className="px-3 py-4 text-sm text-muted-foreground sm:px-4">
          <T>No saved messages in this environment.</T>
        </p>
      ) : (
        <div className="overflow-hidden rounded-md border border-border/65">
          {messages.map((message) => (
            <div key={message.messageId} className="border-b border-border/50 last:border-b-0">
              <SavedMessagePreview
                message={message}
                threadTitle={message.threadTitle}
                threadRef={scopeThreadRef(environmentId, message.threadId)}
                onOpen={() => onOpen(message)}
                onUnsave={() => {
                  if (canSave) onUnsave(message);
                }}
              />
            </div>
          ))}
        </div>
      )}
    </SettingsSection>
  );
}

function SavedMessagesEnvironment({
  environmentId,
  label,
  onOpen,
  onUnsave,
}: {
  readonly environmentId: import("@t3tools/contracts").EnvironmentId;
  readonly label: string;
  readonly onOpen: (message: OrchestrationV2SavedMessage) => void;
  readonly onUnsave: (message: OrchestrationV2SavedMessage) => Promise<boolean>;
}) {
  const query = useEnvironmentQuery(savedMessages({ environmentId, input: {} }));
  const unsave = (message: OrchestrationV2SavedMessage) => {
    return onUnsave(message).then((result) => {
      if (result === true) query.refresh();
      return result;
    });
  };
  return (
    <SavedMessagesEnvironmentGroup
      environmentId={environmentId}
      label={label}
      messages={query.data?.messages ?? []}
      canSave={readEnvironmentSupportsSavedMessages(environmentId)}
      onOpen={onOpen}
      onUnsave={unsave}
    />
  );
}

export function SavedMessagesPanel() {
  const gt = useGT();
  const navigate = useNavigate();
  const presentations = useAtomValue(environmentPresentations.presentationsAtom);
  const setMessageSaved = useOrchestrationCommand(threadEnvironment.setMessageSaved, {
    reportFailure: false,
  });
  const environments = [...presentations].flatMap(([environmentId, presentation]) =>
    readEnvironmentSupportsSavedMessages(environmentId)
      ? [{ environmentId, label: presentation.entry.target.label }]
      : [],
  );
  const unsave = (
    environmentId: import("@t3tools/contracts").EnvironmentId,
    message: OrchestrationV2SavedMessage,
  ) => {
    return setMessageSaved({
      environmentId,
      input: { threadId: message.threadId, messageId: message.messageId, saved: false },
    }).then((result) => result._tag === "Success");
  };
  const openSavedMessage = (
    environmentId: import("@t3tools/contracts").EnvironmentId,
    message: OrchestrationV2SavedMessage,
  ) => {
    void navigate({
      to: "/$environmentId/$threadId",
      params: { environmentId, threadId: message.threadId },
      hash: assistantCitationHash({
        version: 1,
        environmentId,
        threadId: message.threadId,
        messageId: message.messageId,
        text: message.text || " ",
        start: 0,
        end: Math.max(1, message.text.length),
        prefix: "",
        suffix: "",
      }),
      state: {
        assistantCitationActivation: randomUUID(),
        savedMessageExpectedRole: message.role,
      },
      resetScroll: false,
    });
  };
  return (
    <SettingsPageContainer>
      {environments.map((environment) => (
        <SavedMessagesEnvironment
          key={environment.environmentId}
          environmentId={environment.environmentId}
          label={environment.label}
          onOpen={(message) => openSavedMessage(environment.environmentId, message)}
          onUnsave={(message) => unsave(environment.environmentId, message)}
        />
      ))}
      <SettingsSection id="saved-messages" title={gt("Saved messages")}>
        <p className="px-3 py-1 text-sm text-muted-foreground sm:px-4">
          {gt("Messages you saved from any thread.")}
        </p>
      </SettingsSection>
      {environments.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-4 py-16 text-center">
          <BookmarkIcon className="size-6 text-muted-foreground" aria-hidden />
          <p className="text-sm font-medium">
            <T>No saved messages yet</T>
          </p>
          <p className="max-w-sm text-xs text-muted-foreground">
            <T>Save a message from a thread to keep it here for later.</T>
          </p>
        </div>
      ) : null}
    </SettingsPageContainer>
  );
}
