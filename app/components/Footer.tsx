import Image from 'next/image';
import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="relative min-h-[350px] sm:min-h-[400px] lg:h-[437px] overflow-hidden">
      {/* Background Image */}
      <div className="absolute inset-0">
        <Image
          src="/images/footer-bg.png"
          alt="Footer background"
          fill
          className="object-cover"
          priority={false}
        />
        {/* Dark Overlay */}
        <div className="absolute inset-0 bg-black/50" />
      </div>

      {/* Content */}
      <div className="relative h-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col justify-between py-8 sm:py-10 lg:py-12">
        {/* Top Section */}
        <div className="flex flex-col lg:flex-row justify-between items-start gap-6 sm:gap-8 lg:gap-2">
          {/* Left - Logo and Description */}
          <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-6 lg:gap-8 w-full lg:w-auto">
            {/* Logo */}
            <div className="flex flex-col">
              <Image src="/images/logo.svg" alt="Profixter" width={160} height={64} />
            </div>
            
            {/* Description */}
            <p className="text-[#C5CBD8] text-sm sm:text-base leading-[120%] max-w-[500px] lg:pt-2">
              Quick help, honest pricing, and professionals who care. Because every home deserves smooth comfort.
            </p>
          </div>

          {/* Right - Navigation */}
          <div className="flex-shrink-0 w-full sm:w-auto">
            <nav className="flex flex-row sm:flex-col gap-4 sm:gap-4 flex-wrap sm:flex-nowrap sm:text-right">
              <Link 
                href="#how-it-works" 
                className="text-[#EEF2FF] text-sm sm:text-base leading-[120%] hover:text-[#306EEC] transition-colors"
              >
                How it works
              </Link>
              <Link 
                href="#plans" 
                className="text-[#EEF2FF] text-sm sm:text-base leading-[120%] hover:text-[#306EEC] transition-colors"
              >
                Plans
              </Link>
              <Link 
                href="#pick-day" 
                className="text-[#EEF2FF] text-sm sm:text-base leading-[120%] hover:text-[#306EEC] transition-colors"
              >
                Pick day
              </Link>
              <Link 
                href="#projects" 
                className="text-[#EEF2FF] text-sm sm:text-base leading-[120%] hover:text-[#306EEC] transition-colors"
              >
                Projects
              </Link>
            </nav>
          </div>
        </div>

        {/* Get in Touch Card */}
        <div className="mt-8 w-full sm:w-auto">
          <div className="relative w-full sm:w-[300px]">
            {/* Soft blurred backdrop rectangle (hide on mobile to avoid overlap) */}
            <div className="hidden sm:block absolute -left-6 -top-6 w-[320px] h-[245px] rounded-[14px] bg-[rgba(46,41,27,0.13)] backdrop-blur-[4px]" />

            {/* Foreground contact card */}
            <div className="relative w-full rounded-[14px] bg-white/5 border border-white/10 backdrop-blur-md shadow-none sm:shadow-[0_10px_80px_rgba(0,0,0,0.25)] p-5 sm:p-6">
              <h3 className="text-[22px] sm:text-[24px] font-semibold text-[#306EEC] leading-[89%] mb-4">Get in Touch</h3>
              <div className="space-y-3">
                <Link href="https://instagram.com/mrfixter.ny" target="_blank" className="flex items-center gap-3 text-[#C5CBD8] text-[16px] leading-[120%] hover:text-[#306EEC] transition-colors">
                  {/* Instagram icon */}
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5z" stroke="currentColor" strokeWidth="2"/>
                    <circle cx="12" cy="12" r="3.5" stroke="currentColor" strokeWidth="2"/>
                    <circle cx="17.5" cy="6.5" r="1.5" fill="currentColor"/>
                  </svg>
                  mrfixter.ny
                </Link>
                <Link href="mailto:my@profixter.com" className="flex items-center gap-3 text-[#C5CBD8] text-[16px] leading-[120%] hover:text-[#306EEC] transition-colors">
                  {/* Mail icon */}
                  <svg width="20" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M4 6h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z" stroke="currentColor" strokeWidth="2"/>
                    <path d="M22 8l-10 7L2 8" stroke="currentColor" strokeWidth="2"/>
                  </svg>
                  my@profixter.com
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-2 sm:gap-0 mt-6 sm:mt-0">
          <p className="text-[#6A6D71] text-sm sm:text-base leading-[120%] text-center sm:text-left">
            © 2025 All rights reserved.
          </p>
          <p className="text-[#6A6D71] text-sm sm:text-base leading-[120%] text-center sm:text-right">
            License HI-71484 Insured
          </p>
        </div>
      </div>
    </footer>
  );
}
