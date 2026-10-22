// navigator.clipboard only exists in secure contexts: https, localhost and the desktop app's app:// origin
export const clipboardAvailable = window.isSecureContext && !!navigator.clipboard;
