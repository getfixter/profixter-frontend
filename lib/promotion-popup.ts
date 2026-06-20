import API from "@/lib/api";

export type PromotionPopupTarget = "homepage" | "all_public";

export interface PromotionPopup {
  _id?: string;
  enabled: boolean;
  eyebrow: string;
  title: string;
  message: string;
  promoCode: string;
  ctaText: string;
  ctaUrl: string;
  secondaryText: string;
  secondaryUrl: string;
  startAt: string | null;
  endAt: string | null;
  target: PromotionPopupTarget;
  internalNote?: string;
  updatedAt?: string;
}

export const EMPTY_PROMOTION_POPUP: PromotionPopup = {
  enabled: false,
  eyebrow: "Profixter update",
  title: "",
  message: "",
  promoCode: "",
  ctaText: "",
  ctaUrl: "",
  secondaryText: "",
  secondaryUrl: "",
  startAt: null,
  endAt: null,
  target: "homepage",
  internalNote: "",
};

export async function getPromotionPopup(): Promise<PromotionPopup> {
  const response = await API.get("/api/admin/promotion-popup");
  return response.data.popup;
}

export async function savePromotionPopup(
  popup: PromotionPopup
): Promise<PromotionPopup> {
  const response = await API.put("/api/admin/promotion-popup", popup);
  return response.data.popup;
}

export async function getActivePromotionPopup(): Promise<PromotionPopup | null> {
  const baseUrl =
    process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001";
  const response = await fetch(`${baseUrl}/api/promotion-popup/active`, {
    cache: "no-store",
  });
  if (!response.ok) return null;
  const body = (await response.json()) as { popup?: PromotionPopup | null };
  return body.popup || null;
}
