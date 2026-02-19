# ============================================
# Faza 1: Izgradnja aplikacije (builder)
# ============================================
FROM node:22-alpine AS builder

# Postavljamo radni direktorijum unutar kontejnera
WORKDIR /app

# Kopiramo fajl sa zavisnostima kako bismo iskoristili Docker kesh
COPY package.json ./

# Instaliramo sve zavisnosti (ukljucujuci dev zavisnosti potrebne za build)
RUN npm install

# Kopiramo ceo izvorni kod aplikacije u kontejner
COPY . .

# Pokrecemo build proces (kompajliranje TypeScript-a u JavaScript)
RUN npm run build

# ============================================
# Faza 2: Produkciona slika
# ============================================
FROM node:22-alpine AS production

# Postavljamo radni direktorijum za produkciju
WORKDIR /app

# Kopiramo samo fajl sa zavisnostima
COPY package.json ./

# Instaliramo samo produkcione zavisnosti (bez dev zavisnosti)
RUN npm install --only=production

# Kopiramo kompajlirane fajlove iz builder faze
COPY --from=builder /app/dist ./dist

# Otvaramo port na kome Notification Service slusa (3004)
EXPOSE 3004

# Pokrecemo aplikaciju
CMD ["node", "dist/main.js"]
