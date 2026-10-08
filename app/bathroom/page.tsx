import { permanentRedirect } from "next/navigation";

export default function BathroomPage() {
  permanentRedirect("/projects?type=bathroom#estimate");
}
