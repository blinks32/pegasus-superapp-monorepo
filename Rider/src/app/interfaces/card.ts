export interface Card {
  cardId: string;
  id?: string;
  email: string;
  last4: string | number;
  brand?: string; // Card brand: visa, mastercard, amex, etc.
}
