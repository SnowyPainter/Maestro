#!/bin/bash

# Docker user management script
# This script helps manage Docker user permissions and setup

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "Docker is not installed. Please install Docker first."
    exit 1
fi

# Function to add user to docker group
add_user_to_docker_group() {
    local username=${1:-$USER}
    
    echo "Adding user '$username' to docker group..."
    
    # Create docker group if it doesn't exist
    if ! getent group docker > /dev/null 2>&1; then
        echo "Creating docker group..."
        sudo groupadd docker
    fi
    
    # Add user to docker group
    sudo usermod -aG docker "$username"
    
    echo "User '$username' has been added to docker group."
    echo "Please log out and log back in for changes to take effect."
    echo "Or run: newgrp docker"
}

# Function to check docker permissions
check_docker_permissions() {
    echo "Checking Docker permissions..."
    
    if docker ps &> /dev/null; then
        echo "✓ Docker is accessible without sudo"
    else
        echo "✗ Docker requires sudo or user is not in docker group"
        echo "Run: $0 add-user"
    fi
}

# Function to show docker user info
show_docker_info() {
    echo "Docker User Information:"
    echo "Current user: $USER"
    echo "User groups: $(groups)"
    echo "Docker group members: $(getent group docker | cut -d: -f4)"
    echo ""
    check_docker_permissions
}

# Main script logic
case "${1:-help}" in
    "add-user")
        add_user_to_docker_group "$2"
        ;;
    "check")
        check_docker_permissions
        ;;
    "info")
        show_docker_info
        ;;
    "help"|*)
        echo "Docker User Management Script"
        echo ""
        echo "Usage: $0 [command] [options]"
        echo ""
        echo "Commands:"
        echo "  add-user [username]  Add user to docker group (default: current user)"
        echo "  check               Check docker permissions"
        echo "  info                Show docker user information"
        echo "  help                Show this help message"
        echo ""
        echo "Examples:"
        echo "  $0 add-user          # Add current user to docker group"
        echo "  $0 add-user john     # Add user 'john' to docker group"
        echo "  $0 check             # Check if docker works without sudo"
        echo "  $0 info              # Show user and docker group info"
        ;;
esac
