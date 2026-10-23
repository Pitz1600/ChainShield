// Use only for idempotent reads. Never retry CSV imports or attachment writes.
export async function retryReadRequest(read, { attempts = 5, wait = ms => new Promise(resolve => setTimeout(resolve, ms)) } = {}) {
  for (let attempt = 0; ; attempt++) {
    try { return await read(); }
    catch (error) {
      const status = error.response?.status;
      const networkFailure = !error.response && (error.request || ['ERR_NETWORK', 'ECONNABORTED', 'ETIMEDOUT'].includes(error.code));
      // Vite's proxy can return an empty 500 when the backend is restarting.
      const proxyFailure = [502, 503, 504].includes(status) || (status === 500 && !error.response?.data);
      if (error.code === 'ERR_CANCELED' || (!networkFailure && !proxyFailure) || attempt >= attempts - 1) throw error;
      await wait(750 * (2 ** attempt));
    }
  }
}
