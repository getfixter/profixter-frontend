import Header from "@/app/components/sections/Header";
import Footer from "@/app/components/sections/Footer";
import StudioLoader from "../StudioLoader";

/**
 * The owner's live preview of the customer Shower Studio. The server answers
 * only the owner (any other visitor gets nothing); the demo catalog and DEMO
 * prices are fixed, and nothing entered here is saved or sent. noindex comes
 * from the shower-studio layout.
 */
export default function ShowerStudioPreviewPage() {
  return (
    <>
      <Header />
      <main className="min-h-screen bg-[#F8FAFF] pb-28 pt-24 sm:pt-28">
        <StudioLoader preview />
      </main>
      <Footer compact />
    </>
  );
}
