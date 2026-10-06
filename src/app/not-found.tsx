import Link from "next/link";

export default function NotFound() {
  return (
    <div className="wrap page">
      <h1>Page not found</h1>
      <p className="lede">That page is not part of the exchange.</p>
      <Link className="button" href="/">
        Back to the shelf
      </Link>
    </div>
  );
}
