import {
  ShoppingCart, Coffee, Car, Heart, Home, Shirt, Gamepad2, Dumbbell,
  BookOpen, Gift, Plane, Laptop, Wrench, Users, Landmark, MoreHorizontal,
  Briefcase, TrendingUp, Building2, Bitcoin, FileText, Receipt, User, Gem,
  type LucideIcon,
} from 'lucide-react'

// Реєстр іконок — тільки ті, що використовуються в категоріях і типах інвестицій.
// Такий підхід краще ніж import * — дає Vite правильно tree-shake.
const ICON_REGISTRY: Record<string, LucideIcon> = {
  ShoppingCart, Coffee, Car, Heart, Home, Shirt, Gamepad2, Dumbbell,
  BookOpen, Gift, Plane, Laptop, Wrench, Users, Landmark, MoreHorizontal,
  Briefcase, TrendingUp, Building2, Bitcoin, FileText, Receipt, User, Gem,
}

// Повертає компонент іконки за назвою (рядком з БД).
// Якщо іконка не знайдена — fallback на MoreHorizontal.
export function getCategoryIcon(iconName: string): LucideIcon {
  return ICON_REGISTRY[iconName] ?? MoreHorizontal
}
