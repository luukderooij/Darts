import os

# Mappen en extensies die we willen zien
TARGET_DIRS = ["backend/app", "frontend/src"]
ALLOWED_EXTENSIONS = {".py", ".tsx", ".ts", ".css", ".html"}
IGNORE_DIRS = {"__pycache__", "node_modules", ".venv", "dist", "build"}

output_file = "project_context.txt"

def is_text_file(filename):
    return any(filename.endswith(ext) for ext in ALLOWED_EXTENSIONS)

with open(output_file, "w", encoding="utf-8") as outfile:
    for root_dir in TARGET_DIRS:
        if not os.path.exists(root_dir):
            print(f"Let op: Map niet gevonden: {root_dir}")
            continue
            
        for root, dirs, files in os.walk(root_dir):
            # Verwijder genegeerde mappen zodat we er niet doorheen lopen
            dirs[:] = [d for d in dirs if d not in IGNORE_DIRS]
            
            for file in files:
                if is_text_file(file):
                    file_path = os.path.join(root, file)
                    try:
                        with open(file_path, "r", encoding="utf-8") as infile:
                            content = infile.read()
                            
                        # Schrijf bestandsnaam en inhoud met een scheiding
                        outfile.write(f"\n{'='*50}\n")
                        outfile.write(f"FILE: {file_path}\n")
                        outfile.write(f"{'='*50}\n\n")
                        outfile.write(content)
                        outfile.write("\n")
                    except Exception as e:
                        print(f"Kon {file_path} niet lezen: {e}")

print(f"Klaar! Alle code staat in '{output_file}'. Upload dit bestand naar de chat.")