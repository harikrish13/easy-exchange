import { readStoredPhoto } from "@/server/photos";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ photoId: string }> },
) {
  const { photoId } = await context.params;
  const photo = await readStoredPhoto(photoId);
  if (!photo) {
    return new Response(null, { status: 404 });
  }

  return new Response(new Uint8Array(photo.bytes), {
    status: 200,
    headers: {
      "Content-Type": photo.mimeType,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
