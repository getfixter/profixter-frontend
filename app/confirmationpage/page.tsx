import { Suspense } from "react";
import ConfirmationClient from "./ConfirmationClient";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ConfirmationClient />
    </Suspense>
  );
}
