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
import type { Cell, SheetData } from "write-excel-file/browser";

const logoDataUri = "data:image/png;base64,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";

type View = "inventory" | "summary" | "devices" | "stores" | "import";
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
  switchTorch?: (enabled: boolean) => Promise<void>;
};

type NativeBarcodeDetector = {
  detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue: string }>>;
};

type NativeBarcodeDetectorConstructor = {
  new (options?: { formats?: string[] }): NativeBarcodeDetector;
  getSupportedFormats?: () => Promise<string[]>;
};

type CameraCapabilities = MediaTrackCapabilities & {
  focusMode?: string[];
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

function cameraBaseName(device: MediaDeviceInfo, index: number): string {
  const label = normalized(device.label);
  const isFront = /\b(front|user|frontal|delantera)\b/.test(label);
  const isBack = /\b(back|rear|environment|trasera|posterior)\b/.test(label);

  if (isFront) return "Cámara frontal";
  if (isBack && /\b(ultrawide|ultra wide|gran angular)\b/.test(label)) {
    return "Cámara trasera · Gran angular";
  }
  if (isBack && /\b(telephoto|telefoto|zoom)\b/.test(label)) {
    return "Cámara trasera · Zoom";
  }
  if (isBack) return "Cámara trasera";
  return `Cámara ${index + 1}`;
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
  const [view, setView] = useState<View>("summary");
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
  const [cameraDevices, setCameraDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState("");
  const [cameraTorchAvailable, setCameraTorchAvailable] = useState(false);
  const [cameraTorchOn, setCameraTorchOn] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const storeFileInput = useRef<HTMLInputElement>(null);
  const barcodeInput = useRef<HTMLInputElement>(null);
  const cameraVideo = useRef<HTMLVideoElement>(null);
  const cameraScannerControls = useRef<CameraScannerControls | null>(null);
  const cameraScannerFrame = useRef<number | null>(null);
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
  const cameraOptions = useMemo(() => {
    const baseNames = cameraDevices.map(cameraBaseName);
    const totals = new Map<string, number>();
    const positions = new Map<string, number>();
    baseNames.forEach((name) => totals.set(name, (totals.get(name) ?? 0) + 1));

    return cameraDevices.map((device, index) => {
      const baseName = baseNames[index];
      const position = (positions.get(baseName) ?? 0) + 1;
      positions.set(baseName, position);
      return {
        device,
        name: (totals.get(baseName) ?? 0) > 1 ? `${baseName} ${position}` : baseName,
      };
    });
  }, [cameraDevices]);

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

  const deviceTypeSummary = useMemo(() => {
    const groups = new Map<
      string,
      { deviceType: string; units: number; warehouse: number; delivered: number }
    >();

    for (const item of data?.equipment ?? []) {
      if (item.itemKind !== "equipment") continue;
      const deviceType = item.deviceType.trim() || "Sin tipo asignado";
      const key = normalized(deviceType) || "sin tipo asignado";
      const current = groups.get(key) ?? {
        deviceType,
        units: 0,
        warehouse: 0,
        delivered: 0,
      };
      current.units += item.quantity;
      if (item.delivered) current.delivered += item.quantity;
      else current.warehouse += item.quantity;
      groups.set(key, current);
    }

    return Array.from(groups.values()).sort((a, b) =>
      a.deviceType.localeCompare(b.deviceType, "es", { sensitivity: "base" }),
    );
  }, [data?.equipment]);

  const deviceSummaryStats = useMemo(() => {
    const total = deviceTypeSummary.reduce((sum, item) => sum + item.units, 0);
    const warehouse = deviceTypeSummary.reduce(
      (sum, item) => sum + item.warehouse,
      0,
    );
    const delivered = deviceTypeSummary.reduce(
      (sum, item) => sum + item.delivered,
      0,
    );
    const assignedToStore = (data?.equipment ?? []).reduce(
      (sum, item) =>
        item.itemKind === "equipment" && item.storeId ? sum + item.quantity : sum,
      0,
    );
    return {
      types: deviceTypeSummary.length,
      total,
      warehouse,
      delivered,
      assignedToStore,
      withoutStore: total - assignedToStore,
    };
  }, [data?.equipment, deviceTypeSummary]);

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
    if (cameraScannerFrame.current !== null) {
      window.cancelAnimationFrame(cameraScannerFrame.current);
      cameraScannerFrame.current = null;
    }
    cameraScannerControls.current?.stop();
    cameraScannerControls.current = null;
    const video = cameraVideo.current;
    const stream = video?.srcObject as MediaStream | null;
    stream?.getTracks().forEach((track) => track.stop());
    if (video) video.srcObject = null;
    setCameraTorchAvailable(false);
    setCameraTorchOn(false);
  }, []);

  const closeCameraScanner = useCallback(() => {
    stopCameraScanner();
    setCameraScannerOpen(false);
  }, [stopCameraScanner]);

  const processCameraBarcode = useCallback(
    (value: string) => {
      const barcode = value.trim();
      if (!barcode) return;
      navigator.vibrate?.(120);
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
    let helpTimer = 0;

    const startCameraScanner = async () => {
      if (!navigator.mediaDevices?.getUserMedia || !cameraVideo.current) {
        setCameraScannerError("Este navegador no permite usar la cámara. Prueba con Chrome, Safari o el lector USB.");
        return;
      }
      setCameraScannerStatus("Solicitando acceso a la cámara…");
      setCameraScannerError("");
      try {
        const [
          { BrowserMultiFormatReader },
          {
            BarcodeFormat,
            ChecksumException,
            DecodeHintType,
            FormatException,
            NotFoundException,
          },
        ] = await Promise.all([
          import("@zxing/browser"),
          import("@zxing/library"),
        ]);
        if (cancelled || !cameraVideo.current) return;

        const inventoryFormats = [
          BarcodeFormat.CODE_128,
          BarcodeFormat.CODE_39,
          BarcodeFormat.CODE_93,
          BarcodeFormat.CODABAR,
          BarcodeFormat.EAN_13,
          BarcodeFormat.EAN_8,
          BarcodeFormat.UPC_A,
          BarcodeFormat.UPC_E,
          BarcodeFormat.ITF,
          BarcodeFormat.QR_CODE,
          BarcodeFormat.DATA_MATRIX,
        ];
        const hints = new Map();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, inventoryFormats);
        hints.set(DecodeHintType.TRY_HARDER, true);

        const reader = new BrowserMultiFormatReader(hints, {
          delayBetweenScanAttempts: 160,
          delayBetweenScanSuccess: 900,
        });
        const videoConstraints: MediaTrackConstraints = selectedCameraId
          ? {
              deviceId: { exact: selectedCameraId },
              width: { ideal: 1920 },
              height: { ideal: 1080 },
            }
          : {
              facingMode: { ideal: "environment" },
              width: { ideal: 1920 },
              height: { ideal: 1080 },
            };
        controls = await reader.decodeFromConstraints(
          {
            audio: false,
            video: videoConstraints,
          },
          cameraVideo.current,
          (result, scanError) => {
            if (result && !detected) {
              detected = true;
              processCameraBarcode(result.getText());
              return;
            }
            if (
              scanError &&
              !(scanError instanceof NotFoundException) &&
              !(scanError instanceof ChecksumException) &&
              !(scanError instanceof FormatException)
            ) {
              setCameraScannerError(
                "El lector se detuvo inesperadamente. Cierra la cámara y vuelve a intentarlo.",
              );
            }
          },
        );
        if (cancelled || detected) {
          controls.stop();
          return;
        }
        cameraScannerControls.current = controls;
        setCameraTorchAvailable(Boolean(controls.switchTorch));

        const video = cameraVideo.current;
        const videoTrack = (video.srcObject as MediaStream | null)
          ?.getVideoTracks()
          .at(0);
        if (videoTrack) {
          try {
            const capabilities = videoTrack.getCapabilities() as CameraCapabilities;
            if (capabilities.focusMode?.includes("continuous")) {
              await videoTrack.applyConstraints({
                advanced: [
                  { focusMode: "continuous" } as MediaTrackConstraintSet,
                ],
              });
            }
          } catch {
            // Some mobile browsers report focus capabilities but reject the constraint.
          }
        }

        const devices = await navigator.mediaDevices.enumerateDevices();
        if (!cancelled) {
          setCameraDevices(devices.filter((device) => device.kind === "videoinput"));
        }

        const detectorConstructor = (
          window as Window & { BarcodeDetector?: NativeBarcodeDetectorConstructor }
        ).BarcodeDetector;
        if (detectorConstructor && video) {
          try {
            const desiredNativeFormats = [
              "code_128",
              "code_39",
              "code_93",
              "codabar",
              "ean_13",
              "ean_8",
              "upc_a",
              "upc_e",
              "itf",
              "qr_code",
              "data_matrix",
            ];
            const supportedFormats = detectorConstructor.getSupportedFormats
              ? await detectorConstructor.getSupportedFormats()
              : desiredNativeFormats;
            const nativeFormats = desiredNativeFormats.filter((format) =>
              supportedFormats.includes(format),
            );
            const nativeDetector = new detectorConstructor(
              nativeFormats.length ? { formats: nativeFormats } : undefined,
            );
            const detectNativeBarcode = async () => {
              if (cancelled || detected || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
                if (!cancelled && !detected) {
                  cameraScannerFrame.current = window.requestAnimationFrame(
                    () => void detectNativeBarcode(),
                  );
                }
                return;
              }
              try {
                const [nativeResult] = await nativeDetector.detect(video);
                if (nativeResult?.rawValue && !detected) {
                  detected = true;
                  processCameraBarcode(nativeResult.rawValue);
                  return;
                }
              } catch {
                // ZXing continues scanning if the native detector rejects a frame.
              }
              if (!cancelled && !detected) {
                cameraScannerFrame.current = window.requestAnimationFrame(
                  () => void detectNativeBarcode(),
                );
              }
            };
            cameraScannerFrame.current = window.requestAnimationFrame(
              () => void detectNativeBarcode(),
            );
          } catch {
            // ZXing remains the compatible fallback on browsers without native detection.
          }
        }

        setCameraScannerStatus(
          "Lector activo. Centra las barras, mantén el teléfono firme y prueba a acercarlo o alejarlo.",
        );
        helpTimer = window.setTimeout(() => {
          if (!cancelled && !detected) {
            setCameraScannerStatus(
              "Aún buscando… Evita reflejos, llena el recuadro con el código y prueba otra cámara si aparece disponible.",
            );
          }
        }, 7000);
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
      window.clearTimeout(helpTimer);
      controls?.stop();
      stopCameraScanner();
    };
  }, [cameraScannerOpen, processCameraBarcode, selectedCameraId, stopCameraScanner]);

  const toggleCameraTorch = async () => {
    const controls = cameraScannerControls.current;
    if (!controls?.switchTorch) return;
    const nextValue = !cameraTorchOn;
    try {
      await controls.switchTorch(nextValue);
      setCameraTorchOn(nextValue);
      setCameraScannerError("");
    } catch {
      setCameraScannerError("Este teléfono no permitió cambiar la linterna.");
    }
  };

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
    reportWindow.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Reporte de inventario Dollar</title><style>@import url("https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700&display=swap");@page{margin:16mm}*{box-sizing:border-box}body{font-family:"Outfit",sans-serif;color:#1d1d1d;margin:0;font-weight:400}h1{margin:0;font-size:25px;font-weight:700}p{color:rgba(29,29,29,.62);margin:7px 0 0}.summary{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:24px 0}.metric{border:1px solid #dcdcdc;border-radius:10px;padding:12px}.metric strong{display:block;font-size:22px;margin-top:5px}table{width:100%;border-collapse:collapse;font-size:11px}th{background:rgba(196,235,194,.4);text-align:left;padding:9px}td{padding:9px;border-top:1px solid #dcdcdc;vertical-align:top}small{color:rgba(29,29,29,.62)}@media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}}</style></head><body><h1>Reporte de inventario · Dollar</h1><p>Generado: ${htmlText(generatedAt)} · ${filteredEquipment.length} registros según los filtros actuales.</p><section class="summary"><div class="metric">Unidades registradas<strong>${totalUnits.toLocaleString("es-GT")}</strong></div><div class="metric">En bodega<strong>${warehouseUnits.toLocaleString("es-GT")}</strong></div><div class="metric">Entregadas<strong>${deliveredUnits.toLocaleString("es-GT")}</strong></div><div class="metric">No funcionan<strong>${filteredEquipment.filter((item) => item.condition === "not_working").length}</strong></div></section><table><thead><tr><th>No. de Serie / Código</th><th>Artículo</th><th>Cantidad</th><th>Ubicación</th><th>Entrega</th><th>Condición</th><th>Ingreso</th></tr></thead><tbody>${reportRows}</tbody></table></body></html>`);
    reportWindow.document.close();
    reportWindow.focus();
    window.setTimeout(() => reportWindow.print(), 250);
    setNotice("Reporte generado. Usa Imprimir o Guardar como PDF en la nueva ventana.");
  };

  const generateSummaryReport = (scope: "all" | "types" | "stores") => {
    if (!deviceSummaryStats.total) {
      setError("No hay dispositivos para generar el reporte del resumen.");
      return;
    }
    const reportWindow = window.open("", "_blank", "width=980,height=820");
    if (!reportWindow) {
      setError("El navegador bloqueó la ventana del reporte. Permite ventanas emergentes e inténtalo de nuevo.");
      return;
    }
    reportWindow.opener = null;
    setError("");

    const generatedAt = new Intl.DateTimeFormat("es-GT", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date());
    const typeRows = deviceTypeSummary
      .map(
        (item) =>
          `<tr><td><strong>${htmlText(item.deviceType)}</strong><br><small>${item.warehouse.toLocaleString("es-GT")} en bodega · ${item.delivered.toLocaleString("es-GT")} entregados</small></td><td>${item.units.toLocaleString("es-GT")}</td></tr>`,
      )
      .join("");
    const typeSection = `<section><h2>Dispositivos por tipo</h2><table><thead><tr><th>Tipo de equipo</th><th>Cantidad</th></tr></thead><tbody>${typeRows}</tbody><tfoot><tr><th>Total general</th><td>${deviceSummaryStats.total.toLocaleString("es-GT")}</td></tr></tfoot></table></section>`;
    const assignmentSection = `<section><h2>Asignación a tiendas</h2><table><thead><tr><th>Estado de asignación</th><th>Cantidad</th></tr></thead><tbody><tr><td><strong>Con tienda asignada</strong><br><small>Relacionados con una tienda del catálogo</small></td><td>${deviceSummaryStats.assignedToStore.toLocaleString("es-GT")}</td></tr><tr><td><strong>Sin tienda asignada</strong><br><small>Pendientes de relacionar con una tienda</small></td><td>${deviceSummaryStats.withoutStore.toLocaleString("es-GT")}</td></tr></tbody><tfoot><tr><th>Total general</th><td>${deviceSummaryStats.total.toLocaleString("es-GT")}</td></tr></tfoot></table></section>`;
    const sections = scope === "types"
      ? typeSection
      : scope === "stores"
        ? assignmentSection
        : `${typeSection}${assignmentSection}`;
    const reportTitle = scope === "types"
      ? "Resumen por tipo de equipo"
      : scope === "stores"
        ? "Resumen de asignación a tiendas"
        : "Resumen general de dispositivos";

    reportWindow.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${htmlText(reportTitle)} · Inventario Dollar</title><style>@import url("https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700&display=swap");@page{margin:16mm}*{box-sizing:border-box}body{font-family:"Outfit",sans-serif;color:#1d1d1d;margin:0;font-weight:400}h1{margin:0;font-size:26px}h2{margin:26px 0 10px;font-size:17px}p{color:rgba(29,29,29,.62);margin:7px 0 0}.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:22px 0}.metric{border:1px solid #dcdcdc;border-radius:10px;padding:12px;font-size:11px}.metric strong{display:block;font-size:22px;margin-top:5px}section{break-inside:avoid}table{width:100%;border-collapse:collapse;font-size:12px}th{background:rgba(196,235,194,.4);text-align:left;padding:10px}th:last-child,td:last-child{text-align:right;width:120px}td{padding:10px;border-top:1px solid #dcdcdc;vertical-align:top}tfoot th,tfoot td{background:#c4ebc2;font-weight:700;border-top:2px solid #8fcb8a}small{color:rgba(29,29,29,.62)}@media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}}</style></head><body><h1>${htmlText(reportTitle)}</h1><p>Inventario Dollar · Generado: ${htmlText(generatedAt)}</p><div class="metrics"><div class="metric">Tipos de equipo<strong>${deviceSummaryStats.types.toLocaleString("es-GT")}</strong></div><div class="metric">Dispositivos<strong>${deviceSummaryStats.total.toLocaleString("es-GT")}</strong></div><div class="metric">En bodega<strong>${deviceSummaryStats.warehouse.toLocaleString("es-GT")}</strong></div><div class="metric">Entregados<strong>${deviceSummaryStats.delivered.toLocaleString("es-GT")}</strong></div></div>${sections}</body></html>`);
    reportWindow.document.close();
    reportWindow.focus();
    window.setTimeout(() => reportWindow.print(), 250);
    setNotice(`Reporte generado: ${reportTitle}. Usa Imprimir o Guardar como PDF.`);
  };

  const exportDeviceTypeExcel = async () => {
    if (!deviceSummaryStats.total) {
      setError("No hay dispositivos para generar el reporte de Excel.");
      return;
    }

    setError("");
    try {
      const { default: writeXlsxFile } = await import("write-excel-file/browser");
      const generatedAt = new Intl.DateTimeFormat("es-GT", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date());
      const fileDate = new Intl.DateTimeFormat("en-CA").format(new Date());
      const border = "#DCDCDC";
      const accent = "#C4EBC2";
      const ink = "#1D1D1D";
      const muted = "#5D5D5D";
      const numberCell = (value: number): Cell => ({
        value,
        type: Number,
        format: "#,##0",
        align: "right",
        borderColor: border,
        borderStyle: "thin",
      });
      const formulaCell = (value: string): Cell => ({
        value,
        type: "Formula",
        format: "#,##0",
        align: "right",
        borderColor: border,
        borderStyle: "thin",
        fontWeight: "bold",
      });
      const tableHeader = (value: string): Cell => ({
        value,
        fontWeight: "bold",
        backgroundColor: accent,
        textColor: ink,
        borderColor: border,
        borderStyle: "thin",
        align: value === "Tipo de equipo" ? "left" : "right",
        height: 26,
      });
      const firstDataRow = 8;
      const lastDataRow = firstDataRow + deviceTypeSummary.length - 1;
      const totalRow = lastDataRow + 1;
      const sheetData: SheetData = [
        [
          {
            value: "Resumen por tipo de equipo",
            columnSpan: 4,
            fontSize: 20,
            fontWeight: "bold",
            textColor: ink,
            height: 34,
            alignVertical: "center",
          },
          null,
          null,
          null,
        ],
        [
          {
            value: `Inventario Dollar · Generado: ${generatedAt}`,
            columnSpan: 4,
            textColor: muted,
            fontSize: 11,
            height: 22,
          },
          null,
          null,
          null,
        ],
        [null, null, null, null],
        [
          tableHeader("Tipos de equipo"),
          tableHeader("Dispositivos"),
          tableHeader("En bodega"),
          tableHeader("Entregados"),
        ],
        [
          numberCell(deviceSummaryStats.types),
          formulaCell(`=D${totalRow}`),
          formulaCell(`=B${totalRow}`),
          formulaCell(`=C${totalRow}`),
        ],
        [null, null, null, null],
        [
          tableHeader("Tipo de equipo"),
          tableHeader("En bodega"),
          tableHeader("Entregados"),
          tableHeader("Total"),
        ],
        ...deviceTypeSummary.map((item) => [
          {
            value: item.deviceType,
            borderColor: border,
            borderStyle: "thin" as const,
            wrap: true,
          },
          numberCell(item.warehouse),
          numberCell(item.delivered),
          numberCell(item.units),
        ]),
        [
          {
            value: "Total general",
            fontWeight: "bold",
            backgroundColor: accent,
            borderColor: border,
            borderStyle: "thin",
          },
          { ...formulaCell(`=SUM(B${firstDataRow}:B${lastDataRow})`), backgroundColor: accent },
          { ...formulaCell(`=SUM(C${firstDataRow}:C${lastDataRow})`), backgroundColor: accent },
          { ...formulaCell(`=SUM(D${firstDataRow}:D${lastDataRow})`), backgroundColor: accent },
        ],
      ];

      await writeXlsxFile(
        sheetData,
        {
          sheet: "Resumen por tipo",
          columns: [{ width: 38 }, { width: 16 }, { width: 16 }, { width: 16 }],
          stickyRowsCount: 7,
          showGridLines: false,
          zoomScale: 1.1,
        },
        { fontFamily: "Outfit", fontSize: 11 },
      ).toFile(`reporte-dispositivos-por-tipo-${fileDate}.xlsx`);
      setNotice(`Excel descargado con ${deviceTypeSummary.length} tipos de equipo.`);
    } catch {
      setError("No se pudo generar el archivo de Excel. Inténtalo de nuevo.");
    }
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
          <img className="auth-logo" src={logoDataUri} alt="Tecnasa" />
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
    summary: {
      eyebrow: "Vista consolidada",
      title: "El inventario, en una mirada.",
      description: "Consulta cuántos dispositivos hay por tipo y distingue rápidamente los que siguen en bodega de los ya entregados.",
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
    { id: "summary", label: "Resumen" },
    { id: "devices", label: "Dispositivos" },
    { id: "stores", label: "Tiendas" },
    { id: "import", label: "Importar CSV" },
  ];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <img className="brand-logo" src={logoDataUri} alt="Tecnasa" />
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
              {view === "summary" ? (
                <button
                  className="primary-button"
                  type="button"
                  onClick={() => generateSummaryReport("all")}
                  disabled={!deviceSummaryStats.total}
                >
                  Generar reporte completo
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
                  <div className="scanner-input-wrap">
                    <span className="scanner-symbol" aria-hidden="true" />
                    <input
                      id="barcode-scanner"
                      className="scanner-input"
                      aria-label="Lector de código de barras"
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

          {view === "summary" ? (
            <>
              <section className="stats-grid summary-stats-grid" aria-label="Indicadores del resumen de dispositivos">
                <Stat label="Tipos de equipo" value={deviceSummaryStats.types} foot="Categorías registradas" />
                <Stat label="Total de dispositivos" value={deviceSummaryStats.total} foot="Unidades contabilizadas" />
                <Stat label="En bodega" value={deviceSummaryStats.warehouse} foot="Pendientes de entrega" />
                <Stat label="Entregados" value={deviceSummaryStats.delivered} foot="Asignados fuera de bodega" />
              </section>

              <div className="summary-panels-grid">
                <section className="panel device-summary-panel">
                  <div className="panel-header">
                    <div>
                      <h2 className="panel-title">Dispositivos por tipo</h2>
                      <div className="panel-meta">
                        {deviceTypeSummary.length} {deviceTypeSummary.length === 1 ? "tipo registrado" : "tipos registrados"}
                      </div>
                    </div>
                    <div className="panel-actions summary-report-actions">
                      <button
                        className="primary-button action-label-button"
                        type="button"
                        aria-label="Generar reporte por tipo de equipo"
                        onClick={() => generateSummaryReport("types")}
                        disabled={!deviceSummaryStats.total}
                      >
                        <span className="action-glyph action-glyph-report" aria-hidden="true" />
                        <span>Generar reporte</span>
                      </button>
                      <button
                        className="primary-button action-label-button"
                        type="button"
                        aria-label="Exportar reporte por tipo a Excel"
                        onClick={() => void exportDeviceTypeExcel()}
                        disabled={!deviceSummaryStats.total}
                      >
                        <span className="action-glyph action-glyph-excel" aria-hidden="true" />
                        <span>Exportar a Excel</span>
                      </button>
                    </div>
                  </div>

                  {deviceTypeSummary.length ? (
                    <div className="device-summary-table-wrap">
                      <table className="device-summary-table">
                        <thead>
                          <tr>
                            <th>Tipo de equipo</th>
                            <th>Cantidad</th>
                          </tr>
                        </thead>
                        <tbody>
                          {deviceTypeSummary.map((item) => (
                            <tr key={normalized(item.deviceType)}>
                              <td>
                                <div className="device-summary-type-copy">
                                  <strong>{item.deviceType}</strong>
                                  <span>{item.warehouse} en bodega · {item.delivered} entregados</span>
                                </div>
                              </td>
                              <td>{item.units.toLocaleString("es-GT")}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr>
                            <th>Total general</th>
                            <td>{deviceSummaryStats.total.toLocaleString("es-GT")}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  ) : (
                    <EmptyState
                      title="Aún no hay dispositivos para resumir"
                      text="Los tipos y sus cantidades aparecerán aquí cuando registres o importes el primer equipo. Los materiales no se incluyen en este resumen."
                    />
                  )}
                </section>

                <section className="panel device-summary-panel store-assignment-panel">
                  <div className="panel-header">
                    <div>
                      <h2 className="panel-title">Asignación a tiendas</h2>
                      <div className="panel-meta">Relación actual de los dispositivos</div>
                    </div>
                    <button
                      className="ghost-button action-icon-button"
                      type="button"
                      aria-label="Generar reporte de asignación a tiendas"
                      data-tooltip="Reporte de tiendas"
                      onClick={() => generateSummaryReport("stores")}
                      disabled={!deviceSummaryStats.total}
                    >
                      <span className="action-glyph action-glyph-report" aria-hidden="true" />
                    </button>
                  </div>
                  <div className="store-assignment-summary">
                    <article className="store-assignment-card assigned">
                      <span>Con tienda asignada</span>
                      <strong>{deviceSummaryStats.assignedToStore.toLocaleString("es-GT")}</strong>
                      <small>
                        {deviceSummaryStats.total
                          ? Math.round((deviceSummaryStats.assignedToStore / deviceSummaryStats.total) * 100)
                          : 0}% del total
                      </small>
                    </article>
                    <article className="store-assignment-card unassigned">
                      <span>Sin tienda asignada</span>
                      <strong>{deviceSummaryStats.withoutStore.toLocaleString("es-GT")}</strong>
                      <small>
                        {deviceSummaryStats.total
                          ? Math.round((deviceSummaryStats.withoutStore / deviceSummaryStats.total) * 100)
                          : 0}% del total
                      </small>
                    </article>
                    <div className="store-assignment-total">
                      <span>Total general</span>
                      <strong>{deviceSummaryStats.total.toLocaleString("es-GT")}</strong>
                    </div>
                  </div>
                </section>
              </div>
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
              {cameraDevices.length > 1 || cameraTorchAvailable ? (
                <div className="camera-controls">
                  {cameraDevices.length > 1 ? (
                    <label className="camera-selector">
                      <span>Elegir cámara</span>
                      <select
                        className="select"
                        value={selectedCameraId}
                        onChange={(event) => setSelectedCameraId(event.target.value)}
                      >
                        <option value="">Cámara trasera · Automática</option>
                        {cameraOptions.map(({ device, name }) => (
                          <option key={device.deviceId} value={device.deviceId}>
                            {name}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                  {cameraTorchAvailable ? (
                    <button className="secondary-button camera-torch-button" type="button" onClick={() => void toggleCameraTorch()}>
                      {cameraTorchOn ? "Apagar linterna" : "Encender linterna"}
                    </button>
                  ) : null}
                </div>
              ) : null}
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
