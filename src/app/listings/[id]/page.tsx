import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { makeOfferHref, showMakeOffer } from "@/domain/listings";
import { getListingDetail } from "@/server/catalog";
import { auth } from "@/server/auth";
import { ListingImage } from "../../components/listing-image";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const listing = await getListingDetail(id);
  return { title: listing ? `${listing.title} - Easy Exchange` : "Listing - Easy Exchange" };
}

export default async function ListingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const listing = await getListingDetail(id);
  if (!listing) notFound();

  const session = await auth();
  const viewerId = session?.user?.id ? session.user.id : null;
  const offerVisible = showMakeOffer({
    status: listing.status,
    viewerId,
    ownerId: listing.ownerId,
  });
  const offerHref = makeOfferHref({ viewerId, listingId: listing.id });
  const listedBy = listing.ownerCity
    ? `Listed by ${listing.ownerDisplayName} in ${listing.ownerCity}`
    : `Listed by ${listing.ownerDisplayName}`;

  return (
    <div className="wrap page">
      <article className="detail">
        <div className="photos">
          {listing.photos.map((photo, index) => (
            <ListingImage
              key={photo.id}
              photoId={photo.id}
              alt={index === 0 ? listing.title : `${listing.title}, photo ${index + 1}`}
            />
          ))}
        </div>
        <div className="facts">
          <p>
            <span className="tag">{listing.statusLabel}</span>
          </p>
          <h1>{listing.title}</h1>
          <p className="prose">{listing.description}</p>
          <dl>
            <div>
              <dt>Category</dt>
              <dd>{listing.categoryName}</dd>
            </div>
            <div>
              <dt>Condition</dt>
              <dd>{listing.conditionLabel}</dd>
            </div>
            {listing.conditionNotes ? (
              <div>
                <dt>Condition notes</dt>
                <dd>{listing.conditionNotes}</dd>
              </div>
            ) : null}
            {listing.lookingFor ? (
              <div>
                <dt>Looking for</dt>
                <dd>{listing.lookingFor}</dd>
              </div>
            ) : null}
            {listing.fairnessHint ? (
              <div>
                <dt>Fairness hint</dt>
                <dd>{listing.fairnessHint}</dd>
              </div>
            ) : null}
            <div>
              <dt>Collector</dt>
              <dd>{listedBy}</dd>
            </div>
          </dl>
          {offerVisible ? (
            offerHref ? (
              <a className="button" href={offerHref}>
                Make offer
              </a>
            ) : (
              <button className="button" type="button">
                Make offer
              </button>
            )
          ) : null}
        </div>
      </article>
    </div>
  );
}
