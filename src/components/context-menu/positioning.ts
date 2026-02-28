export interface MenuPoint {
  x: number;
  y: number;
}

export interface MenuSize {
  width: number;
  height: number;
}

export interface ViewportSize {
  width: number;
  height: number;
}

export interface ResolveMenuPositionInput {
  position: MenuPoint;
  menuSize: MenuSize;
  viewportSize: ViewportSize;
  viewportPadding?: number;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function resolveMenuPosition({
  position,
  menuSize,
  viewportSize,
  viewportPadding = 8,
}: ResolveMenuPositionInput): MenuPoint {
  const constrainedPadding = Math.max(0, viewportPadding);

  const overflowRight =
    position.x + menuSize.width + constrainedPadding > viewportSize.width;
  const overflowBottom =
    position.y + menuSize.height + constrainedPadding > viewportSize.height;

  const preferredX = overflowRight ? position.x - menuSize.width : position.x;
  const preferredY = overflowBottom
    ? position.y - menuSize.height
    : position.y;

  const maxX = Math.max(
    constrainedPadding,
    viewportSize.width - menuSize.width - constrainedPadding
  );
  const maxY = Math.max(
    constrainedPadding,
    viewportSize.height - menuSize.height - constrainedPadding
  );

  return {
    x: clamp(preferredX, constrainedPadding, maxX),
    y: clamp(preferredY, constrainedPadding, maxY),
  };
}
