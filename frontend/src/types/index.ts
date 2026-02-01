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
  status: string; // 'draft', 'active', 'completed'
  format: string;
  public_uuid?: string;
  scorer_uuid?: string;

  number_of_poules?: number;
  player_count?: number;
  board_count?: number;
  allow_byes?: boolean; 

  qualifiers_per_poule?: number;
  players: Player[];
}

// We voegen Match en Leg later toe
export interface Match {
    id: number;
    player1_id?: number | null;
    player2_id?: number | null;

    team1_id?: number | null;
    team2_id?: number | null;
    team1?: { id: number; name: string } | null;
    team2?: { id: number; name: string } | null;


    player1?: Player | null;
    player2?: Player | null;

    referee_name?: string;
}

export interface Team {
  id: number;
  name: string;
  players: Player[];
}