export function serializeNotification(n: any) {
  return {
    ...n,
    id: n?.id != null ? String(n.id) : null
  };
}

