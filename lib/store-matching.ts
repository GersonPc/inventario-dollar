export type StoreMatchCandidate = {
  id: number;
  storeNumber: string;
  name: string;
};

export type StoreReferenceMatch = {
  store: StoreMatchCandidate;
  method: "number" | "embedded_number" | "name";
};

export function normalizeStoreName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function uniqueMatch(
  candidates: StoreMatchCandidate[],
  method: StoreReferenceMatch["method"],
): StoreReferenceMatch | null {
  return candidates.length === 1 ? { store: candidates[0], method } : null;
}

/**
 * Relates an imported room reference only when there is one unambiguous match.
 * Store codes take priority because names in historical spreadsheets may contain
 * spelling or encoding errors.
 */
export function matchStoreReference(
  reference: string,
  stores: StoreMatchCandidate[],
): StoreReferenceMatch | null {
  const cleanReference = reference.trim();
  if (!cleanReference) return null;

  const exactNumber = uniqueMatch(
    stores.filter((store) => store.storeNumber.trim() === cleanReference),
    "number",
  );
  if (exactNumber) return exactNumber;

  const numberTokens = new Set(cleanReference.match(/\d{4,}/g) ?? []);
  if (numberTokens.size) {
    const embeddedNumber = uniqueMatch(
      stores.filter((store) => numberTokens.has(store.storeNumber.trim())),
      "embedded_number",
    );
    if (embeddedNumber) return embeddedNumber;
  }

  const normalizedReference = normalizeStoreName(cleanReference);
  if (!normalizedReference) return null;
  return uniqueMatch(
    stores.filter(
      (store) => normalizeStoreName(store.name) === normalizedReference,
    ),
    "name",
  );
}
