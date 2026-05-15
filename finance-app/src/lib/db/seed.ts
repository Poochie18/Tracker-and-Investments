import type { TransactionType } from './schema'

// Структура для визначення дефолтної категорії (без id і user_id)
interface CategorySeed {
  name: string
  type: TransactionType
  icon_name: string  // назва іконки з lucide-react
  color_hex: string
}

// ──────────────────────────────────────────────────────────
// Дефолтні категорії витрат
// Кольори відповідають скріншотам додатку
// ──────────────────────────────────────────────────────────
export const DEFAULT_EXPENSE_CATEGORIES: CategorySeed[] = [
  { name: 'Продукти харчування', type: 'expense', icon_name: 'ShoppingCart',   color_hex: '#51CF66' },
  { name: 'Кафе',               type: 'expense', icon_name: 'Coffee',          color_hex: '#F4B942' },
  { name: 'Транспорт',          type: 'expense', icon_name: 'Car',             color_hex: '#4A90E2' },
  { name: 'Здоров\'я',          type: 'expense', icon_name: 'Heart',           color_hex: '#FF6B6B' },
  { name: 'Дім',                type: 'expense', icon_name: 'Home',            color_hex: '#5DADE2' },
  { name: 'Одяг',               type: 'expense', icon_name: 'Shirt',           color_hex: '#E91E63' },
  { name: 'Дозвілля',           type: 'expense', icon_name: 'Gamepad2',        color_hex: '#9CB861' },
  { name: 'Тренування',         type: 'expense', icon_name: 'Dumbbell',        color_hex: '#00C896' },
  { name: 'Освіта',             type: 'expense', icon_name: 'BookOpen',        color_hex: '#5DADE2' },
  { name: 'Подарунки',          type: 'expense', icon_name: 'Gift',            color_hex: '#E91E63' },
  { name: 'Подорожі',           type: 'expense', icon_name: 'Plane',           color_hex: '#4A90E2' },
  { name: 'Техніка',            type: 'expense', icon_name: 'Laptop',          color_hex: '#607D8B' },
  { name: 'Хоз товари',         type: 'expense', icon_name: 'Wrench',          color_hex: '#9CB861' },
  { name: 'Сім\'я',             type: 'expense', icon_name: 'Users',           color_hex: '#E74C3C' },
  { name: 'Депозит',            type: 'expense', icon_name: 'Landmark',        color_hex: '#F4B942' },
  { name: 'Інше',               type: 'expense', icon_name: 'MoreHorizontal',  color_hex: '#B0B0B0' },
]

// ──────────────────────────────────────────────────────────
// Дефолтні категорії доходів
// ──────────────────────────────────────────────────────────
export const DEFAULT_INCOME_CATEGORIES: CategorySeed[] = [
  { name: 'Заробітна плата',   type: 'income', icon_name: 'Briefcase',       color_hex: '#51CF66' },
  { name: 'Подарунок',         type: 'income', icon_name: 'Gift',            color_hex: '#E91E63' },
  { name: 'Відсотки',          type: 'income', icon_name: 'TrendingUp',      color_hex: '#00C896' },
  { name: 'Оренда квартири',   type: 'income', icon_name: 'Building2',       color_hex: '#4A90E2' },
  { name: 'Інше',              type: 'income', icon_name: 'MoreHorizontal',  color_hex: '#B0B0B0' },
]

export const ALL_DEFAULT_CATEGORIES = [
  ...DEFAULT_EXPENSE_CATEGORIES,
  ...DEFAULT_INCOME_CATEGORIES,
]
