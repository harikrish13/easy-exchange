import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ListingForm } from "@/app/components/listing-form";
import { ListingImage } from "@/app/components/listing-image";
import { updateListingAction } from "@/server/actions/listings";
import { listCategories } from "@/server/catalog";
import { requireUser } from "@/server/auth";
import { getOwnedListing } from "@/server/listings";

export const metadata: Metadata = {
  title: "Edit listing - Easy Exchange",
};

export default async function EditListingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const gate = await requireUser();
  if (!gate.ok) {
    return (
      <div className="wrap page">
        <h1>Edit listing</h1>
        <p className="error" role="alert">
          {gate.error.message}
        </p>
        <p>
          <a className="button" href={`/sign-in?callbackUrl=${encodeURIComponent(`/listings/${id}/edit`)}`}>
            Sign in
          </a>
        </p>
      </div>
    );
  }

  const owned = await getOwnedListing(id, gate.user.id);
  if (owned.kind === "missing") notFound();
  if (owned.kind === "not-owner") {
    return (
      <div className="wrap page">
        <h1>Edit listing</h1>
        <p className="error" role="alert">
          You can only change your own listings.
        </p>
      </div>
    );
  }

  if (owned.listing.locked) {
    return (
      <div className="wrap page">
        <h1>Edit listing</h1>
        <p className="lede">
          This listing can&apos;t be edited while it&apos;s part of a pending offer or a trade.
        </p>
        <a href={`/listings/${id}`}>Back to the listing</a>
      </div>
    );
  }

  const categories = await listCategories();

  return (
    <div className="wrap page">
      <h1>Edit listing</h1>
      {owned.listing.photoIds.length > 0 ? (
        <div className="current-photos">
          {owned.listing.photoIds.map((photoId) => (
            <ListingImage key={photoId} photoId={photoId} alt="" />
          ))}
        </div>
      ) : null}
      <ListingForm
        action={updateListingAction}
        categories={categories}
        submitLabel="Save changes"
        includePhotos={false}
        listingId={owned.listing.id}
        initial={owned.listing}
      />
    </div>
  );
}
