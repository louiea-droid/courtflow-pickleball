import { useEffect, useRef, useState } from "react";
import {
  EmailAuthProvider, GoogleAuthProvider, createUserWithEmailAndPassword, deleteUser, onAuthStateChanged,
  reauthenticateWithCredential, reauthenticateWithPopup, sendPasswordResetEmail, signInWithEmailAndPassword,
  signInWithPopup, signOut, updatePassword,
} from "firebase/auth";
import {
  collection, doc, getDoc, getDocs, limit, onSnapshot, query, setDoc, updateDoc, writeBatch,
} from "firebase/firestore";
import { auth, db, firebaseConfigured } from "../firebase";
import {
  accountStatus, authMessage, defaultClubName, hasPasswordProvider, isAccountUser, resetMessage,
} from "../utils/account";

// Step 2 adds each event's own subcollections to this cascade.
const ACCOUNT_COLLECTIONS = ["roster", "events"];

// Creates accounts/{uid} once. Safe to call again: it never overwrites settings.
async function ensureAccount(user, clubName) {
  const ref = doc(db, "accounts", user.uid);
  if ((await getDoc(ref)).exists()) return;
  await setDoc(ref, { clubName: clubName || defaultClubName(user), email: user.email, createdAt: Date.now() });
}

// Firestore batches cap at 500 writes, so delete in rounds.
async function wipeCollection(colRef) {
  for (;;) {
    const snap = await getDocs(query(colRef, limit(400)));
    if (snap.empty) return;
    const batch = writeBatch(db);
    snap.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
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
  const creating = useRef(false); // sign-up writes the account itself; don't race it

  useEffect(() => {
    if (!firebaseConfigured) { setUser(null); return; }
    return onAuthStateChanged(auth, (u) => setUser(isAccountUser(u) ? u : null));
  }, []);

  useEffect(() => {
    setLoaded(false);
    setFailed(false);
    if (!user) { setAccount(null); return; }
    return onSnapshot(doc(db, "accounts", user.uid), (s) => {
      setAccount(s.exists() ? s.data() : null);
      setLoaded(true);
      // Signed in but no profile yet (e.g. made in the console): create it.
      if (!s.exists() && !creating.current) ensureAccount(user).catch(() => setFailed(true));
    }, () => setFailed(true));
  }, [user]);

  const status = accountStatus({ user, loaded, account, failed });

  const signIn = (email, password) => run(async () => {
    const { user: u } = await signInWithEmailAndPassword(auth, email.trim(), password);
    await ensureAccount(u);
  });

  const signUp = (clubName, email, password) => run(async () => {
    creating.current = true;
    try {
      const { user: u } = await createUserWithEmailAndPassword(auth, email.trim(), password);
      await ensureAccount(u, clubName.trim());
    } finally {
      creating.current = false;
    }
  });

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
    return run(async () => {
      const uid = auth.currentUser.uid;
      for (const name of ACCOUNT_COLLECTIONS) await wipeCollection(collection(db, "accounts", uid, name));
      const batch = writeBatch(db);
      batch.delete(doc(db, "accounts", uid));
      await batch.commit();
      await deleteUser(auth.currentUser);
    });
  };

  return {
    status, user, account, hasPassword: user ? hasPasswordProvider(user) : false,
    signIn, signUp, signInGoogle, resetPassword, signOutUser: () => signOut(auth),
    updateAccount, changePassword, deleteAccount,
  };
}
