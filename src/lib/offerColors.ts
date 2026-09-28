import type { Promotion } from "@/hooks/usePromotions";

export type OfferColor = "teal" | "coral" | "blue" | "gold" | "green" | "plum";

export const offerColorClasses: Record<OfferColor, { card: string; icon: string; title: string; badge: string; banner: string; progress: string }> = {
  teal: {
    card: "border-l-offer-teal bg-offer-teal/15",
    icon: "bg-offer-teal text-offer-teal-fg",
    title: "text-offer-teal",
    badge: "bg-offer-teal text-offer-teal-fg border-transparent",
    banner: "bg-offer-teal text-offer-teal-fg",
    progress: "[&>div]:bg-offer-teal",
  },
  coral: {
    card: "border-l-offer-coral bg-offer-coral/15",
    icon: "bg-offer-coral text-offer-coral-fg",
    title: "text-offer-coral",
    badge: "bg-offer-coral text-offer-coral-fg border-transparent",
    banner: "bg-offer-coral text-offer-coral-fg",
    progress: "[&>div]:bg-offer-coral",
  },
  blue: {
    card: "border-l-offer-blue bg-offer-blue/15",
    icon: "bg-offer-blue text-offer-blue-fg",
    title: "text-offer-blue",
    badge: "bg-offer-blue text-offer-blue-fg border-transparent",
    banner: "bg-offer-blue text-offer-blue-fg",
    progress: "[&>div]:bg-offer-blue",
  },
  gold: {
    card: "border-l-offer-gold bg-offer-gold/15",
    icon: "bg-offer-gold text-offer-gold-fg",
    title: "text-offer-gold",
    badge: "bg-offer-gold text-offer-gold-fg border-transparent",
    banner: "bg-offer-gold text-offer-gold-fg",
    progress: "[&>div]:bg-offer-gold",
  },
  green: {
    card: "border-l-offer-green bg-offer-green/15",
    icon: "bg-offer-green text-offer-green-fg",
    title: "text-offer-green",
    badge: "bg-offer-green text-offer-green-fg border-transparent",
    banner: "bg-offer-green text-offer-green-fg",
    progress: "[&>div]:bg-offer-green",
  },
  plum: {
    card: "border-l-offer-plum bg-offer-plum/15",
    icon: "bg-offer-plum text-offer-plum-fg",
    title: "text-offer-plum",
    badge: "bg-offer-plum text-offer-plum-fg border-transparent",
    banner: "bg-offer-plum text-offer-plum-fg",
    progress: "[&>div]:bg-offer-plum",
  },
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
