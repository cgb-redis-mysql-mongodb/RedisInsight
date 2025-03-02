yarn --cwd tests/e2e install

# mount app resources
./release/*.AppImage --appimage-mount >> apppath &

# run rte
docker-compose -f tests/e2e/rte.docker-compose.yml build
docker-compose -f tests/e2e/rte.docker-compose.yml up --force-recreate -d -V
./tests/e2e/wait-for-redis.sh localhost 12000 && \

# run tests
COMMON_URL=$(tail -n 1 apppath)/resources/app.asar/index.html \
ELECTRON_PATH=$(tail -n 1 apppath)/redisinsight \
SOCKETS_CORS=true \
yarn --cwd tests/e2e dotenv -e .desktop.env yarn --cwd tests/e2e test:desktop:ci
