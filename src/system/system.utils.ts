import { networkInterfaces } from 'os';

const PRIVATE_IPV4_PATTERNS = [
  /^192\.168\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
];

const IGNORED_INTERFACE_PATTERNS = [
  /vEthernet/i,
  /WSL/i,
  /Docker/i,
  /VirtualBox/i,
  /VMware/i,
  /Loopback/i,
];

function isPrivateIpv4(address: string): boolean {
  return PRIVATE_IPV4_PATTERNS.some((pattern) => pattern.test(address));
}

function isIgnoredInterface(name: string): boolean {
  return IGNORED_INTERFACE_PATTERNS.some((pattern) => pattern.test(name));
}

function getAddressPriority(address: string): number {
  if (address.startsWith('192.168.')) return 0;
  if (address.startsWith('10.')) return 1;
  return 2;
}

export function getLanIp(): string | null {
  const interfaces = networkInterfaces();
  const candidates: Array<{ address: string; priority: number }> = [];

  for (const [name, entries] of Object.entries(interfaces)) {
    if (!entries || isIgnoredInterface(name)) continue;

    for (const entry of entries) {
      const family = String(entry.family);
      const isIpv4 = family === 'IPv4' || family === '4';
      if (!isIpv4 || entry.internal) continue;
      if (!isPrivateIpv4(entry.address)) continue;
      if (entry.address.startsWith('169.254.')) continue;

      candidates.push({
        address: entry.address,
        priority: getAddressPriority(entry.address),
      });
    }
  }

  if (!candidates.length) return null;

  candidates.sort((a, b) => a.priority - b.priority);
  return candidates[0].address;
}
