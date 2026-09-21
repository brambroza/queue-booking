import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import sharp from 'sharp';
import { z } from 'zod';
import { requireAuthContext, getErrorStatus } from '@/lib/auth/context';
import { createAdminClient } from '@/lib/supabase/admin';
import { ensureBucket } from '@/lib/storage/buckets';
import { sniffImageMime } from '@/lib/utils/image-sniff';
import { SHOP_ASSETS_BUCKET, SHOP_IMAGE_KINDS, SHOP_IMAGE_MAX_BYTES, buildShopAssetPath } from '@/lib/storage/shop-assets';

export const runtime = 'nodejs';

const KindSchema = z.enum(SHOP_IMAGE_KINDS);

/** Long edge of the stored photo; plenty for a full-screen phone gallery. */
const MAX_EDGE = 1600;
/** Guards against decompression bombs — a phone photo is ~12–50 megapixels. */
const MAX_INPUT_PIXELS = 60_000_000;

/**
 * Upload one photo (resource / service cover / branch venue map) to the public
 * `shop-assets` bucket and return its URL.
 *
 * Deliberately does not touch any table: the form attaches the returned URL and
 * the normal POST/PATCH saves it, so photos can be added before the record
 * exists. Those routes only accept URLs under the shop's own prefix.
 *
 * The image is always re-encoded: that strips EXIF (phone photos carry GPS) and
 * guarantees the stored bytes really are the JPEG the extension claims.
 */
export async function POST(req: Request) {
  try {
    const { profile } = await requireAuthContext({ roles: ['super_admin', 'shop_owner', 'branch_manager'] });
    if (!profile.shop_id) return NextResponse.json({ error: 'ยังไม่ได้เลือกร้าน' }, { status: 400 });

    const form = await req.formData();
    const kind = KindSchema.safeParse(form.get('kind'));
    if (!kind.success) return NextResponse.json({ error: 'kind ไม่ถูกต้อง' }, { status: 400 });

    const image = form.get('image');
    if (!(image instanceof File) || image.size === 0) {
      return NextResponse.json({ error: 'ไม่พบไฟล์รูป' }, { status: 400 });
    }
    if (image.size > SHOP_IMAGE_MAX_BYTES) {
      return NextResponse.json({ error: 'ไฟล์ใหญ่เกิน 5 MB' }, { status: 413 });
    }

    const bytes = new Uint8Array(await image.arrayBuffer());
    // The declared type and the filename are client-controlled; trust the bytes only.
    if (!sniffImageMime(bytes)) {
      return NextResponse.json({ error: 'รองรับเฉพาะไฟล์ JPEG, PNG หรือ WebP' }, { status: 400 });
    }

    let encoded: Buffer;
    try {
      encoded = await sharp(bytes, { limitInputPixels: MAX_INPUT_PIXELS })
        .rotate()
        .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: 'inside', withoutEnlargement: true })
        .flatten({ background: '#ffffff' })
        .jpeg({ quality: 82, mozjpeg: true })
        .toBuffer();
    } catch {
      return NextResponse.json({ error: 'อ่านไฟล์รูปไม่ได้ กรุณาลองรูปอื่น' }, { status: 400 });
    }

    const admin = createAdminClient();
    await ensureBucket(admin, SHOP_ASSETS_BUCKET, { public: true, fileSizeLimit: SHOP_IMAGE_MAX_BYTES });

    const path = buildShopAssetPath(profile.shop_id, kind.data, 'jpg', randomBytes(6).toString('hex'));
    const { error: uploadError } = await admin.storage.from(SHOP_ASSETS_BUCKET).upload(path, encoded, {
      upsert: false,
      contentType: 'image/jpeg',
      cacheControl: '31536000',
    });
    if (uploadError) throw uploadError;

    const { data: publicData } = admin.storage.from(SHOP_ASSETS_BUCKET).getPublicUrl(path);
    return NextResponse.json({ data: { url: publicData.publicUrl } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: getErrorStatus(e) });
  }
}
