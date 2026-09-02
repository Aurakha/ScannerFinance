import { Category } from '@/types';

export const DEFAULT_CATEGORIES: Category[] = [
  {
    id: 'cat-operational',
    name: 'Operational',
    icon: 'briefcase-outline',
    color: '#EAB308',
    type: 'expense',
    is_default: true,
  },
  {
    id: 'cat-pantry',
    name: 'Pantry',
    icon: 'restaurant-outline',
    color: '#10B981',
    type: 'expense',
    is_default: true,
  },
  {
    id: 'cat-fasilitas',
    name: 'Fasilitas',
    icon: 'business-outline',
    color: '#EC4899',
    type: 'expense',
    is_default: true,
  },
  {
    id: 'cat-lain-lain',
    name: 'Lain-Lain',
    icon: 'ellipsis-horizontal-circle-outline',
    color: '#3B82F6',
    type: 'expense',
    is_default: true,
  },
];

