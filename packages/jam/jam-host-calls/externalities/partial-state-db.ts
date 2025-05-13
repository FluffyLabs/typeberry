import {ServiceId, CodeHash, PerValidator, CoreIndex} from "@typeberry/block";
import {AUTHORIZATION_QUEUE_SIZE} from "@typeberry/block/gp-constants";
import {Bytes} from "@typeberry/bytes";
import {FixedSizeArray} from "@typeberry/collections";
import {Blake2bHash, OpaqueHash} from "@typeberry/hash";
import {U64, U32} from "@typeberry/numbers";
import {Gas} from "@typeberry/pvm-interpreter";
import {State, ValidatorData} from "@typeberry/state";
import {Result, OK} from "@typeberry/utils";
import {PartialState, PreimageStatus, QuitError, RequestPreimageError, slotsToPreimageStatus, TRANSFER_MEMO_BYTES, TransferError} from "./partial-state";
import {PreimageHash} from "@typeberry/block/preimage";

export class PartialStateDb implements PartialState {
  constructor(
    private readonly state: State,
    // TODO [ToDr] current service id should be an argument to functions instead.
    private currentServiceId: ServiceId,
  ) {}

  checkPreimageStatus(hash: PreimageHash, length: U64): PreimageStatus | null {
    const service = this.state.services.get(this.currentServiceId);
    const lookup = service?.data.lookupHistory.get(hash);
    const status = lookup?.find(x => BigInt(x.length) === length);
    const slots = status?.slots;
    if (slots === undefined) {
      return null;
    }

    return slotsToPreimageStatus(slots);
  }

  requestPreimage(hash: PreimageHash, length: U64): Result<null, RequestPreimageError> {
    throw new Error("Method not implemented.");
  }

  forgetPreimage(hash: Blake2bHash, length: U64): Result<null, null> {
    throw new Error("Method not implemented.");
  }

  quitAndTransfer(destination: ServiceId, suppliedGas: Gas, memo: Bytes<TRANSFER_MEMO_BYTES>): Result<null, QuitError> {
    throw new Error("Method not implemented.");
  }

  quitAndBurn(): void {
    throw new Error("Method not implemented.");
  }

  transfer(destination: ServiceId | null, amount: U64, suppliedGas: Gas, memo: Bytes<TRANSFER_MEMO_BYTES>): Result<OK, TransferError> {
    throw new Error("Method not implemented.");
  }

  newService(requestedServiceId: ServiceId, codeHash: CodeHash, codeLength: U32, gas: U64, balance: U64): Result<ServiceId, "insufficient funds"> {
    throw new Error("Method not implemented.");
  }

  upgradeService(codeHash: CodeHash, gas: U64, allowance: U64): void {
    throw new Error("Method not implemented.");
  }

  updateValidatorsData(validatorsData: PerValidator<ValidatorData>): void {
    throw new Error("Method not implemented.");
  }

  checkpoint(): void {
    throw new Error("Method not implemented.");
  }

  updateAuthorizationQueue(coreIndex: CoreIndex, authQueue: FixedSizeArray<Blake2bHash, AUTHORIZATION_QUEUE_SIZE>): void {
    throw new Error("Method not implemented.");
  }

  updatePrivilegedServices(m: ServiceId, a: ServiceId, v: ServiceId, g: Map<ServiceId, Gas>): void {
    throw new Error("Method not implemented.");
  }

  yield(hash: OpaqueHash): void {
    throw new Error("Method not implemented.");
  }
}
