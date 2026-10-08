import { permanentRedirect } from "next/navigation";

export default function SubscriptionPage() {
  /* "Subscription" is a question about the category; the explainer answers it. */
  permanentRedirect("/handyman-membership");
}
