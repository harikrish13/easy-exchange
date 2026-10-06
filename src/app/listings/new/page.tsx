import type { Metadata } from "next";
import { ListingForm } from "@/app/components/listing-form";
import { createListingAction } from "@/server/actions/listings";
import { listCategories } from "@/server/catalog";
import { requireUser } from "@/server/auth";

export const metadata: Metadata = {
  title: "List an item - Easy Exchange",
};

export default async function NewListingPage() {
  const gate = await requireUser();
  if (!gate.ok) {
    return (
      <div className="wrap page">
        <h1>List an item</h1>
        <p className="error" role="alert">
          {gate.error.message}
        </p>
        <p>
          <a className="button" href="/sign-in?callbackUrl=%2Flistings%2Fnew">
            Sign in
          </a>
        </p>
      </div>
    );
  }

  const categories = await listCategories();

  return (
    <div className="wrap page">
      <h1>List an item</h1>
      <ListingForm
        action={createListingAction}
        categories={categories}
        submitLabel="List item"
        includePhotos
      />
    </div>
  );
}
