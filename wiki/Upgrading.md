# Upgrading

CraftPages checks for new versions when it starts and every few hours after. When one is
out, a card appears at the bottom of the sidebar with a **What's new** link. You can also
check by hand in **App settings → Updates → Check now**.

Your settings, connections, tokens and sites are kept across upgrades: they live outside
the app.

| System         | What happens                                                                                                                |
| -------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Windows        | The update downloads in the background. Click **Restart to update**, or it installs the next time you quit.                 |
| Linux AppImage | Same as Windows.                                                                                                            |
| macOS          | Click **Download**, open the new `.dmg` and drag CraftPages into Applications, choosing **Replace**. Quit CraftPages first. |
| Linux .deb     | Click **Download**, then `sudo apt install ./craftpages_amd64.deb`.                                                         |

macOS can't update the app in place yet: that needs the app to be signed with an Apple
developer certificate, which is planned.

Clicking **×** on the card hides it until the next version comes out.

Want an email for each release? On the
[GitHub repository](https://github.com/moomoo-agency/craftpages), click **Watch → Custom →
Releases**.
