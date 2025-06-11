docker compose -p realtime down;
docker compose -p realtime -f docker-compose.yaml pull;
docker compose -p realtime -f docker-compose.yaml up --build -d --remove-orphans;
