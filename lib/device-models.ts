export function deviceModelCatalogKey(deviceType: string, model: string): string {
  return [deviceType, model]
    .map((value) =>
      value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim(),
    )
    .join("|");
}

export function deviceModelImageUrl(imageKey: string): string {
  return `/api/device-model-images?key=${encodeURIComponent(imageKey)}`;
}
