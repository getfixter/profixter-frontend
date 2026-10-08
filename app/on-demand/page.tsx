import { permanentRedirect } from "next/navigation";

export default function OnDemandPage() {
  permanentRedirect("/book");
}
