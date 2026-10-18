import type { Translation } from '../types'

const messages: Translation['settings'] = {
  intro:
    'Valgono per tutti i progetti. Le impostazioni del sito aperto sono in Impostazioni progetto.',

  appearance: 'Aspetto e lingua',
  appearanceHint: 'Solo per questa app. Le anteprime del sito seguono il tema di sistema.',
  language: 'Lingua',
  languageHint: 'Menu, etichette e messaggi. I contenuti del sito non vengono mai tradotti.',
  theme: 'Tema',
  themeSystem: 'Come il sistema',
  themeLight: 'Chiaro',
  themeDark: 'Scuro',

  background: 'Modifiche programmate',
  backgroundHint:
    'CraftPages pubblica da solo, su questo computer, gli articoli e le modifiche alle pagine programmati. Queste opzioni lo mantengono attivo a questo scopo.',
  keepRunningMac:
    'Resta attivo nella barra dei menu quando la finestra è chiusa e c’è qualcosa di programmato',
  keepRunningOther:
    'Resta attivo nell’area di notifica quando la finestra è chiusa e c’è qualcosa di programmato',
  openAtLogin: 'Apri all’accesso, in background',
  sleepNote:
    'Quando mancano meno di 20 minuti a un’ora programmata, CraftPages impedisce al computer di andare in stop da solo. Non può evitare la chiusura del coperchio o lo spegnimento: ciò che scade in quel momento esce appena il computer si riaccende.',

  mcp: 'Connessione IA (MCP)',
  mcpHint:
    'Un server MCP raggiungibile solo da questo computer. Il tuo strumento di IA (Claude Code, OpenAI Codex, Cursor…) si collega per leggere il sito e proporre modifiche al template.',
  mcpEnabled: 'Accetta connessioni IA',
  port: 'Porta',
  portHint: 'Solo su 127.0.0.1.',
  token: 'Token di accesso',
  showToken: 'Mostra token',
  hideToken: 'Nascondi token',
  regenerate: 'Rigenera token',
  regenerated:
    'Nuovo token creato. I client connessi sono stati scollegati: aggiorna la loro configurazione.',
  listening: 'In ascolto sulla porta {port}',
  mcpOff: 'La connessione IA è disattivata',
  statusListening: 'In ascolto su {url}',
  statusClients: 'connessi: {clients}',
  statusNoClients: 'nessun client connesso',
  notRunning: 'Non attivo',
  addToClaude: 'Aggiungi a Claude Code',
  addToClaudeHint: 'Contiene il token di accesso, quindi tienilo riservato.',
  addToClaudeSteps:
    'Esegui il comando una volta nel Terminale, poi avvia Claude Code scrivendo «claude». Se Claude Code era già aperto, riavvialo: si collega all’avvio, e «/mcp» mostra se craftpages è collegato. Le sue modifiche arrivano in Modifica template come proposte da rivedere.',
  aiClient: 'Il tuo strumento di IA',
  aiClientOther: 'Altro (Cursor, VS Code…)',
  addToCodex: 'Aggiungi a Codex',
  addToCodexSteps:
    'Esegui il comando una volta nel Terminale, poi avvia Codex (o riavvialo se era aperto): si collega all’avvio, e «/mcp» mostra se craftpages è collegato. Vale per Codex CLI, l’estensione per IDE e l’app. Le sue modifiche arrivano in Modifica template come proposte da rivedere.',
  aiClientDesktop: 'Claude Desktop (stdio)',
  addToDesktopSteps:
    'In Claude Desktop apri Impostazioni → Sviluppatore → Modifica configurazione e aggiungi questo a claude_desktop_config.json (uniscilo a “mcpServers” se il file ne ha già), poi chiudi e riapri Claude Desktop. Avvia il ponte di CraftPages, quindi non serve installare altro; CraftPages deve restare aperto mentre lo usi. Funziona con qualsiasi strumento che avvia i server MCP come comandi.',
  addToOther: 'Voce del server',
  addToOtherSteps:
    'Aggiungila ai server MCP del tuo strumento (Streamable HTTP). Se lo strumento non può impostare intestazioni, metti il token nell’indirizzo: {http}?token=… Gli strumenti che usano WebSocket possono usare {ws}.',
  copyCommand: 'Copia comando',
  diagnostics: 'Diagnostica',
  diagnosticsHint:
    'Se qualcosa non va, il log ci aiuta a capire perché. Allegalo alla tua segnalazione.',
  showLog: 'Mostra file di log',
  copyLog: 'Copia log',
  logCopied: 'Log copiato. Incollalo nella segnalazione o in un’email.',
  logEmpty: 'Il log è ancora vuoto.',
  logPrivacy:
    'Il log elenca cosa ha fatto CraftPages e gli errori incontrati, con l’ora. Password, token e passphrase non vi vengono mai scritti.'
}

export default messages
