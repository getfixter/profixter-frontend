import { ActiveTab } from './types';

interface AccountSidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  onLogout?: () => void;
  userName: string;
}

export function AccountSidebar({ activeTab, setActiveTab, onLogout, userName }: AccountSidebarProps) {
  const menuItems: { key: ActiveTab; label: string }[] = [
    { key: 'personal', label: 'Personal information' },
    { key: 'plan', label: 'My plan' },
    { key: 'bookings', label: 'My bookings' },
    { key: 'password', label: 'Password' },
  ];
  return (
    <div className="w-full lg:w-[358px] bg-[#EEF2FF] border border-[#C5CBD8] rounded-[11px] p-4 sm:p-6 lg:p-8" style={{ boxShadow: '0px 0px 200px 0px rgba(0, 0, 0, 0.1)' }}>
      <div className="flex flex-col items-center mb-6 sm:mb-8">
        <div className="w-[120px] h-[120px] sm:w-[150px] sm:h-[150px] rounded-full bg-[#C5CBD8] flex items-center justify-center mb-3 sm:mb-4">
          <svg width="85" height="77" viewBox="0 0 106 96" fill="none" className="sm:w-[106px] sm:h-[96px]">
            <path d="M53 48C61.8366 48 69 40.8366 69 32C69 23.1634 61.8366 16 53 16C44.1634 16 37 23.1634 37 32C37 40.8366 44.1634 48 53 48Z" fill="#EEF2FF" />
            <path d="M53 53C35.8792 53 22 62.0589 22 73C22 77.4183 25.5817 81 30 81H76C80.4183 81 84 77.4183 84 73C84 62.0589 70.1208 53 53 53Z" fill="#EEF2FF" />
          </svg>
        </div>
        <h2 className="text-xl sm:text-2xl font-semibold text-[#313234] mb-1">{userName}</h2>
      </div>
      <nav className="space-y-3 sm:space-y-4">
        {menuItems.map(item => (
          <button
            key={item.key}
            onClick={() => setActiveTab(item.key)}
            className={`w-full text-left text-sm sm:text-base px-0 py-1 relative text-[#313234]`}
          >
            {item.label}
            <span className={`absolute -bottom-1 left-0 w-full h-0.5 bg-[#306EEC] transition-transform duration-300 origin-left ${activeTab === item.key ? 'scale-x-100' : 'scale-x-0'}`}></span>
          </button>
        ))}
        <button className="w-full text-left text-base px-0 py-1 text-[#FF3C3C]" onClick={onLogout}>Log Out</button>
      </nav>
    </div>
  );
}
