import type { OfferView } from "@/server/offers";
import { OfferDecision } from "./offer-decision";

export function OfferList({ offers }: { offers: OfferView[] }) {
  return (
    <ul className="offer-list">
      {offers.map((offer) => {
        const who = offer.counterpartCity
          ? `${offer.counterpartName} in ${offer.counterpartCity}`
          : offer.counterpartName;
        return (
          <li className="offer" key={offer.id}>
            <p>
              <span className="tag">{offer.statusLabel}</span>
            </p>
            <h2>
              <a href={`/listings/${offer.target.id}`}>{offer.target.title}</a>
            </h2>
            <p>{offer.madeByViewer ? `To ${who}` : `From ${who}`}</p>
            <p>
              Offering{" "}
              {offer.offered.map((item, index) => (
                <span key={item.id}>
                  {index > 0 ? ", " : null}
                  <a href={`/listings/${item.id}`}>{item.title}</a>
                </span>
              ))}
            </p>
            {offer.cancelLabel ? <p>{offer.cancelLabel}</p> : null}
            <p>
              <a href={`/offers/${offer.id}`}>View trade</a>
            </p>
            {offer.canAccept || offer.canDecline || offer.canCancel ? (
              <div className="offer-actions">
                {offer.canAccept ? <OfferDecision offerId={offer.id} kind="accept" /> : null}
                {offer.canDecline ? <OfferDecision offerId={offer.id} kind="decline" /> : null}
                {offer.canCancel ? <OfferDecision offerId={offer.id} kind="cancel" /> : null}
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
