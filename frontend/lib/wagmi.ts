import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { xLayerTestnet } from "./contracts/chain";

// OKX Wallet is an EIP-1193 injected provider; `injected` picks it up (and MetaMask).
export const wagmiConfig = createConfig({
  chains: [xLayerTestnet],
  connectors: [injected()],
  transports: {
    [xLayerTestnet.id]: http(),
  },
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
