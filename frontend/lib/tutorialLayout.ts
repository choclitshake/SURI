type Rect = { left: number; top: number; right: number; bottom: number; width: number; height: number };
export type TutorialViewport = { left: number; top: number; width: number; height: number; compact: boolean; landscape: boolean };

// Keep the navigation buttons within the visible viewport, including when a
// phone's keyboard is open. Touch devices use a stable sheet instead of a
// tooltip that jumps from side to side as the highlighted control changes.
export function positionTutorialCard(viewport: TutorialViewport, measuredHeight: number, target?: Rect) {
  const { left, top, width, height, compact, landscape } = viewport;
  const gap = 12;
  const sideSheet = compact && landscape && height < 600;
  const cardWidth = Math.min(compact && !sideSheet ? 480 : 360, width - gap * 2, sideSheet ? width * .48 : width);
  const maxHeight = Math.max(0, Math.min(height - gap * 2, compact && !sideSheet ? Math.max(300, height * .55) : height));
  const cardHeight = Math.min(measuredHeight, maxHeight);
  let x = left + (width - cardWidth) / 2;
  let y = top + (height - cardHeight) / 2;
  if (compact) {
    x = sideSheet ? left + width - cardWidth - gap : x;
    y = top + height - cardHeight - gap;
  } else if (target) {
    if (target.right + cardWidth + gap * 2 < left + width) { x = target.right + gap; y = target.top; }
    else if (target.left - cardWidth - gap * 2 > left) { x = target.left - cardWidth - gap; y = target.top; }
    else if (target.bottom + cardHeight + gap * 2 < top + height) y = target.bottom + gap;
    else if (target.top - cardHeight - gap * 2 > top) y = target.top - cardHeight - gap;
    else y = top + height - cardHeight - gap;
  }
  return {
    cardX: Math.max(left + gap, Math.min(left + width - cardWidth - gap, x)),
    cardY: Math.max(top + gap, Math.min(top + height - cardHeight - gap, y)),
    cardWidth,
    maxHeight,
  };
}
