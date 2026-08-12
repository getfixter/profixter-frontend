import Link from "next/link";
import Header from "@/app/components/sections/Header";
import Footer from "@/app/components/sections/Footer";

export default function NotFound() {
  return (
    <main className="min-h-screen bg-[#F6F8FC] text-[#0B1628]">
      <Header />
      <section className="mx-auto grid min-h-[62svh] max-w-[780px] content-center px-4 py-10 text-center sm:px-6 lg:px-8">
        <div className="rounded-[8px] border border-slate-200 bg-white p-7 shadow-[0_18px_45px_rgba(15,23,42,0.08)] sm:p-10">
          <div className="text-xs font-black uppercase tracking-[0.16em] text-blue-700">
            Page not found
          </div>
          <h1 className="mt-4 text-4xl font-black leading-tight text-slate-950 sm:text-5xl">
            This page is not part of the house anymore.
          </h1>
          <p className="mx-auto mt-4 max-w-[560px] text-base leading-7 text-slate-600">
            Start with the free Home Support AI, book a handyman visit, compare membership, or request a project estimate.
          </p>
          <div className="mt-7 grid gap-3 sm:grid-cols-2">
            <Link href="/home-support" className="rounded-[8px] bg-blue-600 px-5 py-3 text-sm font-black text-white">
              Home Support AI
            </Link>
            <Link href="/book" className="rounded-[8px] border border-slate-200 px-5 py-3 text-sm font-black text-slate-900">
              Book a Handyman
            </Link>
            <Link href="/membership" className="rounded-[8px] border border-slate-200 px-5 py-3 text-sm font-black text-slate-900">
              Membership
            </Link>
            <Link href="/projects" className="rounded-[8px] border border-slate-200 px-5 py-3 text-sm font-black text-slate-900">
              Home Projects
            </Link>
          </div>
        </div>
      </section>
      <Footer />
    </main>
  );
}
