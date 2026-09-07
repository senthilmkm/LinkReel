export const CAPTION_STYLES = ['bold_center', 'bottom_bar', 'word_highlight', 'minimal'] as const;

export type CaptionStyle = (typeof CAPTION_STYLES)[number];

export const DEFAULT_CAPTION_STYLE: CaptionStyle = 'bold_center';

export function normalizeCaptionStyle(raw?: string | null): CaptionStyle {
  return CAPTION_STYLES.includes(raw as CaptionStyle) ? (raw as CaptionStyle) : DEFAULT_CAPTION_STYLE;
}
