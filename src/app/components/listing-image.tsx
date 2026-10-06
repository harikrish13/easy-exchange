export function ListingImage({
  photoId,
  alt,
}: {
  photoId: string;
  alt: string;
}) {
  return (
    // Served by the photo route handler from uploads/, not as a static import.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={`/photos/${photoId}`} alt={alt} />
  );
}
