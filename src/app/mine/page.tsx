import type { Metadata } from "next";
import { DeleteListingButton } from "@/app/components/delete-listing-button";
import { ListingImage } from "@/app/components/listing-image";
import { myListingsFor } from "@/server/guards";
import { requireUser } from "@/server/auth";

export const metadata: Metadata = {
  title: "My listings - Easy Exchange",
};

export default async function MyListingsPage() {
  const result = await myListingsFor(await requireUser());
  if (!result.ok) {
    return (
      <div className="wrap page">
        <h1>My listings</h1>
        <p className="error" role="alert">
          {result.error.message}
        </p>
        <p>
          <a className="button" href="/sign-in?callbackUrl=%2Fmine">
            Sign in
          </a>
        </p>
      </div>
    );
  }

  return (
    <div className="wrap page">
      <h1>My listings</h1>
      {result.listings.length === 0 ? (
        <p className="lede">
          You haven&apos;t listed anything yet. <a href="/listings/new">List an item</a>
        </p>
      ) : (
        <ul className="mine-list">
          {result.listings.map((listing) => (
            <li className="mine-row" key={listing.id}>
              {listing.photoId ? (
                <ListingImage photoId={listing.photoId} alt="" />
              ) : (
                <span />
              )}
              <div>
                <h2>
                  <a href={`/listings/${listing.id}`}>{listing.title}</a>
                </h2>
                <p>{listing.categoryName}</p>
                <p>{listing.statusLabel}</p>
              </div>
              {listing.showEdit || listing.showDelete ? (
                <div className="mine-actions">
                  {listing.showEdit ? (
                    <a href={`/listings/${listing.id}/edit`}>Edit listing</a>
                  ) : null}
                  {listing.showDelete ? (
                    <DeleteListingButton listingId={listing.id} />
                  ) : null}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
