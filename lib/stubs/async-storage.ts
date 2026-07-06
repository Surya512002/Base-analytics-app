/** Web stub — MetaMask SDK optionally imports React Native async-storage. */
const storage = {
  getItem: async (key: string) =>
    typeof window !== "undefined" ? window.localStorage.getItem(key) : null,
  setItem: async (key: string, value: string) => {
    if (typeof window !== "undefined") window.localStorage.setItem(key, value);
  },
  removeItem: async (key: string) => {
    if (typeof window !== "undefined") window.localStorage.removeItem(key);
  },
};

export default storage;
