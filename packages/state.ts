
// GP: sigma
export class State {
  // GP: alpha
  //
  // "the authorization requirement which work done on that core must satisfy at the time 
  // of being reported on-chain,"
  authorizatonRequirement: void;
  // GP: beta
  previousBlocks: void;
  // GP: gamma
  //
  // "all other state concerning the determination of these[validator's] keys"
  validatorElectionState: void;
  // GP: delta
  services: void;
  // GP: eta
  entropyPool: void;
  // GP: iota
  //
  // Enqueued validator set for the next epoch.
  nextValidatorSet: void;
  // GP: kappa
  // 
  // Validator set in the current epoch.
  currentValidatorSet: void;
  // GP: lambda
  //
  // Validator set archive.
  previousValidatorSets: void;
  // GP: rho
  //
  // "each of the cores' currently assigned `report`, the availability of whose
  // `work-package` must yet be assured by a super-majority of validators."
  workPackgesToConfirm: void;
  // GP: tau
  mostRecentTime: void;
  // GP: varphi
  //
  // `alpha` the authorization requirement which work done on that core must satisfy at the time
  // of being reported on-chain, together with the queue which fills this, `varphi`.
  enquedWorkPackages: void;
  // GP: chi
  priviledgedServices: void;
  // GP: psi
  ongoingDisputes: void;
}
