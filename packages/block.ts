import {Header} from "./header";
import {Opaque} from "./opaque";

export type Ticket  = Opaque<void, "Tickets">;
export type Judgement = Opaque<void, "Judgements">;
export type PreImage = Opaque<void, "PreImages">;
export type Availability = Opaque<void, "Availability">;
export type Report = Opaque<void, "Report">;

// GP: B
export class Block {
  // GP: H
  public header: Header;
  // GP: E_T
  public tickAvailabilityets: Ticket[];
  // GP: E_J
  public judgements: Judgement[];
  // GP: E_P
  public preImages: PreImage[];
  // GP: E_A
  public availability: Availability[];
  // GP: E_G
  public reports: Report[];
}
