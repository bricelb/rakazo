// @vitest-environment jsdom

import type { ComponentProps, ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const messaging = vi.hoisted(() => ({
  status: vi.fn(),
  channels: { list: vi.fn(async () => []), respond: vi.fn(), leave: vi.fn() },
  connections: { list: vi.fn(async () => []), respond: vi.fn(), revoke: vi.fn() },
  identities: { unlink: vi.fn() },
  link: { start: vi.fn(async () => ({ code: "ABCD-2345", expiresAt: "" })) },
}));

vi.mock("../lib/rpc", () => ({
  rpc: {
    messaging,
    bots: { list: vi.fn(async () => [{ id: "bot-1", name: "Chief" }]) },
    spaces: { list: vi.fn(async () => ({ current: { externalConversations: [] } })) },
  },
}));
vi.mock("./ExternalConversationSettings", () => ({ ExternalConversationSettings: () => null }));
vi.mock("@lingui/react/macro", () => {
  const t = (parts: TemplateStringsArray, ...values: unknown[]) =>
    parts.reduce(
      (text, part, index) => `${text}${index > 0 ? String(values[index - 1]) : ""}${part}`,
      "",
    );
  return {
    useLingui: () => ({ t }),
    Trans: ({ children }: { children?: ReactNode }) => children,
  };
});
vi.mock("@rakazo/ui-web", () => {
  const Pass = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  return {
    Button: ({
      children,
      onClick,
      disabled,
    }: ComponentProps<"button"> & { variant?: string; size?: string }) => (
      <button type="button" disabled={disabled} onClick={onClick}>
        {children}
      </button>
    ),
    Dialog: Pass,
    DialogClose: Pass,
    DialogContent: Pass,
    DialogTitle: Pass,
    NativeSelect: (props: ComponentProps<"select">) => <select {...props} />,
    NativeSelectOption: (props: ComponentProps<"option">) => <option {...props} />,
  };
});

import { MessagingSettingsOverlay } from "./MessagingSettingsOverlay";

const identity = {
  id: "mi-1",
  provider: "telegram",
  address: "424242",
  botId: "bot-1",
  botName: "Chief",
};

function statusWith(identities: (typeof identity)[]) {
  return { enabled: true, providers: ["telegram"], openSignup: false, identities };
}

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

beforeEach(() => {
  vi.useFakeTimers();
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
  vi.clearAllMocks();
});

async function startLink() {
  await act(async () => root.render(<MessagingSettingsOverlay onClose={() => undefined} />));
  const select = container.querySelector("select");
  if (!select) throw new Error("Missing bot select");
  await act(async () => {
    select.value = "bot-1";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  const link = [...container.querySelectorAll("button")].find((button) =>
    button.textContent?.includes("Link a chat app"),
  );
  await act(async () => link?.click());
  expect(container.querySelector('[data-testid="messaging-link-code"]')).not.toBeNull();
}

it("lists a chat app linked from the chat app without reopening the dialog", async () => {
  messaging.status.mockResolvedValue(statusWith([]));
  await startLink();
  expect(container.textContent).toContain("No chat apps linked yet.");

  // The code is sent from the chat app; the server now reports the identity.
  messaging.status.mockResolvedValue(statusWith([identity]));
  await act(async () => vi.advanceTimersByTimeAsync(3_000));

  expect(container.textContent).toContain("424242");
  expect(container.querySelector('[data-testid="messaging-link-code"]')).toBeNull();
});

it("stops polling once the link code expires", async () => {
  messaging.status.mockResolvedValue(statusWith([]));
  await startLink();
  await act(async () => vi.advanceTimersByTimeAsync(10 * 60_000));
  const calls = messaging.status.mock.calls.length;

  await act(async () => vi.advanceTimersByTimeAsync(30_000));
  expect(messaging.status.mock.calls.length).toBe(calls);
});
