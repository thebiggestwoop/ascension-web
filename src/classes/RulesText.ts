/**
 * Rulebook prose transcribed verbatim into content/ (content/rules/*.json and
 * content/quick-reference.json). Text may contain **bold** and _italic_; list markers
 * ("1.", "a.", "●"...) are stored exactly as the source shows them.
 */
export interface IRulesListItem {
  text: string
  /** Nesting depth, 0 = top level. */
  level: number
  /** Exact marker from the source; omitted = a plain bullet. */
  marker?: string
}

export type RulesBlock =
  | { type: 'heading'; level: number; text: string }
  | { type: 'subheading'; text: string }
  /** `indent`: an indented note set inside a list in the source. */
  | { type: 'paragraph'; text: string; indent?: boolean }
  | { type: 'list'; items: IRulesListItem[] }
  /** First row is the header row. Cell lines starting "• " are bullets. */
  | { type: 'table'; rows: string[][] }

export interface IRulesSection {
  id: string
  title: string
  /** The chapter this section belongs to (rulebook chapters only). */
  chapter?: string
  /** A chapter's opening text, before its first section heading. */
  intro?: boolean
  blocks: RulesBlock[]
}

export interface IRulesDocument {
  source: string
  /** Rulebook chapter titles covered (absent for the Quick Reference). */
  chapters?: string[]
  sections: IRulesSection[]
}
