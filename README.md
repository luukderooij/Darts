# Darts






Start dev enviroment:
 CTRL SHIFT B

 
.venv/Scripts/Activate.ps1
cd backend
uvicorn app.main:app --reload

cd frontend
npm run dev





Log in op je Proxmox VM (bijv. Ubuntu/Debian) en installeer Docker:

```bash
# Update pakketten
sudo apt update && sudo apt upgrade -y

# Installeer Docker & Docker Compose
curl -fsSL [https://get.docker.com](https://get.docker.com) -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
# Log uit en weer in om de groepsrechten toe te passen


# 1. Clone de code
git clone [https://github.com/luukderooij/Darts.git](https://github.com/luukderooij/Darts.git)
cd Darts

# 2. Maak mappen voor persistente data
mkdir -p data logs

# 3. Start de containers
docker compose up -d --build


# 1. Haal de laatste versie van GitHub
git pull

# 2. Bouw de containers opnieuw (belangrijk voor nieuwe code!) en herstart ze
docker compose up -d --build

# 3. (Optioneel) Ruim oude, ongebruikte images op om schijfruimte te besparen
docker image prune -f