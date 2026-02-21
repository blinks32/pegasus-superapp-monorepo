export interface Card {
    name: string;
    number: string;
    type: string;
    id: string;
    selected: boolean;
    cardId?: string;
    last4?: string | number;
    brand?: string;
}
