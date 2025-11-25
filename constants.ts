import { Device, DeviceStatus, OSType } from './types';

// Simulate a database of devices that might come from Vercel Postgres or KV
export const MOCK_DEVICES: Device[] = [
  {
    id: 'dev_001',
    hostname: 'DESKTOP-AK47',
    os: OSType.WINDOWS,
    osVersion: '11 Pro',
    appVersion: '2.4.1',
    ipAddress: '192.168.1.45',
    lastSeen: new Date().toISOString(),
    status: DeviceStatus.ONLINE,
    userId: 'u_101',
    userName: 'John Doe'
  },
  {
    id: 'dev_002',
    hostname: 'MACBOOK-PRO-X',
    os: OSType.MACOS,
    osVersion: '14.2.1',
    appVersion: '2.4.0',
    ipAddress: '10.0.0.12',
    lastSeen: new Date(Date.now() - 1000 * 60 * 5).toISOString(), // 5 mins ago
    status: DeviceStatus.ONLINE,
    userId: 'u_102',
    userName: 'Jane Smith'
  },
  {
    id: 'dev_003',
    hostname: 'LINUX-WORKSTATION',
    os: OSType.LINUX,
    osVersion: 'Ubuntu 22.04',
    appVersion: '2.3.5',
    ipAddress: '172.16.0.5',
    lastSeen: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(), // 2 days ago
    status: DeviceStatus.OFFLINE,
    userId: 'u_103',
    userName: 'Dev Team'
  },
  {
    id: 'dev_004',
    hostname: 'LEGACY-WIN-01',
    os: OSType.WINDOWS,
    osVersion: '10 Enterprise',
    appVersion: '1.9.0',
    ipAddress: '192.168.1.100',
    lastSeen: new Date().toISOString(),
    status: DeviceStatus.CRITICAL,
    userId: 'u_104',
    userName: 'Reception'
  },
  {
    id: 'dev_005',
    hostname: 'DESIGN-MAC-02',
    os: OSType.MACOS,
    osVersion: '13.5',
    appVersion: '2.4.1',
    ipAddress: '10.0.0.15',
    lastSeen: new Date().toISOString(),
    status: DeviceStatus.ONLINE,
    userId: 'u_105',
    userName: 'Sarah Lee'
  },
  {
    id: 'dev_006',
    hostname: 'SERVER-MONITOR',
    os: OSType.LINUX,
    osVersion: 'Debian 11',
    appVersion: '2.4.1',
    ipAddress: '10.0.0.200',
    lastSeen: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    status: DeviceStatus.WARNING,
    userId: 'u_admin',
    userName: 'SysAdmin'
  },
  {
    id: 'dev_007',
    hostname: 'SALES-LAPTOP-01',
    os: OSType.WINDOWS,
    osVersion: '11 Home',
    appVersion: '2.2.0',
    ipAddress: '192.168.1.67',
    lastSeen: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    status: DeviceStatus.OFFLINE,
    userId: 'u_106',
    userName: 'Mike Ross'
  },
  {
    id: 'dev_008',
    hostname: 'FINANCE-PC-02',
    os: OSType.WINDOWS,
    osVersion: '10 Pro',
    appVersion: '2.1.0',
    ipAddress: '192.168.1.88',
    lastSeen: new Date().toISOString(),
    status: DeviceStatus.ONLINE,
    userId: 'u_107',
    userName: 'Amanda Key'
  }
];

export const APP_LATEST_VERSION = '2.4.1';
