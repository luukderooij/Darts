// This file defines the shape of our data so TypeScript can help us catch errors.

export interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
}

export interface Player {
  id: number;
  first_name: string;
  last_name?: string; // The '?' means it is optional
  nickname?: string;
  email?: string;
  name: string;       // This is the formatted name from the backend (e.g. 'Luke "The Nuke" Littler')
}

export interface Tournament {
  id: number;
  name: string;
  date: string;
  status: string; // 'draft', 'active', 'completed'
  public_uuid?: string;
}

export interface Dartboard {
  id: number;
  name: string;
  number: number;
}
// We will add 'Match' and 'Leg' definitions here later when we build the scoreboard!