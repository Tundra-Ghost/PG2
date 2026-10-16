import { useCallback, useEffect, useRef, useState } from 'react';
import { adoptProfile, type LocalProfile } from '../profile';
import {
  currentAccount,
  fetchProfile,
  register as registerAccount,
  signIn as signInAccount,
  signOut as signOutAccount,
  uploadProfile,
  type Account,
  type AccountResult,
} from './account';

export type SyncState = 'syncing' | 'synced' | 'offline';

export interface AccountControls {
  account: Account | null;
  sync: SyncState;
  register(username: string, password: string): Promise<AccountResult>;
  signIn(username: string, password: string): Promise<AccountResult>;
  signOut(): Promise<void>;
}

/**
 * Keeps the local profile and the account's saved profile in step.
 * On sign-in the account's profile wins; an account with no profile yet
 * takes this browser's. After that, every profile change is uploaded.
 */
export function useAccount(
  profile: LocalProfile | null,
  setProfile: (profile: LocalProfile) => void,
): AccountControls {
  const [account, setAccount] = useState<Account | null>(null);
  const [sync, setSync] = useState<SyncState>('syncing');
  const profileRef = useRef(profile);
  profileRef.current = profile;

  const start = useCallback(
    async (next: Account) => {
      setAccount(next);
      setSync('syncing');
      try {
        const adopted = adoptProfile(await fetchProfile());
        if (adopted) setProfile(adopted);
        else if (profileRef.current) await uploadProfile(profileRef.current);
        setSync('synced');
      } catch {
        // Uploads wait until a sync succeeds, so a stale local copy can't
        // overwrite the account's profile.
        setSync('offline');
      }
    },
    [setProfile],
  );

  useEffect(() => {
    currentAccount()
      .then(found => (found ? start(found) : undefined))
      .catch(() => setSync('offline'));
  }, [start]);

  useEffect(() => {
    if (!account || sync !== 'synced' || !profile) return;
    uploadProfile(profile).catch(() => setSync('offline'));
  }, [account, sync, profile]);

  const withSync = useCallback(
    async (attempt: Promise<AccountResult>) => {
      const result = await attempt;
      if (result.ok) void start(result.account);
      return result;
    },
    [start],
  );

  return {
    account,
    sync,
    register: (username, password) => withSync(registerAccount(username, password)),
    signIn: (username, password) => withSync(signInAccount(username, password)),
    async signOut() {
      await signOutAccount();
      setAccount(null);
    },
  };
}
