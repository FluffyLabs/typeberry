/** Numeric mapping for state entries. */
export enum StateEntry {
  Unused = 0,
  /**Authorizer Pool */
  Alpha = 1,
  /** Authorizer Queue */
  Phi = 2,
  /** Recent History */
  Beta = 3,
  /** Safrole */
  Gamma = 4,
  /** Disputes Records (Judgements) */
  Psi = 5,
  /** Entropy */
  Eta = 6,
  /** Next Validators */
  Iota = 7,
  /** Current Validators */
  Kappa = 8,
  /** Previous Validators */
  Lambda = 9,
  /** Availability Assignment */
  Rho = 10,
  /** Current time slot */
  Tau = 11,
  /** Privileged Services */
  Chi = 12,
  /** Statistics */
  Pi = 13,
  /** Work Packages ready to be accumulated */
  Theta = 14,
  /** Work Packages recently accumulated */
  Xi = 15,
  /** Services data */
  Delta = 255,
}
