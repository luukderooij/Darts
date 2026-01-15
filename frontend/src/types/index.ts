export interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
}

export interface Player {
  id: number;
  first_name: string;
  last_name?: string;
  nickname?: string;
  email?: string;
  name: string;
}

export interface Dartboard {
  id: number;
  name: string;
  number: number;
}

export interface Tournament {
  id: number;
  name: string;
  date: string;
  number_of_poules: number;
  status: string;
  public_uuid: string;
  scorer_uuid: string;
  player_count?: number;
  board_count?: number;
}