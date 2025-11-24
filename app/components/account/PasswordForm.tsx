export function PasswordForm() {
  return (
    <div>
      <h2 className="text-xl sm:text-2xl font-semibold text-[#313234] mb-8 sm:mb-12">Password</h2>
      <form className="space-y-6 sm:space-y-10">
        {['Current Password','New Password','Confirm new Password'].map(label => (
          <div key={label}>
            <label className="block text-[#6A6D71] text-sm sm:text-base mb-2 sm:mb-3">{label}</label>
            <input
              type="password"
              className="w-full px-4 sm:px-6 py-3 sm:py-4 bg-white border border-[#C5CBD8] rounded-[14px] text-[#313234] text-sm sm:text-base focus:outline-none focus:border-[#306EEC] transition-colors"
            />
          </div>
        ))}
        <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 pt-6 sm:pt-8">
          <button type="button" className="w-full sm:w-[350px] py-3 sm:py-4 bg-transparent border border-[#306EEC] text-[#313234] rounded-[14px] text-base sm:text-xl font-semibold hover:bg-[#306EEC]/10 transition-colors">Discard changes</button>
          <button type="button" className="w-full sm:w-[350px] py-3 sm:py-4 bg-[#306EEC] text-[#EEF2FF] rounded-[14px] text-base sm:text-xl font-semibold hover:bg-[#2557C7] transition-colors">Safe changes</button>
        </div>
      </form>
    </div>
  );
}
