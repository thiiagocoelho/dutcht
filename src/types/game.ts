// Card Types
export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';

export interface Card {
  suit: Suit;
  rank: Rank;
  id: string;
}

export interface PlayerHand {
  cards: Card[];
  revealedIndices: number[]; // Indices of cards that are face-up temporarily
}

export interface Player {
  id: string;
  username: string;
  avatarUrl?: string;
  position: number;
  isReady: boolean;
  hand?: PlayerHand;
}

export interface GameState {
  deck: Card[];
  discardPile: Card[];
  playerHands: Record<string, Card[]>;
  revealedCards: Record<string, number[]>; // playerId -> revealed card indices
  phase: 'memorizing' | 'playing' | 'dutch_round' | 'finished';
  lastAction?: GameAction;
}

export interface GameAction {
  type: 'draw' | 'discard' | 'swap' | 'cut' | 'peek' | 'blind_swap' | 'dutch' | 'penalty';
  playerId: string;
  playerName?: string;
  data?: Record<string, unknown>;
  timestamp: Date;
}

export interface Room {
  id: string;
  code: string;
  name: string;
  hostId: string;
  isPrivate: boolean;
  password?: string;
  maxPlayers: number;
  status: 'waiting' | 'playing' | 'finished';
  currentTurn?: string;
  turnStartedAt?: Date;
  dutchCaller?: string;
  createdAt: Date;
  players?: Player[];
}

export interface ChatMessage {
  id: string;
  roomId: string;
  playerId: string;
  playerName?: string;
  message: string;
  createdAt: Date;
}

// Card value calculation
export const getCardValue = (card: Card): number => {
  if (card.rank === 'K') {
    // Black Kings = 0, Red Kings = -1
    return card.suit === 'spades' || card.suit === 'clubs' ? 0 : -1;
  }
  if (card.rank === 'A') return 1;
  if (card.rank === 'J' || card.rank === 'Q') return 10;
  return parseInt(card.rank);
};

// Get card suit symbol
export const getSuitSymbol = (suit: Suit): string => {
  switch (suit) {
    case 'hearts': return '♥';
    case 'diamonds': return '♦';
    case 'clubs': return '♣';
    case 'spades': return '♠';
  }
};

// Check if suit is red
export const isRedSuit = (suit: Suit): boolean => {
  return suit === 'hearts' || suit === 'diamonds';
};

// Create a full deck of cards
export const createDeck = (): Card[] => {
  const suits: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
  const ranks: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const deck: Card[] = [];

  for (const suit of suits) {
    for (const rank of ranks) {
      deck.push({
        suit,
        rank,
        id: `${rank}-${suit}`,
      });
    }
  }

  return shuffleDeck(deck);
};

// Shuffle deck using Fisher-Yates algorithm
export const shuffleDeck = (deck: Card[]): Card[] => {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

// Calculate total score for a hand
export const calculateScore = (cards: Card[]): number => {
  return cards.reduce((total, card) => total + getCardValue(card), 0);
};
