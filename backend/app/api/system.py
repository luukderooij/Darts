import os
import re
from typing import List, Optional
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()

class ChangeItem(BaseModel):
    type: str      
    text: str
    hash: Optional[str] = None
    link: Optional[str] = None

class Release(BaseModel):
    version: str
    date: str
    description: Optional[str] = None
    changes: List[ChangeItem]

def parse_changelog_line(line: str) -> Optional[ChangeItem]:
    # Regex: * message ([hash](link))
    match_hash = re.search(r'^\*\s+(.*?)\s+\(\[(.*?)\]\((.*?)\)\)', line)
    
    text = ""
    commit_hash = None
    link = None

    if match_hash:
        text = match_hash.group(1)
        commit_hash = match_hash.group(2)
        link = match_hash.group(3)
    else:
        # Fallback: tekst zonder link
        match_simple = re.search(r'^\*\s+(.*)', line)
        if match_simple:
            text = match_simple.group(1)
        else:
            return None

    # Markdown cleanup (**bold**)
    text = re.sub(r'\*\*(.*?)\*\*', r'\1', text)
    
    return ChangeItem(type="unknown", text=text, hash=commit_hash, link=link)

def determine_type_from_header(header: str) -> str:
    h = header.lower()
    if "features" in h: return "feat"
    if "bug fixes" in h: return "fix"
    if "performance" in h: return "perf"
    if "reverts" in h: return "revert"
    return "chore"

@router.get("/changelog", response_model=List[Release])
def get_changelog():
    # --- PAD FIX: We gaan 3 mappen omhoog vanuit api/system.py ---
    # api -> app -> backend -> ROOT
    root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
    changelog_path = os.path.join(root_dir, "CHANGELOG.md")
    
    # DEBUG: Als bestand niet bestaat, geef dat terug in de UI
    if not os.path.exists(changelog_path):
        # Probeer backend map als fallback
        backend_path = os.path.join(os.path.dirname(__file__), "..", "..", "CHANGELOG.md")
        if os.path.exists(backend_path):
            changelog_path = backend_path
        else:
            return [Release(
                version="Error", 
                date="Nu", 
                description=f"Kan CHANGELOG.md niet vinden op: {changelog_path}", 
                changes=[]
            )]

    releases = []
    current_release = None
    current_type = "chore"

    with open(changelog_path, "r", encoding="utf-8") as f:
        lines = f.readlines()

    for line in lines:
        line = line.strip()
        if not line: continue

        # Versie detectie: ## [1.0.0] of ### [1.0.0]
        version_match = re.search(r'^#{2,3}\s+\[(.*?)\]\(.*?\)\s+\((.*?)\)', line)
        if not version_match:
             version_match = re.search(r'^#{2,3}\s+\[(.*?)\]\s+\((.*?)\)', line)
        if not version_match:
             version_match = re.search(r'^#{2,3}\s+(.*?)\s+\((.*?)\)', line)

        if version_match:
            if current_release:
                releases.append(current_release)
            
            current_release = Release(
                version=version_match.group(1),
                date=version_match.group(2),
                changes=[]
            )
            continue

        # Categorie detectie (Features, Bug Fixes)
        if line.startswith("###") and not version_match:
            if "[" not in line and "(" not in line: 
                current_type = determine_type_from_header(line)
            continue

        # Change Line detectie
        if line.startswith("*") and current_release:
            change = parse_changelog_line(line)
            if change:
                change.type = current_type
                current_release.changes.append(change)

    if current_release:
        releases.append(current_release)

    return releases