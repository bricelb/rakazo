import { useEffect, useState } from "react";
import {
  Alert,
  Image,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import {
  imageArtifactUri,
  type MobileArtifactTarget,
  openMobileArtifact,
} from "../lib/artifact-open";
import { useI18n } from "../lib/i18n";
import { NativeSymbol } from "./native-symbol";

export type ImageArtifactPreviewTarget = {
  artifactId: string;
  name: string;
  mimeType: string;
};

const HEADER_HEIGHT = 54;

/** Full-screen image viewer: pinch to zoom, share/export through the system sheet, close. */
export function ImageArtifactViewer({
  threadTarget,
  target,
  onClose,
}: {
  threadTarget: MobileArtifactTarget;
  target: ImageArtifactPreviewTarget;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const { width, height } = useWindowDimensions();
  const [state, setState] = useState<
    { status: "loading" } | { status: "ready"; uri: string } | { status: "error"; message: string }
  >({ status: "loading" });
  const targetBotId = "botId" in threadTarget ? threadTarget.botId : undefined;
  const targetGroupId = "groupId" in threadTarget ? threadTarget.groupId : undefined;

  useEffect(() => {
    let cancelled = false;
    const requestTarget: MobileArtifactTarget =
      targetBotId !== undefined ? { botId: targetBotId } : { groupId: targetGroupId! };
    void imageArtifactUri(requestTarget, target.artifactId, target.mimeType)
      .then((uri) => {
        if (!cancelled) setState({ status: "ready", uri });
      })
      .catch((error) => {
        if (cancelled) return;
        setState({
          status: "error",
          message: error instanceof Error ? error.message : t("Could not load image"),
        });
      });
    return () => {
      cancelled = true;
    };
  }, [targetBotId, targetGroupId, target.artifactId, target.mimeType]);

  const share = () =>
    void openMobileArtifact(threadTarget, target.artifactId, target.name, target.mimeType).catch(
      (error) =>
        Alert.alert(
          t("Could not share image"),
          error instanceof Error ? error.message : t("Try again."),
        ),
    );

  return (
    <Modal animationType="fade" presentationStyle="fullScreen" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: "#000" }}>
        <View
          style={{
            height: HEADER_HEIGHT,
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 12,
          }}
        >
          <Text
            numberOfLines={1}
            style={{ flex: 1, color: "#fff", fontSize: 15, fontWeight: "500" }}
          >
            {target.name}
          </Text>
          <Pressable
            accessibilityLabel={t("Share {name}", { name: target.name })}
            hitSlop={8}
            onPress={share}
            style={{ padding: 10 }}
          >
            <NativeSymbol
              ios="square.and.arrow.up"
              android="share-social-outline"
              size={20}
              color="#fff"
            />
          </Pressable>
          <Pressable
            accessibilityLabel={t("Close image")}
            hitSlop={8}
            onPress={onClose}
            style={{ padding: 10 }}
          >
            <NativeSymbol ios="xmark" android="close" size={20} color="#fff" />
          </Pressable>
        </View>
        {state.status === "ready" ? (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}
            maximumZoomScale={5}
            minimumZoomScale={1}
            bouncesZoom
            centerContent
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
          >
            <Pressable onPress={onClose} accessibilityLabel={t("Close image")}>
              <Image
                source={{ uri: state.uri }}
                resizeMode="contain"
                style={{ width, height: height - HEADER_HEIGHT }}
                accessibilityIgnoresInvertColors
              />
            </Pressable>
          </ScrollView>
        ) : (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
            <Text style={{ color: "#ddd", fontSize: 15, textAlign: "center" }}>
              {state.status === "loading" ? t("Loading image…") : state.message}
            </Text>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}
