type UploadKind = "image" | "audio" | "video";

type UploadPolicy = {
  prefix: string;
  allowedKinds: UploadKind[];
};

const UPLOAD_POLICIES: UploadPolicy[] = [
  { prefix: "homepage/hero/", allowedKinds: ["image", "video"] },
  { prefix: "covers/", allowedKinds: ["image"] },
  { prefix: "avatars/", allowedKinds: ["image"] },
  { prefix: "posts/", allowedKinds: ["image"] },
  { prefix: "stories/", allowedKinds: ["image"] },
  { prefix: "audio/", allowedKinds: ["audio"] },
  { prefix: "video/", allowedKinds: ["video"] },
];

const SAFE_KEY_PATTERN = /^[a-zA-Z0-9/_\-.]+$/;

function normalizeUploadKey(rawValue: string): string {
  return rawValue.trim();
}

function resolveKindFromContentType(contentType: string): UploadKind | null {
  const normalized = contentType.trim().toLowerCase();
  if (normalized.startsWith("image/")) return "image";
  if (normalized.startsWith("audio/")) return "audio";
  if (normalized.startsWith("video/")) return "video";
  return null;
}

function findPolicyForKey(key: string): UploadPolicy | null {
  return UPLOAD_POLICIES.find((policy) => key.startsWith(policy.prefix)) ?? null;
}

export function validateUploadKey(rawValue: unknown):
  | { ok: true; key: string }
  | { ok: false; error: string } {
  if (typeof rawValue !== "string") {
    return { ok: false, error: "Neplatný upload key" };
  }

  const key = normalizeUploadKey(rawValue);
  if (!key) {
    return { ok: false, error: "Upload key nesmí být prázdný" };
  }
  if (key.startsWith("/")) {
    return { ok: false, error: "Upload key nesmí začínat '/'" };
  }
  if (key.includes("..") || key.includes("\\")) {
    return { ok: false, error: "Upload key obsahuje neplatnou cestu" };
  }
  if (!SAFE_KEY_PATTERN.test(key)) {
    return { ok: false, error: "Upload key obsahuje nepovolené znaky" };
  }

  const policy = findPolicyForKey(key);
  if (!policy) {
    return { ok: false, error: "Upload key není v povoleném prefixu" };
  }

  return { ok: true, key };
}

export function validateUploadContentTypeForKey(
  key: string,
  contentType: unknown,
): { ok: true } | { ok: false; error: string } {
  if (typeof contentType !== "string" || !contentType.trim()) {
    return { ok: false, error: "Chybí contentType" };
  }

  const policy = findPolicyForKey(key);
  if (!policy) {
    return { ok: false, error: "Upload key není v povoleném prefixu" };
  }

  const kind = resolveKindFromContentType(contentType);
  if (!kind || !policy.allowedKinds.includes(kind)) {
    return { ok: false, error: "Nepovolený contentType pro tento upload key" };
  }

  return { ok: true };
}
