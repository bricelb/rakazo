import { useEffect, useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  SafeAreaView,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { mobileTokens } from "../lib/appearance";
import type { MobileArtifactTarget } from "../lib/artifact-open";
import { imageArtifactUri, openMobileArtifact, shareLocalFile } from "../lib/artifact-open";
import { useI18n } from "../lib/i18n";
import { NativeSymbol } from "./native-symbol";

export type ImageArtifactPreviewTarget = {
  artifactId: string;
  name: string;
  mimeType: string;
};

const HEADER_HEIGHT = 54;
const MIN_SCALE = 1;
const MAX_SCALE = 5;
const DOUBLE_TAP_SCALE = 2.5;

/** Pinch to zoom, drag to pan while zoomed, double-tap to toggle. Works on iOS and Android. */
function ZoomableImage({ uri, width, height }: { uri: string; width: number; height: number }) {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedX = useSharedValue(0);
  const savedY = useSharedValue(0);

  const pinch = Gesture.Pinch()
    .onUpdate((event) => {
      scale.value = Math.min(MAX_SCALE, Math.max(MIN_SCALE, savedScale.value * event.scale));
    })
    .onEnd(() => {
      if (scale.value <= 1.02) {
        scale.value = withTiming(1);
        savedScale.value = 1;
        translateX.value = withTiming(0);
        translateY.value = withTiming(0);
        savedX.value = 0;
        savedY.value = 0;
        return;
      }
      savedScale.value = scale.value;
    });
  const pan = Gesture.Pan()
    .maxPointers(2)
    .onUpdate((event) => {
      if (savedScale.value <= 1) return;
      const maxX = (width * (scale.value - 1)) / 2;
      const maxY = (height * (scale.value - 1)) / 2;
      translateX.value = Math.min(maxX, Math.max(-maxX, savedX.value + event.translationX));
      translateY.value = Math.min(maxY, Math.max(-maxY, savedY.value + event.translationY));
    })
    .onEnd(() => {
      savedX.value = translateX.value;
      savedY.value = translateY.value;
    });
  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      const next = savedScale.value > 1 ? 1 : DOUBLE_TAP_SCALE;
      scale.value = withTiming(next);
      savedScale.value = next;
      translateX.value = withTiming(0);
      translateY.value = withTiming(0);
      savedX.value = 0;
      savedY.value = 0;
    });
  const gesture = Gesture.Race(doubleTap, Gesture.Simultaneous(pinch, pan));
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.Image
        source={{ uri }}
        resizeMode="contain"
        style={[{ width, height }, animatedStyle]}
        accessibilityIgnoresInvertColors
      />
    </GestureDetector>
  );
}

/** Full-screen image viewer: zoom, share or export through the system sheet, close. */
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
  const tokens = mobileTokens();
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

  // Share the file the viewer already shows; only fall back to a download when nothing loaded.
  const share = () =>
    void (
      state.status === "ready"
        ? shareLocalFile(state.uri, target.mimeType, target.name)
        : openMobileArtifact(threadTarget, target.artifactId, target.name, target.mimeType)
    ).catch((error) =>
      Alert.alert(
        t("Could not share image"),
        error instanceof Error ? error.message : t("Try again."),
      ),
    );

  return (
    <Modal animationType="fade" presentationStyle="fullScreen" onRequestClose={onClose}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaView style={{ flex: 1, backgroundColor: tokens.background }}>
          <View
            style={{
              height: HEADER_HEIGHT,
              flexDirection: "row",
              alignItems: "center",
              borderBottomWidth: 1,
              borderBottomColor: tokens.border,
              paddingHorizontal: 12,
            }}
          >
            <Text
              numberOfLines={1}
              style={{ flex: 1, color: tokens.foreground, fontSize: 15, fontWeight: "500" }}
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
                color={tokens.mutedForeground}
              />
            </Pressable>
            <Pressable
              accessibilityLabel={t("Close image")}
              hitSlop={8}
              onPress={onClose}
              style={{ padding: 10 }}
            >
              <NativeSymbol ios="xmark" android="close" size={20} color={tokens.mutedForeground} />
            </Pressable>
          </View>
          {state.status === "ready" ? (
            <View
              style={{
                flex: 1,
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
              }}
            >
              <ZoomableImage uri={state.uri} width={width} height={height - HEADER_HEIGHT} />
            </View>
          ) : (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
              <Text style={{ color: tokens.mutedForeground, fontSize: 15, textAlign: "center" }}>
                {state.status === "loading" ? t("Loading image…") : state.message}
              </Text>
            </View>
          )}
        </SafeAreaView>
      </GestureHandlerRootView>
    </Modal>
  );
}
