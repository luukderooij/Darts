import csv
import io
from fastapi.responses import StreamingResponse
from sqlmodel import Session, select
from app.models.player import Player

from app.models.team import Team
from app.models.links import TournamentTeamLink
from sqlalchemy.orm import selectinload




def generate_player_template():
    """Genereert een CSV die Excel direct in kolommen opent."""
    output = io.StringIO()
    
    # Truc voor Excel: Vertel Excel dat we komma's gebruiken als separator
    output.write("sep=,\n") 
    
    writer = csv.writer(output, delimiter=',')
    # Headers [cite: 156, 158]
    writer.writerow(["first_name", "last_name", "nickname", "email"])
    # Voorbeeld data [cite: 156, 158]
    writer.writerow(["Michael", "van Gerwen", "Mighty Mike", "mvg@darts.com"])
    writer.writerow(["Raymond", "van Barneveld", "Barney", "rvb@darts.com"])
    
    output.seek(0)
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode('utf-8')),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=dart_players_template.csv"}
    )

def process_player_import(content: bytes, session: Session, user_id: int) -> int:
    """Importeert spelers en negeert de 'sep=' regel als die aanwezig is."""
    try:
        decoded_content = content.decode('utf-8')
    except UnicodeDecodeError:
        decoded_content = content.decode('latin-1')

    # Verwijder de Excel 'sep=,' regel als de gebruiker die heeft laten staan
    lines = decoded_content.splitlines()
    if lines and lines[0].startswith("sep="):
        decoded_content = "\n".join(lines[1:])

    # Detecteer of Excel ; of , heeft gebruikt 
    try:
        dialect = csv.Sniffer().sniff(decoded_content[:2048], delimiters=',;')
        delimiter = dialect.delimiter
    except Exception:
        delimiter = ','

    stream = io.StringIO(decoded_content)
    reader = csv.DictReader(stream, delimiter=delimiter)
    
    added_count = 0
    for row in reader:
        # Schoon de headers op (lowercase en strip) [cite: 158, 159]
        clean_row = {k.strip().lower(): v.strip() if v else None for k, v in row.items()}
        
        first_name = clean_row.get('first_name') or clean_row.get('voornaam')
        if not first_name:
            continue
            
        # Check op duplicaten via email [cite: 155]
        email = clean_row.get('email')
        if email:
            existing = session.exec(select(Player).where(Player.email == email)).first()
            if existing:
                continue

        player = Player(
            first_name=first_name,
            last_name=clean_row.get('last_name') or clean_row.get('achternaam'),
            nickname=clean_row.get('nickname') or clean_row.get('bijnaam'),
            email=email,
            user_id=user_id
        )
        session.add(player)
        added_count += 1
    
    session.commit()
    return added_count


def generate_team_template():
    """Genereert een template die werkt met namen OF emails."""
    output = io.StringIO()
    output.write("sep=,\n") 
    writer = csv.writer(output, delimiter=',')
    # We voegen kolommen toe voor zowel Naam als Email voor maximale flexibiliteit
    writer.writerow(["team_name", "player1_identifier", "player2_identifier"])
    writer.writerow(["The Power Duo", "Michael van Gerwen", "Raymond van Barneveld"])
    writer.writerow(["Young Guns", "luke@nuke.com", "littler@darts.com"])
    output.seek(0)
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode('utf-8')),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=team_template.csv"}
    )

def process_team_import(content: bytes, session: Session, tournament_id: int = None) -> int:
    """Importeert teams op basis van Naam of Email van spelers."""
    # 1. Decodeer content
    try:
        decoded_content = content.decode('utf-8')
    except UnicodeDecodeError:
        decoded_content = content.decode('latin-1')

    lines = decoded_content.splitlines()
    if lines and lines[0].startswith("sep="):
        decoded_content = "\n".join(lines[1:])

    # 2. DELIMITER DETECTIE (FIX voor de NameError)
    # We definiëren een standaardwaarde voor het geval de sniffer faalt
    detected_delimiter = ',' 
    try:
        if decoded_content.strip():
            dialect = csv.Sniffer().sniff(decoded_content[:2048], delimiters=',;')
            detected_delimiter = dialect.delimiter
    except Exception:
        # Als sniffing faalt (bijv. bij 1 kolom), check handmatig op puntkomma
        if ';' in decoded_content.splitlines()[0]:
            detected_delimiter = ';'

    reader = csv.DictReader(io.StringIO(decoded_content), delimiter=detected_delimiter)
    
    # 3. Cache alle spelers voor snelle lookup op Naam en Email
    all_players = session.exec(select(Player)).all()
    added_count = 0

    for row in reader:
        # Schoon de headers en data op
        clean_row = {k.strip().lower(): v.strip() if v else None for k, v in row.items()}
        
        # Gebruik flexibele identifiers (Naam of Email)
        id1 = clean_row.get('player1_identifier') or clean_row.get('player1_email')
        id2 = clean_row.get('player2_identifier') or clean_row.get('player2_email')
        team_name_input = clean_row.get('team_name')

        if not id1 or not id2:
            continue

        # Helper functie om speler te vinden op Email, Naam of Nickname
        def find_player(identifier: str):
            if not identifier: return None
            search_term = identifier.lower()
            for p in all_players:
                # Check Email [cite: 1004]
                if p.email and p.email.lower() == search_term:
                    return p
                # Check Volledige Naam (Property in model) 
                if p.name.lower() == search_term:
                    return p
                # Check Nickname [cite: 150]
                if p.nickname and p.nickname.lower() == search_term:
                    return p
            return None

        p1 = find_player(id1)
        p2 = find_player(id2)

        if not p1 or not p2:
            # Sla over als een van de spelers niet gevonden kan worden
            continue

        # 4. Check op bestaand team (Duplicate check op speler-IDs)
        new_team_ids = {p1.id, p2.id}
        
        # Haal teams op met hun spelers geladen [cite: 81]
        existing_teams = session.exec(select(Team).options(selectinload(Team.players))).all()
        
        target_team = None
        for et in existing_teams:
            et_ids = {p.id for p in et.players}
            if et_ids == new_team_ids:
                target_team = et
                break

        # 5. Maak Team aan indien nodig
        if not target_team:
            final_name = team_name_input if team_name_input else f"{p1.nickname or p1.first_name} & {p2.nickname or p2.first_name}"
            target_team = Team(name=final_name)
            target_team.players = [p1, p2]
            session.add(target_team)
            session.commit()
            session.refresh(target_team)
            added_count += 1

        # 6. Link aan Toernooi [cite: 85]
        if tournament_id:
            # Check of link al bestaat in TournamentTeamLink [cite: 86, 144]
            existing_link = session.get(TournamentTeamLink, (tournament_id, target_team.id))
            if not existing_link:
                link = TournamentTeamLink(tournament_id=tournament_id, team_id=target_team.id)
                session.add(link)
    
    session.commit()
    return added_count