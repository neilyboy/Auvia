#!/bin/bash

# Auvia - Set the Atmosphere
# Quick start script for development and production

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}"
echo "    _____            _       "
echo "   /  _  \\ __ _____(_) ____  "
echo "  /  /_\\  |  |  \\  \\/ |/  _ \\ "
echo " /    |    \\  |  /\\   /|  |_| |"
echo " \\____|__  /____/  \\_/ |____/ "
echo "         \\/                   "
echo -e "${NC}"
echo "Set the Atmosphere"
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo -e "${YELLOW}No .env file found. Creating from .env.example...${NC}"
    cp .env.example .env
    echo -e "${GREEN}.env file created. Please edit it with your settings.${NC}"
    echo ""
fi

# Check Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Docker is not installed. Please install Docker first.${NC}"
    exit 1
fi

if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo -e "${RED}Docker Compose is not installed. Please install Docker Compose first.${NC}"
    exit 1
fi

# Parse arguments
case "$1" in
    "dev")
        echo -e "${GREEN}Starting Auvia in development mode...${NC}"
        docker compose up --build
        ;;
    "prod")
        echo -e "${GREEN}Starting Auvia in production mode...${NC}"
        docker compose up -d --build
        echo -e "${GREEN}Auvia is running!${NC}"
        echo "  Frontend: http://localhost:${FRONTEND_PORT:-3000}"
        echo "  Backend:  http://localhost:${BACKEND_PORT:-8000}"
        ;;
    "stop")
        echo -e "${YELLOW}Stopping Auvia...${NC}"
        docker compose down
        echo -e "${GREEN}Auvia stopped.${NC}"
        ;;
    "logs")
        docker compose logs -f
        ;;
    "rebuild")
        echo -e "${YELLOW}Rebuilding Auvia...${NC}"
        docker compose down
        docker compose build --no-cache
        docker compose up -d
        echo -e "${GREEN}Auvia rebuilt and started!${NC}"
        ;;
    *)
        echo "Usage: ./start.sh [command]"
        echo ""
        echo "Commands:"
        echo "  dev      Start in development mode (attached, with logs)"
        echo "  prod     Start in production mode (detached)"
        echo "  stop     Stop all containers"
        echo "  logs     View container logs"
        echo "  rebuild  Rebuild all containers from scratch"
        echo ""
        echo "First time setup:"
        echo "  1. Copy .env.example to .env"
        echo "  2. Edit .env with your settings"
        echo "  3. Run ./start.sh dev"
        echo "  4. Open http://localhost:3000"
        echo "  5. Complete the setup wizard"
        ;;
esac
