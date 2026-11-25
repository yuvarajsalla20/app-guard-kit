import { safeKeyPart } from './logic/options';
import type { GuardModules } from './modules';

/** What the kit keeps in the Keychain for each person. */
export type VaultItem = 'pin' | 'settings' | 'tries' | 'bio';

const USER_KEY = 'appguard.user';

/**
 * 2.1.0: the Keychain side of the lock, on its own: item names per person, the options every read and write needs, and the
 * Face ID secret. The controller decides what to keep; this only stores it.
 */
export class GuardVault {
  constructor(
    private readonly modules: GuardModules,
    private readonly report: (where: string, error: unknown) => void,
  ) {}

  private get store() {
    return this.modules.store;
  }

  private opts() {
    return { keychainAccessible: this.modules.accessible };
  }

  private bioOpts(prompt: string) {
    return { requireAuthentication: true, authenticationPrompt: prompt, keychainAccessible: this.modules.biometricAccessible };
  }

  private key(name: VaultItem, userId: string | null | undefined): string {
    return `appguard.${safeKeyPart(userId ?? '_')}.${name}`;
  }

  /** The account whose items are on this phone. */
  lastUser = (): Promise<string | null> => this.store.getItemAsync(USER_KEY, this.opts());

  rememberUser = (userId: string): Promise<void> => this.store.setItemAsync(USER_KEY, userId, this.opts());

  forgetUser = (): Promise<void> => this.store.deleteItemAsync(USER_KEY, this.opts());

  read = (userId: string | null | undefined, name: VaultItem): Promise<string | null> => this.store.getItemAsync(this.key(name, userId), this.opts());

  write = (userId: string | null | undefined, name: VaultItem, value: string): Promise<void> => this.store.setItemAsync(this.key(name, userId), value, this.opts());

  /** Removes items. A failure is reported, never thrown, so the rest still goes. */
  remove = async (userId: string | null | undefined, names: readonly VaultItem[]): Promise<void> => {
    await Promise.all(names.map((k) => this.store.deleteItemAsync(this.key(k, userId), this.opts()).catch((e) => this.report('wipe', e))));
  };

  /** Reads the Face ID secret, which iOS shows only after Face ID passes for the faces enrolled now. */
  readBio = (userId: string | null | undefined, prompt: string): Promise<string | null> => this.store.getItemAsync(this.key('bio', userId), this.bioOpts(prompt));

  writeBio = (userId: string | null | undefined, value: string, prompt: string): Promise<void> => this.store.setItemAsync(this.key('bio', userId), value, this.bioOpts(prompt));

  /** Removes the Face ID secret quietly (it may not be there). */
  dropBio = (userId: string | null | undefined): Promise<void> => this.store.deleteItemAsync(this.key('bio', userId), this.opts()).catch(() => undefined);
}

/** Everything the kit keeps for one person. */
export const ALL_ITEMS: readonly VaultItem[] = ['pin', 'settings', 'tries', 'bio'];
