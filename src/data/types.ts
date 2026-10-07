export interface CaseDef {
  /** Full name, e.g. "OLL 27" or "PLL T". */
  id: string;
  /** Short label for thumbnails. */
  short: string;
  nickname?: string;
  group: string;
  /** Best-known algorithm first. Brackets only mark triggers. */
  algs: string[];
}
