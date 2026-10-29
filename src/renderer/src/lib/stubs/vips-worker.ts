/**
 * Stands in for @wordpress/vips/worker (wasm-vips, a 13 MB worker in the bundle).
 * Gutenberg loads it only for client-side media processing, which needs
 * window.__clientSideMediaProcessing; the app never sets it, because uploads go
 * through its own image pipeline (sharp, in the main process). So nothing calls this.
 */
const unavailable = (): never => {
  throw new Error('Client-side media processing is not available in CraftPages.')
}

export const vipsConvertImageFormat = unavailable
export const vipsCompressImage = unavailable
export const vipsHasTransparency = unavailable
export const vipsResizeImage = unavailable
export const vipsRotateImage = unavailable
export const vipsGetUltraHdrInfo = unavailable
export const vipsCancelOperations = (): boolean => false
export const terminateVipsWorker = (): void => {}
