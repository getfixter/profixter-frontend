import Header from "@/app/components/sections/Header";
import Footer from "@/app/components/sections/Footer";
import StudioLoader from "./StudioLoader";

export default function ShowerStudioPage() {
  return (
    <>
      <Header />
      <main className="min-h-screen bg-[#F8FAFF] pb-28 pt-24 sm:pt-28">
        <StudioLoader />
      </main>
      <Footer compact />
    </>
  );
}
