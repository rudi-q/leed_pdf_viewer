#!/bin/bash
# Get the local network IP address for iOS development

# Try to get the IP address from the primary network interface
IP=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -1)

if [ -z "$IP" ]; then
    echo "Could not detect local IP address"
    exit 1
fi

echo "$IP"

