import { type ClientContext, createORPCClient } from '@orpc/client';
import { RPCLink, type RPCLinkOptions } from '@orpc/client/fetch';
import { type AnyRouter, type RouterClient } from '@orpc/server';
import { type CreateRouterUtilsOptions, type RouterUtils, createTanstackQueryUtils } from '@orpc/tanstack-query';

const buildClient = <TRouter extends AnyRouter>(options: RPCLinkOptions<ClientContext>): RouterClient<TRouter> => {
  const url = typeof options.url === 'string' ? `${options.url.replace(/\/+$/, '')}/rpc` : options.url;

  return createORPCClient(new RPCLink({ ...options, url }));
};

export const createRouterClient = <TRouter extends AnyRouter = never>(
  ...args: [TRouter] extends [never]
    ? [router: 'Error: You must provide a Router type parameter, e.g. createRouterClient<Router>(...)']
    : [options: RPCLinkOptions<ClientContext>]
): RouterClient<TRouter> => {
  return buildClient<TRouter>(args[0] as RPCLinkOptions<ClientContext>);
};

export const createTanstackQueryClient = <TRouter extends AnyRouter = never>(
  ...args: [TRouter] extends [never]
    ? [router: 'Error: You must provide a Router type parameter, e.g. createTanstackQueryClient<Router>(...)']
    : [options: RPCLinkOptions<ClientContext>, utilsOptions?: CreateRouterUtilsOptions<RouterClient<TRouter>>]
): RouterUtils<RouterClient<TRouter>> => {
  const [linkOptions, utilsOptions] = args as [RPCLinkOptions<ClientContext>, CreateRouterUtilsOptions<RouterClient<TRouter>>?];

  return createTanstackQueryUtils(buildClient<TRouter>(linkOptions), utilsOptions);
};
