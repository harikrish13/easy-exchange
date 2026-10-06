import type { Metadata } from "next";
import { OfferList } from "@/app/components/offer-list";
import { requireUser } from "@/server/auth";
import { listIncoming } from "@/server/offers";

export const metadata: Metadata = {
  title: "Incoming offers - Easy Exchange",
};

export default async function IncomingOffersPage() {
  const gate = await requireUser();
  if (!gate.ok) {
    return (
      <div className="wrap page">
        <h1>Incoming offers</h1>
        <p className="error" role="alert">
          {gate.error.message}
        </p>
        <p>
          <a className="button" href="/sign-in?callbackUrl=%2Foffers%2Fincoming">
            Sign in
          </a>
        </p>
      </div>
    );
  }

  const offers = await listIncoming(gate.user.id);
  const waiting = offers.filter((offer) => offer.status === "Pending");

  return (
    <div className="wrap page">
      <h1>Incoming offers</h1>
      {waiting.length === 0 ? (
        <p className="lede">No offers are waiting on you.</p>
      ) : (
        <OfferList offers={waiting} />
      )}
    </div>
  );
}
