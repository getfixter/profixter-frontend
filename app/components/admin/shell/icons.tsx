import {
  BanknotesIcon,
  BriefcaseIcon,
  CalendarDaysIcon,
  ChartBarIcon,
  EllipsisHorizontalIcon,
  EnvelopeIcon,
  FolderIcon,
  InboxIcon,
  ListBulletIcon,
  MegaphoneIcon,
  PhotoIcon,
  SparklesIcon,
  SunIcon,
  UserGroupIcon,
  UsersIcon,
} from "@heroicons/react/24/outline";
import type { SectionIcon } from "@/lib/admin/sections";

const ICONS: Record<SectionIcon, typeof BriefcaseIcon> = {
  jobs: BriefcaseIcon,
  day: SunIcon,
  schedule: CalendarDaysIcon,
  customers: UsersIcon,
  projects: FolderIcon,
  leads: InboxIcon,
  overview: ChartBarIcon,
  communications: EnvelopeIcon,
  tips: BanknotesIcon,
  team: UserGroupIcon,
  photos: PhotoIcon,
  promotion: MegaphoneIcon,
  activity: ListBulletIcon,
  assistant: SparklesIcon,
  more: EllipsisHorizontalIcon,
};

export function SectionGlyph({ icon, className = "h-6 w-6" }: { icon: SectionIcon; className?: string }) {
  const Icon = ICONS[icon];
  return <Icon className={className} aria-hidden="true" />;
}
