export type UploadDiagnosticEvent =
  | "picker_attempt"
  | "picker_opened"
  | "picker_blocked"
  | "picker_cancelled"
  | "upload_removed"
  | "file_selected"
  | "upload_started"
  | "upload_done"
  | "upload_failed"
  | "upload_picker_open_attempt"
  | "upload_picker_open_blocked"
  | "upload_file_selected";

type UploadDiagnosticPayload = Record<string, unknown>;

const LEGACY_EVENT_MAP: Partial<Record<UploadDiagnosticEvent, UploadDiagnosticEvent>> = {
  upload_picker_open_attempt: "picker_attempt",
  upload_picker_open_blocked: "picker_blocked",
  upload_file_selected: "file_selected",
};

function isDiagnosticsEnabled() {
  if (typeof window === "undefined") return false;
  if (process.env.NODE_ENV !== "production") return true;
  return process.env.NEXT_PUBLIC_UPLOAD_DIAGNOSTICS === "true";
}

declare global {
  interface WindowEventMap {
    "admin-upload-diagnostic": CustomEvent<{
      event: UploadDiagnosticEvent;
      originalEvent: UploadDiagnosticEvent;
      payload: UploadDiagnosticPayload;
      timestamp: string;
    }>;
  }
}

export function logUploadDiagnostic(event: UploadDiagnosticEvent, payload: UploadDiagnosticPayload = {}) {
  if (!isDiagnosticsEnabled()) {
    return;
  }

  const normalizedEvent = LEGACY_EVENT_MAP[event] ?? event;
  const detail = {
    event: normalizedEvent,
    originalEvent: event,
    payload,
    timestamp: new Date().toISOString(),
  };

  window.dispatchEvent(new CustomEvent("admin-upload-diagnostic", { detail }));
  if (process.env.NODE_ENV !== "production") {
    console.debug("[upload-diagnostic]", detail);
  }
}
