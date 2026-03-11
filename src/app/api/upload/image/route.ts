import { NextRequest, NextResponse } from "next/server";
import {
  createImageDeliveryRef,
  createMediaAsset,
  isMediaAssetsSchemaMissingError,
  resolveMediaAssetPreviewState,
} from "@/lib/mediaAssets";
import {
  resolveMediaPreviewUrl,
  toMediaReference,
  uploadMediaBuffer,
} from "@/lib/storage";

export async function GET(request: NextRequest) {
  try {
    const value = request.nextUrl.searchParams.get("value");
    if (!value?.trim()) {
      return NextResponse.json({ error: "Chybí value" }, { status: 400 });
    }

    let assetState = null;
    try {
      assetState = await resolveMediaAssetPreviewState(value.trim());
    } catch (err) {
      if (!isMediaAssetsSchemaMissingError(err)) {
        throw err;
      }
    }
    if (assetState) {
      return NextResponse.json(assetState);
    }

    const storedUrl = toMediaReference(value, "public");
    const previewUrl = await resolveMediaPreviewUrl(storedUrl, "public");

    return NextResponse.json({
      storedUrl,
      previewUrl: previewUrl ?? null,
      status: "ready",
      assetId: null,
    });
  } catch (err) {
    console.error("Image resolve error:", err);
    return NextResponse.json(
      { error: "Nepodařilo se připravit preview URL" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const key = formData.get("key") as string | null;

    if (!file || !key) {
      return NextResponse.json(
        { error: "Chybí soubor nebo klíč" },
        { status: 400 },
      );
    }

    const allowedTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
      "image/gif",
    ];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Nepodporovaný formát obrázku" },
        { status: 400 },
      );
    }

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "Soubor je příliš velký (max 10MB)" },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    try {
      const asset = await createMediaAsset({
        kind: "image",
        fileName: file.name || key,
        contentType: file.type,
      });

      await uploadMediaBuffer({
        key: asset.master_object_key,
        buffer,
        contentType: file.type,
        bucket: "private",
      });

      const previewUrl = await resolveMediaPreviewUrl(
        `private://${asset.master_object_key}`,
        "private",
      );
      const storedUrl = createImageDeliveryRef(asset.id);

      return NextResponse.json({
        storedUrl,
        previewUrl: previewUrl ?? null,
        status: asset.status,
        assetId: asset.id,
      });
    } catch (err) {
      if (!isMediaAssetsSchemaMissingError(err)) {
        throw err;
      }

      const storedUrl = await uploadMediaBuffer({
        key: key.trim(),
        buffer,
        contentType: file.type,
        bucket: "public",
      });
      const previewUrl = await resolveMediaPreviewUrl(storedUrl, "public");

      return NextResponse.json({
        storedUrl,
        previewUrl: previewUrl ?? null,
        status: "ready",
        assetId: null,
        pipelineBypassed: true,
      });
    }
  } catch (err) {
    console.error("Image upload error:", err);
    return NextResponse.json({ error: "Upload selhal" }, { status: 500 });
  }
}
