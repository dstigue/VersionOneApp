# PowerShell Script to Setup and Run the VersionOne Story Copier Server

# Exit script immediately if any command fails
# $ErrorActionPreference = 'Stop' # Uncomment this for stricter error handling if desired

Write-Host "Starting setup and run script..." -ForegroundColor Cyan

# --- Check for Node.js --- 
Write-Host "Checking for Node.js installation..."
$nodeExists = $false
Try {
    # Try executing node -v. Redirect output to null, check exit code.
    node --version *> $null 
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Node.js is already installed." -ForegroundColor Green
        $nodeExists = $true
    }
} Catch {
    # Catch block might trigger if 'node' command isn't recognized at all
    Write-Host "Node.js command not found initially."
}

# --- Install Node.js via winget if needed --- 
if (-not $nodeExists) {
    Write-Host "Node.js not found. Attempting installation via winget..."
    # Check if winget exists
    Try {
        winget --version *> $null
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Winget command not found or failed. Cannot automatically install Node.js."
            Write-Error "Please install Node.js manually from https://nodejs.org/ and then run this script again."
            Exit 1
        }

        Write-Host "Attempting to install Node.js using winget..." -ForegroundColor Yellow
        Write-Host "NOTE: This might require Administrator privileges or user interaction."
        # Attempt to install Node.js silently
        winget install OpenJS.NodeJS --accept-package-agreements --accept-source-agreements
        
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Winget failed to install Node.js (Exit Code: $LASTEXITCODE)."
            Write-Error "Try running this script as Administrator. If that fails, please install Node.js manually from https://nodejs.org/"
            Exit 1
        }

        Write-Host "Node.js installation via winget potentially successful." -ForegroundColor Green
        Write-Host "IMPORTANT: Please CLOSE this terminal and RE-RUN the script in a NEW terminal window to ensure Node.js is available in the system PATH." -ForegroundColor Yellow
        Exit 0 # Exit cleanly, requiring user to restart script in new terminal

    } Catch {
        Write-Error "Error checking/running winget. Cannot automatically install Node.js."
        Write-Error "Please install Node.js manually from https://nodejs.org/ and then run this script again."
        Exit 1
    }
}

# --- Navigate to Script Directory --- 
# $PSScriptRoot is the directory where the script itself resides
if ($PSScriptRoot) {
    Write-Host "Changing directory to script location: $PSScriptRoot"
    Set-Location $PSScriptRoot
} else {
    Write-Warning "Could not determine script directory. Assuming current directory is correct."
}

# --- Check for package.json --- 
if (-not (Test-Path -Path .\package.json -PathType Leaf)) {
    Write-Error "package.json not found in the current directory ($PWD). Cannot proceed."
    Exit 1
}

# --- Run npm install --- 
Write-Host "Running 'npm install' to install dependencies..."
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Error "'npm install' failed. Please check the errors above."
    Exit 1
}
Write-Host "'npm install' completed successfully." -ForegroundColor Green

# --- Run npm start --- 
Write-Host "Starting the server via 'npm start'... (Press Ctrl+C to stop the server)" -ForegroundColor Cyan
npm start

# Execution will likely pause here while the server runs.
# The script will continue here if npm start fails immediately or the server is stopped.
if ($LASTEXITCODE -ne 0) {
    Write-Error "'npm start' failed or the server stopped with an error."
} else {
    Write-Host "Server stopped."
}

Write-Host "Script finished."