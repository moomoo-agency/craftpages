# Upgrading

CraftPages checks for new versions when it starts and every few hours after. When one is
out, a card appears at the bottom of the sidebar with a **What's new** link. You can also
check by hand in **App settings → Updates → Check now**.

Your settings, connections, tokens and sites are kept across upgrades: they live outside
the app.

| System         | What happens                                                                                                |
| -------------- | ----------------------------------------------------------------------------------------------------------- |
| macOS, Windows | The update downloads in the background. Click **Restart to update**, or it installs the next time you quit. |
| Linux AppImage | Same as macOS and Windows.                                                                                  |
| Linux .deb     | Click **Download**, then `sudo apt install ./craftpages_amd64.deb`.                                         |

On macOS, versions before 1.1.4 can't update themselves: download the latest `.dmg` once,
open it and drag CraftPages into Applications, choosing **Replace** (quit CraftPages first).
After that, updates install on their own.

Clicking **×** on the card hides it until the next version comes out.

Want an email for each release? On the
[GitHub repository](https://github.com/moomoo-agency/craftpages), click **Watch → Custom →
Releases**.
