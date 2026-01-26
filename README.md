# ATmark

Obsidian plugin for AT Protocol bookmarking platforms. 

## Supported platforms

- **Semble** (`network.cosmik.*`) - Collections and cards
- **Bookmarks** (`community.lexicon.bookmarks.*`) - Community bookmarks lexicon with tag filtering (supports kipclip tags)
- **margin.at** (`at.margin.*`) - Bookmarks with collections and tags support

## Installation

Install via [BRAT](https://github.com/TfTHacker/obsidian42-brat):

1. Install the BRAT plugin from Community Plugins
2. Open BRAT settings
3. Click "Add Beta plugin"
4. Enter the GitHub URL: `https://github.com/treethought/obsidian-atmark`
5. Enable the plugin in Community Plugins

## Getting Started

### Authentication

1. Open Settings > ATmark
2. Enter your AT Protocol handle or DID
3. Create an app password in your AT Protocol client (Bluesky: Settings > Privacy and security > App passwords)
4. Enter the app password in the plugin settings
5. Save settings

The plugin will automatically connect using your credentials.

### Opening the View

Open the command palette (Ctrl/Cmd + P) and search for "ATmark: Open view". The view will show your bookmarks from all supported platforms.
