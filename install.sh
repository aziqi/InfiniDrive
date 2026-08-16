#!/usr/bin/env bash
# ==============================================================================
# ⚡ InfiniDrive Desktop — Universal Linux & Arch Linux 1-Line Installer
# Repository: https://github.com/aziqi/InfiniDrive
# ==============================================================================

set -e

# Colors
C_RESET="\033[0m"
C_BOLD="\033[1m"
C_CYAN="\033[36m"
C_BLUE="\033[34m"
C_GREEN="\033[32m"
C_YELLOW="\033[33m"
C_RED="\033[31m"
C_PURPLE="\033[35m"

print_banner() {
    echo -e "${C_CYAN}${C_BOLD}"
    cat << "EOF"
  _____        __ _       _ _____       _           
 |_   _|      / _(_)     (_)  __ \     (_)          
   | |  _ __ | |_ _ _ __  _| |  | |_ __ ___   _____ 
   | | | '_ \|  _| | '_ \| | |  | | '__| \ \ / / _ \
  _| |_| | | | | | | | | | | |__| | |  | |\ V /  __/
 |_____|_| |_|_| |_|_| |_|_|_____/|_|  |_| \_/ \___|
                                                    
      ⚡ Infinite Telegram Cloud Storage for Linux ⚡
EOF
    echo -e "${C_RESET}"
}

log_info() {
    echo -e "${C_BLUE}${C_BOLD}[INFO]${C_RESET} $1"
}

log_success() {
    echo -e "${C_GREEN}${C_BOLD}[OK]${C_RESET} $1"
}

log_warn() {
    echo -e "${C_YELLOW}${C_BOLD}[WARN]${C_RESET} $1"
}

log_error() {
    echo -e "${C_RED}${C_BOLD}[ERROR]${C_RESET} $1"
}

print_banner

INSTALL_DIR="$HOME/.local/share/infinidrive"
BIN_DIR="$HOME/.local/bin"
DESKTOP_DIR="$HOME/.local/share/applications"
REPO_URL="https://github.com/aziqi/InfiniDrive.git"

mkdir -p "$BIN_DIR"
mkdir -p "$DESKTOP_DIR"

# ------------------------------------------------------------------------------
# 1. Detect Distribution & Install System Dependencies
# ------------------------------------------------------------------------------
log_info "Detecting Linux distribution and package manager..."

if [ -f /etc/arch-release ] || command -v pacman &> /dev/null; then
    DISTRO="Arch Linux"
    log_info "Detected ${C_CYAN}${DISTRO}${C_RESET} (Pacman)"
    
    NEEDED_PKGS=()
    for pkg in git python python-pip nodejs npm; do
        if ! pacman -Q $pkg &> /dev/null; then
            NEEDED_PKGS+=("$pkg")
        fi
    done

    if [ ${#NEEDED_PKGS[@]} -gt 0 ]; then
        log_info "Installing missing dependencies: ${NEEDED_PKGS[*]}..."
        sudo pacman -S --needed --noconfirm "${NEEDED_PKGS[@]}"
    fi

elif [ -f /etc/debian_version ] || command -v apt-get &> /dev/null; then
    DISTRO="Debian/Ubuntu"
    log_info "Detected ${C_CYAN}${DISTRO}${C_RESET}"
    sudo apt-get update -y
    sudo apt-get install -y git python3 python3-pip python3-venv nodejs npm
elif [ -f /etc/fedora-release ] || command -v dnf &> /dev/null; then
    DISTRO="Fedora"
    log_info "Detected ${C_CYAN}${DISTRO}${C_RESET}"
    sudo dnf install -y git python3 python3-pip nodejs npm
elif command -v zypper &> /dev/null; then
    DISTRO="openSUSE"
    log_info "Detected ${C_CYAN}${DISTRO}${C_RESET}"
    sudo zypper install -y git python3 python3-pip nodejs npm
else
    log_warn "Unknown distribution. Please ensure git, python3, pip, nodejs, and npm are installed."
fi

# ------------------------------------------------------------------------------
# 2. Clone or Update Repository
# ------------------------------------------------------------------------------
if [ -d "$INSTALL_DIR/.git" ]; then
    log_info "InfiniDrive is already installed at $INSTALL_DIR. Pulling latest updates..."
    cd "$INSTALL_DIR"
    git pull origin main
else
    log_info "Cloning InfiniDrive to $INSTALL_DIR..."
    rm -rf "$INSTALL_DIR"
    git clone "$REPO_URL" "$INSTALL_DIR"
fi

cd "$INSTALL_DIR"

# ------------------------------------------------------------------------------
# 3. Setup Python Backend Virtualenv
# ------------------------------------------------------------------------------
log_info "Configuring Python virtual environment in backend..."
cd "$INSTALL_DIR/backend"
if [ ! -d "venv" ]; then
    python3 -m venv venv || python -m venv venv
fi

source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
deactivate

# ------------------------------------------------------------------------------
# 4. Build Frontend UI
# ------------------------------------------------------------------------------
log_info "Building frontend React & Electron app..."
cd "$INSTALL_DIR/app"
npm install
npm run build

# ------------------------------------------------------------------------------
# 5. Create CLI Launcher (~/.local/bin/infinidrive)
# ------------------------------------------------------------------------------
log_info "Creating CLI launcher command: ${C_GREEN}infinidrive${C_RESET}..."

LAUNCHER_SCRIPT="$BIN_DIR/infinidrive"
cat << 'EOF' > "$LAUNCHER_SCRIPT"
#!/usr/bin/env bash
INSTALL_DIR="$HOME/.local/share/infinidrive"
cd "$INSTALL_DIR/app"
export NODE_ENV=production
npx electron electron/main.cjs "$@"
EOF

chmod +x "$LAUNCHER_SCRIPT"

# ------------------------------------------------------------------------------
# 6. Create Desktop Entry & Icon
# ------------------------------------------------------------------------------
log_info "Creating Desktop entry for App Launcher / Rofi / KDE / GNOME..."

ICON_PATH="$INSTALL_DIR/assets/logo.png"

cat << EOF > "$DESKTOP_DIR/infinidrive.desktop"
[Desktop Entry]
Name=InfiniDrive
Comment=Infinite Telegram Cloud Storage Desktop App
Exec=$LAUNCHER_SCRIPT
Icon=$ICON_PATH
Terminal=false
Type=Application
Categories=Utility;Network;FileTransfer;
StartupWMClass=InfiniDrive
Keywords=telegram;drive;storage;cloud;infinite;
EOF

chmod +x "$DESKTOP_DIR/infinidrive.desktop"

if command -v update-desktop-database &> /dev/null; then
    update-desktop-database "$DESKTOP_DIR" 2>/dev/null || true
fi

# Ensure ~/.local/bin is in PATH notice
if [[ ":$PATH:" != *":$HOME/.local/bin:"* ]]; then
    log_warn "Note: '$HOME/.local/bin' is not in your current PATH."
    log_warn "Add this line to your ~/.bashrc or ~/.zshrc:"
    echo -e "      ${C_YELLOW}export PATH=\"\$HOME/.local/bin:\$PATH\"${C_RESET}"
fi

# ------------------------------------------------------------------------------
# 7. Complete!
# ------------------------------------------------------------------------------
echo ""
echo -e "${C_GREEN}${C_BOLD}======================================================${C_RESET}"
echo -e "${C_GREEN}${C_BOLD}  ⚡ InfiniDrive Desktop installed successfully! ⚡  ${C_RESET}"
echo -e "${C_GREEN}${C_BOLD}======================================================${C_RESET}"
echo ""
echo -e "  🚀 ${C_BOLD}How to launch:${C_RESET}"
echo -e "     1. Terminal:    ${C_CYAN}infinidrive${C_RESET}"
echo -e "     2. App Menu:    Search ${C_CYAN}InfiniDrive${C_RESET} in Rofi / Wofi / GNOME / KDE"
echo ""
echo -e "  📂 Installed to:   ${C_BOLD}$INSTALL_DIR${C_RESET}"
echo -e "  ⚙️ Config saved:   ${C_BOLD}~/.config/infinidrive/${C_RESET}"
echo ""
