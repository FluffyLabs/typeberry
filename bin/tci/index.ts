import { Level, Logger } from "@typeberry/logger";
import { type CommonArguments, HELP, parseArgs } from "./args.js";

Logger.configureAll(process.env.JAM_LOG ?? "", Level.LOG);
/** TODO: [MaSo]
  * Stworzyc osobne CLI. Chcemy mieć taki setup.
  * TCI-CLI - compatibility layer z innymi aplikacjami.
  * RPC-Server - nasz serwer ma swoje CLI jak jest odpalany niezależnie
  * JAM-CLI - nasze CLI do odpalania Jama.
  * -----
  * RPC-Server CLI tworzy sobie jakiś RpcConfig którym uruchamia server,
  * JAM-CLI tworzy JamConfig który uruchamia binarkę.
  * TCI-CLI tworzy oba te konfigi i uruchamia obie rzeczy.
  * -----
  * Teraz nasze JAM-CLI ma dwie rzeczy:
  * 1. Bardzo proste CLI (chyba jedna opcja --nodeName) i JSON-config z którego wczytujemy całą resztę.
  * 2. Ten JSON-Config się pokrywa z JamConfig ale tez nie musi tak być jeśli zauważymy, że lepiej jak to jest rozłączne.
*/
async function main(args: string[]) {
  const argv = parseArgs(args);

}

function jamConfig(args: CommonArguments) {

}

function rpcConfig(args: CommonArguments) {

}

main(process.argv.slice(2));
