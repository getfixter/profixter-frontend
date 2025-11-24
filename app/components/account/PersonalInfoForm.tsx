import { AccountFormData } from './types';

interface PersonalInfoFormProps {
  formData: AccountFormData;
  onChange: (field: keyof AccountFormData, value: string) => void;
  onDiscard: () => void;
  onSave: () => void;
}

export function PersonalInfoForm({ formData, onChange, onDiscard, onSave }: PersonalInfoFormProps) {
  return (
    <div>
      <h2 className="text-xl sm:text-2xl font-semibold text-[#313234] mb-8 sm:mb-10">Personal information</h2>
      <form className="space-y-6 sm:space-y-6">
        {(['name','email','phone','address1','address2'] as (keyof AccountFormData)[]).map(key => (
          <div key={key}>
            <label className="block text-[#6A6D71] text-sm sm:text-base mb-2 sm:mb-3">{key === 'address1' ? 'Address 1' : key === 'address2' ? 'Address 2' : key.charAt(0).toUpperCase() + key.slice(1).replace('address','Address')}</label>
            <input
              type={key === 'email' ? 'email' : key === 'phone' ? 'tel' : 'text'}
              value={formData[key]}
              onChange={e => onChange(key, e.target.value)}
              className="w-full px-4 sm:px-6 py-3 sm:py-4 bg-[#EEF2FF] border border-[#C5CBD8] rounded-[20px] text-[#313234] text-base sm:text-xl font-medium focus:outline-none focus:border-[#306EEC] focus:ring-2 focus:ring-[#306EEC]/20 transition-colors"
            />
          </div>
        ))}
        <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 pt-6 sm:pt-8">
          <button type="button" onClick={onDiscard} className="w-full sm:w-[350px] py-3 sm:py-4 bg-transparent border border-[#306EEC] text-[#313234] rounded-[14px] text-base sm:text-xl font-semibold hover:bg-[#306EEC]/10 transition-colors">Discard changes</button>
          <button type="button" onClick={onSave} className="w-full sm:w-[350px] py-3 sm:py-4 bg-[#306EEC] text-[#EEF2FF] rounded-[14px] text-base sm:text-xl font-semibold hover:bg-[#2557C7] transition-colors">Safe changes</button>
        </div>
      </form>
    </div>
  );
}
