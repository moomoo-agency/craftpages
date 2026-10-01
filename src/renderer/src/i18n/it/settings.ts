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
    'Un server MCP WebSocket raggiungibile solo da questo computer. Il tuo strumento di IA (per esempio Claude Code) si collega per leggere il sito e proporre modifiche al template.',
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
  addToClaudeHint:
    'Eseguilo una volta nel Terminale, poi avvia Claude Code scrivendo «claude». La schermata IA ha le istruzioni passo passo. Contiene il token, quindi tienilo riservato.',
  copyCommand: 'Copia comando'
}

export default messages
