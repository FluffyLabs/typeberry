import { kinds } from "./kinds";

export const getTypes = async () => {
  return kinds.map((kind) => ({ id: kind.name }));
};
