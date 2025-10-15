#!/bin/bash

# cPanel Deployment Script for Public Controller Fix
# Run this script on your cPanel server to deploy the fix

echo "🚀 Deploying fix for 'Invalid count value: -1' error..."

# Step 1: Backup current file
if [ -f "controllers/publicController.js" ]; then
    echo "📦 Backing up current publicController.js..."
    cp controllers/publicController.js controllers/publicController.js.backup.$(date +%Y%m%d_%H%M%S)
    echo "✅ Backup created"
else
    echo "❌ publicController.js not found in controllers directory"
    echo "Make sure you're running this from your app's root directory"
    exit 1
fi

# Step 2: Instructions for manual upload
echo ""
echo "📋 Next steps:"
echo "1. Upload the enhanced publicController.js to controllers/ directory"
echo "2. Restart your Node.js application"
echo "3. Test with: curl 'https://job-portal-backend.excellusi.com/public/job-seekers?page=1&limit=5'"
echo ""
echo "Expected result: JSON response with jobSeekers array and valid pagination.total (not -1)"
echo ""
echo "🔍 If issues persist, check application logs for:"
echo "   - 'Count query failed, trying fallback methods'"
echo "   - 'Used simplified count query'"
echo "   - 'Using manual estimation'"
echo ""
echo "📞 Rollback command if needed:"
echo "   cp controllers/publicController.js.backup.* controllers/publicController.js"
echo ""
echo "✅ Ready for deployment!"