export type UploadDiagnosticEvent =
  | "upload_picker_open_attempt"
  | "upload_picker_open_blocked"
  | "upload_removed"
  | "upload_file_selected";

type UploadDiagnosticPayload = Record<string, unknown>;

declare global {
  interface WindowEventMap {
    "admin-upload-diagnostic": CustomEvent<{
      event: UploadDiagnosticEvent;
      payload: UploadDiagnosticPayload;
      timestamp: string;
    }>;
  }
}

export function logUploadDiagnostic(event: UploadDiagnosticEvent, payload: UploadDiagnosticPayload = {}) {
  if (typeof window === "undefined" || process.env.NODE_ENV === "production") {
    return;
  }

  const detail = {
    event,
    payload,
    timestamp: new Date().toISOString(),
  };

  window.dispatchEvent(new CustomEvent("admin-upload-diagnostic", { detail }));
  console.debug("[upload-diagnostic]", detail);
}
