"use client";
import React, { createContext, useEffect, useState } from "react";
import Store from "@/store/store";
import $api from "@/http";

interface State {
  store: Store;
}

export const store = new Store();
export const Context = createContext<State>({ store });

export const StoreProvider = ({ children }: { children: React.ReactNode }) => {
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (token) $api.defaults.headers.common["Authorization"] = `Bearer ${token}`;

    (async () => {
      try {
        await store.checkAuth();
      } catch (e) {
      } finally {
        setInitialized(true);
      }
    })();
  }, []);

  if (!initialized) {
    return (
      <div style={{width: '100%', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
        <div>Загрузка...</div>
      </div>
    );
  }

  return <Context.Provider value={{ store }}>{children}</Context.Provider>;
};
