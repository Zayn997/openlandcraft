import { parseProject, type Project } from '@openlandcraft/core';

export const LOCAL_PROJECT_KEY = 'current-project';
export const MAX_PROJECT_BYTES = 40 * 1024 * 1024;

export function serializeProject(project: Project): string {
  const text = JSON.stringify(parseProject(project), null, 2);
  if (new TextEncoder().encode(text).length > MAX_PROJECT_BYTES) throw new Error('This project exceeds the 40 MB limit. Remove unused models.');
  return text;
}
export function deserializeProject(text: string): Project {
  if (new TextEncoder().encode(text).length > MAX_PROJECT_BYTES) throw new Error('This project exceeds the 40 MB limit.');
  let value: unknown;
  try { value = JSON.parse(text); } catch { throw new Error('This file is not valid JSON. Open an .olc.json project.'); }
  return parseProject(value);
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('openlandcraft', 1);
    request.onupgradeneeded = () => { request.result.createObjectStore('projects'); };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('Local storage could not be opened. Export your project to keep a copy.'));
  });
}
export async function saveLocal(project: Project): Promise<void> {
  const text = serializeProject(project);
  const db = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('projects', 'readwrite');
      tx.objectStore('projects').put(text, LOCAL_PROJECT_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(new Error('Local save failed. Export your project and check browser storage.'));
      tx.onabort = () => reject(new Error('Local save was interrupted. Export a copy.'));
    });
  } finally { db.close(); }
}
export async function loadLocal(): Promise<Project | null> {
  const db = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction('projects', 'readonly');
      const request = tx.objectStore('projects').get(LOCAL_PROJECT_KEY);
      request.onsuccess = () => {
        try { resolve(request.result === undefined ? null : deserializeProject(request.result)); }
        catch (error) { reject(error); }
      };
      request.onerror = () => reject(new Error('The local project could not be read.'));
    });
  } finally { db.close(); }
}
