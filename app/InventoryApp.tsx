"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import {
  mapInventoryCsv,
  mapStoresCsv,
  type CsvRecord,
  type InventoryCondition as Condition,
  type InventoryItemKind as ItemKind,
  type StoreCsvRecord,
} from "@/lib/inventory-csv";
import {
  deviceModelCatalogKey,
  deviceModelImageUrl,
} from "@/lib/device-models";

type View = "inventory" | "devices" | "stores" | "import";
type Role = "admin" | "operator" | "viewer";

type Equipment = {
  id: number;
  barcode: string;
  model: string;
  deviceType: string;
  itemKind: ItemKind;
  quantity: number;
  receivedAt: string;
  delivered: boolean;
  condition: Condition;
  storeId: number | null;
  storeNumber: string | null;
  storeName: string | null;
  storeReference: string | null;
  deliveredAt: string | null;
  isNetworkDevice: boolean;
  macAddress: string | null;
  ipAddress: string | null;
  notes: string | null;
  hasCredential: boolean;
  createdAt: string;
  updatedAt: string;
};

type Store = {
  id: number;
  storeNumber: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

type DeviceModelProfile = {
  id: number;
  catalogKey: string;
  deviceType: string;
  model: string;
  manufacturer: string | null;
  description: string | null;
  specifications: string | null;
  imageKey: string | null;
  imageContentType: string | null;
  createdAt: string;
  updatedAt: string;
};

type DeviceCatalogEntry = {
  catalogKey: string;
  deviceType: string;
  model: string;
  units: number;
  warehouse: number;
  delivered: number;
  working: number;
  notWorking: number;
  unknown: number;
  profile: DeviceModelProfile | null;
};

type CurrentUser = {
  id: string;
  email: string;
  displayName: string;
  role: Role;
};

type InventoryResponse = {
  currentUser: CurrentUser;
  equipment: Equipment[];
  stores: Store[];
  deviceModels: DeviceModelProfile[];
};

type EquipmentForm = {
  id?: number;
  barcode: string;
  model: string;
  deviceType: string;
  itemKind: ItemKind;
  quantity: number;
  receivedAt: string;
  delivered: boolean;
  condition: Condition;
  storeId: string;
  storeReference: string;
  deliveredAt: string;
  isNetworkDevice: boolean;
  macAddress: string;
  ipAddress: string;
  password: string;
  notes: string;
  hasCredential: boolean;
};

type DeviceModelForm = {
  catalogKey: string;
  deviceType: string;
  model: string;
  manufacturer: string;
  description: string;
  specifications: string;
  imageKey: string;
};

const today = () => new Date().toISOString().slice(0, 10);

function emptyEquipment(barcode = ""): EquipmentForm {
  return {
    barcode,
    model: "",
    deviceType: "",
    itemKind: "equipment",
    quantity: 1,
    receivedAt: today(),
    delivered: false,
    condition: "unknown",
    storeId: "",
    storeReference: "",
    deliveredAt: "",
    isNetworkDevice: false,
    macAddress: "",
    ipAddress: "",
    password: "",
    notes: "",
    hasCredential: false,
  };
}

const conditionLabels: Record<Condition, string> = {
  working: "Funciona",
  not_working: "No funciona",
  unknown: "Sin revisar",
};

type CameraScannerControls = {
  stop: () => void;
};

function formatDate(value: string | null): string {
  if (!value) return "—";
  const parsed = new Date(`${value.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("es-GT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parsed);
}

function normalized(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function csvCell(value: unknown): string {
  const text = String(value ?? "");
  const safeText = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safeText.replace(/"/g, '""')}"`;
}

function csvCondition(condition: Condition): string {
  if (condition === "working") return "SI";
  if (condition === "not_working") return "NO";
  return "";
}

function htmlText(value: unknown): string {
  return String(value ?? "—").replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character];
  });
}

class ApiError extends Error {
  code: string;
  status: number;

  constructor(message: string, code: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

async function postAction(body: Record<string, unknown>, writeToken = "") {
  const response = await fetch("/api/inventory", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(writeToken ? { authorization: `Bearer ${writeToken}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const payload = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    throw new ApiError(
      String(payload.error ?? "La operación falló."),
      String(payload.code ?? ""),
      response.status,
    );
  }
  return payload;
}

export function InventoryApp() {
  const [data, setData] = useState<InventoryResponse | null>(null);
  const [view, setView] = useState<View>("inventory");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [writeUnlocked, setWriteUnlocked] = useState(false);
  const [writeAccessExpiresAt, setWriteAccessExpiresAt] = useState(0);
  const [writeAccessDialogOpen, setWriteAccessDialogOpen] = useState(false);
  const [writePassword, setWritePassword] = useState("");
  const [writeAccessError, setWriteAccessError] = useState("");
  const [checkingWriteAccess, setCheckingWriteAccess] = useState(false);
  const [query, setQuery] = useState("");
  const [kindFilter, setKindFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [deliveryFilter, setDeliveryFilter] = useState("");
  const [conditionFilter, setConditionFilter] = useState("");
  const [deviceQuery, setDeviceQuery] = useState("");
  const [editing, setEditing] = useState<EquipmentForm | null>(null);
  const [editingDevice, setEditingDevice] = useState<DeviceModelForm | null>(null);
  const [editingStore, setEditingStore] = useState<Store | null>(null);
  const [deviceImageFile, setDeviceImageFile] = useState<File | null>(null);
  const [deviceImagePreview, setDeviceImagePreview] = useState("");
  const [removeDeviceImage, setRemoveDeviceImage] = useState(false);
  const [saving, setSaving] = useState(false);
  const [revealedPassword, setRevealedPassword] = useState("");
  const [storeForm, setStoreForm] = useState({ storeNumber: "", name: "" });
  const [storeCsvRecords, setStoreCsvRecords] = useState<StoreCsvRecord[]>([]);
  const [storeCsvName, setStoreCsvName] = useState("");
  const [storeCsvDragging, setStoreCsvDragging] = useState(false);
  const [csvRecords, setCsvRecords] = useState<CsvRecord[]>([]);
  const [csvName, setCsvName] = useState("");
  const [dragging, setDragging] = useState(false);
  const [cameraScannerOpen, setCameraScannerOpen] = useState(false);
  const [cameraScannerStatus, setCameraScannerStatus] = useState("");
  const [cameraScannerError, setCameraScannerError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const storeFileInput = useRef<HTMLInputElement>(null);
  const barcodeInput = useRef<HTMLInputElement>(null);
  const cameraVideo = useRef<HTMLVideoElement>(null);
  const cameraScannerControls = useRef<CameraScannerControls | null>(null);
  const deviceImageObjectUrl = useRef("");
  const writeToken = useRef("");
  const writeTokenExpiresAt = useRef(0);
  const writeAccessResolver = useRef<((token: string | null) => void) | null>(null);
  const writePasswordInput = useRef<HTMLInputElement>(null);

  const loadInventory = useCallback(async () => {
    setError("");
    try {
      const response = await fetch("/api/inventory", { cache: "no-store" });
      const payload = (await response.json()) as InventoryResponse & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "No se pudo abrir el inventario.");
      setData(payload);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se pudo abrir el inventario.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const task = window.setTimeout(() => void loadInventory(), 0);
    return () => window.clearTimeout(task);
  }, [loadInventory]);

  useEffect(() => {
    if (!writeAccessExpiresAt) return;
    const remaining = Math.max(0, writeAccessExpiresAt - Date.now());
    const timer = window.setTimeout(() => {
      writeToken.current = "";
      writeTokenExpiresAt.current = 0;
      setWriteUnlocked(false);
      setWriteAccessExpiresAt(0);
      setNotice("El permiso de edición terminó. La clave se solicitará al guardar de nuevo.");
    }, remaining);
    return () => window.clearTimeout(timer);
  }, [writeAccessExpiresAt]);

  useEffect(() => {
    if (!writeAccessDialogOpen) return;
    const frame = window.requestAnimationFrame(() => {
      writePasswordInput.current?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [writeAccessDialogOpen]);

  // Everyone can prepare forms; the server requires a temporary token to save.
  const writable = Boolean(data);
  const deviceTypes = useMemo(
    () =>
      Array.from(new Set((data?.equipment ?? []).map((item) => item.deviceType))).sort(
        (a, b) => a.localeCompare(b, "es"),
      ),
    [data?.equipment],
  );

  const filteredEquipment = useMemo(() => {
    const search = normalized(query);
    return (data?.equipment ?? []).filter((item) => {
      const matchesSearch =
        !search ||
        [
          item.barcode,
          item.model,
          item.deviceType,
          item.macAddress,
          item.ipAddress,
          item.storeNumber,
          item.storeName,
          item.storeReference,
        ].some((value) => normalized(value).includes(search));
      const matchesKind = !kindFilter || item.itemKind === kindFilter;
      const matchesType = !typeFilter || item.deviceType === typeFilter;
      const matchesDelivery =
        !deliveryFilter ||
        (deliveryFilter === "delivered" ? item.delivered : !item.delivered);
      const matchesCondition = !conditionFilter || item.condition === conditionFilter;
      return matchesSearch && matchesKind && matchesType && matchesDelivery && matchesCondition;
    });
  }, [conditionFilter, data?.equipment, deliveryFilter, kindFilter, query, typeFilter]);

  const stats = useMemo(() => {
    const items = data?.equipment ?? [];
    return {
      total: items.reduce((total, item) => total + item.quantity, 0),
      warehouse: items.filter((item) => !item.delivered).reduce((total, item) => total + item.quantity, 0),
      delivered: items.filter((item) => item.delivered).reduce((total, item) => total + item.quantity, 0),
      failing: items.filter((item) => item.condition === "not_working").length,
    };
  }, [data?.equipment]);

  const deviceCatalogGroups = useMemo(() => {
    const profiles = new Map(
      (data?.deviceModels ?? []).map((profile) => [profile.catalogKey, profile]),
    );
    const entries = new Map<string, DeviceCatalogEntry>();

    for (const item of data?.equipment ?? []) {
      if (item.itemKind !== "equipment") continue;
      const catalogKey = deviceModelCatalogKey(item.deviceType, item.model);
      const current = entries.get(catalogKey) ?? {
        catalogKey,
        deviceType: item.deviceType,
        model: item.model,
        units: 0,
        warehouse: 0,
        delivered: 0,
        working: 0,
        notWorking: 0,
        unknown: 0,
        profile: profiles.get(catalogKey) ?? null,
      };
      current.units += item.quantity;
      if (item.delivered) current.delivered += item.quantity;
      else current.warehouse += item.quantity;
      if (item.condition === "working") current.working += item.quantity;
      else if (item.condition === "not_working") current.notWorking += item.quantity;
      else current.unknown += item.quantity;
      entries.set(catalogKey, current);
    }

    const search = normalized(deviceQuery);
    const groups = new Map<string, DeviceCatalogEntry[]>();
    for (const entry of entries.values()) {
      const searchable = normalized([
        entry.deviceType,
        entry.model,
        entry.profile?.manufacturer,
        entry.profile?.description,
        entry.profile?.specifications,
      ].join(" "));
      if (search && !searchable.includes(search)) continue;
      const group = groups.get(entry.deviceType) ?? [];
      group.push(entry);
      groups.set(entry.deviceType, group);
    }

    return Array.from(groups, ([deviceType, models]) => ({
      deviceType,
      models: models.sort((a, b) => a.model.localeCompare(b.model, "es")),
    })).sort((a, b) => a.deviceType.localeCompare(b.deviceType, "es"));
  }, [data?.deviceModels, data?.equipment, deviceQuery]);

  const csvSummary = useMemo(
    () => ({
      needsSerialReview: csvRecords.filter((record) => record.barcode.includes("-PENDIENTE-")).length,
      materialUnits: csvRecords
        .filter((record) => record.itemKind === "material")
        .reduce((total, record) => total + record.quantity, 0),
      withoutDate: csvRecords.filter((record) => !record.receivedAt).length,
      withoutStore: csvRecords.filter(
        (record) => !record.storeNumber && !record.storeName && !record.storeReference,
      ).length,
    }),
    [csvRecords],
  );

  const storeCsvSummary = useMemo(() => {
    const existingStoreNumbers = new Set(
      (data?.stores ?? []).map((store) => store.storeNumber.trim()),
    );
    const validRecords = storeCsvRecords.filter(
      (record) => record.storeNumber.trim() && record.name.trim(),
    );

    return {
      total: storeCsvRecords.length,
      newStores: validRecords.filter(
        (record) => !existingStoreNumbers.has(record.storeNumber.trim()),
      ).length,
      existingStores: validRecords.filter((record) =>
        existingStoreNumbers.has(record.storeNumber.trim()),
      ).length,
      invalid: storeCsvRecords.length - validRecords.length,
    };
  }, [data?.stores, storeCsvRecords]);

  const clearWriteAccess = useCallback((showNotice = false) => {
    writeToken.current = "";
    writeTokenExpiresAt.current = 0;
    setWriteUnlocked(false);
    setWriteAccessExpiresAt(0);
    if (showNotice) {
      setNotice("La edición quedó bloqueada. La clave se solicitará al guardar.");
    }
  }, []);

  const requestWriteAccess = useCallback((): Promise<string | null> => {
    if (writeToken.current && writeTokenExpiresAt.current > Date.now()) {
      return Promise.resolve(writeToken.current);
    }
    writeToken.current = "";
    writeTokenExpiresAt.current = 0;
    setWriteUnlocked(false);
    setWriteAccessExpiresAt(0);
    setWritePassword("");
    setWriteAccessError("");
    setWriteAccessDialogOpen(true);
    return new Promise((resolve) => {
      writeAccessResolver.current = resolve;
    });
  }, []);

  const cancelWriteAccess = () => {
    writeAccessResolver.current?.(null);
    writeAccessResolver.current = null;
    setWriteAccessDialogOpen(false);
    setWritePassword("");
    setWriteAccessError("");
  };

  const submitWritePassword = async (event: FormEvent) => {
    event.preventDefault();
    setCheckingWriteAccess(true);
    setWriteAccessError("");
    try {
      const response = await fetch("/api/write-access", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password: writePassword }),
      });
      const payload = (await response.json()) as {
        token?: string;
        expiresAt?: number;
        expiresInMinutes?: number;
        error?: string;
      };
      if (!response.ok || !payload.token || !payload.expiresAt) {
        throw new Error(payload.error ?? "No se pudo habilitar la edición.");
      }

      writeToken.current = payload.token;
      writeTokenExpiresAt.current = payload.expiresAt;
      setWriteUnlocked(true);
      setWriteAccessExpiresAt(payload.expiresAt);
      setWriteAccessDialogOpen(false);
      setWritePassword("");
      setNotice(
        `Edición habilitada por ${payload.expiresInMinutes ?? 30} minutos o hasta recargar la página.`,
      );
      writeAccessResolver.current?.(payload.token);
      writeAccessResolver.current = null;
    } catch (accessError) {
      setWriteAccessError(
        accessError instanceof Error
          ? accessError.message
          : "No se pudo habilitar la edición.",
      );
    } finally {
      setCheckingWriteAccess(false);
    }
  };

  const writeErrorMessage = (writeError: unknown, fallback: string): string => {
    if (
      writeError instanceof ApiError &&
      ["WRITE_ACCESS_REQUIRED", "WRITE_ACCESS_NOT_CONFIGURED"].includes(
        writeError.code,
      )
    ) {
      clearWriteAccess();
    }
    return writeError instanceof Error ? writeError.message : fallback;
  };

  const openEquipment = useCallback((item?: Equipment, barcode = "") => {
    setError("");
    setNotice("");
    setRevealedPassword("");
    if (!item) {
      setEditing(emptyEquipment(barcode));
      return;
    }
    setEditing({
      id: item.id,
      barcode: item.barcode,
      model: item.model,
      deviceType: item.deviceType,
      itemKind: item.itemKind,
      quantity: item.quantity,
      receivedAt: item.receivedAt.slice(0, 10),
      delivered: item.delivered,
      condition: item.condition,
      storeId: item.storeId ? String(item.storeId) : "",
      storeReference: item.storeReference ?? "",
      deliveredAt: item.deliveredAt?.slice(0, 10) ?? "",
      isNetworkDevice: item.isNetworkDevice,
      macAddress: item.macAddress ?? "",
      ipAddress: item.ipAddress ?? "",
      password: "",
      notes: item.notes ?? "",
      hasCredential: item.hasCredential,
    });
  }, []);

  const openDeviceProfile = (entry: DeviceCatalogEntry) => {
    setError("");
    setNotice("");
    if (deviceImageObjectUrl.current) {
      URL.revokeObjectURL(deviceImageObjectUrl.current);
      deviceImageObjectUrl.current = "";
    }
    setDeviceImageFile(null);
    setRemoveDeviceImage(false);
    setDeviceImagePreview(
      entry.profile?.imageKey
        ? deviceModelImageUrl(entry.profile.imageKey)
        : "",
    );
    setEditingDevice({
      catalogKey: entry.catalogKey,
      deviceType: entry.deviceType,
      model: entry.model,
      manufacturer: entry.profile?.manufacturer ?? "",
      description: entry.profile?.description ?? "",
      specifications: entry.profile?.specifications ?? "",
      imageKey: entry.profile?.imageKey ?? "",
    });
  };

  const closeDeviceProfile = () => {
    if (deviceImageObjectUrl.current) {
      URL.revokeObjectURL(deviceImageObjectUrl.current);
      deviceImageObjectUrl.current = "";
    }
    setEditingDevice(null);
    setDeviceImageFile(null);
    setDeviceImagePreview("");
    setRemoveDeviceImage(false);
  };

  const stopCameraScanner = useCallback(() => {
    cameraScannerControls.current?.stop();
    cameraScannerControls.current = null;
    const video = cameraVideo.current;
    const stream = video?.srcObject as MediaStream | null;
    stream?.getTracks().forEach((track) => track.stop());
    if (video) video.srcObject = null;
  }, []);

  const closeCameraScanner = useCallback(() => {
    stopCameraScanner();
    setCameraScannerOpen(false);
  }, [stopCameraScanner]);

  const processCameraBarcode = useCallback(
    (value: string) => {
      const barcode = value.trim();
      if (!barcode) return;
      stopCameraScanner();
      setCameraScannerOpen(false);
      setQuery(barcode);
      const match = data?.equipment.find(
        (item) => item.barcode.toLowerCase() === barcode.toLowerCase(),
      );
      if (match) {
        openEquipment(match);
        setNotice("Código detectado. Se abrió la ficha del artículo.");
      } else if (writable) {
        openEquipment(undefined, barcode);
        setNotice("Código detectado. Completa los datos del nuevo artículo.");
      } else {
        setNotice("Código detectado, pero tu permiso es solo de consulta.");
      }
    },
    [data?.equipment, openEquipment, stopCameraScanner, writable],
  );

  useEffect(() => {
    if (!cameraScannerOpen) return;
    let cancelled = false;
    let detected = false;
    let controls: CameraScannerControls | null = null;

    const startCameraScanner = async () => {
      if (!navigator.mediaDevices?.getUserMedia || !cameraVideo.current) {
        setCameraScannerError("Este navegador no permite usar la cámara. Prueba con Chrome, Safari o el lector USB.");
        return;
      }
      setCameraScannerStatus("Solicitando acceso a la cámara…");
      setCameraScannerError("");
      try {
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        if (cancelled || !cameraVideo.current) return;
        const reader = new BrowserMultiFormatReader(undefined, {
          delayBetweenScanAttempts: 120,
          delayBetweenScanSuccess: 900,
        });
        controls = await reader.decodeFromConstraints(
          {
            audio: false,
            video: {
              facingMode: { ideal: "environment" },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
          },
          cameraVideo.current,
          (result) => {
            if (!result || detected) return;
            detected = true;
            processCameraBarcode(result.getText());
          },
        );
        if (cancelled || detected) {
          controls.stop();
          return;
        }
        cameraScannerControls.current = controls;
        setCameraScannerStatus("Apunta la cámara al código de barras.");
      } catch (cameraError) {
        if (cancelled) return;
        const name = cameraError instanceof DOMException ? cameraError.name : "";
        setCameraScannerStatus("");
        setCameraScannerError(
          name === "NotAllowedError"
            ? "No se autorizó la cámara. Permite su uso desde el navegador e inténtalo de nuevo."
            : "No se pudo abrir la cámara. Comprueba el permiso y prueba con la cámara trasera.",
        );
      }
    };

    const startTimer = window.setTimeout(() => void startCameraScanner(), 0);
    return () => {
      cancelled = true;
      window.clearTimeout(startTimer);
      controls?.stop();
      stopCameraScanner();
    };
  }, [cameraScannerOpen, processCameraBarcode, stopCameraScanner]);

  const scanBarcode = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const barcode = event.currentTarget.value.trim();
    if (!barcode) return;
    const match = data?.equipment.find(
      (item) => item.barcode.toLowerCase() === barcode.toLowerCase(),
    );
    if (match) openEquipment(match);
    else if (writable) openEquipment(undefined, barcode);
  };

  const submitEquipment = async (event: FormEvent) => {
    event.preventDefault();
    if (!editing) return;
    const accessToken = await requestWriteAccess();
    if (!accessToken) return;
    const isNewEquipment = !editing.id;
    setSaving(true);
    setError("");
    try {
      await postAction({
        action: "saveEquipment",
        equipment: {
          ...editing,
          storeId: editing.storeId ? Number(editing.storeId) : null,
        },
      }, accessToken);
      setNotice(
        isNewEquipment
          ? "Artículo registrado. Escanea el siguiente No. de Serie para continuar con los mismos datos."
          : "Artículo actualizado correctamente.",
      );
      await loadInventory();
      if (isNewEquipment) {
        window.requestAnimationFrame(() => {
          barcodeInput.current?.focus();
          barcodeInput.current?.select();
        });
      }
    } catch (saveError) {
      setError(writeErrorMessage(saveError, "No se pudo guardar."));
    } finally {
      setSaving(false);
    }
  };

  const revealCredential = async () => {
    if (!editing?.id) return;
    const accessToken = await requestWriteAccess();
    if (!accessToken) return;
    setSaving(true);
    try {
      const result = await postAction({
        action: "revealCredential",
        equipmentId: editing.id,
      }, accessToken);
      setRevealedPassword(String(result.password ?? "Sin contraseña guardada"));
    } catch (revealError) {
      setError(writeErrorMessage(revealError, "No se pudo mostrar."));
    } finally {
      setSaving(false);
    }
  };

  const deleteEquipment = async () => {
    if (!editing?.id) return;
    const articleName = editing.model || editing.barcode;
    const confirmed = window.confirm(
      `¿Eliminar “${articleName}” (${editing.barcode})? Esta acción no se puede deshacer y también eliminará su historial de movimientos.`,
    );
    if (!confirmed) return;

    const accessToken = await requestWriteAccess();
    if (!accessToken) return;

    setSaving(true);
    setError("");
    try {
      await postAction(
        { action: "deleteEquipment", equipmentId: editing.id },
        accessToken,
      );
      setEditing(null);
      setNotice("Artículo eliminado correctamente.");
      await loadInventory();
    } catch (deleteError) {
      setError(
        writeErrorMessage(deleteError, "No se pudo eliminar el artículo."),
      );
    } finally {
      setSaving(false);
    }
  };

  const selectDeviceImage = (event: ChangeEvent<HTMLInputElement>) => {
    const image = event.target.files?.[0];
    if (!image) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(image.type)) {
      setError("La imagen debe ser JPG, PNG o WebP.");
      event.target.value = "";
      return;
    }
    if (image.size > 5 * 1024 * 1024) {
      setError("La imagen no puede superar 5 MB.");
      event.target.value = "";
      return;
    }
    setError("");
    setRemoveDeviceImage(false);
    setDeviceImageFile(image);
    if (deviceImageObjectUrl.current) {
      URL.revokeObjectURL(deviceImageObjectUrl.current);
    }
    deviceImageObjectUrl.current = URL.createObjectURL(image);
    setDeviceImagePreview(deviceImageObjectUrl.current);
    event.target.value = "";
  };

  const submitDeviceProfile = async (event: FormEvent) => {
    event.preventDefault();
    if (!editingDevice) return;
    const accessToken = await requestWriteAccess();
    if (!accessToken) return;

    setSaving(true);
    setError("");
    try {
      const formData = new FormData();
      formData.set("deviceType", editingDevice.deviceType);
      formData.set("model", editingDevice.model);
      formData.set("manufacturer", editingDevice.manufacturer);
      formData.set("description", editingDevice.description);
      formData.set("specifications", editingDevice.specifications);
      formData.set("removeImage", String(removeDeviceImage));
      if (deviceImageFile) formData.set("image", deviceImageFile);

      const response = await fetch("/api/device-models", {
        method: "POST",
        headers: { authorization: `Bearer ${accessToken}` },
        body: formData,
      });
      const payload = (await response.json()) as { error?: string; code?: string };
      if (!response.ok) {
        throw new ApiError(
          payload.error ?? "No se pudo guardar la ficha del dispositivo.",
          payload.code ?? "",
          response.status,
        );
      }

      closeDeviceProfile();
      setNotice(`Ficha de ${editingDevice.model} actualizada correctamente.`);
      await loadInventory();
    } catch (saveError) {
      setError(
        writeErrorMessage(
          saveError,
          "No se pudo guardar la ficha del dispositivo.",
        ),
      );
    } finally {
      setSaving(false);
    }
  };

  const saveStore = async (event: FormEvent) => {
    event.preventDefault();
    const accessToken = await requestWriteAccess();
    if (!accessToken) return;
    setSaving(true);
    setError("");
    try {
      const result = await postAction(
        { action: "saveStore", store: storeForm },
        accessToken,
      );
      const linked = Number(result.linkedEquipmentCount ?? 0);
      setStoreForm({ storeNumber: "", name: "" });
      setNotice(
        `Tienda guardada correctamente.${linked ? ` Se relacionaron ${linked} artículos pendientes.` : ""}`,
      );
      await loadInventory();
    } catch (storeError) {
      setError(writeErrorMessage(storeError, "No se pudo guardar la tienda."));
    } finally {
      setSaving(false);
    }
  };

  const updateStore = async (event: FormEvent) => {
    event.preventDefault();
    if (!editingStore) return;
    const accessToken = await requestWriteAccess();
    if (!accessToken) return;
    setSaving(true);
    setError("");
    try {
      const result = await postAction(
        {
          action: "saveStore",
          store: {
            id: editingStore.id,
            storeNumber: editingStore.storeNumber,
            name: editingStore.name,
          },
        },
        accessToken,
      );
      const linked = Number(result.linkedEquipmentCount ?? 0);
      setEditingStore(null);
      setNotice(
        `Tienda actualizada correctamente.${linked ? ` Se relacionaron ${linked} artículos pendientes.` : ""}`,
      );
      await loadInventory();
    } catch (storeError) {
      setError(writeErrorMessage(storeError, "No se pudo actualizar la tienda."));
    } finally {
      setSaving(false);
    }
  };

  const readStoreCsvFile = async (file?: File) => {
    if (!file) return;
    setError("");
    setNotice("");
    try {
      const records = mapStoresCsv(await file.text());
      if (!records.length) {
        throw new Error(
          "No se encontraron las columnas No. de Tienda y Nombre de tienda.",
        );
      }
      setStoreCsvName(file.name);
      setStoreCsvRecords(records);
    } catch (fileError) {
      setStoreCsvName("");
      setStoreCsvRecords([]);
      setError(
        fileError instanceof Error
          ? fileError.message
          : "No se pudo leer el listado de tiendas.",
      );
    }
  };

  const importStores = async () => {
    const accessToken = await requestWriteAccess();
    if (!accessToken) return;
    setSaving(true);
    setError("");
    try {
      const result = await postAction({
        action: "importStores",
        storeRecords: storeCsvRecords,
      }, accessToken);
      const created = Number(result.createdCount ?? 0);
      const updated = Number(result.updatedCount ?? 0);
      const unchanged = Number(result.unchangedCount ?? 0);
      const skipped = Number(result.skippedCount ?? 0);
      const linked = Number(result.linkedEquipmentCount ?? 0);
      const unresolved = Number(result.unresolvedReferenceCount ?? 0);
      const errors = Array.isArray(result.errors) ? result.errors.map(String) : [];
      setNotice(
        `Listado procesado: ${created} tiendas nuevas, ${updated} actualizadas, ${unchanged} sin cambios y ${skipped} omitidas. ${linked} artículos relacionados con su tienda${unresolved ? ` y ${unresolved} referencias pendientes de revisión` : ""}.${errors.length ? ` ${errors.slice(0, 3).join(" · ")}` : ""}`,
      );
      setStoreCsvRecords([]);
      setStoreCsvName("");
      if (storeFileInput.current) storeFileInput.current.value = "";
      await loadInventory();
    } catch (importError) {
      setError(
        writeErrorMessage(
          importError,
          "No se pudo importar el listado de tiendas.",
        ),
      );
    } finally {
      setSaving(false);
    }
  };

  const readCsvFile = async (file?: File) => {
    if (!file) return;
    setError("");
    setNotice("");
    try {
      const records = mapInventoryCsv(await file.text());
      if (!records.length) throw new Error("No se encontraron filas válidas en el archivo.");
      setCsvName(file.name);
      setCsvRecords(records);
    } catch (fileError) {
      setCsvName("");
      setCsvRecords([]);
      setError(fileError instanceof Error ? fileError.message : "No se pudo leer el CSV.");
    }
  };

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    void readCsvFile(event.target.files?.[0]);
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    void readCsvFile(event.dataTransfer.files?.[0]);
  };

  const importCsv = async () => {
    const accessToken = await requestWriteAccess();
    if (!accessToken) return;
    setSaving(true);
    setError("");
    try {
      const result = await postAction(
        { action: "importCsv", records: csvRecords },
        accessToken,
      );
      const created = Number(result.createdCount ?? 0);
      const updated = Number(result.updatedCount ?? 0);
      const skipped = Number(result.skippedCount ?? 0);
      const errors = Array.isArray(result.errors) ? result.errors.map(String) : [];
      setNotice(
        `Importación terminada: ${created} nuevos, ${updated} actualizados y ${skipped} omitidos.${errors.length ? ` ${errors.slice(0, 3).join(" · ")}` : ""}`,
      );
      setCsvRecords([]);
      setCsvName("");
      await loadInventory();
    } catch (importError) {
      setError(writeErrorMessage(importError, "No se pudo importar el archivo."));
    } finally {
      setSaving(false);
    }
  };

  const exportCsv = () => {
    if (!filteredEquipment.length) {
      setError("No hay registros para exportar con los filtros actuales.");
      return;
    }
    setError("");
    const headers = [
      "No. de Serie",
      "Modelo",
      "Tipo de dispositivo",
      "Clase de articulo",
      "Cantidad",
      "Fecha de ingreso",
      "Entregado",
      "Funciona",
      "No. Tienda",
      "Nombre de tienda",
      "Sala",
      "Fecha de entrega",
      "Dispositivo de red",
      "MAC Address",
      "IP",
      "Notas",
    ];
    const rows = filteredEquipment.map((item) => [
      item.barcode,
      item.model,
      item.deviceType,
      item.itemKind === "material" ? "Material" : "Equipo",
      item.quantity,
      item.receivedAt,
      item.delivered ? "SI" : "NO",
      csvCondition(item.condition),
      item.storeNumber,
      item.storeName,
      item.storeReference,
      item.deliveredAt,
      item.isNetworkDevice ? "SI" : "NO",
      item.macAddress,
      item.ipAddress,
      item.notes,
    ]);
    const csv = `\uFEFF${[headers, ...rows].map((row) => row.map(csvCell).join(";")).join("\r\n")}`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `inventario-dollar-${today()}.csv`;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    setNotice(`CSV descargado con ${filteredEquipment.length} registros. Las contraseñas no se incluyen.`);
  };

  const generateReport = () => {
    if (!filteredEquipment.length) {
      setError("No hay registros para generar un reporte con los filtros actuales.");
      return;
    }
    const reportWindow = window.open("", "_blank", "width=1180,height=820");
    if (!reportWindow) {
      setError("El navegador bloqueó la ventana del reporte. Permite ventanas emergentes e inténtalo de nuevo.");
      return;
    }
    reportWindow.opener = null;
    const totalUnits = filteredEquipment.reduce((total, item) => total + item.quantity, 0);
    const warehouseUnits = filteredEquipment
      .filter((item) => !item.delivered)
      .reduce((total, item) => total + item.quantity, 0);
    const deliveredUnits = filteredEquipment
      .filter((item) => item.delivered)
      .reduce((total, item) => total + item.quantity, 0);
    const reportRows = filteredEquipment
      .map((item) => {
        const location = item.storeId
          ? `${item.storeNumber ?? ""} · ${item.storeName ?? ""}`
          : item.storeReference || "Sin tienda asignada";
        return `<tr><td>${htmlText(item.barcode)}</td><td><strong>${htmlText(item.model)}</strong><br><small>${htmlText(item.deviceType)}</small></td><td>${item.quantity.toLocaleString("es-GT")}</td><td>${htmlText(location)}</td><td>${item.delivered ? "Entregado" : "En bodega"}</td><td>${htmlText(conditionLabels[item.condition])}</td><td>${htmlText(formatDate(item.receivedAt))}</td></tr>`;
      })
      .join("");
    const generatedAt = new Intl.DateTimeFormat("es-GT", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date());
    reportWindow.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Reporte de inventario Dollar</title><style>@page{margin:16mm}*{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;color:#12211b;margin:0}h1{margin:0;font-size:25px}p{color:#65736c;margin:7px 0 0}.summary{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:24px 0}.metric{border:1px solid #dfe2dc;border-radius:10px;padding:12px}.metric strong{display:block;font-size:22px;margin-top:5px}table{width:100%;border-collapse:collapse;font-size:11px}th{background:#e4f2eb;text-align:left;padding:9px}td{padding:9px;border-top:1px solid #dfe2dc;vertical-align:top}small{color:#65736c}@media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}}</style></head><body><h1>Reporte de inventario · Dollar</h1><p>Generado: ${htmlText(generatedAt)} · ${filteredEquipment.length} registros según los filtros actuales.</p><section class="summary"><div class="metric">Unidades registradas<strong>${totalUnits.toLocaleString("es-GT")}</strong></div><div class="metric">En bodega<strong>${warehouseUnits.toLocaleString("es-GT")}</strong></div><div class="metric">Entregadas<strong>${deliveredUnits.toLocaleString("es-GT")}</strong></div><div class="metric">No funcionan<strong>${filteredEquipment.filter((item) => item.condition === "not_working").length}</strong></div></section><table><thead><tr><th>No. de Serie / Código</th><th>Artículo</th><th>Cantidad</th><th>Ubicación</th><th>Entrega</th><th>Condición</th><th>Ingreso</th></tr></thead><tbody>${reportRows}</tbody></table></body></html>`);
    reportWindow.document.close();
    reportWindow.focus();
    window.setTimeout(() => reportWindow.print(), 250);
    setNotice("Reporte generado. Usa Imprimir o Guardar como PDF en la nueva ventana.");
  };

  if (loading) {
    return (
      <main className="loading-screen" aria-live="polite">
        <div className="loading-card">
          <div className="loading-pulse" />
          <h1>Preparando la bodega</h1>
          <p className="page-description">Cargando equipos y tiendas…</p>
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="auth-screen">
        <div className="auth-card">
          <div className="brand-mark" style={{ margin: "0 auto 18px" }}>D</div>
          <h1>Inventario protegido</h1>
          <p className="page-description">{error || "Inicia sesión para continuar."}</p>
          <a className="primary-button" href="/cdn-cgi/access/logout" style={{ display: "inline-flex", marginTop: 20, textDecoration: "none" }}>
            Cambiar de correo
          </a>
        </div>
      </main>
    );
  }

  const pageCopy: Record<View, { eyebrow: string; title: string; description: string }> = {
    inventory: {
      eyebrow: "Control de activos",
      title: "Cada artículo, ubicado y listo.",
      description: "Escanea equipos y controla materiales por cantidad desde su ingreso a la bodega hasta cada tienda.",
    },
    devices: {
      eyebrow: "Catálogo de modelos",
      title: "Conoce cada dispositivo.",
      description: "Consulta los modelos registrados, sus existencias y la información técnica que utiliza el equipo de bodega.",
    },
    stores: {
      eyebrow: "Directorio operativo",
      title: "Tiendas y asignaciones.",
      description: "Mantén un catálogo único para evitar nombres duplicados durante las entregas y las importaciones.",
    },
    import: {
      eyebrow: "Carga inicial",
      title: "Del Excel al inventario.",
      description: "Importa un CSV, revisa una muestra y actualiza registros existentes usando el No. de Serie o código de material.",
    },
  };

  const navItems: Array<{ id: View; label: string }> = [
    { id: "inventory", label: "Inventario" },
    { id: "devices", label: "Dispositivos" },
    { id: "stores", label: "Tiendas" },
    { id: "import", label: "Importar CSV" },
  ];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">D</div>
          <div className="brand-copy">
            <div className="brand-name">Inventario Dollar</div>
            <div className="brand-subtitle">Bodega de equipos</div>
          </div>
        </div>
        <nav className="nav-list" aria-label="Navegación principal">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`nav-button ${view === item.id ? "active" : ""}`}
              aria-label={item.label}
              title={item.label}
              onClick={() => {
                setView(item.id);
                setError("");
                setNotice("");
              }}
            >
              <span className={`nav-icon nav-icon-${item.id}`} aria-hidden="true">
                <span className="nav-glyph" />
              </span>
              <span className="nav-label">{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-user">
          <div className="sidebar-user-name">{writeUnlocked ? "Edición habilitada" : "Consulta pública"}</div>
          <div className="sidebar-user-role">{writeUnlocked ? "Permiso temporal" : "Solo lectura"}</div>
        </div>
      </aside>

      <main className="main-content">
        <div className="content-wrap">
          <header className="page-header">
            <div>
              <p className="eyebrow">{pageCopy[view].eyebrow}</p>
              <h1 className="page-title">{pageCopy[view].title}</h1>
              <p className="page-description">{pageCopy[view].description}</p>
            </div>
            <div className="page-header-actions">
              {writeUnlocked ? (
                <button className="secondary-button write-access-button unlocked" type="button" onClick={() => clearWriteAccess(true)}>
                  Edición activa · Bloquear
                </button>
              ) : (
                <button className="secondary-button write-access-button" type="button" onClick={() => void requestWriteAccess()}>
                  Habilitar edición
                </button>
              )}
              {view === "inventory" && writable ? (
                <button className="primary-button" type="button" onClick={() => openEquipment()}>
                  + Registrar artículo
                </button>
              ) : null}
            </div>
          </header>

          {error ? <div className="error-banner" role="alert">{error}</div> : null}
          {notice ? <div className="success-banner" role="status">{notice}</div> : null}

          {view === "inventory" ? (
            <>
              <section className="scanner-card" aria-label="Lector de código de barras">
                <div>
                  <label className="scanner-label" htmlFor="barcode-scanner">Lector de código de barras</label>
                  <div className="scanner-input-wrap">
                    <span className="scanner-symbol" aria-hidden="true" />
                    <input
                      id="barcode-scanner"
                      className="scanner-input"
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      onKeyDown={scanBarcode}
                      placeholder="Escanea o escribe un código…"
                      autoComplete="off"
                    />
                    <span className="scanner-hint">Enter para abrir</span>
                  </div>
                </div>
                <div className="scanner-actions">
                  <button
                    className="camera-button"
                    type="button"
                    onClick={() => {
                      setCameraScannerError("");
                      setCameraScannerStatus("");
                      setCameraScannerOpen(true);
                    }}
                  >
                    <span className="camera-icon" aria-hidden="true" />
                    <span>Usar cámara</span>
                  </button>
                  <div className="scanner-copy">
                    <strong>USB o cámara del teléfono</strong>
                    <span>El equipo se abre automáticamente al recibir el código.</span>
                  </div>
                </div>
              </section>

              <section className="stats-grid" aria-label="Resumen del inventario">
                <Stat label="Unidades registradas" value={stats.total} foot="Equipos y materiales" />
                <Stat label="En bodega" value={stats.warehouse} foot="Unidades disponibles o pendientes" />
                <Stat label="Entregados" value={stats.delivered} foot="Unidades asignadas a tienda" />
                <Stat label="No funcionan" value={stats.failing} foot="Requieren seguimiento" />
              </section>

              <section className="panel">
                <div className="panel-header">
                  <div>
                    <h2 className="panel-title">Equipos y materiales</h2>
                    <div className="panel-meta">{filteredEquipment.length} resultados</div>
                  </div>
                  <div className="panel-actions">
                    <button
                      className="ghost-button action-icon-button"
                      type="button"
                      aria-label="Generar reporte"
                      data-tooltip="Generar reporte"
                      onClick={generateReport}
                    >
                      <span className="action-glyph action-glyph-report" aria-hidden="true" />
                    </button>
                    <button
                      className="ghost-button action-icon-button"
                      type="button"
                      aria-label="Exportar CSV"
                      data-tooltip="Exportar CSV"
                      onClick={exportCsv}
                    >
                      <span className="action-glyph action-glyph-export" aria-hidden="true" />
                    </button>
                    <button
                      className="ghost-button action-icon-button"
                      type="button"
                      aria-label="Actualizar"
                      data-tooltip="Actualizar"
                      onClick={() => void loadInventory()}
                    >
                      <span className="action-glyph action-glyph-refresh" aria-hidden="true" />
                    </button>
                  </div>
                </div>
                <div className="filters">
                  <input
                    className="input"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Buscar serie, modelo, MAC, IP o tienda"
                    aria-label="Buscar artículos"
                  />
                  <select className="select" value={kindFilter} onChange={(event) => setKindFilter(event.target.value)} aria-label="Filtrar por clase de artículo">
                    <option value="">Equipos y materiales</option>
                    <option value="equipment">Solo equipos</option>
                    <option value="material">Solo materiales</option>
                  </select>
                  <select className="select" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} aria-label="Filtrar por tipo">
                    <option value="">Todos los tipos</option>
                    {deviceTypes.map((type) => <option key={type} value={type}>{type}</option>)}
                  </select>
                  <select className="select" value={deliveryFilter} onChange={(event) => setDeliveryFilter(event.target.value)} aria-label="Filtrar por entrega">
                    <option value="">Cualquier ubicación</option>
                    <option value="warehouse">En bodega</option>
                    <option value="delivered">Entregados</option>
                  </select>
                  <select className="select" value={conditionFilter} onChange={(event) => setConditionFilter(event.target.value)} aria-label="Filtrar por funcionamiento">
                    <option value="">Cualquier condición</option>
                    <option value="working">Funciona</option>
                    <option value="not_working">No funciona</option>
                    <option value="unknown">Sin revisar</option>
                  </select>
                </div>
                {filteredEquipment.length ? (
                  <div className="table-wrap">
                    <table className="data-table">
                      <thead><tr><th>No. de Serie / Código</th><th>Artículo</th><th>Cantidad</th><th>Red</th><th>Ubicación</th><th>Condición</th><th>Ingreso</th><th /></tr></thead>
                      <tbody>
                        {filteredEquipment.map((item) => (
                          <tr key={item.id}>
                            <td><span className="barcode">{item.barcode}</span>{item.barcode.includes("-PENDIENTE-") ? <div className="muted serial-warning">Corregir serie</div> : null}</td>
                            <td><div className="device-name">{item.model}</div><div className="device-type">{item.deviceType}</div>{item.itemKind === "material" ? <span className="badge amber">Material</span> : null}</td>
                            <td>{item.quantity.toLocaleString("es-GT")}</td>
                            <td>
                              {item.isNetworkDevice ? (
                                <><div>{item.ipAddress || "Sin IP"}</div><div className="muted">{item.macAddress || "Sin MAC"}</div></>
                              ) : <span className="muted">No aplica</span>}
                            </td>
                            <td>
                              {item.delivered ? (
                                <span className="badge blue">Entregado</span>
                              ) : <span className="badge gray">En bodega</span>}
                              <div className="muted">{item.storeId ? `${item.storeNumber} · ${item.storeName}` : item.storeReference ? `Sala: ${item.storeReference}` : "Sin tienda asignada"}</div>
                            </td>
                            <td><ConditionBadge condition={item.condition} /></td>
                            <td>{formatDate(item.receivedAt)}</td>
                            <td><button className="secondary-button" type="button" onClick={() => openEquipment(item)}>{writable ? "Editar" : "Ver"}</button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <EmptyState
                    title={data.equipment.length ? "No hay coincidencias" : "La bodega está lista"}
                    text={data.equipment.length ? "Cambia los filtros o escanea otro código." : "Registra el primer artículo o importa el archivo CSV que ya utilizan."}
                    action={writable ? () => openEquipment() : undefined}
                  />
                )}
              </section>
            </>
          ) : null}

          {view === "devices" ? (
            <>
              <section className="panel device-catalog-toolbar">
                <div>
                  <h2 className="panel-title">Tipos y modelos</h2>
                  <div className="panel-meta">
                    {deviceCatalogGroups.reduce((total, group) => total + group.models.length, 0)} modelos visibles
                  </div>
                </div>
                <input
                  className="input device-search"
                  value={deviceQuery}
                  onChange={(event) => setDeviceQuery(event.target.value)}
                  placeholder="Buscar tipo, modelo, marca o característica"
                  aria-label="Buscar modelos de dispositivos"
                />
              </section>

              {deviceCatalogGroups.length ? (
                <div className="device-catalog-groups">
                  {deviceCatalogGroups.map((group) => (
                    <section className="device-type-section" key={group.deviceType}>
                      <div className="device-type-heading">
                        <div>
                          <p className="eyebrow">Tipo de dispositivo</p>
                          <h2>{group.deviceType}</h2>
                        </div>
                        <span>{group.models.length} {group.models.length === 1 ? "modelo" : "modelos"}</span>
                      </div>
                      <div className="device-model-grid">
                        {group.models.map((entry) => {
                          const profile = entry.profile;
                          const hasInformation = Boolean(
                            profile?.manufacturer || profile?.description || profile?.specifications,
                          );
                          return (
                            <article className="device-model-card" key={entry.catalogKey}>
                              <div className={`device-model-image ${profile?.imageKey ? "has-image" : ""}`}>
                                {profile?.imageKey ? (
                                  // R2 serves authenticated, user-uploaded images with dynamic URLs.
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={deviceModelImageUrl(profile.imageKey)}
                                    alt={`${entry.deviceType} modelo ${entry.model}`}
                                    loading="lazy"
                                  />
                                ) : (
                                  <div className="device-image-placeholder" aria-label="Sin imagen">
                                    <span aria-hidden="true">D</span>
                                    <small>Sin imagen</small>
                                  </div>
                                )}
                              </div>
                              <div className="device-model-content">
                                <div className="device-model-title-row">
                                  <div>
                                    <p className="device-model-kicker">Modelo</p>
                                    <h3>{entry.model}</h3>
                                  </div>
                                  <span className="device-unit-count">{entry.units} {entry.units === 1 ? "unidad" : "unidades"}</span>
                                </div>
                                {profile?.manufacturer ? (
                                  <p className="device-manufacturer">{profile.manufacturer}</p>
                                ) : null}
                                {profile?.description ? (
                                  <p className="device-description">{profile.description}</p>
                                ) : (
                                  <p className="device-description muted">Agrega una descripción e información de este modelo.</p>
                                )}
                                {profile?.specifications ? (
                                  <div className="device-specifications">
                                    <strong>Información técnica</strong>
                                    <p>{profile.specifications}</p>
                                  </div>
                                ) : null}
                                <div className="device-model-stats" aria-label="Resumen del modelo">
                                  <span><strong>{entry.warehouse}</strong> en bodega</span>
                                  <span><strong>{entry.delivered}</strong> entregados</span>
                                  <span className={entry.notWorking ? "has-warning" : ""}><strong>{entry.notWorking}</strong> no funcionan</span>
                                </div>
                                <button
                                  className={hasInformation || profile?.imageKey ? "secondary-button" : "primary-button"}
                                  type="button"
                                  onClick={() => openDeviceProfile(entry)}
                                >
                                  {writable ? "Editar ficha" : "Ver ficha"}
                                </button>
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    </section>
                  ))}
                </div>
              ) : (
                <section className="panel">
                  <EmptyState
                    title={data.equipment.some((item) => item.itemKind === "equipment") ? "No hay modelos que coincidan" : "Aún no hay dispositivos"}
                    text={data.equipment.some((item) => item.itemKind === "equipment") ? "Prueba con otro modelo, tipo o característica." : "Los modelos aparecerán aquí al registrar o importar el primer equipo."}
                  />
                </section>
              )}
            </>
          ) : null}

          {view === "stores" ? (
            <>
              {writable ? (
                <section className="store-tools-grid">
                  <div className="panel form-card">
                    <h2>Agregar una tienda</h2>
                    <p>Registra o corrige una tienda individual usando su número oficial.</p>
                    <form className="store-manual-form" onSubmit={saveStore}>
                      <div className="field"><label htmlFor="store-number">No. de tienda</label><input id="store-number" className="input" value={storeForm.storeNumber} onChange={(event) => setStoreForm({ ...storeForm, storeNumber: event.target.value })} required /></div>
                      <div className="field"><label htmlFor="store-name">Nombre de tienda</label><input id="store-name" className="input" value={storeForm.name} onChange={(event) => setStoreForm({ ...storeForm, name: event.target.value })} required /></div>
                      <button className="primary-button" type="submit" disabled={saving}>{saving ? "Guardando…" : "Guardar tienda"}</button>
                    </form>
                  </div>

                  <div className="panel form-card store-upload-card">
                    <div className="store-upload-heading">
                      <div>
                        <h2>Subir listado de tiendas</h2>
                        <p>Importa un CSV de Excel con las columnas No. de Tienda y Nombre de tienda.</p>
                      </div>
                      <a className="secondary-button template-link" href="/plantilla-tiendas.csv" download>Descargar plantilla</a>
                    </div>
                    <div
                      className={`import-dropzone store-dropzone ${storeCsvDragging ? "dragging" : ""}`}
                      onDragOver={(event) => { event.preventDefault(); setStoreCsvDragging(true); }}
                      onDragLeave={() => setStoreCsvDragging(false)}
                      onDrop={(event) => {
                        event.preventDefault();
                        setStoreCsvDragging(false);
                        void readStoreCsvFile(event.dataTransfer.files?.[0]);
                      }}
                    >
                      <div>
                        <div className="import-icon">T</div>
                        <h3>{storeCsvName || "Arrastra el listado aquí"}</h3>
                        <p className="page-description">{storeCsvRecords.length ? `${storeCsvRecords.length} tiendas detectadas` : "CSV separado por coma o punto y coma"}</p>
                        <input
                          ref={storeFileInput}
                          className="file-input"
                          type="file"
                          accept=".csv,text/csv"
                          onChange={(event) => void readStoreCsvFile(event.target.files?.[0])}
                        />
                        <button className="secondary-button" type="button" onClick={() => storeFileInput.current?.click()} style={{ marginTop: 14 }}>Elegir archivo</button>
                      </div>
                    </div>
                  </div>
                </section>
              ) : null}

              {storeCsvRecords.length ? (
                <section className="panel preview-card store-preview-card">
                  <div className="panel-header">
                    <div>
                      <h2 className="panel-title">Vista previa del listado</h2>
                      <div className="panel-meta">Primeras {Math.min(storeCsvRecords.length, 8)} de {storeCsvRecords.length} filas</div>
                    </div>
                    <button className="primary-button" type="button" onClick={() => void importStores()} disabled={saving || !writable}>{saving ? "Importando…" : "Importar tiendas"}</button>
                  </div>
                  <div className="import-summary" aria-label="Resumen del listado de tiendas">
                    <span><strong>{storeCsvSummary.total}</strong> filas detectadas</span>
                    <span><strong>{storeCsvSummary.newStores}</strong> tiendas nuevas</span>
                    <span><strong>{storeCsvSummary.existingStores}</strong> tiendas existentes</span>
                    <span><strong>{storeCsvSummary.invalid}</strong> filas incompletas</span>
                  </div>
                  <div className="table-wrap">
                    <table className="data-table store-preview-table">
                      <thead><tr><th>Fila</th><th>No. de tienda</th><th>Nombre de tienda</th><th>Resultado esperado</th></tr></thead>
                      <tbody>{storeCsvRecords.slice(0, 8).map((record, index) => {
                        const existing = data.stores.find((store) => store.storeNumber === record.storeNumber.trim());
                        const complete = Boolean(record.storeNumber.trim() && record.name.trim());
                        return <tr key={`${record.storeNumber}-${record.sourceRow}-${index}`}><td>{record.sourceRow}</td><td><span className="barcode">{record.storeNumber || "Falta"}</span></td><td><span className="device-name">{record.name || "Falta nombre"}</span></td><td>{!complete ? <span className="badge red">Se omitirá</span> : existing ? <span className="badge blue">Actualizar</span> : <span className="badge green">Crear</span>}</td></tr>;
                      })}</tbody>
                    </table>
                  </div>
                </section>
              ) : null}

              <section className="panel stores-catalog-panel">
                <div className="panel-header">
                  <div><h2 className="panel-title">Catálogo de tiendas</h2><div className="panel-meta">{data.stores.length} tiendas registradas</div></div>
                  <button className="ghost-button" type="button" onClick={() => void loadInventory()}>Actualizar</button>
                </div>
                {data.stores.length ? (
                  <div className="table-wrap">
                    <table className="data-table" style={{ minWidth: 760 }}>
                      <thead><tr><th>No. de tienda</th><th>Nombre</th><th>Equipos asignados</th><th>Última actualización</th><th className="actions-column">Acciones</th></tr></thead>
                      <tbody>{data.stores.map((store) => <tr key={store.id}><td><span className="barcode">{store.storeNumber}</span></td><td><span className="device-name">{store.name}</span></td><td>{data.equipment.filter((item) => item.storeId === store.id).length}</td><td>{formatDate(store.updatedAt)}</td><td className="actions-column"><button className="secondary-button table-action-button" type="button" onClick={() => setEditingStore({ ...store })}>Editar tienda</button></td></tr>)}</tbody>
                    </table>
                  </div>
                ) : <EmptyState title="Aún no hay tiendas" text="Agrega una tienda manualmente o sube el listado oficial en CSV." />}
              </section>
            </>
          ) : null}

          {view === "import" ? (
            <>
              <section className="section-grid">
                <div className="panel form-card">
                  <h2>Selecciona tu archivo CSV</h2>
                  <p>Excel puede exportar la hoja como CSV UTF-8. Las filas con un No. de Serie o código ya registrado actualizarán el artículo.</p>
                  <div
                    className={`import-dropzone ${dragging ? "dragging" : ""}`}
                    onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={onDrop}
                  >
                    <div>
                      <div className="import-icon">CSV</div>
                      <h3>{csvName || "Arrastra el archivo aquí"}</h3>
                      <p className="page-description">{csvRecords.length ? `${csvRecords.length} filas detectadas` : "o selecciónalo desde tu computadora"}</p>
                      <input ref={fileInput} className="file-input" type="file" accept=".csv,text/csv" onChange={onFileChange} />
                      <button className="secondary-button" type="button" onClick={() => fileInput.current?.click()} style={{ marginTop: 16 }}>Elegir archivo</button>
                    </div>
                  </div>
                </div>
                <aside className="panel import-help">
                  <h3>Antes de importar</h3>
                  <ol><li>Puede existir un título antes de la fila de encabezados.</li><li>El modelo y el tipo son obligatorios; la fecha puede quedar desconocida.</li><li>Los materiales pueden usar cantidad y no necesitan número de serie.</li><li>Las series científicas se marcan para corrección manual.</li><li>Revisa la muestra antes de confirmar.</li></ol>
                  <a href="/plantilla-inventario.csv" download>Descargar plantilla CSV</a>
                </aside>
              </section>
              {csvRecords.length ? (
                <section className="panel preview-card">
                  <div className="panel-header"><div><h2 className="panel-title">Vista previa</h2><div className="panel-meta">Primeras {Math.min(csvRecords.length, 5)} de {csvRecords.length} filas</div></div><button className="primary-button" type="button" onClick={() => void importCsv()} disabled={saving || !writable}>{saving ? "Importando…" : "Importar registros"}</button></div>
                  <div className="import-summary" aria-label="Resumen de la importación">
                    <span><strong>{csvSummary.needsSerialReview}</strong> series por corregir</span>
                    <span><strong>{csvSummary.materialUnits}</strong> unidades de material</span>
                    <span><strong>{csvSummary.withoutDate}</strong> sin fecha</span>
                    <span><strong>{csvSummary.withoutStore}</strong> sin tienda</span>
                  </div>
                  <div className="table-wrap"><table className="data-table"><thead><tr><th>No. de Serie / Código</th><th>Artículo</th><th>Cantidad</th><th>Tienda</th><th>Estado</th><th>Fecha</th></tr></thead><tbody>{csvRecords.slice(0, 5).map((record, index) => <tr key={`${record.barcode}-${index}`}><td><span className="barcode">{record.barcode || "Falta"}</span>{record.barcode.includes("-PENDIENTE-") ? <div className="muted serial-warning">Corregir serie</div> : null}</td><td><div className="device-name">{record.model || "Falta modelo"}</div><div className="muted">{record.deviceType || "Falta tipo"}</div>{record.itemKind === "material" ? <span className="badge amber">Material</span> : null}</td><td>{record.quantity.toLocaleString("es-GT")}</td><td>{record.storeNumber ? `${record.storeNumber} · ${record.storeName}` : record.storeReference ? `Sala: ${record.storeReference}` : "Sin asignar"}</td><td>{record.delivered ? "Entregado" : "En bodega"}<div className="muted">{conditionLabels[record.condition]}</div></td><td>{record.receivedAt ? formatDate(record.receivedAt) : "Desconocida"}</td></tr>)}</tbody></table></div>
                </section>
              ) : null}
            </>
          ) : null}

        </div>
      </main>

      {editing ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditing(null); }}>
          <form className="modal" onSubmit={submitEquipment} role="dialog" aria-modal="true" aria-labelledby="equipment-form-title">
            <div className="modal-header"><div><p className="eyebrow">{editing.id ? "Ficha del artículo" : "Nuevo ingreso"}</p><h2 id="equipment-form-title">{editing.id ? editing.model || "Editar artículo" : "Registrar artículo"}</h2></div><button className="close-button" type="button" onClick={() => setEditing(null)} aria-label="Cerrar">×</button></div>
            <div className="modal-body">
              {!editing.id && writable ? <div className="notice batch-entry-note">Captura continua activa: después de guardar conservaremos los datos y seleccionaremos el No. de Serie para recibir el siguiente escaneo.</div> : null}
              <div className="form-grid">
                <FormField label="Clase de artículo" id="item-kind"><select id="item-kind" className="select" value={editing.itemKind} onChange={(event) => { const itemKind = event.target.value as ItemKind; setEditing({ ...editing, itemKind, quantity: itemKind === "equipment" ? 1 : Math.max(1, editing.quantity), isNetworkDevice: itemKind === "equipment" && editing.isNetworkDevice }); }} disabled={!writable || Boolean(editing.id)}><option value="equipment">Equipo con No. de Serie</option><option value="material">Material por cantidad</option></select></FormField>
                <FormField label={editing.itemKind === "material" ? "Código de material (opcional)" : "No. de Serie"} id="equipment-barcode"><input ref={barcodeInput} id="equipment-barcode" className="input" value={editing.barcode} onChange={(event) => setEditing({ ...editing, barcode: event.target.value })} required={editing.itemKind === "equipment"} readOnly={!writable} placeholder={editing.itemKind === "material" ? "Se genera automáticamente si queda vacío" : "Escanea o escribe la serie"} /></FormField>
                <FormField label="Cantidad" id="quantity"><input id="quantity" type="number" min="1" step="1" className="input" value={editing.quantity} onChange={(event) => setEditing({ ...editing, quantity: Math.max(1, Number(event.target.value) || 1) })} required disabled={editing.itemKind === "equipment" || !writable} /></FormField>
                <FormField label="Fecha de ingreso (opcional)" id="received-at"><input id="received-at" type="date" className="input" value={editing.receivedAt} onChange={(event) => setEditing({ ...editing, receivedAt: event.target.value })} readOnly={!writable} /></FormField>
                <FormField label="Modelo" id="equipment-model"><input id="equipment-model" className="input" value={editing.model} onChange={(event) => setEditing({ ...editing, model: event.target.value })} required readOnly={!writable} /></FormField>
                <FormField label="Tipo de equipo o material" id="device-type"><input id="device-type" className="input" list="device-types" value={editing.deviceType} onChange={(event) => setEditing({ ...editing, deviceType: event.target.value })} required readOnly={!writable} /><datalist id="device-types">{deviceTypes.map((type) => <option key={type} value={type} />)}</datalist></FormField>
                <FormField label="Condición" id="condition"><select id="condition" className="select" value={editing.condition} onChange={(event) => setEditing({ ...editing, condition: event.target.value as Condition })} disabled={!writable}><option value="unknown">Sin revisar</option><option value="working">Funciona</option><option value="not_working">No funciona</option></select></FormField>
                <div className="field"><label htmlFor="delivered">Entrega</label><div className="toggle-row"><input id="delivered" type="checkbox" checked={editing.delivered} onChange={(event) => setEditing({ ...editing, delivered: event.target.checked, deliveredAt: event.target.checked ? editing.deliveredAt || today() : "" })} disabled={!writable} /><span>Ya fue entregado</span></div></div>
                <FormField label="Tienda asignada" id="store"><select id="store" className="select" value={editing.storeId} onChange={(event) => setEditing({ ...editing, storeId: event.target.value, storeReference: event.target.value ? "" : editing.storeReference })} required={editing.delivered && !editing.storeReference} disabled={!writable}><option value="">Sin asignar</option>{data.stores.map((store) => <option key={store.id} value={store.id}>{store.storeNumber} · {store.name}</option>)}</select></FormField>
                {editing.storeReference ? <FormField label="Referencia de sala importada" id="store-reference"><input id="store-reference" className="input" value={editing.storeReference} onChange={(event) => setEditing({ ...editing, storeReference: event.target.value })} readOnly={!writable} /></FormField> : null}
                <FormField label="Fecha de entrega" id="delivered-at"><input id="delivered-at" type="date" className="input" value={editing.deliveredAt} onChange={(event) => setEditing({ ...editing, deliveredAt: event.target.value })} disabled={!editing.delivered || !writable} /></FormField>
                {editing.itemKind === "equipment" ? <div className="field full network-device-toggle"><label htmlFor="network-device">Datos de red</label><div className="toggle-row"><input id="network-device" type="checkbox" checked={editing.isNetworkDevice} onChange={(event) => setEditing({ ...editing, isNetworkDevice: event.target.checked })} disabled={!writable} /><span>Es un dispositivo de red</span></div><small>Actívalo para registrar MAC, IP o contraseña.</small></div> : null}
                {editing.itemKind === "equipment" && editing.isNetworkDevice ? <FormField label="MAC Address" id="mac-address"><input id="mac-address" className="input" value={editing.macAddress} onChange={(event) => setEditing({ ...editing, macAddress: event.target.value })} placeholder="AA:BB:CC:DD:EE:FF" readOnly={!writable} /></FormField> : null}
                {editing.itemKind === "equipment" && editing.isNetworkDevice ? <FormField label="Dirección IP" id="ip-address"><input id="ip-address" className="input" value={editing.ipAddress} onChange={(event) => setEditing({ ...editing, ipAddress: event.target.value })} placeholder="192.168.1.10" readOnly={!writable} /></FormField> : null}
                {writable && editing.itemKind === "equipment" && editing.isNetworkDevice ? <FormField label={editing.hasCredential ? "Nueva contraseña (opcional)" : "Contraseña del equipo"} id="password"><input id="password" type="password" className="input" value={editing.password} onChange={(event) => setEditing({ ...editing, password: event.target.value })} autoComplete="new-password" placeholder={editing.hasCredential ? "Dejar vacío para conservar" : "Opcional"} /></FormField> : null}
                {editing.itemKind === "equipment" && editing.isNetworkDevice && editing.id && editing.hasCredential && data.currentUser.role === "admin" ? <div className="field"><label htmlFor="saved-password">Contraseña guardada</label><div className="credential-row"><input id="saved-password" className="input" value={revealedPassword || "••••••••••••"} readOnly /><button className="secondary-button" type="button" onClick={() => void revealCredential()} disabled={saving}>{revealedPassword ? "Ocultar" : "Mostrar"}</button></div></div> : null}
                <FormField label="Notas" id="notes" full><textarea id="notes" className="textarea" value={editing.notes} onChange={(event) => setEditing({ ...editing, notes: event.target.value })} readOnly={!writable} placeholder="Observaciones o detalles adicionales" /></FormField>
              </div>
            </div>
            <div className="modal-actions">
              {writable && editing.id ? <button className="danger-button modal-delete-button" type="button" onClick={() => void deleteEquipment()} disabled={saving}>Eliminar artículo</button> : null}
              <button className="secondary-button" type="button" onClick={() => setEditing(null)} disabled={saving}>Cerrar</button>
              {writable ? <button className="primary-button" type="submit" disabled={saving}>{saving ? "Guardando…" : editing.id ? "Guardar cambios" : "Guardar y continuar"}</button> : null}
            </div>
          </form>
        </div>
      ) : null}

      {editingDevice ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeDeviceProfile(); }}>
          <form className="modal device-profile-modal" onSubmit={submitDeviceProfile} role="dialog" aria-modal="true" aria-labelledby="device-profile-title">
            <div className="modal-header">
              <div>
                <p className="eyebrow">Ficha del modelo</p>
                <h2 id="device-profile-title">{editingDevice.model}</h2>
              </div>
              <button className="close-button" type="button" onClick={closeDeviceProfile} aria-label="Cerrar ficha">×</button>
            </div>
            <div className="modal-body device-profile-body">
              <div className="device-image-editor">
                <div className={`device-image-preview ${deviceImagePreview ? "has-image" : ""}`}>
                  {deviceImagePreview ? (
                    // The preview can be a temporary browser object URL.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={deviceImagePreview} alt={`Vista previa de ${editingDevice.model}`} />
                  ) : (
                    <div className="device-image-placeholder">
                      <span aria-hidden="true">D</span>
                      <small>Aún no hay imagen</small>
                    </div>
                  )}
                </div>
                {writable ? (
                  <div className="device-image-actions">
                    <label className="secondary-button upload-image-button" htmlFor="device-model-image">
                      {deviceImagePreview ? "Cambiar imagen" : "Subir imagen"}
                    </label>
                    <input
                      id="device-model-image"
                      className="file-input"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={selectDeviceImage}
                    />
                    {deviceImagePreview ? (
                      <button
                        className="ghost-button"
                        type="button"
                        onClick={() => {
                          if (deviceImageObjectUrl.current) {
                            URL.revokeObjectURL(deviceImageObjectUrl.current);
                            deviceImageObjectUrl.current = "";
                          }
                          setDeviceImageFile(null);
                          setDeviceImagePreview("");
                          setRemoveDeviceImage(true);
                        }}
                      >
                        Quitar imagen
                      </button>
                    ) : null}
                    <small>JPG, PNG o WebP · máximo 5 MB</small>
                  </div>
                ) : null}
              </div>
              <div className="form-grid device-profile-fields">
                <FormField label="Tipo de dispositivo" id="profile-device-type">
                  <input id="profile-device-type" className="input" value={editingDevice.deviceType} readOnly />
                </FormField>
                <FormField label="Modelo" id="profile-model">
                  <input id="profile-model" className="input" value={editingDevice.model} readOnly />
                </FormField>
                <FormField label="Marca o fabricante" id="profile-manufacturer" full>
                  <input
                    id="profile-manufacturer"
                    className="input"
                    maxLength={150}
                    value={editingDevice.manufacturer}
                    onChange={(event) => setEditingDevice({ ...editingDevice, manufacturer: event.target.value })}
                    readOnly={!writable}
                    placeholder="Ejemplo: APC, Forza, Dell"
                  />
                </FormField>
                <FormField label="Descripción del modelo" id="profile-description" full>
                  <textarea
                    id="profile-description"
                    className="textarea"
                    maxLength={2000}
                    value={editingDevice.description}
                    onChange={(event) => setEditingDevice({ ...editingDevice, description: event.target.value })}
                    readOnly={!writable}
                    placeholder="Uso, características principales o recomendaciones para identificarlo"
                  />
                </FormField>
                <FormField label="Información técnica" id="profile-specifications" full>
                  <textarea
                    id="profile-specifications"
                    className="textarea device-specifications-input"
                    maxLength={5000}
                    value={editingDevice.specifications}
                    onChange={(event) => setEditingDevice({ ...editingDevice, specifications: event.target.value })}
                    readOnly={!writable}
                    placeholder="Capacidad, voltaje, conexiones, dimensiones u otras especificaciones"
                  />
                </FormField>
              </div>
            </div>
            <div className="modal-actions">
              <button className="secondary-button" type="button" onClick={closeDeviceProfile} disabled={saving}>Cerrar</button>
              {writable ? <button className="primary-button" type="submit" disabled={saving}>{saving ? "Guardando…" : "Guardar ficha"}</button> : null}
            </div>
          </form>
        </div>
      ) : null}

      {editingStore ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setEditingStore(null); }}>
          <form className="modal store-edit-modal" onSubmit={updateStore} role="dialog" aria-modal="true" aria-labelledby="store-edit-title">
            <div className="modal-header">
              <div>
                <p className="eyebrow">Catálogo de tiendas</p>
                <h2 id="store-edit-title">Editar tienda</h2>
              </div>
              <button className="close-button" type="button" onClick={() => setEditingStore(null)} aria-label="Cerrar edición de tienda" disabled={saving}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-grid">
                <FormField label="No. de tienda" id="edit-store-number">
                  <input id="edit-store-number" className="input" maxLength={80} value={editingStore.storeNumber} onChange={(event) => setEditingStore({ ...editingStore, storeNumber: event.target.value })} required />
                </FormField>
                <FormField label="Nombre de tienda" id="edit-store-name">
                  <input id="edit-store-name" className="input" maxLength={200} value={editingStore.name} onChange={(event) => setEditingStore({ ...editingStore, name: event.target.value })} required />
                </FormField>
              </div>
            </div>
            <div className="modal-actions">
              <button className="secondary-button" type="button" onClick={() => setEditingStore(null)} disabled={saving}>Cancelar</button>
              <button className="primary-button" type="submit" disabled={saving}>{saving ? "Guardando…" : "Guardar cambios"}</button>
            </div>
          </form>
        </div>
      ) : null}

      {writeAccessDialogOpen ? (
        <div
          className="modal-backdrop write-access-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !checkingWriteAccess) {
              cancelWriteAccess();
            }
          }}
        >
          <form
            className="modal write-access-modal"
            onSubmit={submitWritePassword}
            role="dialog"
            aria-modal="true"
            aria-labelledby="write-access-title"
          >
            <div className="modal-header">
              <div>
                <p className="eyebrow">Protección de cambios</p>
                <h2 id="write-access-title">Ingresa la clave de edición</h2>
              </div>
              <button className="close-button" type="button" onClick={cancelWriteAccess} aria-label="Cancelar" disabled={checkingWriteAccess}>×</button>
            </div>
            <div className="modal-body">
              <p className="write-access-copy">La consulta es pública. La clave habilita guardar, importar y eliminar durante 30 minutos o hasta recargar esta página.</p>
              <div className="field">
                <label htmlFor="write-access-password">Clave de edición</label>
                <input
                  ref={writePasswordInput}
                  id="write-access-password"
                  className="input"
                  type="password"
                  value={writePassword}
                  onChange={(event) => setWritePassword(event.target.value)}
                  autoComplete="current-password"
                  required
                />
              </div>
              {writeAccessError ? <div className="error-banner write-access-error" role="alert">{writeAccessError}</div> : null}
            </div>
            <div className="modal-actions">
              <button className="secondary-button" type="button" onClick={cancelWriteAccess} disabled={checkingWriteAccess}>Cancelar</button>
              <button className="primary-button" type="submit" disabled={checkingWriteAccess || !writePassword}>{checkingWriteAccess ? "Verificando…" : "Habilitar edición"}</button>
            </div>
          </form>
        </div>
      ) : null}

      {cameraScannerOpen ? (
        <div className="modal-backdrop camera-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeCameraScanner(); }}>
          <section className="camera-modal" role="dialog" aria-modal="true" aria-labelledby="camera-scanner-title">
            <div className="modal-header">
              <div>
                <p className="eyebrow">Lector con cámara</p>
                <h2 id="camera-scanner-title">Escanea el código de barras</h2>
              </div>
              <button className="close-button" type="button" onClick={closeCameraScanner} aria-label="Cerrar cámara">×</button>
            </div>
            <div className="camera-modal-body">
              <div className="camera-preview">
                <video ref={cameraVideo} autoPlay muted playsInline aria-label="Vista de la cámara para escanear" />
                <div className="camera-guide" aria-hidden="true" />
              </div>
              <p className="camera-instructions">{cameraScannerStatus || "Da permiso a la cámara y centra el código dentro del recuadro."}</p>
              {cameraScannerError ? <div className="error-banner" role="alert">{cameraScannerError}</div> : null}
            </div>
            <div className="modal-actions">
              <button className="secondary-button" type="button" onClick={closeCameraScanner}>Cancelar</button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function Stat({ label, value, foot }: { label: string; value: number; foot: string }) {
  return <article className="stat-card"><div className="stat-label">{label}</div><div className="stat-value">{value.toLocaleString("es-GT")}</div><div className="stat-foot">{foot}</div></article>;
}

function ConditionBadge({ condition }: { condition: Condition }) {
  const color = condition === "working" ? "green" : condition === "not_working" ? "red" : "gray";
  return <span className={`badge ${color}`}>{conditionLabels[condition]}</span>;
}

function EmptyState({ title, text, action }: { title: string; text: string; action?: () => void }) {
  return <div className="empty-state"><div className="empty-mark">D</div><h3>{title}</h3><p>{text}</p>{action ? <button className="primary-button" type="button" onClick={action}>Registrar artículo</button> : null}</div>;
}

function FormField({ label, id, full = false, children }: { label: string; id: string; full?: boolean; children: React.ReactNode }) {
  return <div className={`field ${full ? "full" : ""}`}><label htmlFor={id}>{label}</label>{children}</div>;
}
