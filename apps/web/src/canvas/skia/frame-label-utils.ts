export function isEntityCardRole(role: unknown): boolean {
  return typeof role === "string" && role.startsWith("entity-");
}

export function shouldDrawFrameLabel(
  node: { type: string; name?: string; role?: string },
  clipRect: unknown,
  isReusable: boolean,
  isInstance: boolean,
): boolean {
  if (!node.name || isEntityCardRole(node.role)) {
    return false;
  }

  const isRootFrame = node.type === "frame" && !clipRect;
  return isRootFrame || isReusable || isInstance;
}
