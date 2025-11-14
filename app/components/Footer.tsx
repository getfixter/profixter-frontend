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
              <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold">
                <span className="text-[#306EEC]">PRO</span>
                <span className="text-white">FIXTER</span>
              </h2>
              <p className="text-white text-sm">Long Island</p>
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
