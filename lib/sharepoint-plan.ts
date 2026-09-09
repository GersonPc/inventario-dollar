export type SourceFields = {
  model: string;
  deviceType: string;
  condition: "working" | "not_working" | "unknown";
  receivedAt: string;
  delivered: boolean;
  storeReference: string | null;
};

export type SourceRow = SourceFields & {
  item: string;
  serial: string;
  reliableSerial: boolean;
  row: number;
};

export type LocalRow = SourceFields & {
  id: number;
  barcode: string;
  itemKind: string;
  updatedAt: string;
  storeId: number | null;
  deliveredAt: string | null;
};

export type SourceLink = {
  item: string;
  equipmentId: number | null;
  snapshot: string;
};

export type SyncChoice = number | "create" | "skip";
export type PlanRow = {
  source: SourceRow;
  action: "link" | "create" | "update" | "unchanged" | "conflict";
  equipmentId: number | null;
  reason: string;
  fields: (keyof SourceFields)[];
  canChoose: boolean;
};

export const sourceFields = ["model", "deviceType", "condition", "receivedAt", "delivered", "storeReference"] as const;
export function normalizedSource(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

/** Three-way comparison. A changed local field is never silently overwritten. */
export function planSharePointSync(rows: SourceRow[], locals: LocalRow[], links: SourceLink[], choices: Record<string, SyncChoice> = {}): PlanRow[] {
  const localById = new Map(locals.map((row) => [row.id, row]));
  const linkByItem = new Map(links.map((row) => [row.item, row]));
  const occupied = new Map(links.filter((link) => link.equipmentId !== null).map((link) => [link.equipmentId, link.item]));
  const serialCounts = new Map<string, number>();
  for (const row of rows) serialCounts.set(row.serial, (serialCounts.get(row.serial) ?? 0) + 1);
  const result = rows.map((source): PlanRow => {
    const link = linkByItem.get(source.item);
    const plan: PlanRow = { source, action: "conflict", equipmentId: null, fields: [], canChoose: !link, reason: "Selecciona el equipo existente o confirma que es nuevo." };
    if (!link) {
      const choice = choices[source.item];
      if (choice === "skip") return plan;
      if (choice === "create") return { ...plan, action: "create", reason: "Crear un artículo independiente, conservando la serie original en las notas." };
      const candidates = locals.filter((local) => source.reliableSerial && serialCounts.get(source.serial) === 1 &&
        local.barcode === source.serial && local.itemKind === "equipment" &&
        normalizedSource(local.model) === normalizedSource(source.model) &&
        normalizedSource(local.deviceType) === normalizedSource(source.deviceType));
      const selected = typeof choice === "number" ? localById.get(choice) : candidates.length === 1 ? candidates[0] : undefined;
      if (!selected || selected.itemKind !== "equipment") return plan;
      if (occupied.has(selected.id) && occupied.get(selected.id) !== source.item) return { ...plan, reason: "Este equipo ya está vinculado a otro Item de Excel." };
      return { ...plan, action: "link", equipmentId: selected.id, reason: "Vincular sin cambiar los datos actuales de la aplicación." };
    }
    const local = link.equipmentId === null ? undefined : localById.get(link.equipmentId);
    if (!local) return { ...plan, reason: "El equipo vinculado fue eliminado de la aplicación. No se recreará automáticamente." };
    plan.equipmentId = local.id;
    const previous = JSON.parse(link.snapshot) as SourceRow;
    if (source.serial !== previous.serial || normalizedSource(source.model) !== normalizedSource(previous.model) || normalizedSource(source.deviceType) !== normalizedSource(previous.deviceType)) {
      return { ...plan, reason: "Cambió la identificación del Item. Revisa si hubo una corrección o renumeración en Excel." };
    }
    const changed = sourceFields.filter((field) => source[field] !== previous[field]);
    const conflicts = changed.filter((field) => local[field] !== previous[field] && local[field] !== source[field]);
    // Delivery and location form one operational change. Do not split a local delivery.
    if (changed.some((field) => field === "delivered" || field === "storeReference") &&
        ((local.delivered !== previous.delivered && local.delivered !== source.delivered) ||
         (local.storeReference !== previous.storeReference && local.storeReference !== source.storeReference))) {
      return { ...plan, reason: "La entrega o ubicación cambió en la aplicación y en Excel." };
    }
    if (conflicts.length) return { ...plan, reason: `Cambios locales y de Excel en: ${conflicts.join(", ")}.` };
    const fields = changed.filter((field) => local[field] !== source[field]);
    return { ...plan, fields, action: fields.length ? "update" : "unchanged", reason: fields.length ? "Actualizar únicamente los campos modificados en Excel." : "Conservar los datos locales." };
  });
  const targets = new Map<number, PlanRow[]>();
  for (const row of result) if (row.equipmentId !== null) targets.set(row.equipmentId, [...(targets.get(row.equipmentId) ?? []), row]);
  for (const group of targets.values()) if (group.length > 1) for (const row of group) {
    row.action = "conflict"; row.reason = "Dos filas intentan usar el mismo equipo. Revisa los vínculos.";
  }
  return result;
}
