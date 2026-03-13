import { logUploadDiagnostic } from "@/lib/uploadDiagnostics";

type PickerInput = HTMLInputElement & { showPicker?: () => void };

type SafeOpenFileDialogContext = {
  component: string;
  source: string;
  label?: string;
};

type SafeOpenFileDialogOptions = {
  watchdogMs?: number;
};

function emit(context: SafeOpenFileDialogContext, payload: Record<string, unknown>) {
  logUploadDiagnostic("picker_blocked", {
    component: context.component,
    source: context.source,
    label: context.label,
    ...payload,
  });
}

function attemptClick(input: HTMLInputElement, context: SafeOpenFileDialogContext, method: string) {
  try {
    input.click();
    logUploadDiagnostic("picker_opened", {
      component: context.component,
      source: context.source,
      label: context.label,
      method,
    });
    return true;
  } catch (error) {
    emit(context, {
      reason: `${method}-threw`,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

export function safeOpenFileDialog(
  input: HTMLInputElement | null,
  context: SafeOpenFileDialogContext,
  options: SafeOpenFileDialogOptions = {},
) {
  logUploadDiagnostic("picker_attempt", {
    component: context.component,
    source: context.source,
    label: context.label,
  });

  if (!input) {
    emit(context, { reason: "missing-input" });
    return false;
  }

  if (input.disabled) {
    emit(context, { reason: "input-disabled" });
    return false;
  }

  const watchdogMs = options.watchdogMs ?? 220;
  const target = input;
  let changed = false;
  let blurred = false;
  let cleanedUp = false;

  let watchdogTimer: number | null = null;
  let hardStopTimer: number | null = null;

  const onChange = () => {
    changed = true;
    cleanup();
  };

  const onFocus = () => {
    window.setTimeout(() => {
      if (!changed) {
        logUploadDiagnostic("picker_cancelled", {
          component: context.component,
          source: context.source,
          label: context.label,
          reason: "dialog-closed-without-selection",
        });
      }
      cleanup();
    }, 0);
  };

  const onBlur = () => {
    blurred = true;
    window.addEventListener("focus", onFocus, { once: true });
  };

  function cleanup() {
    if (cleanedUp) return;
    cleanedUp = true;
    target.removeEventListener("change", onChange);
    window.removeEventListener("blur", onBlur);
    window.removeEventListener("focus", onFocus);
    if (watchdogTimer) {
      window.clearTimeout(watchdogTimer);
      watchdogTimer = null;
    }
    if (hardStopTimer) {
      window.clearTimeout(hardStopTimer);
      hardStopTimer = null;
    }
  }

  target.addEventListener("change", onChange, { once: true });
  window.addEventListener("blur", onBlur, { once: true });

  let opened = attemptClick(target, context, "click");

  if (!opened) {
    const maybePicker = (target as PickerInput).showPicker;
    if (typeof maybePicker === "function") {
      try {
        maybePicker.call(target);
        opened = true;
        logUploadDiagnostic("picker_opened", {
          component: context.component,
          source: context.source,
          label: context.label,
          method: "showPicker-fallback",
        });
      } catch (error) {
        emit(context, {
          reason: "showPicker-fallback-threw",
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  watchdogTimer = window.setTimeout(() => {
    if (changed || blurred) return;

    emit(context, { reason: "silent-fail-watchdog" });
    attemptClick(target, context, "watchdog-click");
  }, watchdogMs);

  hardStopTimer = window.setTimeout(() => {
    if (!changed && !blurred) {
      logUploadDiagnostic("picker_cancelled", {
        component: context.component,
        source: context.source,
        label: context.label,
        reason: "watchdog-timeout-no-dialog",
      });
    }
    cleanup();
  }, 5000);

  return opened;
}
