export type Motion = "h" | "j" | "k" | "l";

/**
 * Move focus to the nearest control in a Vim direction, judged by on-screen
 * position so rows of buttons and vertical lists both behave as they look.
 * Focus stays put at an edge rather than wrapping.
 */
export function moveFocus(controls: HTMLElement[], motion: Motion) {
  if (!controls.length) return;
  const active = document.activeElement as HTMLElement | null;
  if (!active || !controls.includes(active)) {
    controls[0].focus();
    return;
  }
  const from = active.getBoundingClientRect();
  const fromX = from.left + from.width / 2;
  const fromY = from.top + from.height / 2;
  const vertical = motion === "j" || motion === "k";
  let best: HTMLElement | undefined;
  let bestScore = Infinity;
  for (const control of controls) {
    if (control === active) continue;
    const to = control.getBoundingClientRect();
    const x = to.left + to.width / 2;
    const y = to.top + to.height / 2;
    // Distance along the motion and drift across it.
    const along =
      motion === "j"
        ? to.top - from.bottom
        : motion === "k"
          ? from.top - to.bottom
          : motion === "l"
            ? to.left - from.right
            : from.left - to.right;
    const ahead =
      motion === "j"
        ? y > fromY + 1
        : motion === "k"
          ? y < fromY - 1
          : motion === "l"
            ? x > fromX + 1
            : x < fromX - 1;
    if (!ahead) continue;
    // h and l stay on the same row: the controls must overlap vertically.
    if (!vertical && (to.bottom <= from.top || to.top >= from.bottom)) continue;
    // Align by leading edges, so moving into a row lands on its first item.
    const across = vertical
      ? Math.abs(to.left - from.left)
      : Math.abs(to.top - from.top);
    const score = Math.max(0, along) * 1000 + across;
    if (score < bestScore) {
      bestScore = score;
      best = control;
    }
  }
  best?.focus();
}
