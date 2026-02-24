#!/bin/bash

################################################################################
# Deployment script for Soar School Management System
# Can be run manually or via CI/CD pipeline
################################################################################

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running on GCP VM
print_info "Starting deployment..."

# Navigate to application directory
APP_DIR="$HOME/soar-school-management"

if [ ! -d "$APP_DIR" ]; then
    print_error "Application directory not found at $APP_DIR"
    exit 1
fi

cd "$APP_DIR"

# Check if .env exists
if [ ! -f .env ]; then
    print_warning ".env file not found. Creating from .env.example..."

    if [ -f .env.example ]; then
        cp .env.example .env
        print_warning "Please configure .env file with production secrets!"
        print_warning "Generate secrets with: openssl rand -hex 32"
    else
        print_error ".env.example not found!"
        exit 1
    fi
fi

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed. Please install Docker first."
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    print_error "Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Pull latest code (if git repo exists)
if [ -d .git ]; then
    print_info "Pulling latest code from git..."
    git pull
else
    print_warning "Not a git repository. Skipping git pull."
fi

# Stop existing containers
print_info "Stopping existing containers..."
docker-compose down || true

# Remove old images to force rebuild
print_info "Removing old application image..."
docker-compose rm -f app || true

# Build and start containers
print_info "Building and starting containers..."
docker-compose up --build -d

# Wait for services to be ready
print_info "Waiting for services to start..."
sleep 10

# Check container status
print_info "Container status:"
docker-compose ps

# Show recent logs
print_info "Recent application logs:"
docker-compose logs --tail=30 app

# Health check
print_info "Performing health check..."
sleep 5

MAX_RETRIES=10
RETRY_COUNT=0
HEALTH_URL="http://localhost:5111/health"

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if curl -f -s $HEALTH_URL > /dev/null 2>&1; then
        print_info "Health check passed!"

        # Get external IP if on GCP
        if command -v curl &> /dev/null; then
            EXTERNAL_IP=$(curl -s -H "Metadata-Flavor: Google" \
                http://metadata.google.internal/computeMetadata/v1/instance/network-interfaces/0/access-configs/0/external-ip 2>/dev/null || echo "")

            if [ -n "$EXTERNAL_IP" ]; then
                print_info "Deployment successful!"
                print_info "API: http://$EXTERNAL_IP:5111/api/"
                print_info "Swagger: http://$EXTERNAL_IP:5111/api-docs"
            else
                print_info "Deployment successful on localhost:5111"
            fi
        fi

        exit 0
    fi

    RETRY_COUNT=$((RETRY_COUNT + 1))
    print_warning "Health check attempt $RETRY_COUNT/$MAX_RETRIES failed. Retrying..."
    sleep 5
done

print_error "Health check failed after $MAX_RETRIES attempts"
print_error "Check logs with: docker-compose logs app"
exit 1
