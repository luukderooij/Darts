import os

# 1. Mappen die we recursief willen doorzoeken
TARGET_DIRS = ["backend/app", "frontend/src"]

# 2. Specifieke bestanden in de root die cruciaal zijn voor context
# Pas dit aan op basis van wat jij in je root hebt staan
IMPORTANT_ROOT_FILES = [
    "requirements.txt", 
    "package.json", 
    "tsconfig.json", 
    "docker-compose.yml", 
    "Dockerfile", 
    "README.md",
    ".env.example" # NOOIT je echte .env uploaden!
]

# 3. Uitgebreide set extensies voor code én configuratie
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
    
    # STAP 1: Voeg specifieke root-bestanden toe
    print("Scannen van losse belangrijke bestanden...")
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

    # STAP 2: Loop door de mappen
    print("Scannen van mappen...")
    for root_dir in TARGET_DIRS:
        if not os.path.exists(root_dir):
            print(f"Let op: Map niet gevonden: {root_dir}")
            continue
            
        for root, dirs, files in os.walk(root_dir):
            # Verwijder genegeerde mappen
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