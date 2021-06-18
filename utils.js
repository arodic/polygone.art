import path from "path";
import { promises as fs } from "fs";

export const API_KEY = "[get your own API key]";
export const API_URL = "https://poly.googleapis.com/v1/assets";
export const POLY_VIEW_URL = "https://poly.google.com/view";

export const ASSETS_FILENAME = 'assets.json';
export const USERS_FILENAME = 'users.json';
export const TAGS_FILENAME = 'tags.json';

export async function fileOrFolderExists(pathName) {
  try {
    await fs.access(pathName);
    return true;
  } catch {
    return false;
  }
}

export async function createDirectory(pathname) {
  if (!pathname.endsWith('/')) pathname = path.dirname(pathname);
  if (await fileOrFolderExists(pathname) === false) {
    await fs.mkdir(path.resolve(pathname), { recursive: true });
  }
}
