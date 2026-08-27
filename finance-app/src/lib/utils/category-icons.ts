import {
  ShoppingCart, Coffee, Car, Heart, Home, Shirt, Gamepad2, Dumbbell,
  BookOpen, Gift, Plane, Laptop, Wrench, Users, Landmark, MoreHorizontal,
  Briefcase, TrendingUp, Building2, Bitcoin, FileText, Receipt, User, Gem,
  Utensils, Pizza, Bus, Fuel, Stethoscope, PawPrint, Music, Film,
  Baby, GraduationCap, Smartphone, Umbrella, Palette, Scissors, Wallet,
  CreditCard, PiggyBank, Banknote, HandCoins, Percent, Wine, Beer,
  Dog, Cat, Fish, Flower2, TreePine, Bike, Train, Ship, Fan,
  Lightbulb, Droplet, Wifi, Tv, Camera, Watch, Glasses,
  Cake, IceCreamCone, Salad, Sandwich, Trophy,
  Cigarette, Pill, Cross, Church, Hammer, Paintbrush, Shovel, Package,
  Truck, MapPin, Ticket, PartyPopper, Sparkles, Star, Wallet2, Coins,
  type LucideIcon,
} from 'lucide-react'

// Реєстр іконок — тільки ті, що використовуються в категоріях і типах
// інвестицій. Такий підхід краще ніж import * — дає Vite правильно
// tree-shake. Порядок тут визначає порядок у сітці вибору іконки
// при створенні/редагуванні категорії (ManageCategoriesScreen).
const ICON_REGISTRY: Record<string, LucideIcon> = {
  ShoppingCart, Coffee, Car, Heart, Home, Shirt, Gamepad2, Dumbbell,
  BookOpen, Gift, Plane, Laptop, Wrench, Users, Landmark, MoreHorizontal,
  Briefcase, TrendingUp, Building2, Bitcoin, FileText, Receipt, User, Gem,
  Utensils, Pizza, Sandwich, Salad, IceCreamCone, Cake, Wine, Beer,
  Bus, Train, Ship, Bike, Fuel, Truck,
  Stethoscope, Pill, Cross, Cigarette,
  PawPrint, Dog, Cat, Fish,
  Music, Film, Tv, Camera, Ticket, PartyPopper,
  Baby, GraduationCap, Church,
  Smartphone, Wifi, Lightbulb, Droplet, Fan,
  Umbrella, Flower2, TreePine,
  Palette, Paintbrush, Scissors, Hammer, Shovel, Package,
  Wallet, Wallet2, CreditCard, PiggyBank, Banknote, HandCoins, Coins, Percent,
  Watch, Glasses, Trophy, MapPin, Sparkles, Star,
}

// Список назв іконок у стабільному порядку (для сітки вибору) —
// єдине джерело правди, щоб не розходитись із реєстром вище.
export const ICON_NAMES: string[] = Object.keys(ICON_REGISTRY)

// Повертає компонент іконки за назвою (рядком з БД).
// Якщо іконка не знайдена — fallback на MoreHorizontal.
export function getCategoryIcon(iconName: string): LucideIcon {
  return ICON_REGISTRY[iconName] ?? MoreHorizontal
}
