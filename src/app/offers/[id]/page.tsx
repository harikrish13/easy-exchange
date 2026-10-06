import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MarkReceivedForm } from "@/app/components/mark-received-form";
import { RatingForm } from "@/app/components/rating-form";
import { requireUser } from "@/server/auth";
import { getOfferDetail } from "@/server/completion";

export const metadata: Metadata = {
  title: "Trade - Easy Exchange",
};

export default async function TradeOfferPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const gate = await requireUser();
  if (!gate.ok) {
    return (
      <div className="wrap page">
        <h1>Trade</h1>
        <p className="error" role="alert">
          {gate.error.message}
        </p>
        <p>
          <a className="button" href={`/sign-in?callbackUrl=${encodeURIComponent(`/offers/${id}`)}`}>
            Sign in
          </a>
        </p>
      </div>
    );
  }

  const detail = await getOfferDetail(gate.user.id, id);
  if (!detail) notFound();

  const who = detail.counterpartCity
    ? `${detail.counterpartName} in ${detail.counterpartCity}`
    : detail.counterpartName;

  return (
    <div className="wrap page">
      <p>
        <a href="/offers">Offer history</a>
      </p>
      <h1>{detail.target.title}</h1>
      <p>
        <span className="tag">{detail.statusLabel}</span>
      </p>
      <p>With {who}</p>
      <p>
        Offering{" "}
        {detail.offered.map((item, index) => (
          <span key={item.id}>
            {index > 0 ? ", " : null}
            <a href={`/listings/${item.id}`}>{item.title}</a>
          </span>
        ))}
        {" for "}
        <a href={`/listings/${detail.target.id}`}>{detail.target.title}</a>
      </p>

      {detail.markReceivedVisible ? <MarkReceivedForm offerId={detail.id} /> : null}
      {detail.youMarkedReceived ? <p>You marked this received.</p> : null}
      {detail.waitingOnOther ? <p>Waiting for the other person to mark received.</p> : null}

      {detail.ratingsVisible ? (
        <section className="stack">
          <h2>Ratings</h2>
          {detail.ratings.length === 0 ? (
            <p>No ratings yet.</p>
          ) : (
            <ul className="offer-list">
              {detail.ratings.map((rating) => (
                <li className="offer" key={rating.id}>
                  <p>
                    {rating.raterName} rated {rating.ratedName}
                  </p>
                  <p>{rating.score} out of 5</p>
                  {rating.comment ? <p>{rating.comment}</p> : null}
                </li>
              ))}
            </ul>
          )}
          {detail.ratingFormVisible ? <RatingForm offerId={detail.id} /> : null}
        </section>
      ) : null}
    </div>
  );
}
