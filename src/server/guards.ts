import type { AuthGateResult } from "./auth";
import { listMyListings, type MyListing } from "./listings";

export async function myListingsFor(
  gate: AuthGateResult,
): Promise<
  | { ok: true; listings: MyListing[] }
  | { ok: false; error: { code: string; message: string } }
> {
  if (!gate.ok) return { ok: false, error: gate.error };
  return { ok: true, listings: await listMyListings(gate.user.id) };
}
