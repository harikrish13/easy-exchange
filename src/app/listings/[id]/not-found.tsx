import Link from "next/link";

export default function ListingNotFound() {
  return (
    <div className="wrap page">
      <h1>Listing not found</h1>
      <p className="lede">That item is not on the shelf.</p>
      <Link className="button" href="/">
        Back to the shelf
      </Link>
    </div>
  );
}
