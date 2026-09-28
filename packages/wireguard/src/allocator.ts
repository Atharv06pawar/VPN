import { IPV4_REGEX } from '@bharattunnel/shared';

export interface IpAllocatorConfig {
  cidr: string;        // e.g. "10.50.0.0/24"
  gatewayIp: string;   // e.g. "10.50.0.1"
  reservedIps?: string[];
}

export class IpAllocator {
  private baseIpInt: number;
  private prefixLength: number;
  private netmaskInt: number;
  private gatewayIpInt: number;
  private reservedIpInts: Set<number>;
  private networkCidr: string;
  private gatewayIp: string;

  constructor(config: IpAllocatorConfig) {
    this.networkCidr = config.cidr;
    this.gatewayIp = config.gatewayIp;

    const [ipStr, prefixStr] = config.cidr.split('/');
    if (!ipStr || !prefixStr || !IPV4_REGEX.test(ipStr)) {
      throw new Error(`Invalid CIDR network format: ${config.cidr}`);
    }

    const prefix = parseInt(prefixStr, 10);
    if (isNaN(prefix) || prefix < 16 || prefix > 30) {
      throw new Error(`Unsupported prefix length ${prefixStr}. BharatTunnel supports /16 to /30.`);
    }

    this.prefixLength = prefix;
    this.baseIpInt = this.ipToInt(ipStr);
    this.netmaskInt = -1 << (32 - prefix);
    
    // Ensure base IP is aligned with subnet mask
    this.baseIpInt = (this.baseIpInt & this.netmaskInt) >>> 0;

    if (!IPV4_REGEX.test(config.gatewayIp)) {
      throw new Error(`Invalid gateway IP format: ${config.gatewayIp}`);
    }

    this.gatewayIpInt = this.ipToInt(config.gatewayIp);
    if (!this.isIpIntInSubnet(this.gatewayIpInt)) {
      throw new Error(`Gateway IP ${config.gatewayIp} is not inside subnet ${config.cidr}`);
    }

    this.reservedIpInts = new Set<number>();
    // Reserve network address (all 0 host bits) and broadcast address (all 1 host bits)
    this.reservedIpInts.add(this.baseIpInt);
    const broadcastInt = (this.baseIpInt | (~this.netmaskInt >>> 0)) >>> 0;
    this.reservedIpInts.add(broadcastInt);

    // Reserve gateway IP
    this.reservedIpInts.add(this.gatewayIpInt);

    // Add any custom reserved IPs
    if (config.reservedIps) {
      for (const ip of config.reservedIps) {
        if (IPV4_REGEX.test(ip)) {
          this.reservedIpInts.add(this.ipToInt(ip));
        }
      }
    }
  }

  public getCidr(): string {
    return this.networkCidr;
  }

  public getGatewayIp(): string {
    return this.gatewayIp;
  }

  /**
   * Total assignable host IPs excluding network, broadcast, and gateway.
   */
  public getTotalCapacity(): number {
    const totalHosts = Math.pow(2, 32 - this.prefixLength);
    return Math.max(0, totalHosts - this.reservedIpInts.size);
  }

  /**
   * Checks if an IP is within the configured subnet.
   */
  public isIpInSubnet(ip: string): boolean {
    if (!IPV4_REGEX.test(ip)) return false;
    return this.isIpIntInSubnet(this.ipToInt(ip));
  }

  /**
   * Checks if an IP is reserved (network, broadcast, gateway, or reserved list).
   */
  public isIpReserved(ip: string): boolean {
    if (!IPV4_REGEX.test(ip)) return true;
    return this.reservedIpInts.has(this.ipToInt(ip));
  }

  /**
   * Allocates the lowest available IP address that is not in `currentlyAllocatedIps`.
   * Throws an error if the subnet pool is completely exhausted.
   */
  public allocateNextIp(currentlyAllocatedIps: string[]): string {
    const allocatedSet = new Set<number>(
      currentlyAllocatedIps.filter((ip) => IPV4_REGEX.test(ip)).map((ip) => this.ipToInt(ip))
    );

    const totalSubnetIps = Math.pow(2, 32 - this.prefixLength);

    for (let offset = 1; offset < totalSubnetIps - 1; offset++) {
      const candidateInt = (this.baseIpInt + offset) >>> 0;

      if (this.reservedIpInts.has(candidateInt)) {
        continue;
      }

      if (!allocatedSet.has(candidateInt)) {
        return this.intToIp(candidateInt);
      }
    }

    throw new Error(`Subnet address pool ${this.networkCidr} is exhausted.`);
  }

  /**
   * Validates if a proposed IP is valid, unreserved, and inside the subnet.
   */
  public validateAssignableIp(ip: string, currentlyAllocatedIps: string[]): boolean {
    if (!this.isIpInSubnet(ip)) return false;
    if (this.isIpReserved(ip)) return false;
    return !currentlyAllocatedIps.includes(ip);
  }

  private isIpIntInSubnet(ipInt: number): boolean {
    return ((ipInt & this.netmaskInt) >>> 0) === this.baseIpInt;
  }

  private ipToInt(ip: string): number {
    return (
      ip
        .split('.')
        .reduce((acc, octet) => ((acc << 8) + parseInt(octet, 10)) >>> 0, 0) >>> 0
    );
  }

  private intToIp(int: number): string {
    return [
      (int >>> 24) & 255,
      (int >>> 16) & 255,
      (int >>> 8) & 255,
      int & 255,
    ].join('.');
  }
}
