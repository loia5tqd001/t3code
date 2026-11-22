import { describe, expect, it } from "vite-plus/test";
import { MessageId } from "@t3tools/contracts";

import { readSavedMessageNavigation } from "./savedMessageNavigation.logic";

describe("saved message navigation", () => {
  it("treats an ordinary route without saved-message state as no activation", () => {
    expect(readSavedMessageNavigation({})).toBeNull();
  });

  it("returns the saved-message activation", () => {
    const navigation = {
      messageId: MessageId.make("saved-message"),
      requestId: "request",
    };
    expect(readSavedMessageNavigation({ savedMessageNavigation: navigation })).toBe(navigation);
  });
});
