export class WorkPackage {
	items: WorkItem[] = [];
}
export class WorkItem {}

// A total serialized size of a work-report may be no greater than W_r bytes.
export class WorkReport {
	// GP : a
	authorizerHash: void;
	// GP : o
	authorizerOutput: void;
	// GP : x
	refinementContext: RefinementContext;
	// GP : s
	packageSpecification: void;
	// GP : r
	results: WorkResult[];

	constructor() {
		this.authorizerHash = undefined;
		this.authorizerOutput = undefined;
		this.refinementContext = new RefinementContext();
		this.packageSpecification = undefined;
		this.results = [];
	}
}

// The context of the chain at the point that the report's corresponding
// work package has been evaluated.
export class RefinementContext {
	anchorHash: void;
	anchorPostStateRoot: void;
	anchorBeefyRoot: void;
	lookupAnchor: void;
	timeslot: void;
	preRequisiteWorkPackage?: void;

	constructor() {
		this.anchorHash = undefined;
		this.anchorPostStateRoot = undefined;
		this.anchorBeefyRoot = undefined;
		this.lookupAnchor = undefined;
		this.timeslot = undefined;
		this.preRequisiteWorkPackage = undefined;
	}
}

export class WorkResult {}
