import { CampaignApplication } from "./application/campaign/campaign-application";
import { BlobCampaignRepository } from "./infrastructure/persistence/blob-campaign-repository";
import { createBrowserExclusiveLock } from "./infrastructure/persistence/exclusive-lock";
import {
  DEFAULT_CAMPAIGN_STORAGE_KEY,
  LocalStorageCampaignRepository,
} from "./infrastructure/persistence/local-storage-campaign-repository";
import {
  detectTaleSpireApi,
  TaleSpireCampaignBlobStore,
  type TaleSpireApiSubset,
} from "./infrastructure/talespire/talespire-campaign-blob-store";
import "./styles.css";
import { BrowserApp } from "./ui/browser-app";
import { BrowserDiceRoller } from "./infrastructure/dice/browser-dice-roller";
import { TaleSpireDiceRoller } from "./infrastructure/talespire/talespire-dice-roller";
import { TaleSpireMiniatureAdapter } from "./infrastructure/talespire/talespire-miniature";
import { TaleSpirePlayerCollaboration } from "./infrastructure/talespire/talespire-player-collaboration";
import { resolveTaleSpireClientRole } from "./infrastructure/talespire/talespire-client-role";
import { EncounterApplication } from "./application/encounter/encounter-application";
import { GmApp } from "./ui/gm-app";
import { TaleSpireGmCollaboration } from "./infrastructure/talespire/talespire-gm-collaboration";
import { GmWorkspaceApplication } from "./application/gm/gm-workspace-application";
import { mountBackendStatus } from "./ui/backend-status";
import { configureRemotePersistence, type RemoteCampaignServices } from "./ui/remote-persistence-setup";

declare global {
  interface Window {
    TS?: unknown;
    onStateChangeEvent?: (event: { kind?: string }) => void;
    handleRollResult?: (event: unknown) => void;
    logSymbioteEvent?: (event: unknown) => void;
    onCreatureStateChange?: (event: unknown) => void;
    handleSyncEvents?: (event: unknown) => void;
    handleSyncClientEvents?: (event: unknown) => void;
    handleClientEvents?: (event: unknown) => void;
    handlePlayerPermissionEvents?: (event: unknown) => void;
    handleChatMessage?: (event: unknown) => void;
    handleInitiativeEvents?: (event: unknown) => void;
  }
}

const discoveredAppRoot = document.querySelector<HTMLElement>("#app");
if (!discoveredAppRoot) throw new Error("V2_APP_ROOT_NOT_FOUND");
const appRoot: HTMLElement = discoveredAppRoot;
void mountBackendStatus(appRoot);

let started = false;
let activeCollaboration: TaleSpirePlayerCollaboration | null = null;
let activeGmCollaboration: TaleSpireGmCollaboration | null = null;
let activeTaleSpireDiceRoller: TaleSpireDiceRoller | null = null;

function reportStartupFailure(error: unknown): void {
  const panel = document.createElement("section");
  panel.className = "sheet-empty startup-failure";
  const title = document.createElement("strong");
  title.textContent = "No se pudo iniciar el Symbiote";
  const message = document.createElement("p");
  message.textContent = error instanceof Error ? error.message : String(error);
  panel.append(title, message);
  appRoot.replaceChildren(panel);
  console.error("SYMBIOTE_STARTUP_FAILED", error);
}

async function startBrowserDevelopment(): Promise<void> {
  if (started) return;
  started = true;
  const primaryRepository = new LocalStorageCampaignRepository(
    window.localStorage,
    DEFAULT_CAMPAIGN_STORAGE_KEY,
    createBrowserExclusiveLock(),
  );
  let remoteServices: RemoteCampaignServices | null = null;
  const repository = await configureRemotePersistence(primaryRepository, appRoot, (services) => { remoteServices = services; });
  const services = remoteServices as RemoteCampaignServices | null;
  const campaignContent = services?.content ?? null;
  const application = new CampaignApplication(repository);
  void new BrowserApp(appRoot, application, {
    storageLabel: "Almacenamiento de desarrollo del navegador",
    storageEventKey: primaryRepository.storageKey,
    diceRoller: new BrowserDiceRoller(),
    ...(services ? { subscribeCampaignChanges: services.subscribeCampaignChanges } : {}),
    ...(services ? { loreReader: services.lore } : {}),
    ...(campaignContent ? { loadCustomContent: () => campaignContent.load(), saveShop: (shop: Parameters<typeof campaignContent.saveShop>[0], previousKey?: string | null) => campaignContent.saveShop(shop, previousKey ?? null), saveMonster: (monster: Parameters<typeof campaignContent.saveMonster>[0], previousKey?: string | null) => campaignContent.saveMonster(monster, previousKey ?? null) } : {}),
  }).start().catch(reportStartupFailure);
}

async function startTaleSpire(api: TaleSpireApiSubset): Promise<void> {
  if (started) return;
  started = true;
  const blobStore = new TaleSpireCampaignBlobStore(api.localStorage.campaign);
  const primaryRepository = new BlobCampaignRepository(
    blobStore,
    undefined,
    createBrowserExclusiveLock(),
  );
  let remoteServices: RemoteCampaignServices | null = null;
  const repository = await configureRemotePersistence(primaryRepository, appRoot, (services) => { remoteServices = services; });
  const services = remoteServices as RemoteCampaignServices | null;
  const campaignContent = services?.content ?? null;
  const application = new CampaignApplication(repository);
  const clientRole = api.clients ? await resolveTaleSpireClientRole(api.clients) : "player";
  const diceRoller = api.dice ? new TaleSpireDiceRoller(api.dice) : new BrowserDiceRoller();
  const miniature = new TaleSpireMiniatureAdapter(api);
  if (diceRoller instanceof TaleSpireDiceRoller) activeTaleSpireDiceRoller = diceRoller;
  if (clientRole === "gm") {
    const collaboration = api.sync && api.clients
      ? new TaleSpireGmCollaboration({
          sync: api.sync,
          clients: api.clients,
          ...(api.initiative ? { initiative: api.initiative } : {}),
        })
      : null;
    activeGmCollaboration = collaboration;
    if (collaboration) await collaboration.initialize();
    const gmWorkspace = new GmWorkspaceApplication(repository);
    void new GmApp(appRoot, new EncounterApplication(repository), {
      diceRoller,
      ...(services ? { subscribeCampaignChanges: services.subscribeCampaignChanges } : {}),
      ...(services ? { loreReader: services.lore } : {}),
      ...(diceRoller instanceof TaleSpireDiceRoller ? { subscribeDiceResults: (listener: Parameters<typeof diceRoller.subscribe>[0]) => diceRoller.subscribe(listener) } : {}),
      monsters: [],
      ...(campaignContent ? {
        loadGmContent: () => campaignContent.load(),
        loadCustomMonsters: async () => (await campaignContent.load()).monsters,
        saveCustomMonster: (definition, previousKey) => campaignContent.saveMonster(definition, previousKey),
        deleteCustomMonster: (key) => campaignContent.deleteMonster(key),
        saveCustomSpell: (definition, previousKey) => campaignContent.saveSpell(definition, previousKey),
        deleteCustomSpell: (key) => campaignContent.deleteSpell(key),
        saveCustomEquipment: (definition, previousKey) => campaignContent.saveEquipment(definition, previousKey),
        deleteCustomEquipment: (key) => campaignContent.deleteEquipment(key),
        saveShop: (shop, previousKey) => campaignContent.saveShop(shop, previousKey),
        deleteShop: (key) => campaignContent.deleteShop(key),
        saveChecklistItem: (item) => campaignContent.saveChecklistItem(item),
        deleteChecklistItem: (key) => campaignContent.deleteChecklistItem(key),
      } : {}),
      saveGmWorkspace: (workspace, checksum) => gmWorkspace.save(workspace, checksum),
      ...(collaboration ? {
        subscribePlayers: (listener) => collaboration.subscribePlayers(listener),
        subscribeCharacterSummaries: (listener) => collaboration.subscribeCharacterSummaries(listener),
        subscribeInitiative: (listener) => collaboration.subscribeInitiative(listener),
        subscribeNativeInitiative: (listener) => collaboration.subscribeNativeInitiative(listener),
        getNativeInitiative: () => collaboration.getNativeInitiative(),
        refreshPlayers: () => collaboration.refreshClients(),
        requestCharacterSummaries: () => collaboration.requestCharacterSummaries(),
        publishEncounter: (encounter) => collaboration.publishEncounter(encounter),
        subscribeTransferStatus: (listener) => collaboration.subscribeTransferStatus(listener),
      } : {}),
      ...(api.creatures ? { selectMiniature: () => miniature.selectFirst() } : {}),
    }).start().catch(reportStartupFailure);
    return;
  }
  const collaboration = api.sync && api.clients
    ? new TaleSpirePlayerCollaboration({ sync: api.sync, clients: api.clients })
    : null;
  activeCollaboration = collaboration;
  if (collaboration) await collaboration.initialize();
  if (diceRoller instanceof TaleSpireDiceRoller) {
    diceRoller.subscribe((result) => {
      if (result.name.startsWith("Iniciativa:")) void activeCollaboration?.sendInitiative(result.total);
    });
  }
  void new BrowserApp(appRoot, application, {
    storageLabel: "Almacenamiento de campaña de TaleSpire",
    loadStorageUsage: () => primaryRepository.getStorageUsage(),
    diceRoller,
    ...(services ? { subscribeCampaignChanges: services.subscribeCampaignChanges } : {}),
    ...(services ? { loreReader: services.lore } : {}),
    ...(diceRoller instanceof TaleSpireDiceRoller ? { subscribeDiceResults: (listener: Parameters<typeof diceRoller.subscribe>[0]) => diceRoller.subscribe(listener) } : {}),
    ...(collaboration
      ? {
          requestInitiativeList: () => collaboration.requestInitiativeList(),
          sendInitiative: (value: number, characterId?: string) => collaboration.sendInitiative(value, characterId ?? null),
          sendCharacterSummary: (character: Parameters<typeof collaboration.sendCharacterSummary>[0]) => collaboration.sendCharacterSummary(character),
          subscribeInitiative: (listener: Parameters<typeof collaboration.subscribe>[0]) => collaboration.subscribe(listener),
          runSyncTransportProbe: (messageCharacters: number) => collaboration.runTransportProbe(messageCharacters),
          refreshSyncPeers: () => collaboration.refreshClients(),
          subscribeTransportDiagnostics: (listener: Parameters<typeof collaboration.subscribeTransportDiagnostics>[0]) => collaboration.subscribeTransportDiagnostics(listener),
          subscribeCharacterSummaryRequests: (listener: Parameters<typeof collaboration.subscribeCharacterSummaryRequests>[0]) => collaboration.subscribeCharacterSummaryRequests(listener),
          respondToCharacterSummaryRequest: (character: Parameters<typeof collaboration.respondToCharacterSummaryRequest>[0], request: Parameters<typeof collaboration.respondToCharacterSummaryRequest>[1]) => collaboration.respondToCharacterSummaryRequest(character, request),
          subscribeEncounterSync: (listener: Parameters<typeof collaboration.subscribeEncounterSync>[0]) => collaboration.subscribeEncounterSync(listener),
        }
      : {}),
    ...(campaignContent
      ? {
          loadCustomContent: () => campaignContent.load(),
          saveCustomSpell: (definition: Parameters<typeof campaignContent.saveSpell>[0]) => campaignContent.saveSpell(definition),
          saveCustomEquipment: (definition: Parameters<typeof campaignContent.saveEquipment>[0]) => campaignContent.saveEquipment(definition),
          saveShop: (shop: Parameters<typeof campaignContent.saveShop>[0], previousKey?: string | null) => campaignContent.saveShop(shop, previousKey ?? null),
          saveMonster: (monster: Parameters<typeof campaignContent.saveMonster>[0], previousKey?: string | null) => campaignContent.saveMonster(monster, previousKey ?? null),
        }
      : {}),
    ...(api.creatures
      ? {
          selectMiniature: () => miniature.selectFirst(),
          createMiniatureThumbnail: (link: Parameters<typeof miniature.createThumbnail>[0]) => miniature.createThumbnail(link),
        }
      : {}),
  }).start().catch(reportStartupFailure);
}

const taleSpireApi = detectTaleSpireApi(window.TS);
window.handleRollResult = (event) => { void activeTaleSpireDiceRoller?.handleRollEvent(event); };
window.logSymbioteEvent = () => undefined;
window.onCreatureStateChange = () => undefined;
window.handleSyncEvents = (event) => {
  void activeCollaboration?.handleSyncEvent(event);
  void activeGmCollaboration?.handleSyncEvent(event);
};
window.handleSyncClientEvents = () => {
  void activeCollaboration?.refreshClients();
  void activeGmCollaboration?.refreshClients();
};
window.handleClientEvents = window.handleSyncClientEvents;
window.handlePlayerPermissionEvents = () => undefined;
window.handleChatMessage = () => undefined;
window.handleInitiativeEvents = (event) => { void activeGmCollaboration?.handleInitiativeEvent(event); };
if (taleSpireApi === null) {
  void startBrowserDevelopment();
} else {
  appRoot.innerHTML = '<p class="welcome">Esperando la inicialización del API de TaleSpire…</p>';
  window.onStateChangeEvent = (event): void => {
    if (event.kind === "hasInitialized") void startTaleSpire(taleSpireApi);
  };
}
