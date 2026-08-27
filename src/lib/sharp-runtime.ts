import type sharp from "sharp";

type Sharp = typeof sharp;

let sharpPromise: Promise<Sharp> | null = null;

export async function getSharp(): Promise<Sharp> {
  if (!sharpPromise) {
    sharpPromise = import("sharp").then((mod) => (mod.default ?? mod) as Sharp);
  }
  return sharpPromise;
}
