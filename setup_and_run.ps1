# PowerShell Script to Setup and Run the VersionOne Story Copier Server

param(
    # Internal flag to indicate the script was relaunched for elevation (used by install step)
    [switch]$RelaunchedForInstall
)

Write-Host "Script execution started."

# --- Check for Node.js First ---
Write-Host "Checking for Node.js installation..." -ForegroundColor Cyan
$nodeExists = $false
try {
    # Try executing node -v. Redirect output to null, check exit code.
    node --version *> $null 
    if ($LASTEXITCODE -eq 0) {
        $nodeExists = $true
        Write-Host "Node.js found." -ForegroundColor Green
    } else {
        Write-Host "Node.js not found in PATH." -ForegroundColor Yellow
    }
} catch {
    # Node.js not installed or not in PATH
    Write-Host "Node.js not found (command failed)." -ForegroundColor Yellow
}

# --- Install Node.js via winget if needed --- 
if (-not $nodeExists) {
    Write-Host "Attempting Node.js installation via winget..." -ForegroundColor Yellow
    
    # --- Elevation Check (Moved Here - Only needed for install) ---
    $IsElevated = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]"Administrator")

    if (-NOT $IsElevated) {
        # Check if the -RelaunchedForInstall switch was explicitly passed
        if ($PSBoundParameters.ContainsKey('RelaunchedForInstall')) {
            # If we were relaunched but are still not elevated, elevation failed.
            Write-Error "Failed to elevate privileges for installation after relaunch. Please run the script manually using 'Run as administrator'."
            Exit 1
        } else {
            # Not elevated and not relaunched yet, attempt to relaunch for install.
            Write-Warning "Winget installation requires elevated privileges. Attempting to relaunch with elevation..."
            try {
                # Relaunch PowerShell as admin, passing the current script file path and the -RelaunchedForInstall switch
                $scriptPath = $MyInvocation.MyCommand.Path
                $arguments = "-NoProfile -ExecutionPolicy Bypass -File ""$scriptPath"" -RelaunchedForInstall"
                Start-Process powershell.exe -Verb RunAs -ArgumentList $arguments
                Write-Host "Exiting original non-elevated process to allow elevated instance to run."
                Exit # Exit the current non-elevated instance
            } catch {
                Write-Error "Failed to start relaunch process with elevated privileges for installation. Please run the script manually using 'Run as administrator'. Error: $($_.Exception.Message)"
                Exit 1
            }
        }
    }
    # If we get here, we are either already elevated or successfully relaunched with elevation.
    Write-Host "Running with elevated privileges for installation." -ForegroundColor Green

    # --- Proceed with Winget Install --- 
    try {
        winget --version *> $null
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Winget command not found. Please install Node.js manually from https://nodejs.org/ or ensure Winget is installed and in PATH."
            Exit 1
        }

        Write-Host "Running: winget install OpenJS.NodeJS --accept-package-agreements --accept-source-agreements" -ForegroundColor Gray
        # Attempt to install Node.js silently
        winget install OpenJS.NodeJS --accept-package-agreements --accept-source-agreements
        
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Winget failed to install Node.js. Please try installing Node.js manually from https://nodejs.org/"
            Exit 1
        }

        Write-Host "Node.js installation completed via Winget. Please CLOSE this terminal and RE-RUN the script in a NEW terminal window for the changes to take effect." -ForegroundColor Yellow
        Exit 0 # Exit cleanly, requiring user to restart script in new terminal

    } catch {
        Write-Error "Error during Node.js installation attempt via Winget. Please install manually from https://nodejs.org/. Error: $($_.Exception.Message)"
        Exit 1
    }
}

# --- Script continues only if Node.js was found or install wasn't needed --- 

# Exit script immediately if any command fails (Optional - uncomment if desired)
# $ErrorActionPreference = 'Stop' 

Write-Host "Proceeding with server setup..." -ForegroundColor Cyan

# --- Check for HTTPS_PROXY Environment Variable --- 
# (Proxy check remains here as it might be needed for npm install/start)
$httpsProxy = [System.Environment]::GetEnvironmentVariable("HTTPS_PROXY", "Process")

if (-not $httpsProxy) {
    $setupProxy = Read-Host "NTLM Proxy: HTTPS_PROXY variable not set. Do you want to set it up now? (y/n)"
    
    if ($setupProxy -eq 'y' -or $setupProxy -eq 'Y') {
        # Get proxy server details
        $proxyServer = Read-Host "Enter proxy server address (e.g., proxy.example.com:8080)"
        
        # Get credentials
        $username = Read-Host "Enter your NTLM username"
        
        # Get password with confirmation
        $passwordsMatch = $false
        while (-not $passwordsMatch) {
            $securePassword = Read-Host "Enter your NTLM password" -AsSecureString
            $securePasswordConfirm = Read-Host "Confirm your password" -AsSecureString
            
            # Convert secure strings for comparison
            $bstr1 = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
            $bstr2 = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePasswordConfirm)
            $password = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr1)
            $passwordConfirm = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr2)
            
            if ($password -eq $passwordConfirm) {
                $passwordsMatch = $true
                # Clear confirmation password from memory
                [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr2)
            } else {
                Write-Host "Passwords do not match. Please try again." -ForegroundColor Red
                # Clear both passwords from memory
                [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr1)
                [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr2)
            }
        }
        
        # Clear main password from memory after we're done with both
        [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr1)
        
        # Assuming domain might be needed for NTLM proxy format
        $domain = Read-Host "Enter your NTLM domain (e.g., MYDOMAIN)"
        
        # Format the HTTPS_PROXY value (URL encode domain\username)
        $encodedUser = [uri]::EscapeDataString("${domain}\${username}")
        $encodedPassword = [uri]::EscapeDataString($password)
        $proxyValue = "http://${encodedUser}:${encodedPassword}@${proxyServer}"
        
        # Set the environment variable for the current process
        [System.Environment]::SetEnvironmentVariable("HTTPS_PROXY", $proxyValue, "Process")
        Write-Host "HTTPS_PROXY set for this session." -ForegroundColor Green
        
        # Optionally, ask if they want to set it permanently
        $setPermanent = Read-Host "Do you want to try setting this permanently for your user account? (Requires registry modification) (y/n)"
        if ($setPermanent -eq 'y' -or $setPermanent -eq 'Y') {
            try {
                # Requires elevated privileges which we should have if we installed Node, but check anyway for edge cases
                if (([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]"Administrator")){
                    [System.Environment]::SetEnvironmentVariable("HTTPS_PROXY", $proxyValue, "User")
                    Write-Host "HTTPS_PROXY set permanently for user." -ForegroundColor Green
                 } else {
                     Write-Warning "Setting permanent environment variable requires elevated privileges. Skipping."
                 }
            } catch {
                Write-Error "Failed to set permanent environment variable: $($_.Exception.Message)"
            }
        }
        # Clear sensitive variables from memory
        Remove-Variable password, passwordConfirm, securePassword, securePasswordConfirm, bstr1, bstr2, encodedPassword -ErrorAction SilentlyContinue
    }
}

# --- Navigate to Script Directory --- 
if ($PSScriptRoot) {
    Write-Host "Navigating to script directory: $PSScriptRoot" -ForegroundColor Cyan
    Set-Location $PSScriptRoot
} else {
    Write-Warning "Could not determine script directory. Assuming current directory: $PWD"
}

# --- Check for package.json --- 
Write-Host "Checking for package.json..." -ForegroundColor Cyan
if (-not (Test-Path -Path .\package.json -PathType Leaf)) {
    Write-Error "package.json not found in the current directory ($PWD). Cannot proceed."
    Exit 1
}
Write-Host "package.json found." -ForegroundColor Green

# --- Run npm start directly --- 
Write-Host "Starting the Node.js server (npm start)..." -ForegroundColor Cyan
Write-Host "The application should become available at http://localhost:3000" -ForegroundColor Cyan
Write-Host "Press CTRL+C here to stop the server when you are finished." -ForegroundColor Yellow

# Attempt to open the browser slightly before starting the server (it might 404 initially)
try {
    Write-Host "Attempting to open application in default browser..." -ForegroundColor Gray
    Start-Process "http://localhost:3000"
    Start-Sleep -Seconds 2 # Give browser a moment before server potentially blocks console
} catch {
    Write-Warning "Could not automatically open browser. Please navigate to http://localhost:3000 manually once the server starts. Error: $($_.Exception.Message)"
}

# Execute npm start in the foreground. The script will wait here until CTRL+C is pressed.
# Ensure HTTPS_PROXY is available if set earlier and needed by npm
if ($httpsProxy) {
    $env:HTTPS_PROXY = $httpsProxy
}
npm start

# Execution will only reach here after npm start is terminated (e.g., by CTRL+C)
Write-Host "Server process terminated." -ForegroundColor Yellow