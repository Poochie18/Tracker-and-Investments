import { getCategoryIcon } from '@/lib/utils/category-icons'

interface CategoryIconCircleProps {
  iconName: string
  colorHex: string
  size?: 'sm' | 'md' | 'lg'
}

const SIZE_MAP = {
  sm: { circle: 36, icon: 18 },
  md: { circle: 44, icon: 22 },
  lg: { circle: 56, icon: 28 },
}

export function CategoryIconCircle({ iconName, colorHex, size = 'md' }: CategoryIconCircleProps) {
  const Icon = getCategoryIcon(iconName)
  const { circle, icon } = SIZE_MAP[size]

  return (
    <div
      className="flex items-center justify-center rounded-full flex-shrink-0"
      style={{
        width: circle,
        height: circle,
        // Напівпрозорий фон з кольором категорії
        backgroundColor: `${colorHex}22`,
      }}
    >
      <Icon size={icon} color={colorHex} />
    </div>
  )
}
