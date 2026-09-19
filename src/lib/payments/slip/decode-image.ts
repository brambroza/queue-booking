/**
 * Read the QR code out of an uploaded slip image. Server-only (sharp).
 *
 * Decoding happens on the server, from the exact bytes that were stored, rather
 * than in LIFF: a client-supplied payload could describe a different transfer
 * than the picture the staff member ends up looking at.
 */
import sharp from 'sharp';
import jsQR from 'jsqr';

/** Guards against decompression bombs — a slip screenshot is a few megapixels. */
const MAX_INPUT_PIXELS = 40_000_000;
/** jsQR cost grows with area; slips are tall, so cap the long edge. */
const MAX_EDGE = 2000;

interface RawImage {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

type Region = { left: number; top: number; width: number; height: number };

/** Render (a region of) the image to RGBA pixels, optionally upscaled and contrast-stretched. */
async function renderRgba(
  bytes: Uint8Array,
  opts: { region?: Region; targetEdge: number; normalise?: boolean },
): Promise<RawImage> {
  let pipeline = sharp(bytes, { limitInputPixels: MAX_INPUT_PIXELS, failOn: 'none' }).rotate();
  if (opts.region) pipeline = pipeline.extract(opts.region);
  pipeline = pipeline.resize({
    width: opts.targetEdge,
    height: opts.targetEdge,
    fit: 'inside',
    withoutEnlargement: !opts.region,
    kernel: 'nearest',
  });
  if (opts.normalise) pipeline = pipeline.greyscale().normalise();

  const { data, info } = await pipeline.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data: new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength), width: info.width, height: info.height };
}

function scan(image: RawImage): string | null {
  const hit = jsQR(image.data, image.width, image.height, { inversionAttempts: 'attemptBoth' });
  const text = hit?.data?.trim();
  return text ? text : null;
}

/**
 * Decode the QR payload from slip image bytes, or null when none can be read.
 *
 * Tries the whole image first, then the lower half enlarged — every Thai bank
 * app prints the verification QR small, near the bottom of the slip, where JPEG
 * compression from the LIFF upload hurts it most.
 *
 * Never throws: an unreadable image is an ordinary outcome, not an error.
 */
export async function decodeSlipQr(bytes: Uint8Array): Promise<string | null> {
  try {
    const meta = await sharp(bytes, { limitInputPixels: MAX_INPUT_PIXELS, failOn: 'none' }).rotate().metadata();
    const width = meta.autoOrient?.width ?? meta.width ?? 0;
    const height = meta.autoOrient?.height ?? meta.height ?? 0;
    if (!width || !height) return null;

    const full = scan(await renderRgba(bytes, { targetEdge: MAX_EDGE }));
    if (full) return full;

    const lowerHalf: Region = { left: 0, top: Math.floor(height / 2), width, height: height - Math.floor(height / 2) };
    const zoomed = scan(await renderRgba(bytes, { region: lowerHalf, targetEdge: MAX_EDGE }));
    if (zoomed) return zoomed;

    return scan(await renderRgba(bytes, { region: lowerHalf, targetEdge: MAX_EDGE, normalise: true }));
  } catch (e) {
    console.error('[slip-qr] decode failed:', e instanceof Error ? e.message : e);
    return null;
  }
}
