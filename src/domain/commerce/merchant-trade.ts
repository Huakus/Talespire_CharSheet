export interface MerchantTradeSelectionCommand {
  itemId: string;
  quantity: number;
}

export interface CampaignMerchantTradeCommand {
  operation?: "trade" | "loot";
  expectedCampaignRevision: number;
  characterId: string;
  expectedCharacterRevision: number;
  shopName: string;
  merchantNpcId: string;
  buys: MerchantTradeSelectionCommand[];
  sells: MerchantTradeSelectionCommand[];
}
