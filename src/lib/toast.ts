export function toastSuccess(message: string) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("app-toast", { detail: { type: "success", message } })
    );
  }
}

export function toastError(message: string) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("app-toast", { detail: { type: "error", message } })
    );
  }
}
