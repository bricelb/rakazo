import { Trans } from "@lingui/react/macro";
import { Button, Field, FieldError, FieldLabel, Input } from "@rakazo/ui-web";
import { useId, useState } from "react";
import type { MemoryProviderConnectionDraft, MemoryProviderSettingsFormProps } from "./registry";

const RESOURCE_ID_PATTERN = /^[A-Za-z0-9_-]{0,512}$/;

export function HonchoSettingsForm({ busy, onConnect }: MemoryProviderSettingsFormProps) {
  const apiKeyId = useId();
  const workspaceId = useId();
  const workspaceErrorId = useId();
  const userPeerId = useId();
  const userPeerErrorId = useId();
  const [apiKey, setApiKey] = useState("");
  const [workspace, setWorkspace] = useState("");
  const [userPeer, setUserPeer] = useState("");
  const workspaceValid = RESOURCE_ID_PATTERN.test(workspace.trim());
  // A user peer lives in an existing workspace, so the field appears once one is entered.
  const showUserPeer = workspace.trim().length > 0;
  const userPeerValid = !showUserPeer || RESOURCE_ID_PATTERN.test(userPeer.trim());
  const valid = apiKey.trim().length >= 8 && workspaceValid && userPeerValid;

  async function connect() {
    if (!valid) return;
    const settings: Record<string, string> = {};
    if (workspace.trim()) settings.workspaceId = workspace.trim();
    if (showUserPeer && userPeer.trim()) settings.userPeerId = userPeer.trim();
    const draft: MemoryProviderConnectionDraft = {
      settings,
      credentials: { apiKey: apiKey.trim() },
    };
    if (await onConnect(draft)) setApiKey("");
  }

  return (
    <>
      <Field className="mt-1">
        <FieldLabel htmlFor={apiKeyId}>
          <Trans>API key</Trans>
        </FieldLabel>
        <Input
          id={apiKeyId}
          value={apiKey}
          disabled={busy}
          onChange={(event) => setApiKey(event.target.value)}
          placeholder="hch-…"
          type="password"
          autoComplete="new-password"
          maxLength={4096}
        />
      </Field>

      <Field className="mt-4" data-invalid={workspaceValid ? undefined : true}>
        <FieldLabel htmlFor={workspaceId}>
          <Trans>Workspace</Trans>
        </FieldLabel>
        <Input
          id={workspaceId}
          value={workspace}
          disabled={busy}
          aria-invalid={workspaceValid ? undefined : true}
          aria-describedby={workspaceValid ? undefined : workspaceErrorId}
          onChange={(event) => setWorkspace(event.target.value)}
          placeholder="rakazo-<space>"
          maxLength={512}
          autoComplete="off"
        />
        {!workspaceValid ? (
          <FieldError id={workspaceErrorId}>
            <Trans>Use up to 512 letters, digits, _ or -.</Trans>
          </FieldError>
        ) : null}
      </Field>

      {showUserPeer ? (
        <Field className="mt-4" data-invalid={userPeerValid ? undefined : true}>
          <FieldLabel htmlFor={userPeerId}>
            <Trans>User peer</Trans>
          </FieldLabel>
          <Input
            id={userPeerId}
            value={userPeer}
            disabled={busy}
            aria-invalid={userPeerValid ? undefined : true}
            aria-describedby={userPeerValid ? undefined : userPeerErrorId}
            onChange={(event) => setUserPeer(event.target.value)}
            maxLength={512}
            autoComplete="off"
          />
          {!userPeerValid ? (
            <FieldError id={userPeerErrorId}>
              <Trans>Use up to 512 letters, digits, _ or -.</Trans>
            </FieldError>
          ) : null}
        </Field>
      ) : null}

      <Button
        type="button"
        variant="secondary"
        className="mt-5 rounded-full"
        size="sm"
        disabled={busy || !valid}
        onClick={() => void connect()}
      >
        {busy ? <Trans>Connecting…</Trans> : <Trans>Connect</Trans>}
      </Button>
    </>
  );
}
