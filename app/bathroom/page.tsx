import { redirect } from "next/navigation";

export default function BathroomPage() {
  redirect("/projects?type=bathroom#estimate");
}
