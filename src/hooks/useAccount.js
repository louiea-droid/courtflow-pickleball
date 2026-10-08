import { useEffect, useRef, useState } from "react";
import {
  EmailAuthProvider, GoogleAuthProvider, createUserWithEmailAndPassword, deleteUser, onAuthStateChanged,
  reauthenticateWithCredential, reauthenticateWithPopup, sendPasswordResetEmail, signInWithEmailAndPassword,
  signInWithPopup, signOut, updatePassword,
} from "firebase/auth";
import { doc, getDoc, onSnapshot, setDoc, updateDoc } from "firebase/firestore";
import { auth, db, firebaseConfigured } from "../firebase";
import {
  accountStatus, authMessage, defaultClubName, hasPasswordProvider, isAccountUser, isLegacyEmail, LEGACY_MESSAGE,
  resetMessage, shouldEnsureAccount,
} from "../utils/account";
import { deleteAccountData } from "../utils/accountData";
import { needsDirectorySync } from "../utils/friends";
import { syncDirectory } from "../utils/friendsData";

// Creates accounts/{uid} once. Safe to call again: it never overwrites settings.
async function ensureAccount(user, name) {
  const ref = doc(db, "accounts", user.uid);
  if ((await getDoc(ref)).exists()) return;
  await setDoc(ref, { name: name || defaultClubName(user), email: user.email, createdAt: Date.now() });
}

const run = async (fn) => {
  try {
    await fn();
    return "";
  } catch (err) {
    return authMessage(err);
  }
};

export function useAccount() {
  const [user, setUser] = useState(undefined); // undefined = still checking who's signed in
  const [account, setAccount] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [syncTick, setSyncTick] = useState(0); // bumped to run the directory sync again (after sign-up, after a failure)
  const creating = useRef(false); // sign-up writes the account itself; don't race it
  const deleting = useRef(false); // the profile vanishing mid-delete is intended; don't re-create it

  useEffect(() => {
    if (!firebaseConfigured) { setUser(null); return; }
    return onAuthStateChanged(auth, (u) => setUser(isAccountUser(u) ? u : null));
  }, []);

  useEffect(() => {
    setLoaded(false);
    setFailed(false);
    if (!user) { setAccount(null); return; }
    return onSnapshot(doc(db, "accounts", user.uid), (s) => {
      // Mid-delete, keep the page (and the delete dialog, which shows any error) as it is.
      if (!s.exists() && deleting.current) return;
      setAccount(s.exists() ? s.data() : null);
      setLoaded(true);
      // Signed in but no profile yet (e.g. made in the console): create it.
      if (shouldEnsureAccount({ exists: s.exists(), creating: creating.current, deleting: deleting.current })) {
        ensureAccount(user).catch(() => setFailed(true));
      }
    }, () => setFailed(true));
  }, [user]);

  const status = accountStatus({ user, loaded, account, failed });

  // Keeps the friend directory (code, name listing, names on friendships) matching this account. One run at a
  // time; the next account snapshot (after the write) re-checks, so it settles instead of looping. A failure
  // tries again a few times, a little later (the person may be offline); sign-up bumps the tick when it is done,
  // because its own snapshot arrives while it is still "creating".
  const syncing = useRef(false);
  const syncFailures = useRef(0);
  useEffect(() => {
    if (status !== "in" || creating.current || deleting.current || syncing.current || !needsDirectorySync(account)) return;
    syncing.current = true;
    syncDirectory(db, user.uid, account)
      .then(() => { syncFailures.current = 0; })
      .catch(() => {
        syncFailures.current += 1;
        if (syncFailures.current <= 3) setTimeout(() => setSyncTick((t) => t + 1), 4000 * syncFailures.current);
      })
      .finally(() => { syncing.current = false; });
  }, [status, user, account, syncTick]);

  const signIn = (email, password) => {
    if (isLegacyEmail(email)) return Promise.resolve(LEGACY_MESSAGE);
    return run(async () => {
      const { user: u } = await signInWithEmailAndPassword(auth, email.trim(), password);
      await ensureAccount(u);
    });
  };

  const signUp = (name, email, password) => {
    if (isLegacyEmail(email)) return Promise.resolve(LEGACY_MESSAGE);
    return run(async () => {
      creating.current = true;
      try {
        const { user: u } = await createUserWithEmailAndPassword(auth, email.trim(), password);
        // The form unmounts once the user exists, so a failed profile write can't show an
        // error there. Surface it as the page error instead of an endless "Loading…".
        await ensureAccount(u, name.trim()).catch(() => setFailed(true));
      } finally {
        creating.current = false;
        setSyncTick((t) => t + 1);
      }
    });
  };

  const signInGoogle = () => run(async () => {
    const { user: u } = await signInWithPopup(auth, new GoogleAuthProvider());
    await ensureAccount(u);
  });

  const resetPassword = async (email) => {
    try {
      await sendPasswordResetEmail(auth, email.trim());
      return "";
    } catch (err) {
      return resetMessage(err);
    }
  };

  const updateAccount = (patch) => updateDoc(doc(db, "accounts", user.uid), patch);

  const changePassword = async (current, next) => {
    try {
      await reauthenticateWithCredential(auth.currentUser, EmailAuthProvider.credential(auth.currentUser.email, current));
    } catch (err) {
      return err.code === "auth/too-many-requests" || err.code === "auth/network-request-failed"
        ? authMessage(err) : "Current password is incorrect.";
    }
    return run(() => updatePassword(auth.currentUser, next));
  };

  // Proves it's you first (password, or the Google window), then erases the
  // account's data, then the sign-in itself. Data first, account last, so a
  // failure never leaves data orphaned behind a deleted login.
  const deleteAccount = async (password) => {
    try {
      if (hasPasswordProvider(auth.currentUser)) {
        await reauthenticateWithCredential(auth.currentUser, EmailAuthProvider.credential(auth.currentUser.email, password));
      } else {
        await reauthenticateWithPopup(auth.currentUser, new GoogleAuthProvider());
      }
    } catch (err) {
      return err.code === "auth/popup-closed-by-user" || err.code === "auth/cancelled-popup-request"
        ? "Confirm with Google to delete your account."
        : err.code === "auth/too-many-requests" || err.code === "auth/network-request-failed" || err.code === "auth/popup-blocked"
          ? authMessage(err) : "Password is incorrect.";
    }
    deleting.current = true;
    return run(async () => {
      try {
        await deleteAccountData(db, auth.currentUser.uid);
        await deleteUser(auth.currentUser);
      } finally {
        deleting.current = false;
      }
    });
  };

  return {
    status, user, account, hasPassword: user ? hasPasswordProvider(user) : false,
    signIn, signUp, signInGoogle, resetPassword, signOutUser: () => signOut(auth),
    updateAccount, changePassword, deleteAccount,
  };
}
