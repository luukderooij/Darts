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

// Update Match interface met alle velden die we in de TV mode gebruiken
export interface Match {
    id: number;
    round_number: number;
    round_id?: number | null; 
    poule_number: number | null;
    
    // UI velden voor namen (komt uit backend 'player1_name' etc)
    player1_name?: string;
    player2_name?: string;
    
    score_p1: number;
    score_p2: number;
    is_completed: boolean;
    
    // Relaties (optioneel, afhankelijk van endpoint)
    player1_id?: number | null;
    player2_id?: number | null;
    team1_id?: number | null;
    team2_id?: number | null;

    player1?: Player | null;
    player2?: Player | null;
    
    board_id?: number | null;
    board_name?: string; 
    board_number?: number | null;

    referee_id?: number | null;
    referee_team_id?: number | null;
    referee_name?: string;
    

    beer_fetcher_id?: number | null;
    beer_fetcher_team_id?: number | null; // Voor doubles
    beer_fetcher_name?: string;

    
    


}

export interface Tournament {
  id: number;
  name: string;
  rounds?: TournamentRound[]; // NIEUW
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

  boards: Dartboard[]; 
  matches: Match[]

  mode: 'singles' | 'doubles';
}

export interface Team {
  id: number;
  name: string;
  players: Player[];
}

export interface TournamentRound {
  id: number;
  round_index: number;
  name: string | null;
  is_active: boolean;
  tournament_id: number;
  matches?: Match[]; // Optioneel, afhankelijk of je ze mee-include
}