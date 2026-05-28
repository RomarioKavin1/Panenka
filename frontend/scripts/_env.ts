// Shared script bootstrap: loads the repo-root .env and builds a script wallet client.
import { config } from "dotenv";
import { resolve } from "node:path";
import { getScriptWalletClient, publicClient } from "../lib/clients";

config({ path: resolve(process.cwd(), "../.env") }); // repo-root .env (gitignored)

const pk = process.env.PRIVATE_KEY as `0x${string}` | undefined;
if (!pk) throw new Error("Set PRIVATE_KEY (0x-prefixed) in the repo-root .env");

export const wallet = getScriptWalletClient(pk);
export const account = wallet.account!.address;
export { publicClient };
