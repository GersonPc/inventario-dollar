/** Fixed source: callers cannot provide arbitrary URLs or select another tenant. */
export const sharePointSource = {
  tenantId: "5025b09d-84b2-4789-a402-eeb445671790",
  hostname: "tecnasaes.sharepoint.com",
  documentId: "7e7310d7-05dd-4864-83ad-64d43587d358",
  url: "https://tecnasaes.sharepoint.com/:x:/r/sites/Dpto.IngenieraGuatemala/Ger_Ing_TEG/_layouts/15/Doc.aspx?sourcedoc=%7B7E7310D7-05DD-4864-83AD-64D43587D358%7D&action=default",
};

export type SharePointConfig = {
  SHAREPOINT_CLIENT_ID?: string;
  SHAREPOINT_CLIENT_SECRET?: string;
  SHAREPOINT_DRIVE_ID?: string;
  SHAREPOINT_ITEM_ID?: string;
};

export function sharePointConfigured(config: SharePointConfig): boolean {
  return [config.SHAREPOINT_CLIENT_ID, config.SHAREPOINT_CLIENT_SECRET,
    config.SHAREPOINT_DRIVE_ID, config.SHAREPOINT_ITEM_ID].every((value) => Boolean(value?.trim()));
}

export async function readBounded(response: Response, limit: number): Promise<Uint8Array> {
  if (Number(response.headers.get("content-length")) > limit) {
    await response.body?.cancel();
    throw new Error("El archivo supera el tamaño permitido.");
  }
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Microsoft devolvió una respuesta vacía.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > limit) throw new Error("El archivo supera el tamaño permitido.");
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return bytes;
}

/** Only the token exchange uses POST. Every request for SharePoint data is GET. */
export async function downloadSharePointWorkbook(config: SharePointConfig, fetcher: typeof fetch = fetch) {
  if (!sharePointConfigured(config)) {
    throw new Error("Falta configurar el acceso de lectura a Microsoft 365 en el servidor.");
  }
  const tokenResponse = await fetcher(`https://login.microsoftonline.com/${sharePointSource.tenantId}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.SHAREPOINT_CLIENT_ID!, client_secret: config.SHAREPOINT_CLIENT_SECRET!,
      grant_type: "client_credentials", scope: "https://graph.microsoft.com/.default",
    }),
    redirect: "error", signal: AbortSignal.timeout(20_000),
  });
  if (!tokenResponse.ok) throw new Error("Microsoft no autorizó la conexión. Revisa las credenciales de la aplicación.");
  const token = JSON.parse(new TextDecoder().decode(await readBounded(tokenResponse, 64_000))) as { access_token?: string };
  if (!token.access_token) throw new Error("Microsoft no devolvió una autorización válida.");
  const itemUrl = `https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(config.SHAREPOINT_DRIVE_ID!)}/items/${encodeURIComponent(config.SHAREPOINT_ITEM_ID!)}`;
  const graphGet = async (url: string) => {
    const response = await fetcher(url, {
      method: "GET", headers: { authorization: `Bearer ${token.access_token}` },
      redirect: "manual", signal: AbortSignal.timeout(30_000),
    });
    if (response.status === 403) throw new Error("La aplicación de Microsoft 365 necesita permiso de lectura sobre este archivo.");
    if (response.status === 429 || response.status >= 500) throw new Error("Microsoft está ocupado. Intenta sincronizar nuevamente más tarde.");
    return response;
  };
  const metadataResponse = await graphGet(`${itemUrl}?$select=id,name,eTag,size,webUrl,sharepointIds`);
  if (!metadataResponse.ok) throw new Error("No se pudo localizar el Excel configurado.");
  const metadata = JSON.parse(new TextDecoder().decode(await readBounded(metadataResponse, 64_000))) as {
    eTag?: string; name?: string; size?: number; webUrl?: string;
    sharepointIds?: { listItemUniqueId?: string };
  };
  const sourceUrl = new URL(metadata.webUrl ?? "https://invalid.local");
  if (sourceUrl.hostname !== sharePointSource.hostname ||
      metadata.sharepointIds?.listItemUniqueId?.replace(/[{}]/g, "").toLowerCase() !== sharePointSource.documentId) {
    throw new Error("El archivo configurado no es el inventario de SharePoint autorizado.");
  }
  if (!metadata.eTag || !metadata.name?.toLowerCase().endsWith(".xlsx")) throw new Error("El origen no es un Excel válido.");
  const limit = 5 * 1024 * 1024;
  if ((metadata.size ?? 0) > limit) throw new Error("El Excel supera el límite de 5 MB de esta conexión.");
  const download = await graphGet(`${itemUrl}/content`);
  let response = download;
  if (download.status === 302) {
    const location = new URL(download.headers.get("location") ?? "https://invalid.local");
    // Never forward the Graph bearer token to a download host.
    if (location.protocol !== "https:" || location.hostname !== sharePointSource.hostname || location.username || location.password) {
      throw new Error("Microsoft devolvió una ubicación de descarga inesperada.");
    }
    response = await fetcher(location, { method: "GET", redirect: "error", signal: AbortSignal.timeout(30_000) });
  }
  if (!response.ok) throw new Error("No se pudo descargar el Excel de SharePoint.");
  const bytes = await readBounded(response, limit);
  const afterResponse = await graphGet(`${itemUrl}?$select=eTag`);
  if (!afterResponse.ok) throw new Error("No se pudo verificar la versión del archivo.");
  const after = JSON.parse(new TextDecoder().decode(await readBounded(afterResponse, 64_000))) as { eTag?: string };
  if (after.eTag !== metadata.eTag) throw new Error("El Excel cambió durante la lectura. Vuelve a consultar.");
  return { bytes, version: metadata.eTag, name: metadata.name };
}
