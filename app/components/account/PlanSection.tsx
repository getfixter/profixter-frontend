interface PlanSectionProps {
  // Future props (e.g., plan details) can be added here
}

export function PlanSection({}: PlanSectionProps) {
  return (
    <div>
      <h2 className="text-xl sm:text-2xl font-semibold text-[#313234] mb-8 sm:mb-12">My plan</h2>
      <div className="flex flex-col lg:flex-row gap-4 sm:gap-6 mb-8 sm:mb-10">
        <div className="w-full lg:w-[400px] bg-[#EEF2FF] border border-[#C5CBD8] rounded-[14px] p-4 sm:p-6" style={{ boxShadow: '0px 0px 200px 0px rgba(0,0,0,0.1)' }}>
          <div className="flex items-center justify-between mb-4 sm:mb-6">
            <h3 className="text-lg sm:text-xl font-medium text-[#313234]">Premium</h3>
            <div className="flex items-baseline gap-1">
              <span className="text-lg sm:text-xl font-medium text-[#313234]">$349</span>
              <span className="text-sm sm:text-base text-[#6A6D71]">/month</span>
            </div>
          </div>
          <button className="w-full py-3 sm:py-4 bg-[#306EEC] text-[#EEF2FF] rounded-[14px] text-base sm:text-xl font-semibold hover:bg-[#2557C7] transition-colors">Upgrade Plan</button>
        </div>
        <div className="w-full lg:w-[302px] bg-[#EEF2FF] border border-[#C5CBD8] rounded-[14px] p-4 sm:p-6" style={{ boxShadow: '0px 0px 200px 0px rgba(0,0,0,0.1)' }}>
          <p className="text-sm sm:text-base text-[#6A6D71] mb-2">Next payment</p>
          <p className="text-base sm:text-xl font-medium text-[#313234] mb-6 sm:mb-8">On December 30, 2025</p>
          <button className="text-sm sm:text-base text-[#6A6D71] hover:underline">Cancel plan</button>
        </div>
      </div>
      <div>
        <h3 className="text-lg sm:text-xl font-medium text-[#6A6D71] mb-4 sm:mb-6">Invoices</h3>
        <div className="flex flex-col gap-3 sm:gap-4">
          {[1,2,3,4,5].map(item => (
            <div key={item} className="w-full h-[54px] flex items-center justify-between rounded-[14px] border border-[#C5CBD8] bg-[#EEF2FF] px-4 sm:px-6">
              <div className="flex items-center gap-3">
                <svg width="16" height="22" viewBox="0 0 16 22" fill="none" className="flex-shrink-0">
                  <path d="M10 0H2C0.9 0 0.01 0.9 0.01 2L0 20C0 21.1 0.89 22 1.99 22H14C15.1 22 16 21.1 16 20V6L10 0ZM12 18H4V16H12V18ZM12 14H4V12H12V14ZM9 7V1.5L14.5 7H9Z" fill="#313234" />
                </svg>
                <span className="text-[16px] leading-[120%] text-[#313234]">invoice_2025/10.pdf</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[16px] leading-[120%] text-[#6A6D71]">Date of invoice</span>
                <span className="text-[16px] leading-[120%] text-[#313234]">Nov 02, 2020</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
