import React, { useMemo, useState } from 'react';
import {
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { brand } from '@/constants/matric';
import { MathRenderMode, normalizeForKatex } from '@/utils/mathText';

interface MathTextProps {
  content: string;
  /** inline = stems/options; rich = explanations; expression = practice panels */
  mode?: MathRenderMode;
  style?: StyleProp<TextStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  color?: string;
  fontWeight?: TextStyle['fontWeight'];
  centered?: boolean;
  strikethrough?: boolean;
}

/**
 * Build HTML that mirrors Next.js MathText/MarkdownContent:
 * normalizeMath → render $ / $$ with KaTeX (trust textcolor for blanks).
 */
function buildKatexHtml(params: {
  latex: string;
  color: string;
  centered: boolean;
  fontSize: number;
  fontWeight?: TextStyle['fontWeight'];
  strikethrough: boolean;
  rich: boolean;
}): string {
  const weight = params.fontWeight === '700' || params.fontWeight === 'bold' ? '700' : '400';
  // Escape for embedding inside a JS template literal in the WebView.
  const safeSource = JSON.stringify(params.latex);

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0" />
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css" />
    <style>
      html, body {
        margin: 0;
        padding: 0;
        background: transparent;
        color: ${params.color};
      }
      #content {
        color: ${params.color};
        font-size: ${params.fontSize}px;
        line-height: 1.45;
        font-weight: ${weight};
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        text-align: ${params.centered ? 'center' : 'left'};
        padding: 2px 0;
        white-space: normal;
        overflow-wrap: anywhere;
        word-break: break-word;
        text-decoration: ${params.strikethrough ? 'line-through' : 'none'};
        max-width: 100%;
      }
      #content p { margin: 0 0 0.55em; }
      #content p:last-child { margin-bottom: 0; }
      .katex { color: ${params.color}; font-size: 1.05em; }
      .katex-display {
        margin: 0.35em 0;
        text-align: ${params.centered ? 'center' : 'left'};
        overflow-x: auto;
        overflow-y: hidden;
        max-width: 100%;
        -webkit-overflow-scrolling: touch;
      }
    </style>
  </head>
  <body>
    <div id="content"></div>
    <script src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js"></script>
    <script>
      (function () {
        var source = ${safeSource};
        var el = document.getElementById("content");

        function escapeHtml(s) {
          return String(s)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
        }

        // Soft-break newlines (from normalize) → <br/>; keep $ math intact.
        function toHtml(text) {
          var parts = [];
          var withSlots = String(text).replace(/\\$\\$[\\s\\S]+?\\$\\$|\\$[^$\\n]+\\$/g, function (m) {
            var token = "__K" + parts.length + "__";
            parts.push(m);
            return token;
          });
          var html = escapeHtml(withSlots).replace(/\\n/g, "<br/>");
          return html.replace(/__K(\\d+)__/g, function (_m, i) {
            return parts[Number(i)] || "";
          });
        }

        function reportHeight() {
          var h = Math.ceil(Math.max(
            document.body.scrollHeight,
            document.documentElement.scrollHeight,
            el.scrollHeight
          ));
          if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
            window.ReactNativeWebView.postMessage(String(h));
          }
        }

        function boot() {
          el.innerHTML = toHtml(source);
          try {
            renderMathInElement(el, {
              delimiters: [
                { left: "$$", right: "$$", display: true },
                { left: "$", right: "$", display: false }
              ],
              throwOnError: false,
              strict: false,
              trust: true,
              ignoredTags: ["script", "noscript", "style", "textarea", "pre", "code"]
            });
          } catch (e) {}
          reportHeight();
          setTimeout(reportHeight, 50);
          setTimeout(reportHeight, 180);
        }

        if (typeof renderMathInElement === "function" && typeof katex !== "undefined") {
          boot();
        } else {
          el.textContent = source;
          reportHeight();
        }
      })();
    </script>
  </body>
</html>`;
}

function KatexBlock({
  latex,
  color,
  centered,
  fontSize,
  fontWeight,
  strikethrough,
  rich,
}: {
  latex: string;
  color: string;
  centered?: boolean;
  fontSize: number;
  fontWeight?: TextStyle['fontWeight'];
  strikethrough?: boolean;
  rich?: boolean;
}) {
  const [height, setHeight] = useState(Math.max(36, fontSize + 18));
  const html = useMemo(
    () =>
      buildKatexHtml({
        latex,
        color,
        centered: !!centered,
        fontSize,
        fontWeight,
        strikethrough: !!strikethrough,
        rich: !!rich,
      }),
    [latex, color, centered, fontSize, fontWeight, strikethrough, rich]
  );

  return (
    <WebView
      originWhitelist={['*']}
      source={{ html }}
      style={{
        height: Math.min(height, rich ? 2000 : 900),
        backgroundColor: 'transparent',
        width: '100%',
        opacity: 0.99,
      }}
      scrollEnabled={false}
      showsHorizontalScrollIndicator={false}
      showsVerticalScrollIndicator={false}
      setBuiltInZoomControls={false}
      javaScriptEnabled
      onMessage={(event) => {
        const next = Number(event.nativeEvent.data);
        if (!Number.isNaN(next) && next > 0) {
          setHeight(Math.max(next + 4, fontSize + 14));
        }
      }}
    />
  );
}

export function MathText({
  content,
  mode = 'inline',
  style,
  containerStyle,
  color = brand.text,
  fontWeight,
  centered = false,
  strikethrough = false,
}: MathTextProps) {
  const normalized = useMemo(() => normalizeForKatex(content || '', mode), [content, mode]);
  const flatStyle = StyleSheet.flatten(style) || {};
  const fontSize =
    typeof flatStyle.fontSize === 'number'
      ? flatStyle.fontSize
      : mode === 'expression'
        ? 18
        : 15;
  const weight = fontWeight ?? flatStyle.fontWeight;

  if (!content?.trim()) return null;

  // Always prefer KaTeX when there is math — including already-$ delimited options.
  if (normalized.needsKatex) {
    return (
      <View
        style={[
          mode === 'expression' && styles.expressionWrap,
          containerStyle,
          { width: '100%' },
        ]}
      >
        <KatexBlock
          latex={normalized.katexSource}
          color={color}
          centered={centered || mode === 'expression'}
          fontSize={fontSize}
          fontWeight={weight}
          strikethrough={strikethrough}
          rich={mode === 'rich'}
        />
      </View>
    );
  }

  return (
    <Text
      style={[
        {
          color,
          fontSize,
          lineHeight: fontSize * 1.4,
          fontWeight: weight,
          textAlign: centered ? 'center' : 'left',
          textDecorationLine: strikethrough ? 'line-through' : 'none',
          flexShrink: 1,
        },
        style,
      ]}
    >
      {normalized.plainFallback}
    </Text>
  );
}

const styles = StyleSheet.create({
  expressionWrap: {
    backgroundColor: brand.backgroundElevated,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: brand.border,
  },
});
