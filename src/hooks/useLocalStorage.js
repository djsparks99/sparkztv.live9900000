import { useState, useEffect } from "react";

/**
 * A custom hook to synchronize state with window.localStorage.
 * Automatically synchronizes if the key changes.
 * 
 * @param {string} key The localStorage key
 * @param {any} initialValue The fallback initial value
 * @returns {[any, Function]} The stateful value and a function to update it
 */
export function useLocalStorage(key, initialValue) {
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error("Error reading localStorage key:", key, error);
      return initialValue;
    }
  });

  // When key changes, re-fetch from localStorage
  useEffect(() => {
    try {
      const item = window.localStorage.getItem(key);
      setStoredValue(item ? JSON.parse(item) : initialValue);
    } catch (error) {
      console.error("Error reading localStorage key on update:", key, error);
      setStoredValue(initialValue);
    }
  }, [key]);

  const setValue = (value) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.error("Error setting localStorage key:", key, error);
    }
  };

  return [storedValue, setValue];
}
