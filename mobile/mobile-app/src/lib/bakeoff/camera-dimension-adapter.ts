/** Controlled camera integration seam for Packet C (not legal-metrology certification). */

export type CameraCaptureInput = {
  packageBarcode: string;
  frameToken: string;
};

export type CameraCaptureResult = {
  packageBarcode: string;
  length: number;
  width: number;
  height: number;
  confidence: number;
  measurementSource: 'CAMERA_PROVISIONAL';
  captureMethod: 'EXPO_CAMERA';
};

export type CameraDimensionAdapter = (input: CameraCaptureInput) => Promise<CameraCaptureResult>;

function tokenSeed(token: string): number {
  let h = 0;
  for (let i = 0; i < token.length; i++) h = (h * 31 + token.charCodeAt(i)) >>> 0;
  return h;
}

const defaultAdapter: CameraDimensionAdapter = async (input) => {
  const seed = tokenSeed(input.frameToken);
  return {
    packageBarcode: input.packageBarcode,
    length: 10 + (seed % 11),
    width: 20 + ((seed >> 3) % 13),
    height: 30 + ((seed >> 5) % 17),
    confidence: 0.55 + (seed % 40) / 100,
    measurementSource: 'CAMERA_PROVISIONAL',
    captureMethod: 'EXPO_CAMERA',
  };
};

let activeAdapter: CameraDimensionAdapter = defaultAdapter;
let adapterInvocationCount = 0;

export function setBakeoffCameraAdapter(adapter: CameraDimensionAdapter): void {
  activeAdapter = adapter;
}

export function resetBakeoffCameraAdapter(): void {
  activeAdapter = defaultAdapter;
  adapterInvocationCount = 0;
}

export function getBakeoffCameraAdapterInvocationCount(): number {
  return adapterInvocationCount;
}

/** Candidate Packet C must route capture through this seam. */
export async function captureProvisionalDimensionsViaCamera(
  input: CameraCaptureInput,
): Promise<CameraCaptureResult> {
  adapterInvocationCount += 1;
  const result = await activeAdapter(input);
  if (result.packageBarcode !== input.packageBarcode) {
    throw new Error('PACKAGE_IDENTITY_NOT_PROPAGATED');
  }
  return result;
}
