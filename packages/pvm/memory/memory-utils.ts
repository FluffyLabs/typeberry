import { PAGE_SIZE } from "./memory-consts";

export function alignToPageSize(length: number) {
  return PAGE_SIZE * Math.ceil(length / PAGE_SIZE);
}
