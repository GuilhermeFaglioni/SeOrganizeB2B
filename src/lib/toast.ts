export type AppToastType = "success" | "error" | "info";

export interface AppToastDetail {
  id?: string;
  type: AppToastType;
  message: string;
  description?: string;
}

function dispatchToast(detail: AppToastDetail) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent<AppToastDetail>("app-toast", { detail }));
  }
}

export function toastSuccess(message: string, description?: string) {
  dispatchToast({ type: "success", message, description });
}

export function toastError(message: string, description?: string) {
  dispatchToast({ type: "error", message, description });
}

export function toastInfo(message: string, description?: string) {
  dispatchToast({ type: "info", message, description });
}
