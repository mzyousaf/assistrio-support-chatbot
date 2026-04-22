import type { LucideIcon } from 'lucide-react';
import {
  Bell,
  BookOpen,
  Bookmark,
  Briefcase,
  Building2,
  Calendar,
  Camera,
  ClipboardList,
  Clock,
  CreditCard,
  Download,
  ExternalLink,
  FileText,
  Globe,
  Headphones,
  Heart,
  HelpCircle,
  Home,
  Image,
  Info,
  LifeBuoy,
  Lightbulb,
  Link2,
  Lock,
  Mail,
  MapPin,
  Megaphone,
  MessageCircle,
  Newspaper,
  Package,
  Phone,
  PlayCircle,
  Search,
  Send,
  Settings,
  Share2,
  Shield,
  ShoppingCart,
  Smartphone,
  Star,
  Store,
  Ticket,
  Truck,
  User,
  Users,
  Video,
  Wrench,
  Zap,
} from 'lucide-react';
import type { QuickLinkIconId } from './quickLinkIconIds';

/**
 * Curated quick-link icons (aligned with `chat-widget/src/lib/quickLinkIcons.ts`).
 */
const QUICK_LINK_ICONS: Record<QuickLinkIconId, LucideIcon> = {
  'external-link': ExternalLink,
  home: Home,
  mail: Mail,
  phone: Phone,
  'message-circle': MessageCircle,
  'help-circle': HelpCircle,
  'file-text': FileText,
  'link-2': Link2,
  calendar: Calendar,
  'shopping-cart': ShoppingCart,
  'credit-card': CreditCard,
  user: User,
  users: Users,
  'building-2': Building2,
  'map-pin': MapPin,
  globe: Globe,
  package: Package,
  truck: Truck,
  'book-open': BookOpen,
  'life-buoy': LifeBuoy,
  wrench: Wrench,
  search: Search,
  settings: Settings,
  shield: Shield,
  bell: Bell,
  bookmark: Bookmark,
  briefcase: Briefcase,
  camera: Camera,
  'clipboard-list': ClipboardList,
  clock: Clock,
  download: Download,
  headphones: Headphones,
  heart: Heart,
  image: Image,
  info: Info,
  lightbulb: Lightbulb,
  lock: Lock,
  megaphone: Megaphone,
  newspaper: Newspaper,
  'play-circle': PlayCircle,
  send: Send,
  'share-2': Share2,
  smartphone: Smartphone,
  star: Star,
  store: Store,
  ticket: Ticket,
  video: Video,
  zap: Zap,
};

/** Resolve a stored id to a Lucide icon; unknown/missing → ExternalLink (matches chat-widget). */
export function getQuickLinkIcon(id: string | undefined): LucideIcon {
  if (!id) return ExternalLink;
  return QUICK_LINK_ICONS[id as QuickLinkIconId] ?? ExternalLink;
}

/** Icon used in the widget header when `menuQuickLinksMenuIcon` is unset (see ChatHeader). */
export function getMenuQuickLinksButtonIcon(id: string | undefined): LucideIcon {
  return getQuickLinkIcon(id ?? 'link-2');
}

/** Human-readable label for an icon id (e.g. for `aria-label` / tooltips). */
export function quickLinkIconHumanLabel(id: string): string {
  return id
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
