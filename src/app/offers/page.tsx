import type { Metadata } from "next";
import { OfferList } from "@/app/components/offer-list";
import { requireUser } from "@/server/auth";
import { listOfferHistory } from "@/server/offers";

export const metadata: Metadata = {
  title: "Offer history - Easy Exchange",
};

export default async function OfferHistoryPage() {
  const gate = await requireUser();
  if (!gate.ok) {
    return (
      <div className="wrap page">
        <h1>Offer history</h1>
        <p className="error" role="alert">
          {gate.error.message}
        </p>
        <p>
          <a className="button" href="/sign-in?callbackUrl=%2Foffers">
            Sign in
          </a>
        </p>
      </div>
    );
  }

  const offers = await listOfferHistory(gate.user.id);

  return (
    <div className="wrap page">
      <h1>Offer history</h1>
      <p className="lede">
        Offers you made and offers you received, including ones that were declined or cancelled.
      </p>
      {offers.length === 0 ? (
        <p>You have no offers yet.</p>
      ) : (
        <OfferList offers={offers} />
      )}
    </div>
  );
}
