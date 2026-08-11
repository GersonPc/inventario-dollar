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
  type CsvRecord,
  type InventoryCondition as Condition,
  type InventoryItemKind as ItemKind,
} from "@/lib/inventory-csv";

type View = "inventory" | "stores" | "import";
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
  macAddress: string;
  ipAddress: string;
  password: string;
  notes: string;
  hasCredential: boolean;
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
    macAddress: "",
    ipAddress: "",
    password: "",
    notes: "",
    hasCredential: false,
  };
}

const roleLabels: Record<Role, string> = {
  admin: "Administrador",
  operator: "Operador",
  viewer: "Consulta",
};

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

async function postAction(body: Record<string, unknown>) {
  const response = await fetch("/api/inventory", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await response.json()) as Record<string, unknown>;
  if (!response.ok) throw new Error(String(payload.error ?? "La operación falló."));
  return payload;
}

export function InventoryApp() {
  const [data, setData] = useState<InventoryResponse | null>(null);
  const [view, setView] = useState<View>("inventory");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [kindFilter, setKindFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [deliveryFilter, setDeliveryFilter] = useState("");
  const [conditionFilter, setConditionFilter] = useState("");
  const [editing, setEditing] = useState<EquipmentForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [revealedPassword, setRevealedPassword] = useState("");
  const [storeForm, setStoreForm] = useState({ storeNumber: "", name: "" });
  const [csvRecords, setCsvRecords] = useState<CsvRecord[]>([]);
  const [csvName, setCsvName] = useState("");
  const [dragging, setDragging] = useState(false);
  const [cameraScannerOpen, setCameraScannerOpen] = useState(false);
  const [cameraScannerStatus, setCameraScannerStatus] = useState("");
  const [cameraScannerError, setCameraScannerError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const barcodeInput = useRef<HTMLInputElement>(null);
  const cameraVideo = useRef<HTMLVideoElement>(null);
  const cameraScannerControls = useRef<CameraScannerControls | null>(null);

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

  const writable = data?.currentUser.role === "admin" || data?.currentUser.role === "operator";
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
      macAddress: item.macAddress ?? "",
      ipAddress: item.ipAddress ?? "",
      password: "",
      notes: item.notes ?? "",
      hasCredential: item.hasCredential,
    });
  }, []);

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
      });
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
      setError(saveError instanceof Error ? saveError.message : "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  };

  const revealCredential = async () => {
    if (!editing?.id) return;
    setSaving(true);
    try {
      const result = await postAction({
        action: "revealCredential",
        equipmentId: editing.id,
      });
      setRevealedPassword(String(result.password ?? "Sin contraseña guardada"));
    } catch (revealError) {
      setError(revealError instanceof Error ? revealError.message : "No se pudo mostrar.");
    } finally {
      setSaving(false);
    }
  };

  const saveStore = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await postAction({ action: "saveStore", store: storeForm });
      setStoreForm({ storeNumber: "", name: "" });
      setNotice("Tienda guardada correctamente.");
      await loadInventory();
    } catch (storeError) {
      setError(storeError instanceof Error ? storeError.message : "No se pudo guardar la tienda.");
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
    setSaving(true);
    setError("");
    try {
      const result = await postAction({ action: "importCsv", records: csvRecords });
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
      setError(importError instanceof Error ? importError.message : "No se pudo importar el archivo.");
    } finally {
      setSaving(false);
    }
  };

  const exportCsv = () => {
    if (!filteredEquipment.length) {
      setError("No hay registros para exportar con los filtros actuales.");
      return;
    }
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
    link.click();
    URL.revokeObjectURL(url);
    setNotice(`CSV descargado con ${filteredEquipment.length} registros. Las contraseñas no se incluyen.`);
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

  const navItems: Array<{ id: View; label: string; icon: string }> = [
    { id: "inventory", label: "Inventario", icon: "EQ" },
    { id: "stores", label: "Tiendas", icon: "T" },
    { id: "import", label: "Importar CSV", icon: "CSV" },
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
              onClick={() => {
                setView(item.id);
                setError("");
                setNotice("");
              }}
            >
              <span className="nav-icon" aria-hidden="true">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-user">
          <div className="sidebar-user-name">{data.currentUser.displayName}</div>
          <div className="sidebar-user-role">{roleLabels[data.currentUser.role]}</div>
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
            {view === "inventory" && writable ? (
              <button className="primary-button" type="button" onClick={() => openEquipment()}>
                + Registrar artículo
              </button>
            ) : null}
          </header>

          {error ? <div className="error-banner" role="alert">{error}</div> : null}
          {notice ? <div className="success-banner" role="status">{notice}</div> : null}

          {view === "inventory" ? (
            <>
              <section className="scanner-card" aria-label="Lector de código de barras">
                <div>
                  <label className="scanner-label" htmlFor="barcode-scanner">Lector de código de barras</label>
                  <div className="scanner-input-wrap">
                    <span className="scanner-symbol" aria-hidden="true">▥</span>
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
                    <span aria-hidden="true">▣</span> Usar cámara
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
                    <button className="ghost-button" type="button" onClick={exportCsv}>
                      Exportar CSV
                    </button>
                    <button className="ghost-button" type="button" onClick={() => void loadInventory()}>
                      Actualizar
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
                            <td><div>{item.ipAddress || "—"}</div><div className="muted">{item.macAddress || "Sin MAC"}</div></td>
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

          {view === "stores" ? (
            <section className="panel">
              {writable ? (
                <form className="inline-form" onSubmit={saveStore}>
                  <div className="field"><label htmlFor="store-number">No. de tienda</label><input id="store-number" className="input" value={storeForm.storeNumber} onChange={(event) => setStoreForm({ ...storeForm, storeNumber: event.target.value })} required /></div>
                  <div className="field"><label htmlFor="store-name">Nombre de tienda</label><input id="store-name" className="input" value={storeForm.name} onChange={(event) => setStoreForm({ ...storeForm, name: event.target.value })} required /></div>
                  <button className="primary-button" type="submit" disabled={saving}>Guardar tienda</button>
                </form>
              ) : null}
              {data.stores.length ? (
                <div className="table-wrap">
                  <table className="data-table" style={{ minWidth: 620 }}>
                    <thead><tr><th>No. de tienda</th><th>Nombre</th><th>Equipos asignados</th><th>Última actualización</th></tr></thead>
                    <tbody>{data.stores.map((store) => <tr key={store.id}><td><span className="barcode">{store.storeNumber}</span></td><td><span className="device-name">{store.name}</span></td><td>{data.equipment.filter((item) => item.storeId === store.id).length}</td><td>{formatDate(store.updatedAt)}</td></tr>)}</tbody>
                  </table>
                </div>
              ) : <EmptyState title="Aún no hay tiendas" text="Puedes agregarlas manualmente o dejar que el importador las cree desde el CSV." />}
            </section>
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
                <FormField label="Clase de artículo" id="item-kind"><select id="item-kind" className="select" value={editing.itemKind} onChange={(event) => { const itemKind = event.target.value as ItemKind; setEditing({ ...editing, itemKind, quantity: itemKind === "equipment" ? 1 : Math.max(1, editing.quantity) }); }} disabled={!writable || Boolean(editing.id)}><option value="equipment">Equipo con No. de Serie</option><option value="material">Material por cantidad</option></select></FormField>
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
                {editing.itemKind === "equipment" ? <FormField label="MAC Address" id="mac-address"><input id="mac-address" className="input" value={editing.macAddress} onChange={(event) => setEditing({ ...editing, macAddress: event.target.value })} placeholder="AA:BB:CC:DD:EE:FF" readOnly={!writable} /></FormField> : null}
                {editing.itemKind === "equipment" ? <FormField label="Dirección IP" id="ip-address"><input id="ip-address" className="input" value={editing.ipAddress} onChange={(event) => setEditing({ ...editing, ipAddress: event.target.value })} placeholder="192.168.1.10" readOnly={!writable} /></FormField> : null}
                {writable && editing.itemKind === "equipment" ? <FormField label={editing.hasCredential ? "Nueva contraseña (opcional)" : "Contraseña del equipo"} id="password"><input id="password" type="password" className="input" value={editing.password} onChange={(event) => setEditing({ ...editing, password: event.target.value })} autoComplete="new-password" placeholder={editing.hasCredential ? "Dejar vacío para conservar" : "Opcional"} /></FormField> : null}
                {editing.itemKind === "equipment" && editing.id && editing.hasCredential && data.currentUser.role === "admin" ? <div className="field"><label htmlFor="saved-password">Contraseña guardada</label><div className="credential-row"><input id="saved-password" className="input" value={revealedPassword || "••••••••••••"} readOnly /><button className="secondary-button" type="button" onClick={() => void revealCredential()} disabled={saving}>{revealedPassword ? "Ocultar" : "Mostrar"}</button></div></div> : null}
                <FormField label="Notas" id="notes" full><textarea id="notes" className="textarea" value={editing.notes} onChange={(event) => setEditing({ ...editing, notes: event.target.value })} readOnly={!writable} placeholder="Observaciones o detalles adicionales" /></FormField>
              </div>
            </div>
            <div className="modal-actions"><button className="secondary-button" type="button" onClick={() => setEditing(null)}>Cerrar</button>{writable ? <button className="primary-button" type="submit" disabled={saving}>{saving ? "Guardando…" : editing.id ? "Guardar cambios" : "Guardar y continuar"}</button> : null}</div>
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
