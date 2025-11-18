"use client";

import { useState } from "react";

// Lightweight, presentational booking block matching the provided spec
export default function BookingSection() {
  const [selectedDay, setSelectedDay] = useState<number | null>(16);
  const [uploadedPhotos, setUploadedPhotos] = useState<File[]>([]);
  const [showModal, setShowModal] = useState(false);
  
  const days = [
    // December 2025 layout (starts on Monday); show last days of Nov and first of Jan as disabled
    { d: 30, muted: true }, { d: 1 }, { d: 2 }, { d: 3 }, { d: 4 }, { d: 5 }, { d: 6 },
    { d: 7 }, { d: 8 }, { d: 9 }, { d: 10 }, { d: 11 }, { d: 12 }, { d: 13 },
    { d: 14 }, { d: 15 }, { d: 16 }, { d: 17 }, { d: 18 }, { d: 19 }, { d: 20 },
    { d: 21 }, { d: 22 }, { d: 23 }, { d: 24 }, { d: 25 }, { d: 26 }, { d: 27 },
    { d: 28 }, { d: 29 }, { d: 30 }, { d: 31 }, { d: 1, muted: true }, { d: 2, muted: true }, { d: 3, muted: true },
  ];

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newPhotos = Array.from(e.target.files);
      setUploadedPhotos([...uploadedPhotos, ...newPhotos]);
    }
  };

  const handleBookNow = () => {
    setShowModal(true);
  };

  return (
    <section id="pick-day" className="relative w-full pt-32 sm:pt-40 lg:pt-48 pb-12 sm:pb-16 lg:pb-24 bg-white">
      <div className="container mx-auto px-[20px] max-w-[1240px]">
        {/* Header with edge labels and centered title */}
        <div className="mb-8 sm:mb-10 lg:mb-12">
          {/* Edge labels - Desktop only */}
          <div className="hidden lg:flex items-center justify-between text-[12px] font-bold text-[#313234] leading-[89%] font-montserrat uppercase">
            <span className="w-[66px] text-center whitespace-nowrap">Pick your</span>
            <span className="w-[94px] text-center whitespace-nowrap text-[#306EEC]">
              date<span className="text-[#313234]">&nbsp;and&nbsp;</span>time
            </span>
          </div>

          {/* Mobile/Tablet - Simple centered title */}
          <div className="lg:hidden text-center mb-8">
            <h2 className="text-3xl sm:text-4xl font-bold leading-tight uppercase mb-4">
              <span className="text-[#313234]">PICK YOUR </span>
              <span className="text-[#306EEC]">DATE</span>
            </h2>
            <h2 className="text-3xl sm:text-4xl font-bold leading-tight uppercase">
              <span className="text-[#313234]">AND </span>
              <span className="text-[#306EEC]">TIME</span>
            </h2>
            <p className="text-[#6A6D71] text-sm sm:text-base mt-4 max-w-md mx-auto">
              Choose the most convenient time and tell us what needs fixing.
            </p>
          </div>

          {/* Desktop - Centered Title */}
          <div className="hidden lg:block relative max-w-[1000px] mx-auto">
            <div className="flex items-center justify-center gap-2">
              <h2 className="text-[64px] font-bold leading-[89%] uppercase tracking-[-0.05em]">
                <span className="text-[#313234]">PICK YOUR</span>
              </h2>
              <p className="text-[#6A6D71] text-[15px] font-medium max-w-[289px] text-left">
                Choose the most convenient time and tell us what needs fixing.
              </p>
            </div>
            <div className="flex justify-end " style={{ paddingRight: 'calc((100% - 289px - 64px * 4.5) / 2)' }}>
              <h2 className="text-[64px] font-bold leading-[89%] uppercase tracking-[-0.05em]">
                <span className="text-[#306EEC]">DATE</span>
                <span className="text-[#313234]"> AND </span>
                <span className="text-[#306EEC]">TIME</span>
              </h2>
            </div>
          </div>
        </div>

        {/* Content row */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
          {/* Calendar card */}
          <div className="lg:col-span-5">
            <div className="rounded-[14px] border border-[#c5cbd8] bg-[#EEF2FF] shadow-[0_0_200px_rgba(0,0,0,0.09)] p-4 sm:p-6">
              {/* Month header */}
              <div className="flex items-center justify-between">
                <button aria-label="Prev month" className="w-8 h-8 sm:w-10 sm:h-10 rounded-[12px] border border-[#c5cbd8] bg-white/60 grid place-items-center text-[#313234]">
                  <ChevronLeft />
                </button>
                <div className="text-xl sm:text-2xl lg:text-[28px] font-semibold text-[#313234]">December 2025</div>
                <button aria-label="Next month" className="w-8 h-8 sm:w-10 sm:h-10 rounded-[12px] border border-[#c5cbd8] bg-white/60 grid place-items-center text-[#313234]">
                  <ChevronRight />
                </button>
              </div>

              {/* Week headers */}
              <div className="mt-4 grid grid-cols-7 text-center text-sm sm:text-base lg:text-[18px] text-[#cf3f3f]">
                <div>Su</div>
                <div className="text-[#6a6c71]">Mo</div>
                <div className="text-[#6a6c71]">Tu</div>
                <div className="text-[#6a6c71]">We</div>
                <div className="text-[#6a6c71]">Th</div>
                <div className="text-[#6a6c71]">Fr</div>
                <div className="text-[#6a6c71]">Sa</div>
              </div>

              {/* Days */}
              <div className="mt-2 grid grid-cols-7 gap-y-1 sm:gap-y-2">
                {days.map((day, i) => {
                  const active = !day.muted && day.d === selectedDay;
                  return (
                    <button
                      key={i}
                      onClick={() => !day.muted && setSelectedDay(day.d)}
                      className={[
                        "mx-auto my-1 w-8 h-8 sm:w-10 sm:h-10 grid place-items-center rounded-[12px] text-sm sm:text-base lg:text-[18px]",
                        day.muted ? "text-[#b7bdc8]" : "text-[#313234]",
                        active ? "bg-[#306eec] text-white ring-4 ring-[#306eec]/15" : "bg-transparent hover:bg-white/80"
                      ].join(" ")}
                    >
                      {day.d}
                    </button>
                  );
                })}
              </div>
            </div>
            
            {/* Note below calendar - centered */}
            <p className="mt-4 sm:mt-6 text-sm sm:text-base text-[#6a6c71] text-center">
              Same-day or next-day visits? Please call us directly.
            </p>
          </div>

          {/* Right column */}
          <div className="lg:col-span-7">
            {/* Time + length */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
              <div className="w-full sm:w-[160px] h-[54px] rounded-[11px] border border-[#c5cbd8] bg-[#EEF2FF] shadow-[0_0_200px_rgba(0,0,0,0.09)] flex items-center px-4 sm:px-6 text-[#313234] text-lg sm:text-[20px]">
                14:00
                <span className="ml-auto"><ChevronDown /></span>
              </div>
              <div className="text-sm sm:text-base text-[#6a6c71]">Visit length: up to 90 minutes</div>
            </div>

            {/* Issue description block with buttons on the right */}
            <div className="relative mt-6 rounded-[14px] border border-[#c5cbd8] bg-[#EEF2FF] shadow-[0_0_200px_rgba(0,0,0,0.10)] p-4 sm:p-5 min-h-[200px] sm:min-h-[141px]">
              <p className="text-sm sm:text-base text-[#6a6c71] mb-16 sm:mb-0">Briefly describe your issue (e.g. leaking faucet, light switch not working)...</p>
              <div className="absolute left-4 right-4 bottom-4 sm:left-auto sm:right-5 sm:bottom-5 flex flex-col sm:flex-row gap-3 sm:gap-4">
                <button className="h-[43px] px-4 sm:px-5 rounded-[11px] border border-[#313234] bg-[#EEF2FF] text-[#313234] text-sm sm:text-base whitespace-nowrap">Select a service</button>
                <label className="h-[43px] px-4 sm:px-5 rounded-[11px] border border-[#313234] bg-[#EEF2FF] text-[#313234] text-sm sm:text-base flex items-center justify-center gap-2 cursor-pointer hover:bg-white/50 transition-colors whitespace-nowrap">
                  <Paperclip />
                  Add photo {uploadedPhotos.length > 0 && `(${uploadedPhotos.length})`}
                  <input 
                    type="file" 
                    accept="image/*" 
                    multiple 
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {/* Address */}
            <div className="mt-6 w-full h-[54px] rounded-[11px] border border-[#c5cbd8] bg-[#EEF2FF] shadow-[0_0_200px_rgba(0,0,0,0.10)] flex items-center px-4 sm:px-6">
              <span className="text-sm sm:text-base text-[#6a6c71]">Select address</span>
            </div>

            {/* Book now button */}
            <div className="mt-6">
              <button 
                onClick={handleBookNow}
                className="w-full sm:w-[259px] h-[57px] rounded-[14px] bg-[#306eec] border border-[#306eec] text-[#eef2ff] text-lg sm:text-[20px] font-semibold hover:bg-[#2558c9] transition-colors"
              >
                Book now
              </button>
            </div>
          </div>
        </div>

        {/* Booking Confirmation Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowModal(false)}>
            <div className="bg-white rounded-[20px] p-8 max-w-[500px] w-full mx-4" onClick={(e) => e.stopPropagation()}>
              {/* Party Icon */}
              <div className="text-center mb-6">
                <div className="text-6xl">🎉</div>
              </div>
              
              <h2 className="text-[32px] font-bold text-[#313234] text-center mb-6">
                Booking Confirmed
              </h2>
              
              <div className="space-y-3 mb-6">
                <div className="flex gap-2">
                  <span className="font-semibold text-[#313234]">Booking #:</span>
                  <span className="text-[#6A6D71]">23789249</span>
                </div>
                <div className="flex gap-2">
                  <span className="font-semibold text-[#313234]">Service:</span>
                  <span className="text-[#6A6D71]">Quick Fix</span>
                </div>
                <div className="flex gap-2">
                  <span className="font-semibold text-[#313234]">Date:</span>
                  <span className="text-[#6A6D71]">Friday, November 7, 2025</span>
                </div>
                <div className="flex gap-2">
                  <span className="font-semibold text-[#313234]">Time:</span>
                  <span className="text-[#6A6D71]">6:00 pm</span>
                </div>
              </div>
              
              <p className="text-[#6A6D71] text-[16px] mb-6">
                Mr. Fixter will reach out to you shortly.<br />
                A confirmation email has been sent.
              </p>
              
              <div className="bg-[#EEF2FF] rounded-[12px] p-4 mb-6">
                <h3 className="text-[#306EEC] font-semibold text-[18px] mb-3">Before your visit</h3>
                <p className="text-[#6A6D71] text-[14px] mb-2">
                  Please have all <span className="text-[#306EEC]">materials/fixtures on-site and ready</span> (faucets, lights, shelves, hardware, etc.).
                </p>
                <p className="text-[#6A6D71] text-[14px] mb-2">
                  Your Fixter may arrive <span className="text-[#306EEC]">up to 30 minutes before or after</span> the booked time (traffic & job length).
                </p>
                <p className="text-[#6A6D71] text-[14px]">
                  Emergencies or questions? Call <a href="tel:631-599-1363" className="text-[#306EEC]">631-599-1363</a> or email <a href="mailto:my@profixter.com" className="text-[#306EEC]">my@profixter.com</a>.
                </p>
              </div>
              
              <button
                onClick={() => setShowModal(false)}
                className="w-full h-[57px] rounded-[14px] bg-[#306EEC] text-white text-[20px] font-semibold hover:bg-[#2558c9] transition-colors"
              >
                OK
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function ChevronLeft() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M15 19L8 12L15 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function ChevronRight() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M9 5L16 12L9 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function ChevronDown() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function Paperclip() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M21.44 11.05L12.49 20C10.32 22.17 6.8 22.17 4.63 20C2.46 17.83 2.46 14.31 4.63 12.14L13.58 3.19C15.13 1.64 17.64 1.64 19.19 3.19C20.74 4.74 20.74 7.25 19.19 8.8L10.24 17.75C9.47 18.52 8.22 18.52 7.45 17.75C6.68 16.98 6.68 15.73 7.45 14.96L15.69 6.72" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
