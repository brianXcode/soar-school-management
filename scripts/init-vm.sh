#!/bin/bash

################################################################################
# VM Initialization Script for GCP Compute Engine
# Run this script on your GCP VM to prepare it for deployments
################################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_header() {
    echo -e "\n${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}\n"
}

print_info() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

print_header "VM Initialization for Soar School Management"

# Check if running on Ubuntu
if ! grep -q "Ubuntu" /etc/os-release 2>/dev/null; then
    print_warning "This script is designed for Ubuntu. You may encounter issues on other distributions."
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Update system
print_header "Step 1: Update System Packages"
print_info "Updating package lists..."
sudo apt update

print_info "Upgrading installed packages..."
sudo apt upgrade -y

print_info "System updated successfully"

# Install Docker
print_header "Step 2: Install Docker"

if command -v docker &> /dev/null; then
    DOCKER_VERSION=$(docker --version)
    print_warning "Docker is already installed: $DOCKER_VERSION"
    read -p "Skip Docker installation? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_info "Reinstalling Docker..."
        sudo apt install -y docker.io
    fi
else
    print_info "Installing Docker..."
    sudo apt install -y docker.io
    print_info "Docker installed successfully"
fi

# Install Docker Compose
print_header "Step 3: Install Docker Compose"

if command -v docker-compose &> /dev/null; then
    COMPOSE_VERSION=$(docker-compose --version)
    print_warning "Docker Compose is already installed: $COMPOSE_VERSION"
else
    print_info "Installing Docker Compose..."
    sudo apt install -y docker-compose
    print_info "Docker Compose installed successfully"
fi

# Configure Docker permissions
print_header "Step 4: Configure Docker Permissions"

if groups $USER | grep -q docker; then
    print_info "User already in docker group"
else
    print_info "Adding user to docker group..."
    sudo usermod -aG docker $USER
    print_warning "You'll need to logout and login again for group changes to take effect"
    print_warning "Or run: newgrp docker"
fi

# Enable Docker service
print_info "Enabling Docker service..."
sudo systemctl enable docker
sudo systemctl start docker

# Install additional useful tools
print_header "Step 5: Install Additional Tools"

print_info "Installing git..."
sudo apt install -y git

print_info "Installing curl..."
sudo apt install -y curl

print_info "Installing net-tools..."
sudo apt install -y net-tools

print_info "Installing htop (system monitor)..."
sudo apt install -y htop

# Create application directory
print_header "Step 6: Create Application Directory"

APP_DIR="$HOME/soar-school-management"

if [ -d "$APP_DIR" ]; then
    print_warning "Application directory already exists: $APP_DIR"
    read -p "Do you want to remove it and create a fresh one? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_info "Removing existing directory..."
        rm -rf "$APP_DIR"
        mkdir -p "$APP_DIR"
        print_info "Fresh directory created"
    fi
else
    mkdir -p "$APP_DIR"
    print_info "Application directory created: $APP_DIR"
fi

# Configure Git (optional)
print_header "Step 7: Configure Git (Optional)"

if git config --global user.name &> /dev/null; then
    GIT_NAME=$(git config --global user.name)
    GIT_EMAIL=$(git config --global user.email)
    print_info "Git already configured:"
    echo "  Name: $GIT_NAME"
    echo "  Email: $GIT_EMAIL"
else
    read -p "Do you want to configure git now? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        read -p "Enter your git name: " GIT_NAME
        read -p "Enter your git email: " GIT_EMAIL
        git config --global user.name "$GIT_NAME"
        git config --global user.email "$GIT_EMAIL"
        print_info "Git configured successfully"
    else
        print_warning "Skipping git configuration"
    fi
fi

# Get external IP
print_header "Step 8: Network Information"

if command -v curl &> /dev/null; then
    EXTERNAL_IP=$(curl -s -H "Metadata-Flavor: Google" \
        http://metadata.google.internal/computeMetadata/v1/instance/network-interfaces/0/access-configs/0/external-ip 2>/dev/null || echo "")

    if [ -n "$EXTERNAL_IP" ]; then
        print_info "External IP: $EXTERNAL_IP"
        echo ""
        echo "Your application will be accessible at:"
        echo "  API: http://$EXTERNAL_IP:5111/api/"
        echo "  Swagger: http://$EXTERNAL_IP:5111/api-docs"
    else
        print_warning "Could not determine external IP"
    fi
fi

INTERNAL_IP=$(hostname -I | awk '{print $1}')
print_info "Internal IP: $INTERNAL_IP"

# Test Docker
print_header "Step 9: Test Docker Installation"

print_info "Testing Docker..."
if sudo docker run --rm hello-world > /dev/null 2>&1; then
    print_info "Docker is working correctly!"
else
    print_error "Docker test failed"
    exit 1
fi

# Clean up test container
sudo docker rmi hello-world > /dev/null 2>&1 || true

# Display system information
print_header "Step 10: System Information"

echo "Hostname: $(hostname)"
echo "OS: $(cat /etc/os-release | grep PRETTY_NAME | cut -d '"' -f 2)"
echo "Kernel: $(uname -r)"
echo "CPU: $(nproc) cores"
echo "Memory: $(free -h | awk '/^Mem:/ {print $2}')"
echo "Disk: $(df -h / | awk 'NR==2 {print $2}')"

docker --version
docker-compose --version
git --version

# Create a quick reference file
print_header "Step 11: Create Quick Reference"

REF_FILE="$HOME/deployment-reference.txt"

cat > "$REF_FILE" << EOF
================================================================================
SOAR SCHOOL MANAGEMENT - DEPLOYMENT REFERENCE
================================================================================

VM Information:
- Hostname: $(hostname)
- Internal IP: $INTERNAL_IP
$([ -n "$EXTERNAL_IP" ] && echo "- External IP: $EXTERNAL_IP")

Application Directory: $APP_DIR

Access URLs:
$([ -n "$EXTERNAL_IP" ] && echo "- API: http://$EXTERNAL_IP:5111/api/")
$([ -n "$EXTERNAL_IP" ] && echo "- Swagger: http://$EXTERNAL_IP:5111/api-docs")
$([ -n "$EXTERNAL_IP" ] && echo "- Health: http://$EXTERNAL_IP:5111/health")

Docker Commands:
- Start app: cd ~/soar-school-management && docker-compose up -d
- Stop app: docker-compose down
- View logs: docker-compose logs -f app
- Rebuild: docker-compose up --build -d
- Check status: docker-compose ps

System Commands:
- View system resources: htop
- Check disk space: df -h
- Check memory: free -h
- View network: netstat -tlnp

Deployment Script:
- Run: ~/soar-school-management/scripts/deploy.sh

Created: $(date)
================================================================================
EOF

print_info "Reference saved to: $REF_FILE"

# Final summary
print_header "Setup Complete!"

echo -e "${GREEN}✓${NC} System updated"
echo -e "${GREEN}✓${NC} Docker installed and configured"
echo -e "${GREEN}✓${NC} Docker Compose installed"
echo -e "${GREEN}✓${NC} Application directory created: $APP_DIR"
echo -e "${GREEN}✓${NC} Quick reference created: $REF_FILE"

echo ""
print_warning "IMPORTANT NEXT STEPS:"
echo ""
echo "1. Logout and login again to apply docker group permissions:"
echo "   exit"
echo "   gcloud compute ssh <instance-name> --zone=<zone>"
echo ""
echo "2. Your application will be deployed to: $APP_DIR"
echo ""
echo "3. View the quick reference anytime:"
echo "   cat $REF_FILE"
echo ""
echo "4. When CI/CD pushes code, it will automatically deploy to this VM"
echo ""

if [ -n "$EXTERNAL_IP" ]; then
    echo "5. Make sure firewall allows port 5111:"
    echo "   gcloud compute firewall-rules create allow-school-management \\"
    echo "     --direction=INGRESS \\"
    echo "     --priority=1000 \\"
    echo "     --network=default \\"
    echo "     --action=ALLOW \\"
    echo "     --rules=tcp:5111 \\"
    echo "     --source-ranges=0.0.0.0/0"
    echo ""
fi

print_header "VM is ready for deployments!"
