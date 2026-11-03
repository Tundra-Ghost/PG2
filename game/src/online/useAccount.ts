import { useCallback, useEffect, useRef, useState } from 'react';
import { adoptProfile, isGeneratedName, updateProfile, type LocalProfile } from '../profile';
import {
  currentAccount,
  fetchProfile,
  onWaking,
  wakeServer,
  register as registerAccount,
  requestRecoveryCode,
  resetPassword as resetAccountPassword,
  signIn as signInAccount,
  signOut as signOutAccount,
  uploadProfile,
  type Account,
  type AccountResult,
} from './account';

export type SyncState = 'syncing' | 'synced' | 'offline';

export interface AccountControls {
  account: Account | null;
  /** False until a saved session has been checked, so a returning player is not shown as a guest. */
  ready: boolean;
  /** The sleeping game server is starting up. Requests wait for it. */
  waking: boolean;
  sync: SyncState;
  register(username: string, password: string): Promise<AccountResult>;
  signIn(username: string, password: string): Promise<AccountResult>;
  signOut(): Promise<void>;
  /** Uses a recovery code to set a new password, then signs in. */
  resetPassword(username: string, recoveryCode: string, password: string): Promise<AccountResult>;
  /** Shown once after sign-up or a reset, until the player confirms they saved it. */
  recoveryCode: string | null;
  newRecoveryCode(): Promise<void>;
  dismissRecoveryCode(): void;
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
  const [ready, setReady] = useState(false);
  const [waking, setWaking] = useState(false);
  const [sync, setSync] = useState<SyncState>('syncing');
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null);
  const profileRef = useRef(profile);
  profileRef.current = profile;

  const start = useCallback(
    async (next: Account) => {
      setAccount(next);
      setSync('syncing');
      try {
        const adopted = adoptProfile(await fetchProfile());
        let current = adopted ?? profileRef.current;
        // A profile still wearing its random guest name takes the account's username.
        if (current && isGeneratedName(current.displayName)) {
          current = updateProfile(current, { displayName: next.username });
        }
        if (current) {
          setProfile(current);
          await uploadProfile(current);
        }
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
    const stop = onWaking(setWaking);
    // Start waking the server now, so it is up by the time the player signs in or plays online.
    void wakeServer();
    return stop;
  }, []);

  useEffect(() => {
    currentAccount()
      .then(found => {
        setReady(true);
        if (found) void start(found);
      })
      .catch(() => {
        setReady(true);
        setSync('offline');
      });
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
    ready,
    waking,
    sync,
    async register(username, password) {
      const result = await withSync(registerAccount(username, password));
      if (result.ok) setRecoveryCode(await requestRecoveryCode());
      return result;
    },
    signIn: (username, password) => withSync(signInAccount(username, password)),
    async signOut() {
      await signOutAccount();
      setAccount(null);
      setRecoveryCode(null);
    },
    async resetPassword(username, code, password) {
      const reset = await resetAccountPassword(username, code, password);
      if (!reset.ok) return reset;
      const result = await withSync(signInAccount(username, password));
      if (result.ok) setRecoveryCode(reset.recoveryCode);
      return result;
    },
    recoveryCode,
    async newRecoveryCode() {
      setRecoveryCode(await requestRecoveryCode());
    },
    dismissRecoveryCode: () => setRecoveryCode(null),
  };
}
