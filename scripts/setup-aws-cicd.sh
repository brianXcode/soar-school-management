#!/bin/bash

################################################################################
# AWS CI/CD Setup Script
# This script helps configure IAM user and generate secrets for GitHub Actions
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

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    print_error "AWS CLI is not installed"
    echo "Install from: https://aws.amazon.com/cli/"
    echo ""
    echo "Quick install:"
    echo "  Mac: brew install awscli"
    echo "  Linux: curl 'https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip' -o 'awscliv2.zip' && unzip awscliv2.zip && sudo ./aws/install"
    exit 1
fi

print_header "AWS CI/CD Setup for Soar School Management"

# Check AWS credentials
if ! aws sts get-caller-identity &> /dev/null; then
    print_error "AWS credentials not configured"
    echo "Configure with: aws configure"
    exit 1
fi

CURRENT_USER=$(aws sts get-caller-identity --query 'Arn' --output text)
print_info "Authenticated as: $CURRENT_USER"

# Get AWS account ID
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query 'Account' --output text)
print_info "AWS Account ID: $AWS_ACCOUNT_ID"

# Create IAM user for GitHub Actions
print_header "Step 1: Create IAM User"

IAM_USER_NAME="github-actions-deployer"

if aws iam get-user --user-name $IAM_USER_NAME &> /dev/null; then
    print_warning "IAM user already exists: $IAM_USER_NAME"
    read -p "Do you want to use the existing user? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Please use a different username or delete the existing user"
        exit 1
    fi
else
    print_info "Creating IAM user: $IAM_USER_NAME"
    aws iam create-user --user-name $IAM_USER_NAME \
        --tags Key=Purpose,Value=GitHubActions Key=Project,Value=SchoolManagement
    print_info "IAM user created successfully"
fi

# Create IAM policy
print_header "Step 2: Create IAM Policy"

POLICY_NAME="GitHubActionsEC2DeploymentPolicy"

# Check if policy exists
POLICY_ARN="arn:aws:iam::${AWS_ACCOUNT_ID}:policy/${POLICY_NAME}"

if aws iam get-policy --policy-arn $POLICY_ARN &> /dev/null; then
    print_warning "Policy already exists: $POLICY_NAME"
else
    print_info "Creating IAM policy: $POLICY_NAME"

    # Create policy document
    cat > /tmp/policy.json << 'EOF'
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "ec2:DescribeInstances",
                "ec2:DescribeInstanceStatus",
                "ec2:StartInstances",
                "ec2:StopInstances"
            ],
            "Resource": "*"
        }
    ]
}
EOF

    aws iam create-policy \
        --policy-name $POLICY_NAME \
        --policy-document file:///tmp/policy.json \
        --description "Policy for GitHub Actions to deploy to EC2"

    rm /tmp/policy.json
    print_info "Policy created successfully"
fi

# Attach policy to user
print_header "Step 3: Attach Policy to User"

if aws iam list-attached-user-policies --user-name $IAM_USER_NAME | grep -q $POLICY_NAME; then
    print_info "Policy already attached to user"
else
    print_info "Attaching policy to user..."
    aws iam attach-user-policy \
        --user-name $IAM_USER_NAME \
        --policy-arn $POLICY_ARN
    print_info "Policy attached successfully"
fi

# Create access key
print_header "Step 4: Create Access Key"

# Check if user already has access keys
KEY_COUNT=$(aws iam list-access-keys --user-name $IAM_USER_NAME --query 'AccessKeyMetadata | length(@)' --output text)

if [ "$KEY_COUNT" -ge 2 ]; then
    print_error "User already has 2 access keys (AWS limit)"
    echo "Please delete an existing key first:"
    aws iam list-access-keys --user-name $IAM_USER_NAME --output table
    exit 1
elif [ "$KEY_COUNT" -eq 1 ]; then
    print_warning "User already has 1 access key"
    read -p "Create another key? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_info "Using existing access key setup"
        echo "You'll need to manually retrieve the existing access key"
        ACCESS_KEY_ID="<your-existing-access-key-id>"
        SECRET_ACCESS_KEY="<your-existing-secret-access-key>"
    else
        KEY_OUTPUT=$(aws iam create-access-key --user-name $IAM_USER_NAME --output json)
        ACCESS_KEY_ID=$(echo $KEY_OUTPUT | jq -r '.AccessKey.AccessKeyId')
        SECRET_ACCESS_KEY=$(echo $KEY_OUTPUT | jq -r '.AccessKey.SecretAccessKey')
        print_info "New access key created"
    fi
else
    print_info "Creating access key..."
    KEY_OUTPUT=$(aws iam create-access-key --user-name $IAM_USER_NAME --output json)
    ACCESS_KEY_ID=$(echo $KEY_OUTPUT | jq -r '.AccessKey.AccessKeyId')
    SECRET_ACCESS_KEY=$(echo $KEY_OUTPUT | jq -r '.AccessKey.SecretAccessKey')
    print_info "Access key created successfully"
fi

# Generate application secrets
print_header "Step 5: Generate Application Secrets"

LONG_TOKEN_SECRET=$(openssl rand -hex 32)
SHORT_TOKEN_SECRET=$(openssl rand -hex 32)
NACL_SECRET=$(openssl rand -base64 32)

print_info "Application secrets generated"

# Get EC2 instance information
print_header "Step 6: EC2 Instance Information"

echo "Please provide your EC2 instance details:"
echo ""

read -p "EC2 Instance ID (e.g., i-0123456789abcdef0): " EC2_INSTANCE_ID
read -p "EC2 Public IP or DNS (e.g., 54.123.45.67): " EC2_HOST
read -p "EC2 SSH Username (default: ubuntu): " EC2_USER
EC2_USER=${EC2_USER:-ubuntu}
read -p "AWS Region (e.g., us-east-1): " AWS_REGION

print_info "EC2 instance configured"

# SSH Key instructions
print_header "Step 7: SSH Key Setup"

echo "You need to provide the SSH private key for your EC2 instance."
echo ""
read -p "Path to your EC2 private key file (e.g., ~/.ssh/my-key.pem): " SSH_KEY_PATH

if [ ! -f "$SSH_KEY_PATH" ]; then
    print_error "SSH key file not found: $SSH_KEY_PATH"
    echo "Please provide a valid path to your .pem file"
    exit 1
fi

SSH_PRIVATE_KEY=$(cat "$SSH_KEY_PATH")
print_info "SSH key loaded"

# Create summary file
SUMMARY_FILE="$HOME/github-secrets-aws-summary.txt"

print_header "Step 8: GitHub Secrets Summary"

cat > "$SUMMARY_FILE" << EOF
================================================================================
GITHUB SECRETS CONFIGURATION FOR AWS
================================================================================

Add these secrets to your GitHub repository:
Repository → Settings → Secrets and variables → Actions → New repository secret

================================================================================
1. AWS_ACCESS_KEY_ID
================================================================================
$ACCESS_KEY_ID

================================================================================
2. AWS_SECRET_ACCESS_KEY
================================================================================
$SECRET_ACCESS_KEY

================================================================================
3. AWS_REGION
================================================================================
$AWS_REGION

================================================================================
4. EC2_INSTANCE_ID
================================================================================
$EC2_INSTANCE_ID

================================================================================
5. EC2_HOST
================================================================================
$EC2_HOST

================================================================================
6. EC2_USER
================================================================================
$EC2_USER

================================================================================
7. EC2_SSH_PRIVATE_KEY
================================================================================
$SSH_PRIVATE_KEY

================================================================================
8. LONG_TOKEN_SECRET
================================================================================
$LONG_TOKEN_SECRET

================================================================================
9. SHORT_TOKEN_SECRET
================================================================================
$SHORT_TOKEN_SECRET

================================================================================
10. NACL_SECRET
================================================================================
$NACL_SECRET

================================================================================
DEPLOYMENT INFORMATION
================================================================================
EC2 Instance: $EC2_INSTANCE_ID
Public IP/DNS: $EC2_HOST
API URL: http://$EC2_HOST:5111/api/
Swagger Docs: http://$EC2_HOST:5111/api-docs

IAM User: $IAM_USER_NAME
IAM Policy: $POLICY_NAME

================================================================================
NEXT STEPS
================================================================================

1. Add all secrets above to GitHub:
   - Go to: https://github.com/YOUR_USERNAME/YOUR_REPO/settings/secrets/actions
   - Click "New repository secret" for each secret
   - Copy the exact values (preserve line breaks for SSH key)

2. Ensure EC2 Security Group allows:
   - SSH (port 22) from GitHub Actions IPs or 0.0.0.0/0
   - HTTP (port 5111) from 0.0.0.0/0

3. Initialize EC2 instance:
   - SSH into instance: ssh -i $SSH_KEY_PATH $EC2_USER@$EC2_HOST
   - Run: curl -o init-vm.sh https://raw.githubusercontent.com/YOUR_USERNAME/YOUR_REPO/main/scripts/init-vm.sh
   - Run: chmod +x init-vm.sh && ./init-vm.sh

4. Create development branch:
   git checkout -b development
   git push -u origin development

5. Deploy:
   git add .
   git commit -m "feat: enable AWS EC2 CI/CD deployment"
   git push origin development

6. Monitor deployment:
   - Go to GitHub → Actions tab
   - Watch the deployment workflow run

================================================================================
IMPORTANT SECURITY NOTES
================================================================================

⚠️  NEVER commit AWS access keys or SSH private keys to git
⚠️  Keep this summary file secure and delete after setup
⚠️  Rotate AWS access keys regularly
⚠️  Use IAM roles for EC2 when possible (more secure than keys)
⚠️  Restrict Security Group rules to specific IPs in production

================================================================================

This summary has been saved to: $SUMMARY_FILE

EOF

print_info "Summary created: $SUMMARY_FILE"

# Display summary
cat "$SUMMARY_FILE"

# Final instructions
print_header "Setup Complete!"

echo -e "${GREEN}✓${NC} IAM user created: $IAM_USER_NAME"
echo -e "${GREEN}✓${NC} IAM policy attached: $POLICY_NAME"
echo -e "${GREEN}✓${NC} Access keys generated"
echo -e "${GREEN}✓${NC} Application secrets generated"
echo -e "${GREEN}✓${NC} Summary saved: $SUMMARY_FILE"

echo ""
print_warning "NEXT STEPS:"
echo "1. Review the summary file: cat $SUMMARY_FILE"
echo "2. Add all 10 secrets to GitHub (see summary for details)"
echo "3. Configure EC2 Security Group to allow ports 22 and 5111"
echo "4. Initialize EC2 instance with init-vm.sh"
echo "5. Create and push to development branch"
echo "6. Watch your deployment run in GitHub Actions!"

echo ""
print_warning "SECURITY REMINDER:"
echo "Delete the summary file after adding secrets to GitHub:"
echo "  rm $SUMMARY_FILE"
