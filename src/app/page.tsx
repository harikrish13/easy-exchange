import type { Metadata } from "next";
import { auth } from "@/server/auth";
import { listCatalog, listCategories } from "@/server/catalog";
import { ListingImage } from "./components/listing-image";

export const metadata: Metadata = {
  title: "On the shelf - Easy Exchange",
};

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string | string[] }>;
}) {
  const params = await searchParams;
  const categoryParam = typeof params.category === "string" ? params.category : "";
  const session = await auth();
  const viewerId = session?.user?.id ? session.user.id : null;
  const [categories, listings] = await Promise.all([
    listCategories(),
    listCatalog({
      viewerId,
      category: categoryParam.length > 0 ? categoryParam : null,
    }),
  ]);

  return (
    <div className="wrap page">
      <h1>On the shelf</h1>
      <p className="lede">
        {viewerId
          ? "Other collectors' items, ready to trade. Your own listings stay on My listings."
          : "Other collectors' items, ready to trade."}
      </p>
      <ul className="filters">
        <li>
          <a href="/" aria-current={categoryParam.length === 0 ? "page" : undefined}>
            All
          </a>
        </li>
        {categories.map((category) => (
          <li key={category.id}>
            <a
              href={`/?category=${category.slug}`}
              aria-current={categoryParam === category.slug ? "page" : undefined}
            >
              {category.name}
            </a>
          </li>
        ))}
      </ul>
      <section className="case" aria-label="Listings">
        {listings.length === 0 ? (
          <p className="empty">
            {categoryParam.length > 0
              ? "Nothing in this category is on the shelf."
              : "Nothing is on the shelf yet."}
          </p>
        ) : (
          <ul className="shelf-items">
            {listings.map((listing) => (
              <li className="specimen" key={listing.id}>
                <a href={`/listings/${listing.id}`}>
                  {listing.photoId ? (
                    <ListingImage photoId={listing.photoId} alt="" />
                  ) : (
                    <span className="meta">No photo</span>
                  )}
                  <div className="meta">
                    <h2>{listing.title}</h2>
                    <p>{listing.categoryName}</p>
                    <p>{listing.conditionLabel}</p>
                  </div>
                </a>
              </li>
            ))}
          </ul>
        )}
        <div className="rail" aria-hidden="true" />
      </section>
    </div>
  );
}
