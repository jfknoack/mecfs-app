export interface ListIconOption {
  name: string;
  label: string;
}

export const LIST_ICON_OPTIONS: ListIconOption[] = [
  { name: 'list', label: 'Liste' },
  { name: 'pills', label: 'Medikamente' },
  { name: 'capsules', label: 'Kapseln' },
  { name: 'syringe', label: 'Spritze' },
  { name: 'utensils', label: 'Essen' },
  { name: 'apple-whole', label: 'Obst' },
  { name: 'carrot', label: 'Gemüse' },
  { name: 'wheat-awn', label: 'Getreide' },
  { name: 'mug-hot', label: 'Getränk' },
  { name: 'ban', label: 'Unverträglichkeit' },
  { name: 'triangle-exclamation', label: 'Warnung' },
  { name: 'heart', label: 'Favorit' },
  { name: 'star', label: 'Sterne' },
  { name: 'notes-medical', label: 'Notizen' },
  { name: 'heart-pulse', label: 'Gesundheit' },
  { name: 'bed', label: 'Ruhe' },
  { name: 'brain', label: 'Gehirn' },
  { name: 'dumbbell', label: 'Aktivität' },
  { name: 'person-walking', label: 'Gehen' },
  { name: 'music', label: 'Musik' },
  { name: 'list-check', label: 'Pflicht' },
  { name: 'sun', label: 'Tag' },
  { name: 'moon', label: 'Nacht' },
  { name: 'bolt', label: 'Energie' },
  { name: 'battery-half', label: 'Pacing' },
  { name: 'house', label: 'Zuhause' },
  { name: 'cart-shopping', label: 'Einkauf' },
  { name: 'book', label: 'Wissen' },
  { name: 'calendar-day', label: 'Termin' },
  { name: 'users', label: 'Personen' },
  { name: 'leaf', label: 'Natur' },
  { name: 'droplet', label: 'Flüssigkeit' },
  { name: 'temperature-half', label: 'Temperatur' },
];

export function listIconClass(iconName: string): string {
  return `fa-solid fa-${iconName}`;
}
