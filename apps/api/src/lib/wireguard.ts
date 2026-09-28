import { appConfig } from '@bharattunnel/config';
import {
  IpAllocator,
  WireGuardManager,
  SystemWireGuardDriver,
  MockWireGuardDriver,
  IWireGuardDriver,
} from '@bharattunnel/wireguard';
import { logger } from './logger.js';

export const ipAllocator = new IpAllocator({
  cidr: appConfig.VPN_NETWORK,
  gatewayIp: appConfig.VPN_GATEWAY_IP,
});

let driver: IWireGuardDriver;

if (appConfig.WIREGUARD_DRIVER === 'system') {
  logger.info(`Initializing SystemWireGuardDriver for interface ${appConfig.VPN_INTERFACE}`);
  driver = new SystemWireGuardDriver(appConfig.VPN_INTERFACE);
} else {
  logger.info('Initializing MockWireGuardDriver for local development and non-Linux environment');
  driver = new MockWireGuardDriver(
    appConfig.VPN_INTERFACE,
    appConfig.VPN_SERVER_PUBLIC_KEY,
    appConfig.VPN_SERVER_PORT
  );
}

export const wireguardManager = new WireGuardManager({
  driver,
  allocator: ipAllocator,
  serverHost: appConfig.VPN_SERVER_HOST,
  serverPort: appConfig.VPN_SERVER_PORT,
  serverPublicKey: appConfig.VPN_SERVER_PUBLIC_KEY,
  dnsServer: appConfig.VPN_DNS_SERVER,
  gatewayId: 'india-mumbai-1',
  gatewayName: 'BharatTunnel India Gateway (Mumbai-1)',
});
