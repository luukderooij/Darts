import os

# 1. Project Documentatie (Jouw tekstuele input)
PROJECT_OVERVIEW_TEXT = """
# PROJECT OVERVIEW: DART TOERNOOI MANAGER
================================================================================
1. Projectoverzicht
De Dart Toernooi Manager is een full-stack webapplicatie ontworpen voor het stroomlijnen van darttoernooien. 
Doelgroep: Lokale kroegen, dartverenigingen en regionale bonden.
Spelvormen: Singles (1v1) en Doubles (2v2).
Toernooi-modellen: Round Robin, Single/Double Elimination en Hybride.

2. Technische Stack
Backend: Python 3.12 met FastAPI.
Database: SQLModel (SQLAlchemy + Pydantic) met SQLite/PostgreSQL.
Frontend: React (TypeScript) met Tailwind CSS en Lucide Icons.
Real-time: WebSockets voor score-updates.
Deployment: Docker & Docker Compose.

3. Architectuur & Datamodel
Modellen: user, tournament, player, team, match, dartboard.

4. Kernfunctionaliteiten
- Wizard-configuratie & Auto-Generation van schema's.
- Slimme Arbitrage: Automatische toewijzing van schrijvers.
- Narrowcasting (TV Mode): Live carrousel voor toeschouwers.

5. Business Logic
- Match-validatie via state-machine (Best of X).
- Smart Scheduling Logic: Gebalanceerde verdeling van speel- en schrijfrondes om "clumping" (opeenvolgende taken) en lange wachttijden te minimaliseren, gebaseerd op een rustfactor-algoritme.
- Ranking-logica op basis van Punten (2 per winst) -> Leg-Difference (+/- Saldo) -> Head-to-Head (onderling resultaat) -> 9-dart-Shoot-out (indien 3 spelers gelijk staan). Dit is volgens Order of Merrit Rules

5b. Knock-out Transitie & Seeding
Cross-Poule Matching: Dynamische Knock-out
​Dit toernooi gebruikt een slim systeem om de knock-outfase te bepalen. Het doel is maximale sportieve variatie en een eerlijke verdeling van weerstand. Het systeem werkt in drie heldere stappen:
​1. Bepalen van de Byes (Vrijlotingen)
Eerst kijkt het systeem of het aantal spelers precies in een knock-outschema past (4, 8, 16, 32, etc.).
​Past het niet precies? (Bijv. 15 spelers voor een schema van 16). Dan worden de ontbrekende plekken opgevuld met Byes indien voor deze setting is gekozen. 
​Deze vrijlotingen gaan naar de allerbeste poulewinnaars (op basis van hun prestaties over alle poules heen). Zij slaan de eerste ronde over.
​2. Cyclisch Koppelen (De rest van het veld)
De spelers die geen Bye hebben, worden aan elkaar gekoppeld.
​Meerdere Poules: Er wordt gekoppeld in een cirkel (Poule A ➤ Poule B ➤ Poule C ➤ ... ➤ Poule A).
​1 Poule: Er wordt intern gekoppeld.
​3. Sterk tegen Zwak
Binnen die koppeling geldt altijd: de sterkste beschikbare speler speelt tegen de zwakste beschikbare speler.
​Voorbeeld (3 poules van 5 spelers = 15 deelnemers)
​Er is een schema van 16 nodig. Dat betekent 1 Bye en 7 wedstrijden.
​De Bye: De allerbeste nummer 1 (bijvoorbeeld die van Poule A) krijgt een Bye en is direct door.
​De Matches: De overige 14 spelers worden volgens het doorschuif-systeem gematcht:
​De nummer 1 van Poule B speelt tegen de nummer 5 van Poule C.
​De nummer 1 van Poule C speelt tegen de nummer 5 van Poule A.
​De nummer 2 van Poule A speelt tegen de nummer 4 van Poule B.
​(Enzovoort, tot alle spelers zijn voorzien).

6. Interface
- Publieke Pagina's: Home, Live Match View, TV Mode.
- Admin Dashboard: JWT beveiligd, Player/Tournament management.
- Scorer Interface: Geoptimaliseerd voor tablets met numeriek keypad.

7. DevOps & Security
- OAuth2 met JWT.
- Live systeemlogs via WebSockets.
================================================================================
"""

# 2. Mappen die we recursief willen doorzoeken
TARGET_DIRS = ["backend/app", "frontend/src"]

# 3. Specifieke bestanden in de root
IMPORTANT_ROOT_FILES = [
    "requirements.txt", 
    "package.json", 
    "tsconfig.json", 
    "docker-compose.yml", 
    "Dockerfile", 
    "README.md",
    ".env.example"
]

# 4. Extensies & Uitsluitingen
ALLOWED_EXTENSIONS = {
    ".py", ".tsx", ".ts", ".css", ".html", 
    ".json", ".yaml", ".yml", ".toml", ".md", ".sql"
}

IGNORE_DIRS = {
    "__pycache__", "node_modules", ".venv", "venv", 
    "dist", "build", ".git", ".idea", ".vscode"
}

output_file = "project_context.txt"

def is_text_file(filename):
    return any(filename.endswith(ext) for ext in ALLOWED_EXTENSIONS)

with open(output_file, "w", encoding="utf-8") as outfile:
    
    # STAP 1: Schrijf de projectomschrijving bovenaan
    print("Documentatie schrijven...")
    outfile.write(PROJECT_OVERVIEW_TEXT)
    outfile.write("\n\n" + "#" * 80 + "\n")
    outfile.write("# SOURCE CODE START\n")
    outfile.write("#" * 80 + "\n\n")

    # STAP 2: Voeg specifieke root-bestanden toe
    print("Scannen van belangrijke configuratiebestanden...")
    for filename in IMPORTANT_ROOT_FILES:
        if os.path.exists(filename):
            try:
                with open(filename, "r", encoding="utf-8") as infile:
                    content = infile.read()
                    outfile.write(f"\n{'='*50}\n")
                    outfile.write(f"CONFIG FILE: {filename}\n")
                    outfile.write(f"{'='*50}\n\n")
                    outfile.write(content)
                    outfile.write("\n")
            except Exception as e:
                print(f"Kon {filename} niet lezen: {e}")

    # STAP 3: Loop door de mappen voor broncode
    print("Scannen van mappen...")
    for root_dir in TARGET_DIRS:
        if not os.path.exists(root_dir):
            print(f"Let op: Map niet gevonden: {root_dir}")
            continue
            
        for root, dirs, files in os.walk(root_dir):
            dirs[:] = [d for d in dirs if d not in IGNORE_DIRS]
            
            for file in files:
                if is_text_file(file):
                    file_path = os.path.join(root, file)
                    try:
                        with open(file_path, "r", encoding="utf-8") as infile:
                            content = infile.read()
                            
                            outfile.write(f"\n{'='*50}\n")
                            outfile.write(f"FILE: {file_path}\n")
                            outfile.write(f"{'='*50}\n\n")
                            outfile.write(content)
                            outfile.write("\n")
                    except Exception as e:
                        print(f"Kon {file_path} niet lezen: {e}")

print(f"Klaar! Upload '{output_file}' naar de chat.")