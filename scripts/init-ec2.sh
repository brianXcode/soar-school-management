#!/bin/bash

################################################################################
# EC2 Instance Initialization Script
# Run this script on your AWS EC2 Ubuntu instance to prepare it for deployments
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

print_header "EC2 Instance Initialization for Soar School Management"

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
        # Remove old versions
        sudo apt remove -y docker docker-engine docker.io containerd runc || true
    else
        print_info "Skipping Docker installation"
    fi
fi

if ! command -v docker &> /dev/null; then
    print_info "Installing Docker dependencies..."
    sudo apt install -y ca-certificates curl gnupg lsb-release

    print_info "Adding Docker's official GPG key..."
    sudo mkdir -p /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

    print_info "Setting up Docker repository..."
    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
      $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

    sudo apt update

    print_info "Installing Docker Engine..."
    sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

    print_info "Docker installed successfully"
fi

# Install Docker Compose (standalone)
print_header "Step 3: Install Docker Compose"

if command -v docker-compose &> /dev/null; then
    COMPOSE_VERSION=$(docker-compose --version)
    print_warning "Docker Compose is already installed: $COMPOSE_VERSION"
else
    print_info "Installing Docker Compose standalone..."
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

print_info "Installing jq (JSON processor)..."
sudo apt install -y jq

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

# Get network information
print_header "Step 8: Network Information"

# Get public IP
if command -v curl &> /dev/null; then
    PUBLIC_IP=$(curl -s http://checkip.amazonaws.com || curl -s ifconfig.me || echo "Unable to fetch")
    print_info "Public IP: $PUBLIC_IP"
    echo ""
    echo "Your application will be accessible at:"
    echo "  API: http://$PUBLIC_IP:5111/api/"
    echo "  Swagger: http://$PUBLIC_IP:5111/api-docs"
    echo ""
fi

PRIVATE_IP=$(hostname -I | awk '{print $1}')
print_info "Private IP: $PRIVATE_IP"

# Security Group reminder
print_header "Step 9: Security Group Configuration"

echo "⚠️  IMPORTANT: Ensure your EC2 Security Group allows the following:"
echo ""
echo "Inbound Rules:"
echo "  - Port 22 (SSH) from your IP or GitHub Actions"
echo "  - Port 5111 (Application) from 0.0.0.0/0"
echo ""
echo "To configure Security Group:"
echo "  1. Go to EC2 Console → Security Groups"
echo "  2. Select your instance's security group"
echo "  3. Edit Inbound Rules"
echo "  4. Add rules for ports 22 and 5111"
echo ""

# Test Docker
print_header "Step 10: Test Docker Installation"

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
print_header "Step 11: System Information"

echo "Instance Type: $(ec2-metadata --instance-type 2>/dev/null | cut -d ' ' -f2 || echo 'Unknown')"
echo "Availability Zone: $(ec2-metadata --availability-zone 2>/dev/null | cut -d ' ' -f2 || echo 'Unknown')"
echo "OS: $(cat /etc/os-release | grep PRETTY_NAME | cut -d '"' -f 2)"
echo "Kernel: $(uname -r)"
echo "CPU: $(nproc) cores"
echo "Memory: $(free -h | awk '/^Mem:/ {print $2}')"
echo "Disk: $(df -h / | awk 'NR==2 {print $2}')"

echo ""
docker --version
docker-compose --version
git --version

# Create a quick reference file
print_header "Step 12: Create Quick Reference"

REF_FILE="$HOME/deployment-reference.txt"

cat > "$REF_FILE" << EOF
================================================================================
SOAR SCHOOL MANAGEMENT - EC2 DEPLOYMENT REFERENCE
================================================================================

Instance Information:
- Public IP: $PUBLIC_IP
- Private IP: $PRIVATE_IP
- Instance Type: $(ec2-metadata --instance-type 2>/dev/null | cut -d ' ' -f2 || echo 'Unknown')

Application Directory: $APP_DIR

Access URLs:
- API: http://$PUBLIC_IP:5111/api/
- Swagger: http://$PUBLIC_IP:5111/api-docs
- Health: http://$PUBLIC_IP:5111/health

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
- View security group: aws ec2 describe-security-groups

Deployment Script:
- Run: ~/soar-school-management/scripts/deploy.sh

Security Group Ports Required:
- Port 22 (SSH)
- Port 5111 (Application)

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
echo "   ssh -i your-key.pem ubuntu@$PUBLIC_IP"
echo ""
echo "2. Configure EC2 Security Group:"
echo "   - Port 22 for SSH"
echo "   - Port 5111 for Application"
echo ""
echo "3. Application will be deployed to: $APP_DIR"
echo ""
echo "4. When CI/CD pushes code, it will automatically deploy to this instance"
echo ""
echo "5. View the quick reference anytime:"
echo "   cat $REF_FILE"
echo ""

print_header "EC2 Instance is ready for deployments!"
