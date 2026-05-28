import { BPS_DENOMINATOR, RENTAL_SPLIT, MARKETPLACE_SPLIT, INSURANCE } from "../constants";

/** Mirror RentalMarket.settle: owner gets the remainder after platform + original-buyer. */
export function rentalSplit(paid: bigint) {
  const platform = (paid * RENTAL_SPLIT.platformBps) / BPS_DENOMINATOR;
  const originalBuyer = (paid * RENTAL_SPLIT.originalBuyerBps) / BPS_DENOMINATOR;
  const owner = paid - platform - originalBuyer;
  return { owner, platform, originalBuyer };
}

/** Mirror RentalMarket.cancel: pre-lock 90% to renter, remainder to owner. */
export function rentalCancelSplit(paid: bigint) {
  const refund = (paid * RENTAL_SPLIT.cancelRefundBps) / BPS_DENOMINATOR;
  const owner = paid - refund;
  return { refund, owner };
}

/** Mirror Marketplace.buy: seller remainder after platform + original-buyer royalty. */
export function marketplaceSplit(price: bigint) {
  const platform = (price * MARKETPLACE_SPLIT.platformBps) / BPS_DENOMINATOR;
  const originalBuyer = (price * MARKETPLACE_SPLIT.originalBuyerBps) / BPS_DENOMINATOR;
  const seller = price - platform - originalBuyer;
  return { seller, platform, originalBuyer };
}

/** Mirror InsurancePool: premium = 20% of rental; payout on DNP = rental + 50% premium. */
export function insurancePremium(rentalCost: bigint): bigint {
  return (rentalCost * INSURANCE.premiumBps) / BPS_DENOMINATOR;
}
export function insurancePayout(rentalCost: bigint): bigint {
  const premium = insurancePremium(rentalCost);
  return rentalCost + (premium * INSURANCE.premiumReturnBps) / BPS_DENOMINATOR;
}

/** Contest rake = pool * rakeBps / 10000; net pool is what the payout tree distributes. */
export function contestRake(pool: bigint, rakeBps: number) {
  const rake = (pool * BigInt(rakeBps)) / BPS_DENOMINATOR;
  return { rake, net: pool - rake };
}
