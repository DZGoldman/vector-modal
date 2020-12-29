import {
  providers,
  getDefaultProvider,
  constants,
  Contract,
  BigNumber,
} from 'ethers';
import { ERC20Abi } from '@connext/vector-types';

import { TransferStates, ethProvidersOverrides } from '../constants';

const getExplorerLink = (chainId: number): string | undefined => {
  switch (chainId) {
    case 1: {
      return `https://etherscan.io`;
    }
    case 4: {
      return `https://rinkeby.etherscan.io`;
    }
    case 5: {
      return `https://goerli.etherscan.io`;
    }
    case 42: {
      return `https://kovan.etherscan.io`;
    }
    case 80001: {
      return `https://explorer-mumbai.maticvigil.com`;
    }
    case 152709604825713: {
      return `https://explorer.offchainlabs.com/#`;
    }
  }
  return undefined;
};

export const getExplorerLinkForTx = (
  chainId: number,
  txHash: string
): string => {
  const base = getExplorerLink(chainId);
  if (!base) {
    return '#';
  }
  return `${base}/tx/${txHash}`;
};

export const getExplorerLinkForAsset = (
  chainId: number,
  assetId: string
): string => {
  const base = getExplorerLink(chainId);
  if (!base) {
    return '#';
  }
  if (assetId === constants.AddressZero) {
    return base;
  }
  return `${base}/token/${assetId}`;
};

export const getProviderUrlForChain = (chainId: number): string | undefined => {
  switch (chainId) {
    case 5: {
      return `https://goerli.prylabs.net`;
    }
    case 80001: {
      return `https://rpc-mumbai.matic.today`;
    }
    case 152709604825713: {
      return `https://kovan2.arbitrum.io/rpc`;
    }
  }
  return undefined;
};

export const activePhase = (phase: TransferStates): number => {
  switch (phase) {
    case 'INITIAL': {
      return -1;
    }
    case 'DEPOSITING': {
      return 0;
    }
    case 'TRANSFERRING': {
      return 1;
    }
    case 'WITHDRAWING': {
      return 2;
    }
    case 'COMPLETE': {
      return 3;
    }
    case 'ERROR': {
      return 4;
    }
  }
};

export const hydrateProviders = (
  depositChainId: number,
  withdrawChainId: number
): {
  [chainId: number]: providers.BaseProvider;
} => {
  const _ethProviders: { [chainId: number]: providers.BaseProvider } = {};
  for (const chainId of [depositChainId, withdrawChainId]) {
    if (ethProvidersOverrides[chainId]) {
      _ethProviders[chainId] = new providers.JsonRpcProvider(
        ethProvidersOverrides[chainId]
      );
    } else {
      const providerUrl = getProviderUrlForChain(chainId);
      if (providerUrl) {
        _ethProviders[chainId] = new providers.JsonRpcProvider(providerUrl);
      } else {
        _ethProviders[chainId] = getDefaultProvider(chainId as any);
      }
    }
  }
  return _ethProviders;
};

export const getAssetBalance = async (
  ethProviders: { [chainId: number]: providers.BaseProvider },
  chainId: number,
  assetId: string,
  balanceOfAddress: string
): Promise<BigNumber> => {
  const balance =
    assetId === constants.AddressZero
      ? await ethProviders[chainId].getBalance(balanceOfAddress)
      : await new Contract(assetId, ERC20Abi, ethProviders[chainId]).balanceOf(
          balanceOfAddress
        );
  return balance;
};
