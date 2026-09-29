import { captureProvisionalDimensionsViaCamera, type CameraCaptureInput } from './camera-dimension-adapter';
import { evaluateProvisionalDimensions } from '../../../../../api/src/common/bakeoff/dimension-quality-gate.ts';

export type PacketCSubmit = (payload: {
  packageBarcode: string;
  length: number;
  width: number;
  height: number;
  confidence: number;
  decision: string;
  billingEligible: false;
  measurementSource: string;
}) => Promise<{ accepted: boolean; measurementId?: string }>;

/** Candidate Packet C entry: camera seam then measurement gate then API submission. */
export async function runPacketCCandidateWorkflow(input: CameraCaptureInput & { submit: PacketCSubmit; confidence?: number }) {
  const capture = await captureProvisionalDimensionsViaCamera({
    packageBarcode: input.packageBarcode,
    frameToken: input.frameToken,
  });
  const confidence = input.confidence ?? capture.confidence;
  const gate = evaluateProvisionalDimensions({
    length: capture.length,
    width: capture.width,
    height: capture.height,
    confidence,
  });
  const submitted = await input.submit({
    packageBarcode: capture.packageBarcode,
    length: capture.length,
    width: capture.width,
    height: capture.height,
    confidence,
    decision: gate.decision,
    billingEligible: false,
    measurementSource: capture.measurementSource,
  });
  return { capture, gate, submitted, billingEligible: false as const };
}

export function diagnosePacketCExecution(input: {
  cameraCallsBefore: number;
  cameraCallsAfter: number;
  submitted: boolean;
  capturesEqual: boolean;
}) {
  if (input.cameraCallsAfter === input.cameraCallsBefore) return { ok: false, code: 'CAMERA_BYPASS' };
  if (!input.submitted) return { ok: false, code: 'API_SUBMISSION_BYPASS' };
  if (input.capturesEqual) return { ok: false, code: 'HARDCODED_DIMENSIONS' };
  return { ok: true, code: 'PACKET_C_WORKFLOW_OK' };
}
