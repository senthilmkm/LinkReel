export const CAPTION_STYLES = [
  { id: 'bold_center', title: 'Bold', sub: 'Big type' },
  { id: 'bottom_bar', title: 'Bar', sub: 'Bottom' },
  { id: 'word_highlight', title: 'Highlight', sub: 'First word' },
  { id: 'minimal', title: 'Minimal', sub: 'Quiet' },
] as const;

export type CaptionStyleId = (typeof CAPTION_STYLES)[number]['id'];
