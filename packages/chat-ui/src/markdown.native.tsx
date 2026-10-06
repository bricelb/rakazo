import { type ColorTokens, darkTokens, type ResolvedAppearance } from "@rakazo/ui-tokens";
import type { RenderRules } from "@ronradtke/react-native-markdown-display";
import Markdown, {
  createMarkdownIt,
  MarkdownStream,
} from "@ronradtke/react-native-markdown-display";
import type { ReactNode } from "react";
import { memo, useMemo, useState } from "react";
import type { StyleProp, TextStyle, ViewStyle } from "react-native";
import { Linking, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import type { ChatMarkdownProps } from "./markdown";
import { linkifyExplicitUrls, plainTextLinkParts, sanitizeMarkdownUrl } from "./markdown";

// One shared parser: the Markdown components memoize on its identity.
const markdownParser = linkifyExplicitUrls(createMarkdownIt());

function markdownStyles(palette: ColorTokens) {
  return StyleSheet.create({
    body: {
      color: palette.foreground,
      fontSize: 15.5,
      lineHeight: 23,
      width: "100%",
      minWidth: 0,
      flexShrink: 1,
    },
    paragraph: {
      marginTop: 0,
      marginBottom: 9,
      width: "100%",
      flexShrink: 1,
    },
    heading1: {
      color: palette.foreground,
      fontSize: 21,
      lineHeight: 27,
      marginTop: 10,
      marginBottom: 5,
    },
    heading2: {
      color: palette.foreground,
      fontSize: 19,
      lineHeight: 25,
      marginTop: 10,
      marginBottom: 5,
    },
    heading3: {
      color: palette.foreground,
      fontSize: 17,
      lineHeight: 23,
      marginTop: 8,
      marginBottom: 4,
    },
    strong: {
      color: palette.foreground,
      fontWeight: "700",
    },
    link: {
      color: palette.link,
      textDecorationLine: "underline",
      marginBottom: 0,
    },
    code_inline: {
      color: palette.foreground,
      backgroundColor: palette.background,
      borderColor: palette.border,
      borderWidth: StyleSheet.hairlineWidth,
      padding: 0,
      paddingHorizontal: 4,
      paddingVertical: 1,
      borderRadius: 4,
    },
    code_block: {
      color: palette.foreground,
      backgroundColor: palette.background,
      borderColor: palette.border,
    },
    fence: {
      backgroundColor: palette.background,
      borderColor: palette.border,
    },
    fence_code: {
      backgroundColor: palette.background,
    },
    blockquote: {
      backgroundColor: "transparent",
      borderLeftColor: palette.border,
    },
    table: {
      borderColor: palette.border,
    },
    tr: {
      borderColor: palette.border,
    },
    hr: {
      backgroundColor: palette.border,
    },
  });
}

async function openSafeLink(url: string) {
  const safeUrl = sanitizeMarkdownUrl(url);
  if (!safeUrl) return;
  if (await Linking.canOpenURL(safeUrl)) await Linking.openURL(safeUrl);
}

// The library lays table rows out as flex rows of equal-width cells bound to the
// bubble width, so wide tables collapse into unreadable slivers. Give each row a
// minimum width per column and let wide tables scroll horizontally instead.
const TABLE_MIN_COLUMN_WIDTH = 96;

function TableScrollView({
  children,
  style,
}: {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  // Percentage widths do not resolve inside a horizontal ScrollView, so the
  // content floor comes from the measured viewport: narrow tables still fill
  // the bubble while wider rows grow the scrollable content.
  const [viewportWidth, setViewportWidth] = useState(0);
  return (
    <ScrollView
      horizontal
      style={style}
      onLayout={(event) => setViewportWidth(event.nativeEvent.layout.width)}
    >
      <View style={{ minWidth: viewportWidth }}>{children}</View>
    </ScrollView>
  );
}

// Keep links as Text so they stay inside textgroup; Pressable (a View) is laid out
// outside the text flow and collapses the bubble height, overlapping later messages.
/**
 * List items are a row of marker + content. The library gives the content `flex: 1`, a zero
 * flex basis, so a list contributes no intrinsic width: inside a bubble that sizes itself to its
 * content (a bot message on mobile), a list-only message collapsed to one character per line.
 * Growing from an automatic basis keeps the text's natural width while still shrinking to fit.
 */
type RenderRule = NonNullable<RenderRules["link"]>;

function listItemRule(
  node: Parameters<RenderRule>[0],
  children: ReactNode[],
  parent: Parameters<RenderRule>[2],
  styleMap: Parameters<RenderRule>[3],
): ReactNode {
  const body = StyleSheet.flatten(styleMap.body) as TextStyle | undefined;
  const marker: TextStyle = {
    color: body?.color,
    fontSize: body?.fontSize,
    lineHeight: body?.lineHeight,
  };
  if (parent.some((ancestor) => ancestor.type === "bullet_list")) {
    return (
      <View key={node.key} style={styleMap._VIEW_SAFE_list_item}>
        <Text style={[marker, styleMap.bullet_list_icon]} accessible={false}>
          {Platform.select({ android: "\u2022", ios: "\u00B7", default: "\u2022" })}
        </Text>
        <View style={layout.listContent}>{children}</View>
      </View>
    );
  }
  if (parent.some((ancestor) => ancestor.type === "ordered_list")) {
    const orderedList = parent.find((ancestor) => ancestor.type === "ordered_list");
    const start = Number(orderedList?.attributes?.start);
    const number = Number.isFinite(start) ? start + node.index : node.index + 1;
    return (
      <View key={node.key} style={styleMap._VIEW_SAFE_list_item}>
        <Text style={[marker, styleMap.ordered_list_icon]}>
          {number}
          {node.markup}
        </Text>
        <View style={layout.listContent}>{children}</View>
      </View>
    );
  }
  return (
    <View key={node.key} style={styleMap._VIEW_SAFE_list_item}>
      {children}
    </View>
  );
}

const renderRules: RenderRules = {
  list_item: listItemRule,
  table: (node, children, _parent, styleMap) => (
    <TableScrollView key={node.key} style={styleMap._VIEW_SAFE_table}>
      {children}
    </TableScrollView>
  ),
  tr: (node, children, _parent, styleMap) => (
    <View
      key={node.key}
      style={[styleMap._VIEW_SAFE_tr, { minWidth: node.children.length * TABLE_MIN_COLUMN_WIDTH }]}
    >
      {children}
    </View>
  ),
  link: (node, children, _parent, styleMap) => (
    <Text
      accessibilityRole="link"
      key={node.key}
      style={styleMap.link}
      onPress={() => {
        void openSafeLink(node.attributes.href ?? "");
      }}
    >
      {children}
    </Text>
  ),
};

type LinkifiedTextProps = {
  children: string;
  color: string;
  linkColor: string;
};

export const LinkifiedText = memo(function LinkifiedText({
  children,
  color,
  linkColor,
}: LinkifiedTextProps) {
  return (
    <Text style={{ color, fontSize: 15.5, lineHeight: 23 }}>
      {plainTextLinkParts(children).map((part, index) =>
        part.type === "text" ? (
          part.value
        ) : (
          <Text
            accessibilityRole="link"
            key={index}
            style={{ color: linkColor, textDecorationLine: "underline" }}
            onPress={() => {
              void openSafeLink(part.href);
            }}
          >
            {part.value}
          </Text>
        ),
      )}
    </Text>
  );
});

export const ChatMarkdown = memo(function ChatMarkdown({
  children,
  streaming = false,
  palette = darkTokens,
  colorScheme = "dark",
}: ChatMarkdownProps & { palette?: ColorTokens; colorScheme?: ResolvedAppearance }) {
  const styles = useMemo(() => markdownStyles(palette), [palette]);
  const sharedProps = {
    colorScheme,
    markdownit: markdownParser,
    style: styles,
    rules: renderRules,
    allowedImageHandlers: ["https://", "http://"],
    onLinkPress: (url: string) => {
      void openSafeLink(url);
      return false;
    },
  };

  return (
    <View style={layout.wrap}>
      {streaming ? (
        <MarkdownStream {...sharedProps} cursorColor={palette.mutedForeground} streaming>
          {children}
        </MarkdownStream>
      ) : (
        <Markdown {...sharedProps}>{children}</Markdown>
      )}
    </View>
  );
});

const layout = StyleSheet.create({
  wrap: {
    width: "100%",
    minWidth: 0,
    flexShrink: 1,
  },
  // Deliberately no `flex: 1`: an automatic basis gives the item its text's natural width.
  listContent: {
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
  },
});

export type { ChatMarkdownProps } from "./markdown";
