import { createFileRoute } from "@tanstack/react-router";

import { SavedMessagesPanel } from "../components/settings/SavedMessagesPanel";

export const Route = createFileRoute("/_chat/settings/saved")({
  component: SavedMessagesPanel,
});
