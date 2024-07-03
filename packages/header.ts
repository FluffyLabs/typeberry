export class UnsealedHeader {
	// GP: H_p
	public parentHeaderHash: void = undefined;
	// GP: H_r
	public priorStateRoot: void = undefined;
	// GP: H_x
	public extrinsicHash: void = undefined;
	// GP: H_t
	public timeSlotIndex: void = undefined;
	// GP: H_e
	public epoch: void = undefined;
	// GP: H_w
	public winningTickets: void = undefined;
	// GP: H_j
	public judgementMarkers: void = undefined;
	// GP: H_k
	public bandersnatchBlockAuthor: void = undefined;
	// GP: H_v
	//
	// "the entropy yielding VRF signature"
	public vrfSignature: void = undefined;
}

export class Header {
	public header: UnsealedHeader = new UnsealedHeader();
	// GP: H_s
	public seal: void = undefined;
}
