import { useLocalSearchParams, useRouter } from "expo-router";
import { ImageArtifactViewer } from "../components/image-artifact-viewer";
import type { MobileArtifactTarget } from "../lib/artifact-open";

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

/** Full-screen image viewer opened from a thread; a stack screen so the share sheet can sit on top of it. */
export default function ImageScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    artifactId?: string | string[];
    name?: string | string[];
    mimeType?: string | string[];
    botId?: string | string[];
    groupId?: string | string[];
  }>();
  const groupId = first(params.groupId);
  const threadTarget: MobileArtifactTarget = groupId ? { groupId } : { botId: first(params.botId) };
  return (
    <ImageArtifactViewer
      threadTarget={threadTarget}
      target={{
        artifactId: first(params.artifactId),
        name: first(params.name),
        mimeType: first(params.mimeType) || "image/png",
      }}
      onClose={() => router.back()}
    />
  );
}
