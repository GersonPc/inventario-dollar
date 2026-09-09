"use client";

import { useEffect, useRef, useState } from "react";
import type { PlanRow, SyncChoice } from "@/lib/sharepoint-plan";

type Preview = {
  previewId: string;
  plan: PlanRow[];
  summary: { type: string; detail: number; summary: number | null }[];
  summaryTotal: number | null;
  summaryMatches: boolean;
  warnings: string[];
  absent: string[];
  equipment: { id: number; barcode: string; model: string; deviceType: string }[];
};

const labels = { create: "Nuevo", link: "Vincular", update: "Actualizar", unchanged: "Conservar", conflict: "Revisar" };

export default function SharePointImport({ requestAccess, onImported }: {
  requestAccess: () => Promise<string | null>;
  onImported: () => Promise<void>;
}) {
  const [status, setStatus] = useState<{ configured: boolean; sourceUrl: string } | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [choices, setChoices] = useState<Record<string, SyncChoice>>({});
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/sharepoint", { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("No se pudo comprobar la conexión.");
        setStatus(await response.json());
      })
      .catch((reason) => { if (!controller.signal.aborted) setError(reason.message); });
    return () => controller.abort();
  }, []);

  async function run(action: "preview" | "apply", selectedFile: File | null = file, selectedChoices = choices) {
    setBusy(true); setError(""); setMessage("");
    try {
      const token = await requestAccess();
      if (!token) return;
      const upload = action === "preview" && selectedFile;
      const response = await fetch("/api/sharepoint", {
        method: "POST", headers: {
          "content-type": upload ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "application/json",
          authorization: `Bearer ${token}`, ...(upload ? { "x-sync-choices": JSON.stringify(selectedChoices) } : {}),
        },
        body: upload ? selectedFile : JSON.stringify({ action, choices: selectedChoices, previewId: preview?.previewId }),
      });
      const payload = await response.json() as Preview & { error?: string; created: number; updated: number; linked: number; conflicts: number; summaryTotal: number };
      if (!response.ok) throw new Error(payload.error ?? "No se pudo leer el inventario de SharePoint.");
      if (action === "preview") { setPreview(payload); setDirty(false); }
      else {
        setMessage(`Resumen oficial actualizado a ${payload.summaryTotal} unidades · ${payload.created} nuevos · ${payload.updated} actualizados · ${payload.linked} vinculados · ${payload.conflicts} pendientes de revisión.`);
        setPreview(null); setChoices({}); setDirty(false); await onImported();
      }
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo completar la importación."); }
    finally { setBusy(false); }
  }

  const pending = preview?.plan.filter((row) => row.action !== "conflict" && row.action !== "unchanged").length ?? 0;
  return <section className="panel preview-card sharepoint-import" aria-label="Importar desde SharePoint">
    <div className="panel-header">
      <div><h2 className="panel-title">Excel de SharePoint</h2><div className="panel-meta">Fuente oficial del resumen · Archivo original en solo lectura</div></div>
      <button type="button" className="primary-button" disabled={!status?.configured || busy} onClick={() => { setFile(null); setPreview(null); setChoices({}); void run("preview", null, {}); }}>
        {busy ? "Procesando…" : "Consultar cambios"}
      </button>
    </div>
    <p>El apartado RESUMEN del Excel es la fuente oficial del resumen de la aplicación. Los registros creados desde la aplicación se conservan en el inventario, pero no alteran esos totales.</p>
    {status ? <p>{status.configured ? "Conexión configurada. Consulta el archivo para verificar el acceso." : "Pendiente de configurar: el administrador de Microsoft 365 debe autorizar la lectura de este archivo y completar la conexión del servidor."} {<a href={status.sourceUrl} target="_blank" rel="noreferrer">Abrir Excel de origen</a>}</p> : <p>Comprobando conexión…</p>}
    <div className="panel-actions sharepoint-actions">
      <input ref={fileInput} className="file-input" type="file" accept=".xlsx" onChange={(event) => {
        const selected = event.target.files?.[0];
        if (!selected) return;
        if (selected.size > 5 * 1024 * 1024) { setError("El Excel supera el límite de 5 MB."); return; }
        setFile(selected); setPreview(null); setChoices({}); setDirty(false);
      }} />
      <button type="button" className="secondary-button" disabled={busy} onClick={() => fileInput.current?.click()}>Elegir Excel descargado</button>
      {file ? <><span>{file.name} · Copia local, sin actualización automática</span><button type="button" className="primary-button" disabled={busy} onClick={() => void run("preview")}>Revisar archivo</button></> : null}
    </div>
    {error ? <p role="alert">{error}</p> : null}
    {message ? <p role="status">{message}</p> : null}
    {preview ? <>
      <h3>Resumen del archivo consultado</h3>
      <div className="device-summary-table-wrap"><table className="device-summary-table">
        <thead><tr><th>Tipo de equipo</th><th>Detalle de Inventario</th><th>RESUMEN de Excel</th></tr></thead>
        <tbody>{preview.summary.map((group) => <tr key={group.type}><td>{group.type}</td><td>{group.detail}</td><td>{group.summary ?? "Sin dato"}</td></tr>)}</tbody>
        <tfoot><tr><th>Total</th><td>{preview.plan.length}</td><td>{preview.summaryTotal ?? "Sin dato"}</td></tr></tfoot>
      </table></div>
      {!preview.summaryMatches ? <p role="alert">El RESUMEN del Excel no coincide con su detalle. La aplicación mantendrá las cantidades visibles en RESUMEN y dejará el archivo original intacto.</p> : null}
      {preview.absent.length ? <p>Items que ya no aparecen en Excel: {preview.absent.join(", ")}. Sus equipos se conservarán en el inventario, fuera del resumen oficial.</p> : null}
      {preview.warnings.length ? <details><summary>{preview.warnings.length} fechas para revisar</summary><ul>{preview.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></details> : null}
      <h3>Revisión de los equipos</h3>
      <p>Al vincular por primera vez se conservan los valores de la aplicación. El Item del Excel identifica el vínculo: si renumeran los Items, será necesario revisarlo. Confirma «Crear equipo nuevo» únicamente si no está registrado.</p>
      <div className="sharepoint-rows"><table className="device-summary-table">
        <thead><tr><th>Item / Artículo</th><th>Resultado</th><th>Vínculo</th></tr></thead>
        <tbody>{preview.plan.map((row) => <tr key={row.source.item}>
          <td><strong>{row.source.item} · {row.source.deviceType}</strong><br />{row.source.model}<br /><small>Serie: {row.source.serial || "Sin serie"}</small></td>
          <td>{labels[row.action]}<br /><small>{row.reason}</small></td>
          <td>{row.canChoose ? <select className="input" aria-label={`Vincular Item ${row.source.item}`} disabled={busy}
            value={choices[row.source.item] ?? (row.action === "link" ? row.equipmentId ?? "skip" : "skip")}
            onChange={(event) => {
              const value = event.target.value;
              setChoices((current) => {
                const next = { ...current };
                next[row.source.item] = value === "create" || value === "skip" ? value : Number(value);
                return next;
              }); setDirty(true);
            }}>
            <option value="skip">Dejar pendiente</option><option value="create">Crear equipo nuevo</option>
            {preview.equipment.map((equipment) => <option key={equipment.id} value={equipment.id}>{equipment.barcode} · {equipment.deviceType} · {equipment.model}</option>)}
          </select> : <span>Equipo #{row.equipmentId}</span>}</td>
        </tr>)}</tbody>
      </table></div>
      <div className="panel-actions sharepoint-actions">
        {dirty ? <button className="secondary-button" type="button" disabled={busy} onClick={() => void run("preview")}>Revisar los vínculos seleccionados</button> : null}
        <button className="primary-button" type="button" disabled={busy || dirty} onClick={() => void run("apply")}>Actualizar resumen y aplicar {pending} cambios</button>
      </div>
    </> : null}
  </section>;
}
