import Store from 'electron-store';
import { Service } from '../shared/ipc-channels';

interface StoreSchema {
  services: Service[];
  themeMode: 'light' | 'dark' | 'system';
  windowBounds: {
    width: number;
    height: number;
    x?: number;
    y?: number;
  };
}

const store = new Store<StoreSchema>({
  defaults: {
    services: [],
    themeMode: 'system',
    windowBounds: {
      width: 800,
      height: 600,
    },
  },
});

export default store;
