export class UnsealedHeader {
  // GP: H_p
  public parentHeaderHash: void;
  // GP: H_r
  public priorStateRoot: void;
  // GP: H_x
  public extrinsicHash: void;
  // GP: H_t
  public timeSlotIndex: void;
  // GP: H_e
  public epoch: void;
  // GP: H_w
  public winningTickets: void;
  // GP: H_j
  public judgementMarkers: void;
  // GP: H_k
  public bandersnatchBlockAuthor: void;
  // GP: H_v
  //
  // "the entropy yielding VRF signature"
  public vrfSignature: void;
}

export class Header {
  public header: Header;
  // GP: H_s
  public seal: void;
}
