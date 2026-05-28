import { keccak256, encodePacked, type Address, type Hex } from "viem";
import type { PayoutLeaf } from "../types";

/**
 * OpenZeppelin-compatible Merkle tree (commutative, sorted-pair hashing) matching
 * MerkleProof.verify used by ContestEscrow / SeasonLeaderboard / InsurancePool.
 *
 * Payout leaf  = keccak256(abi.encodePacked(address, uint256 amount))
 * DNP leaf      = keccak256(abi.encodePacked(uint256 tokenId))
 */

export function payoutLeaf(account: Address, amount: bigint): Hex {
  return keccak256(encodePacked(["address", "uint256"], [account, amount]));
}

export function dnpLeaf(tokenId: bigint): Hex {
  return keccak256(encodePacked(["uint256"], [tokenId]));
}

function hashPair(a: Hex, b: Hex): Hex {
  // commutative: sort the two 32-byte words ascending, then keccak the concatenation
  const [lo, hi] = a.toLowerCase() <= b.toLowerCase() ? [a, b] : [b, a];
  return keccak256(`0x${lo.slice(2)}${hi.slice(2)}` as Hex);
}

export interface MerkleTree {
  root: Hex;
  getProof: (leaf: Hex) => Hex[];
}

/** Build a tree from pre-hashed, de-duplicated leaves. */
export function buildMerkleTree(leaves: Hex[]): MerkleTree {
  if (leaves.length === 0) throw new Error("no leaves");
  const layers: Hex[][] = [dedupeSorted(leaves)];

  while (layers[layers.length - 1].length > 1) {
    const prev = layers[layers.length - 1];
    const next: Hex[] = [];
    for (let i = 0; i < prev.length; i += 2) {
      if (i + 1 === prev.length) next.push(prev[i]); // odd node promoted
      else next.push(hashPair(prev[i], prev[i + 1]));
    }
    layers.push(next);
  }

  const root = layers[layers.length - 1][0];

  function getProof(leaf: Hex): Hex[] {
    let idx = layers[0].indexOf(leaf.toLowerCase() as Hex);
    if (idx === -1) idx = layers[0].indexOf(leaf);
    if (idx === -1) throw new Error("leaf not in tree");
    const proof: Hex[] = [];
    for (let level = 0; level < layers.length - 1; level++) {
      const layer = layers[level];
      const isRight = idx % 2 === 1;
      const pairIdx = isRight ? idx - 1 : idx + 1;
      if (pairIdx < layer.length) proof.push(layer[pairIdx]);
      idx = Math.floor(idx / 2);
    }
    return proof;
  }

  return { root, getProof };
}

/** Build a payout tree directly from {account, amount} leaves; returns root + per-account claim. */
export function buildPayoutTree(entries: PayoutLeaf[]) {
  const leaves = entries.map((e) => payoutLeaf(e.account, e.amount));
  const tree = buildMerkleTree(leaves);
  const claims = entries.map((e) => ({
    account: e.account,
    amount: e.amount,
    proof: tree.getProof(payoutLeaf(e.account, e.amount)),
  }));
  return { root: tree.root, claims };
}

export function verifyProof(proof: Hex[], root: Hex, leaf: Hex): boolean {
  let computed = leaf.toLowerCase() as Hex;
  for (const p of proof) computed = hashPair(computed, p);
  return computed.toLowerCase() === root.toLowerCase();
}

function dedupeSorted(leaves: Hex[]): Hex[] {
  const lower = leaves.map((l) => l.toLowerCase() as Hex);
  const unique = Array.from(new Set(lower));
  return unique.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}
