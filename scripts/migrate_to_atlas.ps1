# PowerShell script to migrate local MongoDB to MongoDB Atlas

$ErrorActionPreference = "Stop"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " MongoDB Local to Atlas Migration Tool" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Verify Docker is running
try {
    $dockerInfo = docker info
} catch {
    Write-Host "[ERROR] Docker is not running. Please start Docker Desktop and try again." -ForegroundColor Red
    Exit 1
}

# 2. Check if local MongoDB container exists
$containerName = "chainshield-mongodb"
$containerExists = docker ps -a --filter "name=$containerName" --format "{{.Names}}"

if (-not $containerExists) {
    Write-Host "[ERROR] Could not find the local MongoDB container '$containerName'." -ForegroundColor Red
    Write-Host "Please make sure you have run the project using docker-compose at least once." -ForegroundColor Yellow
    Exit 1
}

# 3. Ensure local MongoDB container is running
$containerStatus = docker ps --filter "name=$containerName" --format "{{.Status}}"
if (-not $containerStatus) {
    Write-Host "Starting local MongoDB container '$containerName'..." -ForegroundColor Yellow
    docker start $containerName | Out-Null
    Start-Sleep -Seconds 5
}

Write-Host "[SUCCESS] Local MongoDB container is running." -ForegroundColor Green

# 4. Dump local database
Write-Host "Creating a database dump of 'chainshield'..." -ForegroundColor Yellow
try {
    # Delete any old dump in /tmp/mongodump first if exists
    docker exec $containerName rm -rf /tmp/mongodump
    
    # Run mongodump inside the container
    docker exec $containerName mongodump --username chainshield_admin --password changeme_in_production --authenticationDatabase admin --db chainshield --out /tmp/mongodump
    Write-Host "[SUCCESS] Local database dumped to container path /tmp/mongodump." -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Failed to dump local database." -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Exit 1
}

# 5. Prompt user for MongoDB Atlas URI
Write-Host ""
Write-Host "----------------------------------------------------------" -ForegroundColor Yellow
Write-Host "Please enter your MongoDB Atlas connection string." -ForegroundColor Yellow
Write-Host "Make sure it includes the password and database name, for example:" -ForegroundColor Yellow
Write-Host "mongodb+srv://user:pass@cluster.xxxx.mongodb.net/chainshield?retryWrites=true&w=majority" -ForegroundColor DarkYellow
Write-Host "----------------------------------------------------------" -ForegroundColor Yellow
$atlasUri = Read-Host "Atlas connection URI"

if ([string]::IsNullOrWhiteSpace($atlasUri)) {
    Write-Host "[ERROR] Connection URI cannot be empty." -ForegroundColor Red
    Exit 1
}

# 6. Restore to Atlas from inside container (utilizing container's network connection and pre-installed mongorestore)
Write-Host ""
Write-Host "Restoring database to MongoDB Atlas..." -ForegroundColor Yellow
try {
    docker exec $containerName mongorestore --uri="$atlasUri" /tmp/mongodump
    Write-Host ""
    Write-Host "[SUCCESS] Database successfully migrated to MongoDB Atlas!" -ForegroundColor Green
} catch {
    Write-Host ""
    Write-Host "[ERROR] Migration failed. Check that your Atlas connection string, network access, and database credentials are correct." -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Exit 1
} finally {
    # Clean up container dump
    Write-Host "Cleaning up temporary files inside container..." -ForegroundColor Gray
    docker exec $containerName rm -rf /tmp/mongodump
}

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " Migration Completed Successfully" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "Next, please update your MONGODB_URI in your .env file." -ForegroundColor Yellow
