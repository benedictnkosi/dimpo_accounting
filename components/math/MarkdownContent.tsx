import React, { useMemo, useState } from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import { WebView } from 'react-native-webview';
import { brand } from '@/constants/matric';
import { normalizeMath, dedentMarkdown } from '@/utils/mathText';

interface MarkdownContentProps {
  content: string;
  color?: string;
  containerStyle?: StyleProp<ViewStyle>;
  minHeight?: number;
}

/**
 * Rich markdown + math for AI explanations (app.md / Next.js MarkdownContent).
 * Pipeline: dedent → normalizeMath → GFM markdown → KaTeX.
 */
export function MarkdownContent({
  content,
  color = brand.textSecondary,
  containerStyle,
  minHeight = 120,
}: MarkdownContentProps) {
  const [height, setHeight] = useState(minHeight);

  const html = useMemo(() => {
    const source = normalizeMath(dedentMarkdown(content || ''));
    const safe = JSON.stringify(source);
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
      color: ${color};
    }
    #content {
      color: ${color};
      font-size: 14px;
      line-height: 1.65;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      overflow-wrap: anywhere;
      word-break: break-word;
      max-width: 100%;
      padding: 2px 0 8px;
    }
    #content > *:first-child { margin-top: 0 !important; }
    h1, h2, h3 {
      color: ${brand.text};
      font-weight: 700;
      text-wrap: balance;
      margin: 1.15em 0 0.45em;
      line-height: 1.3;
    }
    h1 { font-size: 18px; }
    h2 { font-size: 16px; }
    h3 { font-size: 14px; }
    p {
      margin: 0 0 0.85em;
      text-wrap: pretty;
    }
    p:last-child { margin-bottom: 0; }
    strong { color: ${brand.text}; font-weight: 700; }
    em { font-style: italic; }
    ul, ol {
      margin: 0 0 0.85em;
      padding-left: 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 0.4em;
    }
    ul { list-style: disc; }
    ol { list-style: decimal; }
    li::marker { color: ${brand.primary}; font-weight: 600; }
    li { padding-left: 0.15rem; }
    code {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 12px;
      background: rgba(148, 163, 184, 0.14);
      color: ${brand.text};
      border-radius: 6px;
      padding: 0.12em 0.4em;
    }
    pre {
      background: rgba(148, 163, 184, 0.1);
      border-radius: 10px;
      padding: 10px 12px;
      overflow-x: auto;
      margin: 0 0 0.85em;
      white-space: pre-wrap;
    }
    pre code {
      background: transparent;
      padding: 0;
    }
    hr {
      border: none;
      border-top: 1px solid rgba(148, 163, 184, 0.22);
      margin: 1.1em 0;
    }
    blockquote {
      margin: 0 0 0.85em;
      padding-left: 0.85rem;
      border-left: 2px solid ${brand.primary};
      color: ${brand.textMuted};
      font-style: italic;
    }
    .katex { color: ${color}; font-size: 1.05em; }
    .katex-display {
      margin: 0.55em 0;
      overflow-x: auto;
      overflow-y: hidden;
      max-width: 100%;
      -webkit-overflow-scrolling: touch;
      text-align: center;
    }
    .katex-display > .katex { white-space: nowrap; }
    table {
      border-collapse: collapse;
      width: 100%;
      margin: 0 0 0.85em;
      font-size: 13px;
    }
    th, td {
      border: 1px solid rgba(148, 163, 184, 0.22);
      padding: 6px 8px;
      text-align: left;
    }
    th { color: ${brand.text}; background: rgba(148, 163, 184, 0.08); }
  </style>
</head>
<body>
  <div id="content"></div>
  <script src="https://cdn.jsdelivr.net/npm/marked@12.0.2/marked.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js"></script>
  <script>
    (function () {
      var source = ${safe};
      var el = document.getElementById("content");

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

      function protectMath(text) {
        var slots = [];
        var protectedText = String(text).replace(/\\$\\$[\\s\\S]+?\\$\\$|\\$[^$\\n]+\\$/g, function (m) {
          var token = "%%MATH" + slots.length + "%%";
          slots.push(m);
          return token;
        });
        return { text: protectedText, slots: slots };
      }

      function restoreMath(html, slots) {
        return html.replace(/%%MATH(\\d+)%%/g, function (_m, i) {
          return slots[Number(i)] || "";
        });
      }

      function boot() {
        try {
          marked.setOptions({ gfm: true, breaks: true });
          var protected = protectMath(source);
          var html = marked.parse(protected.text);
          html = restoreMath(html, protected.slots);
          el.innerHTML = html;
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
        } catch (e) {
          el.textContent = source;
        }
        reportHeight();
        setTimeout(reportHeight, 60);
        setTimeout(reportHeight, 200);
        setTimeout(reportHeight, 500);
      }

      if (typeof marked !== "undefined" && typeof renderMathInElement === "function") {
        boot();
      } else {
        el.textContent = source;
        reportHeight();
      }
    })();
  </script>
</body>
</html>`;
  }, [content, color]);

  if (!content?.trim()) return null;

  return (
    <View style={[{ width: '100%' }, containerStyle]}>
      <WebView
        originWhitelist={['*']}
        source={{ html }}
        style={{
          height: Math.max(height, minHeight),
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
            setHeight(Math.max(next + 8, minHeight));
          }
        }}
      />
    </View>
  );
}
