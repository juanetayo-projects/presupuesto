import {
  AlertTriangle, Baby, Bike, Car, Circle, Fuel, Gift, GraduationCap, HeartPulse, Heart, Home, Landmark, PawPrint, PiggyBank, Scissors, Shield, ShoppingCart,
  Sparkles, User, Utensils, Zap,
  type LucideIcon,
} from 'lucide-react'

export const ICONOS: Record<string, LucideIcon> = {
  landmark: Landmark,
  zap: Zap,
  heart: Heart,
  user: User,
  shield: Shield,
  'piggy-bank': PiggyBank,
  'alert-triangle': AlertTriangle,
  circle: Circle,
  home: Home,
  car: Car,
  'shopping-cart': ShoppingCart,
  utensils: Utensils,
  'graduation-cap': GraduationCap,
  'heart-pulse': HeartPulse,
  fuel: Fuel,
  bike: Bike,
  scissors: Scissors,
  sparkles: Sparkles,
  baby: Baby,
  gift: Gift,
  'paw-print': PawPrint,
}

export function CategoryIcon({ icono, color, size = 'md' }: { icono: string; color: string; size?: 'sm' | 'md' }) {
  const Icon = ICONOS[icono] ?? Circle
  const box = size === 'sm' ? 'size-7 rounded-lg' : 'size-9 rounded-xl'
  return (
    <span className={`${box} grid shrink-0 place-items-center`} style={{ backgroundColor: `${color}1f`, color }}>
      <Icon className={size === 'sm' ? 'size-3.5' : 'size-4.5'} />
    </span>
  )
}
