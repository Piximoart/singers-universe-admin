import { NextRequest, NextResponse } from "next/server";
import { resolveMediaPreviewUrl, toMediaReference, uploadImage } from "@/lib/storage";

export async function GET(request: NextRequest) {
  try {
    const value = request.nextUrl.searchParams.get("value");
    if (!value?.trim()) {
      return NextResponse.json({ error: "Chybí value" }, { status: 400 });
    }

    const storedUrl = toMediaReference(value, "public");
    const previewUrl = await resolveMediaPreviewUrl(storedUrl, "public");

    return NextResponse.json({ storedUrl, previewUrl: previewUrl ?? null });
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
    const storedUrl = await uploadImage(key, buffer, file.type);
    const previewUrl = await resolveMediaPreviewUrl(storedUrl, "public");

    return NextResponse.json({ storedUrl, previewUrl: previewUrl ?? null });
  } catch (err) {
    console.error("Image upload error:", err);
    return NextResponse.json({ error: "Upload selhal" }, { status: 500 });
  }
}
