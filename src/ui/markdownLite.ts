function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** Bold/italic/inline-code only - text is HTML-escaped first, so these regexes only ever wrap
 * already-safe text in tags. */
function renderInline(text: string): string {
  let html = escapeHtml(text)
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>')
  html = html.replace(/\*\*([^*]+)\*\*|__([^_]+)__/g, (_m, a, b) => `<strong>${a ?? b}</strong>`)
  html = html.replace(/\*([^*]+)\*|_([^_]+)_/g, (_m, a, b) => `<em>${a ?? b}</em>`)
  return html
}

const HEADER_CLASS = ['text-h6', 'text-subtitle-1', 'text-subtitle-2']

/**
 * Tiny line-based Markdown-lite renderer - a small, dependency-free subset (headers,
 * bold/italic, inline code, bullet/numbered lists, blank-line-separated paragraphs) rather
 * than a full Markdown library, since every caller is short-form player/rules prose, not
 * documents needing full CommonMark fidelity. Output is always HTML-escaped before any tag
 * gets added, so it's safe to render via v-html regardless of what the source contains.
 */
export function renderMarkdownLite(source: string): string {
  const lines = source.replace(/\r\n/g, '\n').split('\n')
  const blocks: string[] = []
  let paragraph: string[] = []
  let listItems: string[] = []
  let listTag: 'ul' | 'ol' | null = null

  function flushParagraph() {
    if (paragraph.length) {
      blocks.push(`<p>${paragraph.map(renderInline).join('<br>')}</p>`)
      paragraph = []
    }
  }
  function flushList() {
    if (listTag && listItems.length) {
      blocks.push(`<${listTag}>${listItems.map((li) => `<li>${renderInline(li)}</li>`).join('')}</${listTag}>`)
    }
    listItems = []
    listTag = null
  }

  for (const line of lines) {
    if (!line.trim()) {
      flushParagraph()
      flushList()
      continue
    }
    const header = line.match(/^(#{1,3})\s+(.*)$/)
    if (header) {
      flushParagraph()
      flushList()
      const level = header[1].length - 1
      blocks.push(`<div class="${HEADER_CLASS[level]}">${renderInline(header[2])}</div>`)
      continue
    }
    const bullet = line.match(/^[-*]\s+(.*)$/)
    if (bullet) {
      flushParagraph()
      if (listTag !== 'ul') flushList()
      listTag = 'ul'
      listItems.push(bullet[1])
      continue
    }
    const numbered = line.match(/^\d+\.\s+(.*)$/)
    if (numbered) {
      flushParagraph()
      if (listTag !== 'ol') flushList()
      listTag = 'ol'
      listItems.push(numbered[1])
      continue
    }
    flushList()
    paragraph.push(line)
  }
  flushParagraph()
  flushList()
  return blocks.join('')
}
