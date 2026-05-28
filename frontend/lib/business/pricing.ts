import { BPS_DENOMINATOR } from "../constants";
import { PricingMode, type RentalListing } from "../types";

/**
 * Mirror RentalMarket._resolvePrice: Fixed/Suggested return priceValue directly;
 * FloorPegged returns floor * priceValue(bps) / 10000.
 */
export function resolveRentalPrice(listing: RentalListing, floorPrice: bigint): bigint {
  if (listing.mode === PricingMode.FloorPegged) {
    return (floorPrice * listing.priceValue) / BPS_DENOMINATOR;
  }
  return listing.priceValue;
}
