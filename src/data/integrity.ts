/** SHA-256 used to verify downloaded data before it can replace local data. */
export async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', buffer));
  return [...digest].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
