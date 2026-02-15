import os

# 1. Configuratie
TARGET_DIRS = ["backend/app", "frontend/src"]
IMPORTANT_ROOT_FILES = [
    "requirements.txt", "package.json", "tsconfig.json", 
    "docker-compose.yml", "Dockerfile", "README.md", ".env.example"
]
ALLOWED_EXTENSIONS = {
    ".py", ".tsx", ".ts", ".css", ".html", 
    ".json", ".yaml", ".yml", ".toml", ".md", ".sql"
}
IGNORE_DIRS = {
    "__pycache__", "node_modules", ".venv", "venv", 
    "dist", "build", ".git", ".idea", ".vscode"
}

output_file = "project_structure.txt"

def is_valid_file(filename):
    return any(filename.endswith(ext) for ext in ALLOWED_EXTENSIONS)

with open(output_file, "w", encoding="utf-8") as outfile:
    outfile.write("PROJECT STRUCTUUR OVERZICHT\n")
    outfile.write("=" * 30 + "\n\n")

    # STAP 1: Belangrijke root-bestanden
    outfile.write("--- ROOT BESTANDEN ---\n")
    for filename in IMPORTANT_ROOT_FILES:
        if os.path.exists(filename):
            outfile.write(f"[ROOT] {filename}\n")
    
    outfile.write("\n" + "--- MAP STRUCTUUR ---\n")

    # STAP 2: Loop door de mappen en noteer alleen de paden
    for root_dir in TARGET_DIRS:
        if not os.path.exists(root_dir):
            print(f"Let op: Map niet gevonden: {root_dir}")
            continue
            
        for root, dirs, files in os.walk(root_dir):
            # Filter mappen die genegeerd moeten worden
            dirs[:] = [d for d in dirs if d not in IGNORE_DIRS]
            
            for file in files:
                if is_valid_file(file):
                    file_path = os.path.join(root, file)
                    outfile.write(f"{file_path}\n")

print(f"Klaar! De lijst met bestanden staat in '{output_file}'.")