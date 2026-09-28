import type { Promotion } from "@/hooks/usePromotions";

export type OfferColor = "teal" | "coral" | "blue" | "gold" | "green" | "plum";

export const offerColorClasses: Record<OfferColor, { card: string; icon: string; progress: string }> = {
  teal: { card: "border-l-offer-teal bg-offer-teal/5", icon: "bg-offer-teal/15", progress: "[&>div]:bg-offer-teal" },
  coral: { card: "border-l-offer-coral bg-offer-coral/5", icon: "bg-offer-coral/15", progress: "[&>div]:bg-offer-coral" },
  blue: { card: "border-l-offer-blue bg-offer-blue/5", icon: "bg-offer-blue/15", progress: "[&>div]:bg-offer-blue" },
  gold: { card: "border-l-offer-gold bg-offer-gold/5", icon: "bg-offer-gold/15", progress: "[&>div]:bg-offer-gold" },
  green: { card: "border-l-offer-green bg-offer-green/5", icon: "bg-offer-green/15", progress: "[&>div]:bg-offer-green" },
  plum: { card: "border-l-offer-plum bg-offer-plum/5", icon: "bg-offer-plum/15", progress: "[&>div]:bg-offer-plum" },
};

const preferred: Record<Promotion["offer_type"], OfferColor[]> = {
  referral_challenge: ["teal", "green"],
  qualification: ["coral", "gold"],
  announcement: ["blue", "plum"],
};

const palette: OfferColor[] = ["teal", "coral", "blue", "gold", "green", "plum"];

/** Assign colors by stable ID order so card order changes do not shuffle their colors. */
export function getOfferColors(offers: Promotion[]): Map<string, OfferColor> {
  const colors = new Map<string, OfferColor>();
  const usage = new Map<OfferColor, number>();
  for (const offer of [...offers].sort((a, b) => a.id.localeCompare(b.id))) {
    const choices = [...preferred[offer.offer_type], ...palette.filter((color) => !preferred[offer.offer_type].includes(color))];
    const color = choices.find((choice) => !usage.has(choice)) ??
      choices.reduce((best, choice) => (usage.get(choice) ?? 0) < (usage.get(best) ?? 0) ? choice : best, choices[0]);
    colors.set(offer.id, color);
    usage.set(color, (usage.get(color) ?? 0) + 1);
  }
  return colors;
}