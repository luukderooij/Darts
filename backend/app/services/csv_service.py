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

def process_team_import(content: bytes, session: Session, tournament_id: int, user_id: int):
    # 1. Decodeer de content (met fallback voor Excel/Windows encoding)
    try:
        file_content = content.decode('utf-8-sig')
    except UnicodeDecodeError:
        file_content = content.decode('latin-1')
    
    # 2. Automatisch scheidingsteken detecteren
    try:
        dialect = csv.Sniffer().sniff(file_content[:1024])
        delimiter = dialect.delimiter
    except:
        delimiter = ';' # Default voor Nederlandse Excel

    reader = csv.DictReader(io.StringIO(file_content), delimiter=delimiter)
    
    # --- NIEUW: Bestaande teams ophalen voor duplicate check ---
    # We laden de spelers direct mee (selectinload) om snelle vergelijkingen te maken
    existing_teams = session.exec(
        select(Team)
        .where(Team.user_id == user_id)
        .options(selectinload(Team.players))
    ).all()

    import_count = 0
    errors = [] 

    for index, row in enumerate(reader, start=2):
        team_name = row.get('team_name')
        player_refs = [row.get('player1_identifier'), row.get('player2_identifier')]
        
        matched_players = []
        row_issues = []

        # Spelers zoeken (jouw bestaande logica)
        for i, ref in enumerate(player_refs, start=1):
            if not ref:
                row_issues.append(f"Speler {i} is leeg.")
                continue
            
            ref = ref.strip()
            player = None

            # Zoekstrategie 1: Email
            player = session.exec(
                select(Player).where(Player.email == ref, Player.user_id == user_id)
            ).first()

            # Zoekstrategie 2: Volledige naam of Nickname
            if not player:
                player = session.exec(
                    select(Player).where(
                        ((Player.first_name + " " + Player.last_name) == ref) | 
                        (Player.nickname == ref),
                        Player.user_id == user_id
                    )
                ).first()

            # Zoekstrategie 3: Voornaam
            if not player:
                results = session.exec(
                    select(Player).where(Player.first_name == ref, Player.user_id == user_id)
                ).all()
                if len(results) == 1:
                    player = results[0]
                elif len(results) > 1:
                    row_issues.append(f"Voornaam '{ref}' is niet uniek.")
                else:
                    row_issues.append(f"Speler '{ref}' niet gevonden.")

            if player:
                matched_players.append(player)

        # 3. Team aanmaken of overslaan bij dubbelen
        if len(matched_players) == 2:
            # --- NIEUW: DUPLICATE CHECK LOGICA ---
            new_player_ids = {p.id for p in matched_players}
            is_duplicate = False
            
            for et in existing_teams:
                existing_player_ids = {p.id for p in et.players}
                if existing_player_ids == new_player_ids:
                    is_duplicate = True
                    errors.append(f"Regel {index} overgeslagen: Dit duo vormt al team '{et.name}'.")
                    break
            
            if is_duplicate:
                continue

            # Geen duplicaat? Maak het team aan
            final_name = team_name if team_name and team_name.strip() != "" else f"{matched_players[0].first_name} & {matched_players[1].first_name}"
            
            new_team = Team(
                name=final_name,
                user_id=user_id,
                players=matched_players
            )
            session.add(new_team)
            session.flush()

            # Voeg toe aan lokale lijst om ook dubbelen BINNEN de CSV te vangen
            existing_teams.append(new_team)

            if tournament_id:
                link = TournamentTeamLink(tournament_id=tournament_id, team_id=new_team.id)
                session.add(link)
            
            import_count += 1
        else:
            error_msg = f"Regel {index} overgeslagen: {' '.join(row_issues)}"
            errors.append(error_msg)

    session.commit()
    return import_count, errors